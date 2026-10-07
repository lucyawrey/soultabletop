import { describe, expect, it } from "vitest";
import {
  arrayOf,
  formulaTypes,
  parseFormula,
  scalarType,
  unionOf,
  type FormulaType,
} from "./formula";
import { checkFormula, type FormulaCheckHost } from "./formula-check";
import { resolveFormulaCall } from "./formula-functions";

// Scopes are names; paths are looked up as "<scope>:<path>".
const types: Record<string, FormulaType> = {
  "root:level": formulaTypes.number,
  "root:name": formulaTypes.string,
  "root:flag": formulaTypes.boolean,
  "root:value": scalarType,
  "root:notes": formulaTypes.any,
  "root:stats": formulaTypes.record,
  "root:tags": arrayOf(formulaTypes.string),
  "root:nums": arrayOf(formulaTypes.number),
  "root:inventory": arrayOf(formulaTypes.record),
  "root:groups": arrayOf(formulaTypes.record),
  "inventory:qty": formulaTypes.number,
  "inventory:label": formulaTypes.string,
  "groups:members": arrayOf(formulaTypes.record),
  "members:hp": formulaTypes.number,
  "members:rolls": arrayOf(formulaTypes.number),
};

const definitions: Record<string, { params: string[]; type: FormulaType }> = {
  pb: { params: [], type: formulaTypes.number },
  prof: { params: ["rank"], type: formulaTypes.number },
  title: { params: [], type: formulaTypes.string },
};

const host: FormulaCheckHost<string> = {
  resolve(path, text, scope) {
    const key = `${path.absolute ? "root" : scope}:${path.segments.join(".")}`;
    const type = types[key];
    if (!type) return undefined;
    const list = path.segments.at(-1)!;
    return { type, scope: list };
  },
  itemScope: (list) => list ?? "unknown",
  // A list's items and the list share a name here.
  listScope: (item) => item,
  definition: (name) => definitions[name],
};

function check(source: string, scope = "root", params?: string[]) {
  const { ast, diagnostics } = parseFormula(source, { line: 1, column: 1, offset: 0 }, { params });
  expect(diagnostics).toEqual([]);
  const paramTypes = params && Object.fromEntries(params.map((name) => [name, formulaTypes.any]));
  return checkFormula(ast!, { ...host, params: paramTypes }, scope);
}

function messages(source: string) {
  return check(source).diagnostics.map((item) => `${item.code}: ${item.message}`);
}

describe("result types", () => {
  it.each([
    ["1 + level", formulaTypes.number],
    ["level > 1", formulaTypes.boolean],
    ["name == 'x'", formulaTypes.boolean],
    ["not flag", formulaTypes.boolean],
    ["-level", formulaTypes.number],
    ["'a'", formulaTypes.string],
    ["null", formulaTypes.null],
    ["name", formulaTypes.string],
    ["unknown.path", formulaTypes.any],
    ["if(flag, 1, 'a')", unionOf(formulaTypes.number, formulaTypes.string)],
    ["coalesce(level, 0)", formulaTypes.number],
    ["switch(level, 1, 'a', 2, 'b')", unionOf(formulaTypes.string, formulaTypes.null)],
    ["switch(level, 1, 'a', 0)", unionOf(formulaTypes.string, formulaTypes.number)],
    ["sum(nums)", formulaTypes.number],
    ["any(inventory, qty > 1)", formulaTypes.boolean],
    ["concat(name, level)", formulaTypes.string],
    ["get(stats, 'x')", formulaTypes.any],
    ["pb()", formulaTypes.number],
    ["title()", formulaTypes.string],
    ["tags", arrayOf(formulaTypes.string)],
  ])("%s", (source, type) => {
    const result = check(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.type).toEqual(type);
  });
});

