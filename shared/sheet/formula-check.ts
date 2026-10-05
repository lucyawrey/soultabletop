// Static checks for a parsed formula: unknown functions, argument counts,
// types that can never work, and the result type. Paths are resolved by the
// host (the sheet validator, through the content type schema), so this file
// knows nothing about schemas. See formula.ts.

import {
  arrayOf,
  couldBe,
  describeType,
  formulaLimits,
  formulaTypes,
  typeMembers,
  type FormulaNode,
  type FormulaType,
} from "./formula";
import {
  describeArity,
  diceNotAvailable,
  formulaFunctions,
  resolveFormulaCall,
} from "./formula-functions";
import type { Loc, SheetDiagnostic, SheetPath } from "./parser";

export interface FormulaCheckHost<S> {
  // The type a path has in `scope`, and the scope it leads to (for lists).
  // Undefined when the path is broken; the host reports that itself.
  resolve(
    path: SheetPath,
    text: string,
    scope: S,
    loc: Loc,
  ): { type: FormulaType; scope?: S } | undefined;
  // The scope of one item of a list (`list` is undefined when the list isn't
  // a path, e.g. a parameter).
  itemScope(list: S | undefined): S;
  // A struct `list` whose entries a per-item function can repeat over (all
  // alike), with the type of one entry.
  structEntries?(list: S): { entries: { key: string; label: string }[]; type: FormulaType } | undefined;
  // What kind of row `scope` is (List or Table row, or a per-item function's
  // item), or undefined outside one.
  itemKind?(scope: S): "array" | "struct" | "unknown" | undefined;
  // The sheet's definition by this name.
  definition(name: string): { params: readonly string[]; type: FormulaType } | undefined;
  // Inside a definition: its parameters' types.
  params?: Readonly<Record<string, FormulaType>>;
}

export interface FormulaCheckResult {
  type: FormulaType;
  diagnostics: SheetDiagnostic[];
  // The sheet's definitions this formula calls (for cycle checks).
  calls: string[];
}

interface Checked<S> {
  type: FormulaType;
  scope?: S;
}

const arithmeticOps = new Set(["+", "-", "*", "/", "%"]);

// Kinds a type is definitely made of, or undefined if it could be anything.
function definiteKinds(type: FormulaType) {
  const kinds = new Set<string>();
  for (const member of typeMembers(type)) {
    if (member.kind === "any" || member.kind === "null") return undefined;
    kinds.add(member.kind);
  }
  return kinds;
}

class Checker<S> {
  readonly diagnostics: SheetDiagnostic[] = [];
  readonly calls = new Set<string>();

  constructor(private readonly host: FormulaCheckHost<S>) {}

