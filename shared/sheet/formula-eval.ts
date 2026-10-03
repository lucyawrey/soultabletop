// Evaluates a parsed formula against Content data. Never throws: problems
// become FormulaError values, and the work per evaluation is bounded by a step
// budget. Reads plain values (the renderer passes Vue's reactive data; reading
// it gives dependency tracking, but nothing here imports Vue). See formula.ts.

import {
  formulaLimits,
  FormulaError,
  isFormulaError,
  toFormulaValue,
  type FormulaBinaryOp,
  type FormulaNode,
  type FormulaValue,
} from "./formula";
import {
  conditionValue,
  diceNotAvailable,
  formulaDiceNames,
  formulaEquals,
  formulaFunctions,
  formulaLaterBuiltins,
  type FormulaCallContext,
  type FormulaFunction,
} from "./formula-functions";
import { itemScopes, resolveSheetPath, type SheetRefs, type SheetScope } from "./scope";

export interface FormulaBudget {
  steps: number;
}

export function formulaBudget(): FormulaBudget {
  return { steps: formulaLimits.maxSteps };
}

export interface FormulaEnv {
  root: SheetScope;
  scope: SheetScope;
  refs: SheetRefs;
  // Inside a definition: its arguments by parameter name.
  params?: Readonly<Record<string, FormulaValue>>;
  // Calls the sheet's definition `name`, or returns undefined if the sheet has
  // none by that name. See callFormulaDefinition.
  call(name: string, args: FormulaValue[]): FormulaValue | undefined;
  // Shared by everything one evaluation computes, definitions included.
  budget: FormulaBudget;
  // Definitions entered so far.
  depth?: number;
}

export interface FormulaDefinition {
  params: readonly string[];
  ast: FormulaNode;
}

const budgetError = () =>
  new FormulaError("budget", "This formula takes too many steps to compute");

function step(env: FormulaEnv) {
  env.budget.steps -= 1;
  return env.budget.steps >= 0;
}

function typeError(op: string, wanted: string, value: FormulaValue) {
  const describe =
    value === null
      ? "nothing"
      : Array.isArray(value)
        ? "a list"
        : typeof value === "number"
          ? "a number"
          : typeof value === "string"
            ? "text"
            : typeof value === "boolean"
              ? "true or false"
              : "a group of fields";
  return new FormulaError("type", `${op} needs ${wanted}, not ${describe}`);
}

function arithmetic(op: FormulaBinaryOp, left: number, right: number): FormulaValue {
  let result: number;
  switch (op) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "*":
      result = left * right;
      break;
    case "/":
    case "%":
      if (right === 0) return new FormulaError("division-by-zero", "Division by zero");
      result = op === "/" ? left / right : left % right;
      break;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    default:
      return left >= right;
  }
  return Number.isFinite(result)
    ? result
    : new FormulaError("not-finite", "The result is too large to show");
}

function evaluateBinary(
  node: Extract<FormulaNode, { type: "binary" }>,
  env: FormulaEnv,
): FormulaValue {
  const { op } = node;
  if (op === "and" || op === "or") {
    const left = conditionValue(op, evaluateNode(node.left, env));
    if (isFormulaError(left)) return left;
    if (op === "and" ? !left : left) return left;
    return conditionValue(op, evaluateNode(node.right, env));
  }

  const left = evaluateNode(node.left, env);
  if (isFormulaError(left)) return left;
  const right = evaluateNode(node.right, env);
  if (isFormulaError(right)) return right;

  if (op === "==" || op === "!=") {
    for (const value of [left, right]) {
      if (value !== null && typeof value === "object")
        return typeError(op, "single values", value);
    }
    return formulaEquals(left, right) === (op === "==");
  }

  for (const value of [left, right]) {
    if (value !== null && typeof value !== "number") {
      const wanted = op === "+" && typeof value === "string"
        ? "numbers (use concat to join text)"
        : "numbers";
      return typeError(op, wanted, value);
    }
  }
  if (left === null || right === null) return null;
  return arithmetic(op, left as number, right as number);
}

// A list argument as a scope, so its items can be scopes too.
function listScope(node: FormulaNode, env: FormulaEnv): SheetScope | FormulaError {
  if (node.type === "path") {
    if (!step(env)) return budgetError();
    const resolved = resolveSheetPath(node.path, env.root, env.scope, env.refs);
    return resolved.unavailable ? { value: null, path: null } : resolved;
  }
  const value = evaluateNode(node, env);
  if (isFormulaError(value)) return value;
  return { value, path: null };
}

