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
  diceNotHere,
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
  // The scope of a list whose items have scope `item` (what filter and sort
  // give back, an array even when they repeated over a struct).
  listScope?(item: S): S | undefined;
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
  // A <Roll>'s formula: dice and dice(text) are allowed (in arithmetic and
  // the branches of if).
  dice?: boolean;
  // Inside an action on a value tag: the type of the value it shows, which
  // value() gives. Undefined elsewhere (value() is then an error).
  shown?: FormulaType;
  // Parameters that are named rolls (`hit`): read their fields, like hit.total.
  rolls?: ReadonlySet<string>;
}

// The fields of a named roll (a <Roll name="…">), for later steps.
export const rollRecordFields: Readonly<Record<string, FormulaType>> = {
  total: formulaTypes.number,
  dice: arrayOf(formulaTypes.number),
  natural: formulaTypes.number,
  crit: formulaTypes.boolean,
  fumble: formulaTypes.boolean,
};

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

  // A named roll used where a single value is needed: point at its fields.
  private rollAsValue(node: FormulaNode, op: string) {
    if (node.type !== "param" || !this.host.rolls?.has(node.name)) return false;
    this.error(
      "roll-record-as-number",
      `${op} needs a number, but ${node.name} is a roll; use ${node.name}.total for its result`,
      node.loc,
    );
    return true;
  }

  // `dice`: whether dice may be rolled at this spot (a <Roll>'s formula, in
  // arithmetic or an if branch).
  check(node: FormulaNode, scope: S, itemDepth: number, dice = false): Checked<S> {
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
        if (!this.host.dice) this.error("dice-outside-roll", diceNotAvailable, node.loc);
        else if (!dice) this.error("dice-outside-roll", diceNotHere, node.loc);
        return { type: formulaTypes.number };
      case "param":
        return { type: this.host.params?.[node.name] ?? formulaTypes.any };
      case "path": {
        const resolved = this.host.resolve(node.path, node.text, scope, node.loc);
        return resolved ?? { type: formulaTypes.any };
      }
      case "unary": {
        const operand = this.check(node.operand, scope, itemDepth, dice && node.op === "-").type;
        if (node.op === "not") {
          this.expect(operand, ["boolean"], "not needs true or false", node.operand.loc);
          return { type: formulaTypes.boolean };
        }
        if (!this.rollAsValue(node.operand, "-")) this.expect(operand, ["number"], "- needs a number", node.operand.loc);
        return { type: formulaTypes.number };
      }
      case "binary": {
        const { op } = node;
        const diceHere = dice && (op === "+" || op === "-" || op === "*" || op === "/");
        const left = this.check(node.left, scope, itemDepth, diceHere).type;
        const right = this.check(node.right, scope, itemDepth, diceHere).type;
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
          if (!couldBe(type, ["number"]) && !this.rollAsValue(side, op))
            this.error("formula-type", `${op} needs numbers${hint}, not ${describeType(type)}`, side.loc);
        }
        return { type: arithmeticOps.has(op) ? formulaTypes.number : formulaTypes.boolean };
      }
      case "call":
        return this.call(node, scope, itemDepth, dice);
      case "member": {
        // A named roll's field: hit.total, hit.dice, hit.natural, hit.crit, hit.fumble.
        if (node.target.type === "param" && this.host.rolls?.has(node.target.name)) {
          const [field, ...more] = node.path.segments;
          const type = field !== undefined && !more.length && !node.path.absolute ? rollRecordFields[field] : undefined;
          if (!type) {
            this.error(
              "formula-type",
              `${node.target.name} is a roll; it has total, dice, natural, crit, and fumble, not ${node.text.slice(1)}`,
              node.loc,
            );
            return { type: formulaTypes.any };
          }
          return { type };
        }
        const target = this.check(node.target, scope, itemDepth);
        const kinds = definiteKinds(target.type);
        if (kinds?.has("array") && kinds.size === 1) {
          this.error(
            "formula-type",
            `${node.text} needs one item, not a list; pick one with first or at`,
            node.loc,
          );
          return { type: formulaTypes.any };
        }
        if (!couldBe(target.type, ["record", "string"])) {
          this.error("formula-type", `${node.text} needs a group of fields, not ${describeType(target.type)}`, node.loc);
          return { type: formulaTypes.any };
        }
        // Checked against the schema like a path in a List row of the items.
        if (target.scope !== undefined) {
          return this.host.resolve(node.path, node.text, target.scope, node.loc) ?? { type: formulaTypes.any };
        }
        return { type: formulaTypes.any };
      }
    }
  }

  private call(
    node: Extract<FormulaNode, { type: "call" }>,
    scope: S,
    itemDepth: number,
    dice: boolean,
  ): Checked<S> {
    const target = resolveFormulaCall(node.name, (name) => !!this.host.definition(name));

    // dice(text): rolls the dice written in a text value, like a field
    // holding "2d8 + 3".
    if (target === "dice" && node.name === "dice" && this.host.dice) {
      if (!dice) this.error("dice-outside-roll", diceNotHere, node.nameLoc);
      if (node.args.length !== 1) this.error("formula-arity", "dice takes 1 argument: dice(text)", node.loc);
      for (const arg of node.args) {
        const type = this.check(arg, scope, itemDepth).type;
        this.expect(type, ["string"], "dice needs text, like '2d6 + 3'", arg.loc);
      }
      return { type: formulaTypes.number };
    }
    if (target === "dice") {
      this.error("dice-outside-roll", diceNotAvailable, node.nameLoc);
      return { type: formulaTypes.any };
    }
    // value(): the value of the tag an action is on.
    if (target === "unknown" && node.name === "value") {
      if (node.args.length) this.error("formula-arity", "value takes no arguments", node.loc);
      if (this.host.shown === undefined) {
        this.error(
          "value-outside-value",
          "value() works only in a step (Roll, Set, FollowUp) inside a <Value>, <Number>, or <Column>",
          node.loc,
        );
        return { type: formulaTypes.any };
      }
      return { type: this.host.shown };
    }
    if (target === "unknown") {
      this.error("formula-unknown-function", `There's no function named ${node.name}`, node.nameLoc);
      for (const arg of node.args) this.check(arg, scope, itemDepth);
      return { type: formulaTypes.any };
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
      return { type: definition.type };
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
          `${fn.name}() works only in a List or Table row, or inside a per-item function like sum or filter`,
          node.loc,
        );
        return { type: formulaTypes.any };
      }
      return { type: kind === "unknown" ? formulaTypes.any : fn.item[kind] };
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
      const checked = this.check(arg, scope, itemDepth, dice && fn.name === "if" && index > 0);
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
    const type = fn.result(types);
    if (!fn.resultScope || listScope === undefined) return { type };
    const item = this.host.itemScope(listScope);
    return { type, scope: fn.resultScope === "item" ? item : this.host.listScope?.(item) };
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
  const { type } = checker.check(ast, scope, 0, host.dice ?? false);
  return { type, diagnostics: checker.diagnostics, calls: [...checker.calls] };
}