describe("type errors", () => {
  it.each([
    ["name + 1", "formula-type: + needs numbers (use concat to join text), not text"],
    ["1 - flag", "formula-type: - needs numbers, not true or false"],
    ["stats * 2", "formula-type: * needs numbers, not a group of fields"],
    ["-name", "formula-type: - needs a number, not text"],
    ["not level", "formula-type: not needs true or false, not a number"],
    ["level and flag", "formula-type: and needs true or false, not a number"],
    ["level == 'x'", "formula-type: == compares a number with text, which are never equal"],
    ["tags == 1", "formula-type: == compares single values, not a list"],
    ["floor(name)", "formula-type: floor needs a number, not text"],
    ["sum(level)", "formula-type: sum needs a list, not a number"],
    ["sum(tags)", "formula-type: sum needs a list of numbers, not of text; add a second argument, like sum(list, field)"],
    ["sum(inventory)", "formula-type: sum needs a list of numbers, not of a group of fields; add a second argument, like sum(list, field)"],
    ["sum(inventory, label)", "formula-type: sum needs numbers for each item, not text"],
    ["count(inventory, qty)", "formula-type: count needs true or false for each item, not a number"],
    ["min(name, 1)", "formula-type: min needs numbers, not text"],
    ["max(tags)", "formula-type: max needs numbers, not text"],
    ["length(level)", "formula-type: length needs text or a list, not a number"],
    ["if(level, 1, 2)", "formula-type: if needs true or false, not a number"],
    ["get(level, 'a')", "formula-type: get needs a group of fields, not a number"],
    ["join(tags, 1)", "formula-type: join needs text as its separator, not a number"],
    ["concat(flag)", "formula-type: concat needs text or numbers, not true or false"],
  ])("%s", (source, message) => {
    expect(messages(source)).toEqual([message]);
  });

  it("accepts anything that could work", () => {
    for (const source of [
      "value + 1",
      "notes + 1",
      "notes and flag",
      "value == 'x'",
      "level == null",
      "null + 1",
      "sum(notes)",
      "get(notes, 'x') + 1",
      "prof(1) + pb()",
    ]) {
      expect(messages(source), source).toEqual([]);
    }
  });
});

