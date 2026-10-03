import { describe, expect, it } from "vitest";
import { FormulaError, formulaLimits, parseFormula, type FormulaValue } from "./formula";
import {
  callFormulaDefinition,
  evaluateFormula,
  formulaBudget,
  type FormulaDefinition,
  type FormulaEnv,
} from "./formula-eval";
import { formatFormulaValue, type SheetRefs, type SheetScope } from "./runtime";

const refs: SheetRefs = {
  "rope-id": { name: "Rope", contentTypeId: "item", data: { bulk: 0.1, tags: ["tool"] } },
  "class-id": { name: "Wizard", contentTypeId: "class", data: { hitDie: 6 } },
};

const data = {
  name: "Violet",
  level: 3,
  zero: 0,
  big: Number(`1${"0".repeat(300)}`),
  text: "12",
  flag: true,
  stats: { str: 2, dex: 3 },
  tags: ["brave", "tired"],
  nums: [1, null, 3],
  empty: [],
  class: "class-id",
  gone: "gone-id",
  inventory: [
    { item: "rope-id", qty: 10 },
    { item: { name: "Sword", bulk: 1 }, qty: 1 },
    { item: "gone-id", qty: 2 },
  ],
  groups: [
    { members: [{ hp: 1 }, { hp: 2 }] },
    { members: [{ hp: 3 }] },
  ],
  rank: "expert",
};

const root: SheetScope = { value: data, path: [] };

const definitionSources: Record<string, { params: string[]; source: string }> = {
  prof: {
    params: ["rank"],
    source:
      "if(rank == 'untrained' or rank == null, 0, level + switch(rank, 'trained', 2, 'expert', 4, 'master', 6, 'legendary', 8, 0))",
  },
  check: { params: ["attr", "rank"], source: "get(stats, attr) + prof(rank)" },
  pb: { params: [], source: "2 + floor((level - 1) / 4)" },
  loop: { params: [], source: "loop() + 1" },
  items: { params: [], source: "inventory" },
};

const definitions = new Map<string, FormulaDefinition>(
  Object.entries(definitionSources).map(([name, { params, source }]) => [
    name,
    { params, ast: parseFormula(source, { line: 1, column: 1, offset: 0 }, { params }).ast! },
  ]),
);

function env(overrides: Partial<FormulaEnv> = {}): FormulaEnv {
  const base: FormulaEnv = {
    root,
    scope: root,
    refs,
    budget: formulaBudget(),
    call(name, args) {
      const definition = definitions.get(name);
      return definition ? callFormulaDefinition(definition, args, this) : undefined;
    },
    ...overrides,
  };
  return base;
}

function evaluate(source: string, overrides: Partial<FormulaEnv> = {}): FormulaValue {
  const { ast, diagnostics } = parseFormula(source, { line: 1, column: 1, offset: 0 });
  expect(diagnostics).toEqual([]);
  return evaluateFormula(ast!, env(overrides));
}

function failure(source: string, overrides: Partial<FormulaEnv> = {}) {
  const value = evaluate(source, overrides);
  expect(value).toBeInstanceOf(FormulaError);
  const { code, message } = value as FormulaError;
  return { code, message };
}