  private error(code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity: "error", code, message, loc });
  }

  private expect(type: FormulaType, kinds: Parameters<typeof couldBe>[1], message: string, loc: Loc) {
    if (!couldBe(type, kinds)) this.error("formula-type", `${message}, not ${describeType(type)}`, loc);
  }

  check(node: FormulaNode, scope: S, itemDepth: number): Checked<S> {
    switch (node.type) {
      case "number":
        return { type: formulaTypes.number };
      case "string":
        return { type: formulaTypes.string };
      case "boolean":
        return { type: formulaTypes.boolean };
      case "null":
        return { type: formulaTypes.null };
      case "dice":
        this.error("formula-dice", diceNotAvailable, node.loc);
        return { type: formulaTypes.any };
      case "param":
        return { type: this.host.params?.[node.name] ?? formulaTypes.any };
      case "path": {
        const resolved = this.host.resolve(node.path, node.text, scope, node.loc);
        return resolved ?? { type: formulaTypes.any };
      }
      case "unary": {
        const operand = this.check(node.operand, scope, itemDepth).type;
        if (node.op === "not") {
          this.expect(operand, ["boolean"], "not needs true or false", node.operand.loc);
          return { type: formulaTypes.boolean };
        }
        this.expect(operand, ["number"], "- needs a number", node.operand.loc);
        return { type: formulaTypes.number };
      }
      case "binary": {
        const left = this.check(node.left, scope, itemDepth).type;
        const right = this.check(node.right, scope, itemDepth).type;
        const { op } = node;
        if (op === "and" || op === "or") {
          this.expect(left, ["boolean"], `${op} needs true or false`, node.left.loc);
          this.expect(right, ["boolean"], `${op} needs true or false`, node.right.loc);
          return { type: formulaTypes.boolean };
        }
        if (op === "==" || op === "!=") {
          let reported = false;
          for (const [type, side] of [[left, node.left], [right, node.right]] as const) {
            const kinds = definiteKinds(type);
            if (kinds && [...kinds].every((kind) => kind === "array" || kind === "record")) {
              this.error("formula-type", `${op} compares single values, not ${describeType(type)}`, side.loc);
              reported = true;
            }
          }
          if (reported) return { type: formulaTypes.boolean };
          const leftKinds = definiteKinds(left);
          const rightKinds = definiteKinds(right);
          if (leftKinds && rightKinds && ![...leftKinds].some((kind) => rightKinds.has(kind))) {
            this.error(
              "formula-type",
              `${op} compares ${describeType(left)} with ${describeType(right)}, which are never equal`,
              node.loc,
            );
          }
          return { type: formulaTypes.boolean };
        }
        for (const [type, side] of [[left, node.left], [right, node.right]] as const) {
          const hint = op === "+" && !couldBe(type, ["number"]) && couldBe(type, ["string"])
            ? " (use concat to join text)"
            : "";
          if (!couldBe(type, ["number"]))
            this.error("formula-type", `${op} needs numbers${hint}, not ${describeType(type)}`, side.loc);
        }
        return { type: arithmeticOps.has(op) ? formulaTypes.number : formulaTypes.boolean };
      }
      case "call":
        return { type: this.call(node, scope, itemDepth) };
    }
  }

  private call(
    node: Extract<FormulaNode, { type: "call" }>,
    scope: S,
    itemDepth: number,
  ): FormulaType {
    const target = resolveFormulaCall(node.name, (name) => !!this.host.definition(name));

    if (target === "dice") {
      this.error("formula-dice", diceNotAvailable, node.nameLoc);
      return formulaTypes.any;
    }
    if (target === "unknown") {
      this.error("formula-unknown-function", `There's no function named ${node.name}`, node.nameLoc);
      for (const arg of node.args) this.check(arg, scope, itemDepth);
      return formulaTypes.any;
    }
    if (target === "definition") {
      const definition = this.host.definition(node.name)!;
      this.calls.add(node.name);
      const count = definition.params.length;
      if (node.args.length !== count) {
        this.error(
          "formula-arity",
          `${node.name} ${describeArity(count, count)} (${definition.params.join(", ") || "none"})`,
          node.loc,
        );
      }
      for (const arg of node.args) this.check(arg, scope, itemDepth);
      return definition.type;
    }

    const fn = formulaFunctions.get(node.name)!;
    if (node.args.length < fn.minArgs || node.args.length > fn.maxArgs) {
      this.error("formula-arity", `${fn.name} ${describeArity(fn.minArgs, fn.maxArgs)}: ${fn.signature}`, node.loc);
    }
    if (fn.item) {
      const kind = this.host.itemKind?.(scope);
      if (!kind) {
        this.error(
          "formula-no-item",
          `${fn.name}() works only in a List or Table row, or inside sum, count, any, or all`,
          node.loc,
        );
        return formulaTypes.any;
      }
      return kind === "unknown" ? formulaTypes.any : fn.item[kind];
    }
    const types: FormulaType[] = [];
    let listScope: S | undefined;
    node.args.forEach((arg, index) => {
      if (fn.itemArgs?.includes(index)) {
        const depth = itemDepth + 1;
        if (depth > formulaLimits.maxItemNesting) {
          this.error(
            "formula-too-large",
            `Per-item functions like sum and count can be nested at most ${formulaLimits.maxItemNesting} levels deep`,
            node.loc,
          );
        }
        types.push(this.check(arg, this.host.itemScope(listScope), depth).type);
        return;
      }
      const checked = this.check(arg, scope, itemDepth);
      if (index === 0) listScope = checked.scope;
      // A struct a per-item function repeats over: the evaluator walks its
      // schema entries, which it can't know, so they go on the path.
      const struct =
        index === 0 && fn.itemArgs && arg.type === "path" && checked.scope !== undefined
          ? this.host.structEntries?.(checked.scope)
          : undefined;
      if (struct && arg.type === "path") {
        arg.entries = struct.entries;
        types.push(arrayOf(struct.type));
        return;
      }
      types.push(checked.type);
    });
    fn.check?.(types, {
      report: (index, message) => this.error("formula-type", message, node.args[index]?.loc ?? node.loc),
    });
    return fn.result(types);
  }
}

// Checks a formula in `scope`. Diagnostics from the host's path resolution
// are the host's; these are the formula's own.
export function checkFormula<S>(
  ast: FormulaNode,
  host: FormulaCheckHost<S>,
  scope: S,
): FormulaCheckResult {
  const checker = new Checker(host);
  const { type } = checker.check(ast, scope, 0);
  return { type, diagnostics: checker.diagnostics, calls: [...checker.calls] };
}