describe("calls", () => {
  it.each([
    ["floor()", "formula-arity: floor takes 1 argument: floor(x)"],
    ["round(1, 2, 3)", "formula-arity: round takes 1 or 2 arguments: round(x, digits?)"],
    ["if(flag, 1)", "formula-arity: if takes 3 arguments: if(cond, then, else)"],
    ["switch(level, 1)", "formula-arity: switch takes at least 3 arguments: switch(value, case1, result1, …, default?)"],
    ["prof()", "formula-arity: prof takes 1 argument (rank)"],
    ["pb(1)", "formula-arity: pb takes 0 arguments (none)"],
    ["nope(1)", "formula-unknown-function: There's no function named nope"],
    ["roll(1)", "dice-outside-roll: Dice can only be rolled in a <Roll>'s formula"],
    ["2d6 + 1", "dice-outside-roll: Dice can only be rolled in a <Roll>'s formula"],
  ])("%s", (source, message) => {
    expect(messages(source)).toEqual([message]);
  });

  it("lists the definitions a formula calls", () => {
    expect(check("pb() + prof(level) + floor(pb())").calls).toEqual(["pb", "prof"]);
  });

  it("checks per-item arguments in the item's scope", () => {
    expect(messages("sum(inventory, qty)")).toEqual([]);
    expect(messages("sum(groups, sum(members, hp))")).toEqual([]);
    expect(messages("sum(inventory, /level)")).toEqual([]);
    // `qty` isn't a field of the top level.
    expect(check("qty").type).toEqual(formulaTypes.any);
  });

  it("limits nesting of per-item functions", () => {
    expect(messages("sum(groups, sum(members, sum(rolls)))")).toEqual([]);
    expect(messages("sum(groups, sum(members, sum(rolls, .)))")).toEqual([
      "formula-too-large: Per-item functions like sum and count can be nested at most 2 levels deep",
    ]);
  });

  it("resolves names: first-version built-ins, then definitions, then later built-ins", () => {
    const hasDefinition = (name: string) => ["floor", "mine", "newer"].includes(name);
    expect(resolveFormulaCall("floor", hasDefinition)).toBe("builtin");
    expect(resolveFormulaCall("mine", hasDefinition)).toBe("definition");
    expect(resolveFormulaCall("roll", hasDefinition)).toBe("dice");
    expect(resolveFormulaCall("other", hasDefinition)).toBe("unknown");
    // A built-in added later loses to a sheet's own definition.
    expect(resolveFormulaCall("sum", hasDefinition, ["sum"])).toBe("builtin");
    expect(resolveFormulaCall("sum", (name) => name === "sum", ["sum"])).toBe("definition");
  });

  it("types parameters inside definitions", () => {
    expect(check("rank + 1", "root", ["rank"]).diagnostics).toEqual([]);
    expect(check("concat(rank)", "root", ["rank"]).type).toEqual(formulaTypes.string);
  });

  it("types list(...) by its items", () => {
    expect(check("list(level, 2)").type).toEqual(arrayOf(formulaTypes.number));
    expect(check("list(level, name)").type).toEqual(
      arrayOf(unionOf(formulaTypes.number, formulaTypes.string)),
    );
    expect(messages("join(list(name, level), ', ')")).toEqual([]);
    expect(messages("sum(list(level, 1))")).toEqual([]);
    expect(messages("sum(list(name, 1))")).toEqual([]);
    expect(messages("list(stats)")).toEqual([
      "formula-type: list needs single values, not a group of fields",
    ]);
    expect(messages("max(list(name))")).toEqual([
      "formula-type: max needs numbers, not text",
    ]);
  });

  it("types map, filter, sort, first, and at", () => {
    expect(check("map(inventory, qty)").type).toEqual(arrayOf(formulaTypes.number));
    expect(check("filter(tags, . != 'x')").type).toEqual(arrayOf(formulaTypes.string));
    expect(check("sort(nums, ., true)").type).toEqual(arrayOf(formulaTypes.number));
    expect(check("first(tags)").type).toEqual(unionOf(formulaTypes.string, formulaTypes.null));
    expect(check("at(nums, -1)").type).toEqual(unionOf(formulaTypes.number, formulaTypes.null));
    expect(messages("join(map(inventory, label), ', ')")).toEqual([]);
    expect(messages("sum(filter(inventory, qty > 1), qty)")).toEqual([]);
  });

  it("checks paths on call results against the items", () => {
    expect(check("first(inventory).qty").type).toEqual(formulaTypes.number);
    expect(check("first(filter(inventory, qty > 1), qty < 5).label").type).toEqual(formulaTypes.string);
    expect(check("at(sort(inventory, qty), 0).qty").type).toEqual(formulaTypes.number);
    // Without a scope (a definition's result), nothing is known about it.
    expect(check("title().x").type).toEqual(formulaTypes.any);
  });

  it.each([
    ["map(groups, members)", "formula-type: map needs a single value for each item, not a list"],
    ["map(level, 1)", "formula-type: map needs a list, not a number"],
    ["filter(inventory, qty)", "formula-type: filter needs true or false for each item, not a number"],
    ["sort(inventory)", "formula-type: sort needs a list of numbers or text, not of a group of fields; add a second argument, like sort(list, field)"],
    ["sort(inventory, qty > 1)", "formula-type: sort needs numbers or text for each item, not true or false"],
    ["sort(tags, ., 1)", "formula-type: sort needs true or false as descending, not a number"],
    ["first(level)", "formula-type: first needs a list, not a number"],
    ["first(inventory, qty)", "formula-type: first needs true or false for each item, not a number"],
    ["at(tags, name)", "formula-type: at needs a number as its index, not text"],
    ["pb().x", "formula-type: .x needs a group of fields, not a number"],
    ["filter(inventory, true).qty", "formula-type: .qty needs one item, not a list; pick one with first or at"],
    ["map(sort(inventory, qty), qty).x", "formula-type: .x needs one item, not a list; pick one with first or at"],
  ])("%s", (source, message) => {
    expect(messages(source)).toEqual([message]);
  });

  it("points at the argument that's wrong", () => {
    const [diagnostic] = check("max(1, name)").diagnostics;
    expect(diagnostic!.loc).toEqual({
      start: { line: 1, column: 8, offset: 7 },
      end: { line: 1, column: 12, offset: 11 },
    });
  });
});