describe("operators", () => {
  it.each([
    ["1 + 2", 3],
    ["7 - 10", -3],
    ["2 * 3", 6],
    ["7 / 2", 3.5],
    ["7 % 3", 1],
    ["-7 % 3", -1],
    ["-level", -3],
    ["-zero", 0],
    ["1 < 2", true],
    ["2 <= 2", true],
    ["3 > 4", false],
    ["3 >= 3", true],
    ["1 == 1", true],
    ["1 == '1'", false],
    ["'a' != 'b'", true],
    ["true == true", true],
    ["null == null", true],
    ["missing == null", true],
    ["0 == null", false],
    ["true and false", false],
    ["true and true", true],
    ["false or true", true],
    ["null or true", true],
    ["null and true", false],
    ["not true", false],
    ["not null", true],
    ["0.1 + 0.2 == 0.3", false],
  ])("%s → %j", (source, value) => {
    expect(evaluate(source)).toBe(value);
  });

  it("passes nothing through arithmetic and ordering", () => {
    expect(evaluate("missing + 1")).toBeNull();
    expect(evaluate("1 * missing")).toBeNull();
    expect(evaluate("missing < 1")).toBeNull();
    expect(evaluate("-missing")).toBeNull();
    expect(evaluate("stats.luck + 1")).toBeNull();
  });

  it("short-circuits and and or", () => {
    expect(evaluate("false and 1 / 0 > 0")).toBe(false);
    expect(evaluate("true or 1 / 0 > 0")).toBe(true);
    expect(failure("true and 1 / 0 > 0").code).toBe("division-by-zero");
  });

  it.each([
    ["'a' + 1", "+ needs numbers (use concat to join text), not text"],
    ["1 - 'a'", "- needs numbers, not text"],
    ["true * 2", "* needs numbers, not true or false"],
    ["stats < 1", "< needs numbers, not a group of fields"],
    ["-name", "- needs a number, not text"],
    ["1 and true", "and needs true or false, not a number"],
    ["false or 'x'", "or needs true or false, not text"],
    ["not 1", "not needs true or false, not a number"],
    ["stats == 1", "== needs single values, not a group of fields"],
    ["tags != 1", "!= needs single values, not a list"],
  ])("%s is a type error", (source, message) => {
    expect(failure(source)).toEqual({ code: "type", message });
  });

  it("reports division by zero and results too large to show", () => {
    expect(failure("1 / 0")).toEqual({ code: "division-by-zero", message: "Division by zero" });
    expect(failure("1 % zero").code).toBe("division-by-zero");
    expect(failure("big * big")).toEqual({ code: "not-finite", message: "The result is too large to show" });
  });

  it("passes errors through operators and calls", () => {
    expect(failure("(1 / 0) + 1").code).toBe("division-by-zero");
    expect(failure("floor(1 / 0)").code).toBe("division-by-zero");
    expect(failure("not (1 / 0 > 1)").code).toBe("division-by-zero");
    expect(failure("-(1 / 0)").code).toBe("division-by-zero");
  });
});

describe("paths", () => {
  it("reads fields, missing fields as nothing, and references", () => {
    expect(evaluate("stats.dex")).toBe(3);
    expect(evaluate("stats.luck")).toBeNull();
    expect(evaluate("level.x")).toBeNull();
    expect(evaluate("class.hitDie")).toBe(6);
    expect(evaluate("class.name")).toBe("Wizard");
    expect(evaluate("gone.name")).toBeNull();
    expect(evaluate("tags.1")).toBe("tired");
  });

  it("resolves relative paths in the scope and / from the top", () => {
    const item: SheetScope = { value: data.inventory[1], path: ["inventory", 1] };
    expect(evaluate("qty", { scope: item })).toBe(1);
    expect(evaluate("item.name", { scope: item })).toBe("Sword");
    expect(evaluate("/level", { scope: item })).toBe(3);
    expect(evaluate("level", { scope: item })).toBeNull();
  });
});