function callBuiltin(
  fn: FormulaFunction,
  node: Extract<FormulaNode, { type: "call" }>,
  env: FormulaEnv,
): FormulaValue {
  if (node.args.length < fn.minArgs || node.args.length > fn.maxArgs) {
    return new FormulaError("arity", `${fn.name} was called with the wrong number of arguments`);
  }
  if (fn.eager) {
    const args: FormulaValue[] = [];
    for (const arg of node.args) {
      const value = evaluateNode(arg, env);
      if (isFormulaError(value)) return value;
      args.push(value);
    }
    return fn.eager(args);
  }

  const context: FormulaCallContext = {
    argCount: node.args.length,
    refs: env.refs,
    value: (index) => evaluateNode(node.args[index]!, env),
    items: (listIndex, exprIndex) => {
      const list = listScope(node.args[listIndex]!, env);
      if (isFormulaError(list)) return list;
      if (list.value === null || list.value === undefined) return [];
      if (!Array.isArray(list.value))
        return typeError(fn.name, "a list", toFormulaValue(list.value));
      const values: FormulaValue[] = [];
      for (const item of itemScopes(list)) {
        if (!step(env)) return budgetError();
        const value =
          exprIndex === undefined
            ? toFormulaValue(item.value)
            : evaluateNode(node.args[exprIndex]!, { ...env, scope: item });
        if (isFormulaError(value)) return value;
        values.push(value);
      }
      return values;
    },
  };
  return fn.special!(context);
}

function evaluateCall(
  node: Extract<FormulaNode, { type: "call" }>,
  env: FormulaEnv,
): FormulaValue {
  // The same order as resolveFormulaCall: a first-version built-in, then the
  // sheet's definition, then a later built-in.
  const builtin = formulaFunctions.get(node.name);
  if (builtin && !formulaLaterBuiltins.includes(node.name)) return callBuiltin(builtin, node, env);
  if (formulaDiceNames.includes(node.name)) return new FormulaError("dice", diceNotAvailable);

  const args: FormulaValue[] = [];
  for (const arg of node.args) {
    const value = evaluateNode(arg, env);
    if (isFormulaError(value)) return value;
    args.push(value);
  }
  const result = env.call(node.name, args);
  if (result !== undefined) return result;
  if (builtin) return callBuiltin(builtin, node, env);
  return new FormulaError("unknown-function", `There's no function named ${node.name}`);
}

// Evaluates a node; lists and records pass through (for aggregates, `get`,
// and definitions). Use evaluateFormula for a formula's final value.
export function evaluateFormulaNode(node: FormulaNode, env: FormulaEnv): FormulaValue {
  if (!step(env)) return budgetError();
  switch (node.type) {
    case "number":
    case "string":
    case "boolean":
      return node.value;
    case "null":
      return null;
    case "dice":
      return new FormulaError("dice", diceNotAvailable);
    case "param":
      return env.params && Object.hasOwn(env.params, node.name)
        ? env.params[node.name]!
        : null;
    case "path": {
      const resolved = resolveSheetPath(node.path, env.root, env.scope, env.refs);
      return resolved.unavailable ? null : toFormulaValue(resolved.value);
    }
    case "unary": {
      const value = evaluateNode(node.operand, env);
      if (isFormulaError(value)) return value;
      if (node.op === "not") {
        const condition = conditionValue("not", value);
        return isFormulaError(condition) ? condition : !condition;
      }
      if (value === null) return null;
      if (typeof value !== "number") return typeError("-", "a number", value);
      return value === 0 ? 0 : -value;
    }
    case "binary":
      return evaluateBinary(node, env);
    case "call":
      return evaluateCall(node, env);
  }
}

const evaluateNode = evaluateFormulaNode;

// Runs a definition's body with its arguments, against the top level.
export function callFormulaDefinition(
  definition: FormulaDefinition,
  args: FormulaValue[],
  env: FormulaEnv,
): FormulaValue {
  const depth = env.depth ?? 0;
  if (depth >= formulaLimits.maxCallDepth) {
    return new FormulaError(
      "too-deep",
      `Definitions call each other more than ${formulaLimits.maxCallDepth} levels deep`,
    );
  }
  const params: Record<string, FormulaValue> = {};
  definition.params.forEach((name, index) => {
    params[name] = args[index] ?? null;
  });
  return evaluateNode(definition.ast, {
    ...env,
    scope: env.root,
    params,
    depth: depth + 1,
  });
}

// A formula's final value: a single value (or nothing), or an error. Never
// throws.
export function evaluateFormula(ast: FormulaNode, env: FormulaEnv): FormulaValue {
  try {
    const value = evaluateNode(ast, env);
    if (Array.isArray(value)) {
      return new FormulaError(
        "not-a-value",
        "The result is a list; use sum, count, or join to make one value of it",
      );
    }
    if (value !== null && typeof value === "object" && !isFormulaError(value)) {
      return new FormulaError(
        "not-a-value",
        "The result is a group of fields; pick one of them, like stats.strength",
      );
    }
    if (typeof value === "string" && value.length > formulaLimits.maxStringLength) {
      return new FormulaError(
        "too-long",
        `Text from a formula can be at most ${formulaLimits.maxStringLength.toLocaleString("en-US")} characters`,
      );
    }
    return value;
  } catch {
    return new FormulaError("internal", "This formula couldn't be computed");
  }
}