describe("functions", () => {
  it.each([
    ["floor(2.7)", 2],
    ["floor(-2.5)", -3],
    ["ceil(2.1)", 3],
    ["trunc(-2.7)", -2],
    ["abs(-4)", 4],
    ["floor(missing)", null],
    ["round(2.5)", 3],
    ["round(-2.5)", -3],
    ["round(2.4)", 2],
    ["round(1.005, 2)", 1.01],
    ["round(1.25, 1)", 1.3],
    ["round(missing, 1)", null],
    ["clamp(5, 1, 3)", 3],
    ["clamp(-1, 0, 3)", 0],
    ["clamp(2, 0, 3)", 2],
    ["clamp(2, missing, 1)", 1],
    ["clamp(missing, 0, 1)", null],
    ["min(3, 1, 2)", 1],
    ["max(3, 1, 2)", 3],
    ["max(missing, 2)", 2],
    ["min(nums)", 1],
    ["max(nums)", 3],
    ["max(empty)", null],
    ["min(missing)", null],
    ["sum(nums)", 4],
    ["sum(empty)", 0],
    ["sum(missing)", 0],
    ["sum(inventory, qty)", 13],
    ["sum(inventory, qty * coalesce(item.bulk, 0))", 2],
    ["count(nums)", 2],
    ["count(empty)", 0],
    ["count(inventory, qty > 1)", 2],
    ["count(inventory, item.name == null)", 1],
    ["any(inventory, qty > 5)", true],
    ["any(empty, true)", false],
    ["all(inventory, qty > 0)", true],
    ["all(inventory, qty > 1)", false],
    ["all(empty, false)", true],
    ["all(inventory, missing)", false],
    ["sum(groups, sum(members, hp))", 6],
    ["count(groups, any(members, hp > /level - 1))", 1],
    ["length('abc')", 3],
    ["length(tags)", 2],
    ["length(missing)", null],
    ["coalesce(missing, stats.luck, 4, 5)", 4],
    ["coalesce(missing)", null],
    ["concat(name, ' (', level, ')')", "Violet (3)"],
    ["concat('a', missing, 0.1 + 0.2)", "a0.3"],
    ["join(tags, ', ')", "brave, tired"],
    ["join(nums, '+')", "1+3"],
    ["join(missing, ', ')", null],
    ["signed(3)", "+3"],
    ["signed(0)", "0"],
    ["signed(-1)", "-1"],
    ["signed(missing)", null],
    ["number(text) + 1", 13],
    ["number(' -1.5 ')", -1.5],
    ["number('abc')", null],
    ["number(4)", 4],
    ["text(4)", "4"],
    ["text(flag)", "Yes"],
    ["text(missing)", ""],
    ["if(level > 2, 'high', 'low')", "high"],
    ["if(missing, 1, 2)", 2],
    ["if(true, 1, 1 / 0)", 1],
    ["switch(rank, 'trained', 2, 'expert', 4, 0)", 4],
    ["switch(rank, 'trained', 2, 0)", 0],
    ["switch(rank, 'trained', 2)", null],
    ["switch(rank, 'expert', 4, 1 / 0)", 4],
    ["get(stats, 'dex')", 3],
    ["get(stats, 'luck')", null],
    ["get(stats, 'toString')", null],
    ["get(stats, '__proto__')", null],
    ["get(stats, 'constructor')", null],
    ["get(class, 'hitDie')", 6],
    ["get(class, 'name')", "Wizard"],
    ["get(gone, 'name')", null],
    ["get(tags, 1)", "tired"],
    ["get(tags, '0')", "brave"],
    ["get(tags, 5)", null],
    ["get(missing, 'x')", null],
    ["get(stats, missing)", null],
  ])("%s → %j", (source, value) => {
    expect(evaluate(source)).toEqual(value);
  });

  it.each([
    ["floor('a')", "floor needs a number, not text"],
    ["round(1, 1.5)", "round's digits must be a whole number from 0 to 15"],
    ["clamp(1, 'a', 2)", "clamp needs numbers, not text"],
    ["min(1, 'a')", "min needs numbers, not text"],
    ["max(tags)", "max needs numbers, not text"],
    ["sum(tags)", "sum needs numbers for each item, not text"],
    ["sum(level)", "sum needs a list, not a number"],
    ["sum(inventory, item)", "sum needs numbers for each item, not text"],
    ["count(inventory, qty)", "count needs true or false, not a number"],
    ["any(inventory, qty)", "any needs true or false for each item, not a number"],
    ["length(level)", "length needs text or a list, not a number"],
    ["concat('a', flag)", "concat needs text or numbers, not true or false"],
    ["concat(tags)", "concat needs text or numbers, not a list"],
    ["join(level, ',')", "join needs a list, not a number"],
    ["join(tags, 1)", "join needs text as its separator, not a number"],
    ["signed('a')", "signed needs a number, not text"],
    ["number(flag)", "number needs text or a number, not true or false"],
    ["text(tags)", "text needs a single value, not a list"],
    ["if(1, 2, 3)", "if needs true or false, not a number"],
    ["get(level, 'x')", "get needs a group of fields, not a number"],
    ["get(stats, flag)", "get needs text or a number as its key, not true or false"],
  ])("%s is a type error", (source, message) => {
    expect(failure(source)).toEqual({ code: "type", message });
  });

  it("doesn't let coalesce swallow errors", () => {
    expect(failure("coalesce(1 / 0, 2)").code).toBe("division-by-zero");
    expect(failure("coalesce(missing, 1 / 0)").code).toBe("division-by-zero");
    expect(evaluate("coalesce(1, 1 / 0)")).toBe(1);
  });

  it("caps text length", () => {
    const long = "x".repeat(6_000);
    const scope: SheetScope = { value: { long, list: [long, long] }, path: [] };
    expect(failure("concat(long, long)", { root: scope, scope }).code).toBe("too-long");
    expect(failure("join(list, '')", { root: scope, scope }).code).toBe("too-long");
    expect(evaluate("concat(long, 'y')", { root: scope, scope })).toHaveLength(6_001);
  });

  it("rejects dice", () => {
    expect(failure("2d6")).toEqual({ code: "dice", message: "Dice rolls aren't available here yet" });
    expect(failure("roll(2d6)").code).toBe("dice");
    expect(failure("1 + adv()").code).toBe("dice");
  });

  it("reports unknown functions", () => {
    expect(failure("nope(1)")).toEqual({ code: "unknown-function", message: "There's no function named nope" });
  });
});

describe("definitions", () => {
  it("calls definitions with arguments, against the top level", () => {
    expect(evaluate("pb()")).toBe(2);
    expect(evaluate("prof('expert')")).toBe(7);
    expect(evaluate("prof(rank)")).toBe(7);
    expect(evaluate("prof('untrained')")).toBe(0);
    expect(evaluate("prof(missing)")).toBe(0);
    expect(evaluate("check('dex', 'trained')")).toBe(8);
    const item: SheetScope = { value: data.inventory[0], path: ["inventory", 0] };
    expect(evaluate("pb() + qty", { scope: item })).toBe(12);
  });

  it("lets definitions return lists", () => {
    expect(evaluate("sum(items(), qty)")).toBe(13);
    expect(failure("items()").code).toBe("not-a-value");
  });

  it("stops definitions that call themselves", () => {
    expect(failure("loop()")).toEqual({
      code: "too-deep",
      message: `Definitions call each other more than ${formulaLimits.maxCallDepth} levels deep`,
    });
  });
});

describe("limits and safety", () => {
  it("rejects lists and records as a final value", () => {
    expect(failure("tags").code).toBe("not-a-value");
    expect(failure("stats").message).toBe("The result is a group of fields; pick one of them, like stats.strength");
    expect(failure("get(groups, 0)").code).toBe("not-a-value");
  });

  it("stops when the step budget runs out", () => {
    expect(failure("1 + 2 + 3", { budget: { steps: 3 } })).toEqual({
      code: "budget",
      message: "This formula takes too many steps to compute",
    });
    const list = Array.from({ length: formulaLimits.maxSteps }, (_, index) => index);
    const scope: SheetScope = { value: { list }, path: [] };
    expect(failure("sum(list)", { root: scope, scope }).code).toBe("budget");
    expect(evaluate("sum(list)", { root: scope, scope, budget: { steps: formulaLimits.maxSteps * 2 } })).toBe(
      (list.length * (list.length - 1)) / 2,
    );
  });

  it("shares the budget with definitions", () => {
    const budget = { steps: 10 };
    expect(failure("pb() + pb() + pb()", { budget }).code).toBe("budget");
  });

  it("turns unexpected exceptions into an error value", () => {
    const value = evaluate("prof(1)", {
      call() {
        throw new Error("boom");
      },
    });
    expect(value).toEqual(new FormulaError("internal", "This formula couldn't be computed"));
  });

  it("reads own properties only", () => {
    expect(evaluate("stats.toString")).toBeNull();
    expect(evaluate("name.length")).toBeNull();
    expect(evaluate("tags.length")).toBeNull();
  });
});

describe("formatFormulaValue", () => {
  it.each([
    [0.1 + 0.2, "0.3"],
    [1 / 3, "0.333333333333"],
    [2, "2"],
    [-1.5, "-1.5"],
    [null, ""],
    ["rope-id", "Rope"],
    [true, "Yes"],
    [new FormulaError("type", "x"), ""],
  ] as const)("%j → %j", (value, text) => {
    expect(formatFormulaValue(value, refs)).toBe(text);
  });

  it("signs positive numbers when asked", () => {
    expect(formatFormulaValue(0.1 + 0.2, refs, "signed")).toBe("+0.3");
    expect(formatFormulaValue(0, refs, "signed")).toBe("0");
  });
});
