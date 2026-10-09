import { describe, expect, it } from "vitest";
import type { ContentFieldSchema } from "../content-schema";
import {
  defaultSheetValue,
  entryScopes,
  evaluateSheetDefinition,
  evaluateSheetFormula,
  setSheetValue,
  sheetCondition,
  sheetOverride,
  sheetTextSegments,
  formatSheetValue,
  interpolateSheetText,
  itemScopes,
  resolveSheetPath,
  type SheetRefs,
  type SheetScope,
} from "./runtime";
import { FormulaError, formulaLimits, parseFormula, type FormulaValue } from "./formula";
import { pathfinder2eMarkup, pathfinder2eSchemas } from "./fixtures/pathfinder2e";
import {
  isCompiledFormula,
  parseSheetPath,
  sheetStepBudget,
  type CompiledFormula,
  type SheetSchemas,
  type ValidatedElement,
  type ValidatedText,
} from "./validate";
import { compileInSheet as compileSheet } from "./fixtures/in-sheet";

const refs: SheetRefs = {
  "rope-id": { name: "Rope", contentTypeId: "item", data: { weight: 5 } },
  "class-id": { name: "Wizard", contentTypeId: "cls", data: { sub: "sub-id" } },
  "sub-id": { name: "Evoker", contentTypeId: "cls", data: { hitDie: 6 } },
};

const data = {
  name: "Violet",
  hp: 7,
  stats: { str: 12 },
  tags: ["brave", "tired"],
  class: "class-id",
  inventory: [
    { item: "rope-id", qty: 2 },
    { item: { name: "Custom Sword", weight: 3 }, qty: 1 },
    { item: "unreadable-id", qty: 1 },
  ],
};

const root: SheetScope = { value: data, path: [] };

function resolve(path: string, scope: SheetScope = root) {
  return resolveSheetPath(parseSheetPath(path), root, scope, refs);
}

describe("resolveSheetPath", () => {
  it("resolves fields and nested fields with their data paths", () => {
    expect(resolve("hp")).toEqual({ value: 7, path: ["hp"] });
    expect(resolve("stats.str")).toEqual({ value: 12, path: ["stats", "str"] });
    expect(resolve("tags.1")).toEqual({ value: "tired", path: ["tags", 1] });
  });

  it("returns a writable path for missing values", () => {
    expect(resolve("stats.dex")).toEqual({ value: undefined, path: ["stats", "dex"] });
    expect(resolve("missing.deep")).toEqual({ value: undefined, path: ["missing", "deep"] });
  });

  it("follows references read-only, including chains", () => {
    expect(resolve("class.name")).toEqual({ value: "Wizard", path: null });
    expect(resolve("class.sub.hitDie")).toEqual({ value: 6, path: null });
    // The reference itself is part of this Content's data.
    expect(resolve("class")).toEqual({ value: "class-id", path: ["class"] });
  });

  it("marks unloaded references unavailable", () => {
    const [, , unreadable] = itemScopes(resolve("inventory"));
    expect(resolve("item.weight", unreadable)).toEqual({
      value: undefined,
      path: null,
      unavailable: true,
    });
  });

  it("resolves relative to a List item, / from the top, and . as the item", () => {
    const [rope, sword] = itemScopes(resolve("inventory"));
    expect(resolve("qty", rope)).toEqual({ value: 2, path: ["inventory", 0, "qty"] });
    expect(resolve("item.weight", rope)).toEqual({ value: 5, path: null });
    expect(resolve("item.weight", sword)).toEqual({ value: 3, path: ["inventory", 1, "item", "weight"] });
    expect(resolve("/name", sword)).toEqual({ value: "Violet", path: ["name"] });
    expect(resolve(".", sword)).toBe(sword);
  });

  it("doesn't read inherited properties", () => {
    expect(resolve("constructor")).toEqual({ value: undefined, path: ["constructor"] });
    expect(resolve("stats.__proto__")).toEqual({ value: undefined, path: ["stats", "__proto__"] });
    expect(resolve("stats.toString")).toEqual({ value: undefined, path: ["stats", "toString"] });
    expect(resolve("class.constructor").value).toBeUndefined();
  });

  it("gives item scopes no path when the list came through a reference", () => {
    const scopes = itemScopes({ value: ["a"], path: null });
    expect(scopes).toEqual([{ value: "a", path: null, item: { key: 0 } }]);
    expect(itemScopes({ value: "not a list", path: [] })).toEqual([]);
  });
});

describe("formatSheetValue", () => {
  it.each([
    [undefined, ""],
    [null, ""],
    [3, "3"],
    [true, "Yes"],
    [false, "No"],
    ["text", "text"],
    ["rope-id", "Rope"],
    [["a", 1, null], "a, 1"],
    [{ name: "Custom" }, "Custom"],
    [{ a: 1 }, "{\"a\":1}"],
  ])("%j -> %j", (value, text) => {
    expect(formatSheetValue(value, refs)).toBe(text);
  });

  it("signs zero and positive numbers when asked", () => {
    expect(formatSheetValue(2, refs, "signed")).toBe("+2");
    expect(formatSheetValue(0, refs, "signed")).toBe("+0");
    expect(formatSheetValue(-1, refs, "signed")).toBe("-1");
  });
});

describe("setSheetValue", () => {
  it("sets existing values and creates missing objects and arrays", () => {
    const target: Record<string, unknown> = { stats: { str: 1 }, list: [{ a: 1 }] };
    setSheetValue(target, ["stats", "str"], 2);
    setSheetValue(target, ["list", 0, "a"], 3);
    setSheetValue(target, ["new", "deep"], true);
    setSheetValue(target, ["rows", 1, "x"], "y");
    expect(target).toEqual({
      stats: { str: 2 },
      list: [{ a: 3 }],
      new: { deep: true },
      rows: [undefined, { x: "y" }],
    });
  });

  it("never writes through reserved keys", () => {
    const target: Record<string, unknown> = {};
    try {
      setSheetValue(target, ["__proto__", "polluted"], 1);
      setSheetValue(target, ["constructor", "prototype", "polluted"], 1);
      setSheetValue(target, ["a", "__proto__"], 1);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(target).toEqual({});
    } finally {
      delete (Object.prototype as Record<string, unknown>).polluted;
    }
  });

  it("doesn't walk into inherited objects", () => {
    const target: Record<string, unknown> = {};
    setSheetValue(target, ["toString", "x"], 1);
    expect(Object.hasOwn(target, "toString")).toBe(true);
    expect((Function.prototype as unknown as Record<string, unknown>).x).toBeUndefined();
  });

  it("removes the key when the value is undefined", () => {
    const target: Record<string, unknown> = { stats: { str: 1, dex: 2 } };
    setSheetValue(target, ["stats", "str"], undefined);
    expect(target).toEqual({ stats: { dex: 2 } });
    expect(Object.hasOwn(target.stats as object, "str")).toBe(false);
  });

  it("ignores an empty path", () => {
    const target = { a: 1 };
    setSheetValue(target, [], 2);
    expect(target).toEqual({ a: 1 });
  });
});

describe("defaultSheetValue", () => {
  const schemas: SheetSchemas = {
    root: { hasStrictSchema: true, schema: {} },
    types: {
      item: {
        hasStrictSchema: true,
        schema: { weight: { type: "number", required: true }, note: { type: "string" } },
      },
    },
  };

  it.each([
    [{ type: "string" }, ""],
    [{ type: "number" }, 0],
    [{ type: "boolean" }, false],
    [{ type: "array", itemType: { type: "string" } }, []],
    [{ type: "scalar" }, null],
    [{ type: "resourceLink" }, null],
    [undefined, null],
  ] as const)("%j -> %j", (field, value) => {
    expect(defaultSheetValue(field as ContentFieldSchema | undefined, schemas)).toEqual(value);
  });

  it("starts at the field's default, and fills entries with defaults", () => {
    const field: ContentFieldSchema = {
      type: "struct",
      entries: {
        name: { type: "string", default: "Unarmed" },
        bonus: { type: "number" },
        tags: { type: "array", itemType: { type: "string" }, default: ["melee"] },
      },
    };
    expect(defaultSheetValue(field, schemas)).toEqual({ name: "Unarmed", tags: ["melee"] });
    expect(defaultSheetValue({ type: "string", options: [{ value: "s" }, { value: "m" }], default: "m" }, schemas)).toBe("m");
  });

  it("fills required fields of objects and local Content", () => {
    expect(
      defaultSheetValue(
        {
          type: "struct",
          entries: { a: { type: "number", required: true }, b: { type: "string" } },
        },
        schemas,
      ),
    ).toEqual({ a: 0 });
    expect(
      defaultSheetValue({ type: "content", contentTypeId: "item", allow: "both" }, schemas),
    ).toEqual({ name: "", weight: 0 });
  });
});

describe("interpolateSheetText", () => {
  it("fills in {fields}", () => {
    const compiled = compileSheet("<Note>{name} ({class.name}) has {hp} HP and {missing}.</Note>", {
      root: { hasStrictSchema: false, schema: {} },
      types: {},
    });
    const parts = ((compiled.nodes[0] as ValidatedElement).children[0] as ValidatedText).parts;
    expect(interpolateSheetText(parts, root, root, refs)).toBe("Violet (Wizard) has 7 HP and .");
  });
});

describe("formulas in text", () => {
  const compiled = compileSheet(
    '<Define name="twice" params="x" formula="x * 2" /><Define name="base" formula="hp + 1" />' +
      "<Note>{name} has {twice(hp) + base()} HP, {1 / 0}, {0.1 + 0.2}</Note>",
    { root: { hasStrictSchema: false, schema: {} }, types: {} },
  );
  const note = compiled.nodes.find(
    (node): node is ValidatedElement => node.type === "element" && node.tag === "Note",
  )!;
  const parts = (note.children[0] as ValidatedText).parts;
  const formulas = { definitions: compiled.definitions };

  it("computes {} parts, with definitions", () => {
    expect(interpolateSheetText(parts, root, root, refs, formulas)).toBe("Violet has 22 HP, —, 0.3");
  });

  it("marks failed formulas in segments", () => {
    expect(sheetTextSegments(parts, root, root, refs, formulas)[4]).toEqual({
      text: "—",
      error: "Division by zero",
    });
  });

  it("uses cached values of definitions without parameters", () => {
    const cached = { definitions: compiled.definitions, cached: () => 100 };
    expect(interpolateSheetText(parts.slice(2, 3), root, root, refs, cached)).toBe("114");
  });

  it("shows a broken formula part as —", () => {
    const broken = compileSheet("<Note>{nope(}</Note>", { root: { hasStrictSchema: false, schema: {} }, types: {} });
    const brokenParts = ((broken.nodes[0] as ValidatedElement).children[0] as ValidatedText).parts;
    expect(sheetTextSegments(brokenParts, root, root, refs)).toEqual([
      { text: "—", error: "This formula has errors" },
    ]);
  });

  it("gives broken definitions an error value", () => {
    const cyclic = compileSheet('<Define name="a" formula="a()" /><Value formula="1" />', {
      root: { hasStrictSchema: false, schema: {} },
      types: {},
    });
    const ast = parseFormula("a()", { line: 1, column: 1, offset: 0 }).ast!;
    expect(evaluateSheetFormula(ast, root, root, refs, { definitions: cyclic.definitions })).toEqual(
      new FormulaError("definition", "a has errors; fix its <Define>"),
    );
  });
});

describe("sheetCondition", () => {
  const empty = { root: { hasStrictSchema: false, schema: {} }, types: {} };
  function show(markup: string, scope: SheetScope = root) {
    const [node] = compileSheet(markup, empty).nodes;
    return sheetCondition((node as ValidatedElement).attrs.show, root, scope, refs);
  }

  it("shows on true and hides on false or nothing", () => {
    expect(show('<Note show="hp > 5">x</Note>')).toEqual({ shown: true });
    expect(show('<Note show="hp > 10">x</Note>')).toEqual({ shown: false });
    expect(show('<Note show="missing">x</Note>')).toEqual({ shown: false });
    expect(show('<Note show="missing > 1">x</Note>')).toEqual({ shown: false });
    expect(show("<Note>x</Note>")).toEqual({ shown: true });
  });

  it("shows the tag when the formula fails, with the error", () => {
    expect(show('<Note show="1 / 0 > 1">x</Note>')).toEqual({ shown: true, error: "Division by zero" });
    expect(show('<Note show="get(stats, \'str\')">x</Note>')).toEqual({ shown: true, error: "show needs true or false" });
  });

  it("evaluates in the given scope", () => {
    const [rope] = itemScopes(resolve("inventory"));
    expect(show('<Note show="qty > 1">x</Note>', rope)).toEqual({ shown: true });
  });
});

describe("sheetOverride", () => {
  it.each([
    ["Number", undefined, 5, true, 5],
    ["Number", null, 5, true, 5],
    ["Number", 0, 5, false, 0],
    ["Number", 7, 5, false, 7],
    ["Text", "", "auto", true, "auto"],
    ["Text", "mine", "auto", false, "mine"],
    ["Checkbox", undefined, true, true, true],
    ["Checkbox", false, true, false, false],
    // Without a formula, the stored value is all there is.
    ["Number", undefined, undefined, false, undefined],
  ])("%s stored %j, computed %j", (tag, stored, computed, automatic, value) => {
    expect(sheetOverride(tag, stored, computed as FormulaValue | undefined)).toEqual({ automatic, value });
  });

  it("shows nothing when the automatic value failed", () => {
    expect(sheetOverride("Number", undefined, new FormulaError("type", "x"))).toEqual({
      automatic: true,
      value: undefined,
    });
  });
});

describe("computed fields", () => {
  const empty = { root: { hasStrictSchema: false, schema: {} }, types: {} };
  function value(markup: string, source: string, stored: Record<string, unknown> = {}) {
    const compiled = compileSheet(markup, empty);
    const scope: SheetScope = { value: stored, path: [] };
    const ast = parseFormula(source, { line: 1, column: 1, offset: 0 }).ast!;
    return evaluateSheetFormula(ast, scope, scope, refs, {
      definitions: compiled.definitions,
      computedFields: compiled.computedFields,
    });
  }
  const sheet = '<Number field="hp" formula="maxHp" /><Number field="maxHp" formula="floor(maxDex / 2)" />';

  it("reads an override field's computed value when nothing is stored", () => {
    expect(value(sheet, "hp", { maxDex: 9 })).toBe(4);
    expect(value(sheet, "maxHp + 1", { maxDex: 9 })).toBe(5);
  });

  it("keeps computed fields on items that list functions pick", () => {
    const score = { type: "struct" as const, entries: { score: { type: "number" as const }, mod: { type: "number" as const } } };
    const compiled = compileSheet(
      `<Number field="ab.str.mod" formula="floor((ab.str.score - 10) / 2)" />
       <Number field="ab.dex.mod" formula="floor((ab.dex.score - 10) / 2)" />
       <Value formula="first(ab).mod" />
       <Value formula="join(map(filter(ab, mod > 0), text(mod)), ',')" />
       <Value formula="at(sort(ab, mod, true), 0).mod" />`,
      { root: { hasStrictSchema: true, schema: { ab: { type: "struct", entries: { str: score, dex: score } } } }, types: {} },
    );
    expect(compiled.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const scope: SheetScope = { value: { ab: { str: { score: 14 }, dex: { score: 16 } } }, path: [] };
    const values = compiled.nodes
      .filter((node): node is ValidatedElement => node.type === "element" && node.tag === "Value")
      .map((node) =>
        evaluateSheetFormula(node.formula!.ast, scope, scope, refs, {
          definitions: compiled.definitions,
          computedFields: compiled.computedFields,
        }),
      );
    expect(values).toEqual([2, "2,3", 3]);
  });

  it("reads the stored value when there is one", () => {
    expect(value(sheet, "hp", { maxDex: 9, maxHp: 20 })).toBe(20);
    expect(value(sheet, "hp", { maxDex: 9, hp: 0 })).toBe(0);
  });

  it("counts an empty Text as nothing stored", () => {
    const text = '<Text field="title" formula="concat(name, \'!\')" />';
    expect(value(text, "title", { name: "Violet", title: "" })).toBe("Violet!");
    expect(value(text, "title", { name: "Violet", title: "Hero" })).toBe("Hero");
  });

  it("cascades Checkbox overrides", () => {
    const checkbox = '<Checkbox field="trained" formula="level > 1" /><Value formula="trained" />';
    expect(value(checkbox, "trained", { level: 3 })).toBe(true);
    expect(value(checkbox, "trained", { level: 3, trained: false })).toBe(false);
  });

  it("shows the computed value of an override field in {…} text", () => {
    const compiled = compileSheet(`${sheet}<Note>{hp} / {hp}</Note>`, empty);
    const note = compiled.nodes.find(
      (node): node is ValidatedElement => node.type === "element" && node.tag === "Note",
    )!;
    const parts = (note.children[0] as ValidatedText).parts;
    const scope: SheetScope = { value: { maxDex: 9 }, path: [] };
    expect(
      interpolateSheetText(parts, scope, scope, refs, {
        definitions: compiled.definitions,
        computedFields: compiled.computedFields,
      }),
    ).toBe("4 / 4");
  });

  it("gives cycles an error", () => {
    const cycle = '<Number field="a" formula="b + 1" /><Number field="b" formula="a + 1" />';
    expect(value(cycle, "a")).toEqual(new FormulaError("formula-cycle", "a is computed from itself"));
    expect(value(cycle, "a", { b: 1 })).toBe(2);
    expect(value('<Number field="a" formula="a + 1" />', "a")).toEqual(
      new FormulaError("formula-cycle", "a is computed from itself"),
    );
    const throughParams = '<Define name="plus" params="x" formula="x + b" /><Number field="b" formula="plus(1)" />';
    expect(value(throughParams, "b")).toEqual(new FormulaError("formula-cycle", "b is computed from itself"));
  });

  it("limits how deep computed fields depend on each other", () => {
    const depth = formulaLimits.maxCallDepth;
    const chain = Array.from({ length: depth + 1 }, (_, index) => `<Number field="f${index}" formula="f${index + 1} + 1" />`);
    expect(value(chain.join(""), "f0")).toEqual(
      new FormulaError("too-deep", `Computed values depend on each other more than ${depth} levels deep`),
    );
    expect(value(chain.slice(1).join(""), "f1", { [`f${depth + 1}`]: 0 })).toBe(depth);
  });

  it("doesn't use overrides inside List rows", () => {
    const list = '<List field="rows"><Number field="x" formula="5" /></List>';
    expect(value(list, "x")).toBeNull();
    expect(value(list, "sum(rows, x)", { rows: [{}, { x: 2 }] })).toBe(2);
  });

  it("reaches computed fields through definitions without parameters", () => {
    const markup = `<Define name="half" formula="hp / 2" />${sheet}`;
    expect(value(markup, "half()", { maxDex: 9 })).toBe(2);
    // A cached value isn't used inside a computed field, so this cycle is found.
    const cyclic = compileSheet('<Define name="m" formula="hp" /><Number field="hp" formula="m()" />', empty);
    const scope: SheetScope = { value: {}, path: [] };
    const ast = parseFormula("hp", { line: 1, column: 1, offset: 0 }).ast!;
    expect(
      evaluateSheetFormula(ast, scope, scope, refs, {
        definitions: cyclic.definitions,
        computedFields: cyclic.computedFields,
        cached: () => 1,
      }),
    ).toEqual(new FormulaError("formula-cycle", "hp is computed from itself"));
  });
});

describe("compiled number attributes", () => {
  it("evaluates {} in number attributes", () => {
    const { nodes } = compileSheet('<Tracker field="hp" max="{hp * 2 + stats.str}" />', {
      root: { hasStrictSchema: false, schema: {} },
      types: {},
    });
    const max = (nodes[0] as ValidatedElement).attrs.max;
    expect(isCompiledFormula(max)).toBe(true);
    expect(evaluateSheetFormula((max as CompiledFormula).ast, root, root, refs)).toBe(26);
  });
});

describe("the Pathfinder 2e example", () => {
  const compiled = compileSheet(pathfinder2eMarkup, pathfinder2eSchemas);
  const formulas = { definitions: compiled.definitions };
  const character = {
    name: "Ezren",
    level: 5,
    keyAttribute: "int",
    attributes: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 0 },
    perceptionRank: "expert",
    classDcRank: "trained",
    saves: { fortitude: { rank: "trained" }, reflex: { rank: "trained" }, will: { rank: "expert" } },
    skills: { athletics: { rank: "untrained" }, stealth: { rank: "trained" } },
    armor: { rank: "trained", dexCap: 5, itemBonus: 1, strength: 1 },
    speed: 25,
    hp: { current: 30, ancestry: 6, classPerLevel: 6 },
    spellcasting: { tradition: "arcane", attribute: "int", rank: "trained" },
    inventory: [
      { item: "torch-id", qty: 10 },
      { item: { name: "Staff", bulk: 1 }, qty: 1 },
    ],
  };
  const pc: SheetScope = { value: character, path: [] };
  const items: SheetRefs = { "torch-id": { name: "Torch", contentTypeId: "pf2e-item", data: { bulk: 0.1 } } };
  function value(source: string) {
    const ast = parseFormula(source, { line: 1, column: 1, offset: 0 }).ast!;
    return evaluateSheetFormula(ast, pc, pc, items, formulas);
  }

  it("computes the derived numbers", () => {
    expect(value("10 + min(attributes.dex, coalesce(armor.dexCap, 99)) + prof(armor.rank) + coalesce(armor.itemBonus, 0)")).toBe(20);
    expect(value("check('wis', perceptionRank)")).toBe(10);
    expect(value("check('str', skills.athletics.rank)")).toBe(0);
    expect(value("classDc()")).toBe(21);
    expect(value("hp.ancestry + (hp.classPerLevel + attributes.con) * level + coalesce(hp.bonus, 0)")).toBe(41);
    expect(value("speed - if(armor.strength != null and armor.strength > attributes.str, 5, 0)")).toBe(20);
    expect(value("floor(sum(inventory, qty * coalesce(item.bulk, 0)))")).toBe(2);
    expect(value("10 + get(attributes, spellcasting.attribute) + prof(spellcasting.rank)")).toBe(21);
  });
});

describe("reactivity", () => {
  // Vue tracks property reads (the `get` trap), not Object.hasOwn: a computed
  // that found a key missing must have read it, so it reruns when the key is
  // added (an override's first value). This proxy records the reads.
  function watched(target: Record<string, unknown>) {
    const reads: string[] = [];
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        if (typeof key === "string") reads.push(key);
        return Reflect.get(object, key, receiver);
      },
    });
    return { proxy, reads };
  }

  it("reads missing keys of a path through get", () => {
    const { proxy, reads } = watched({ stats: {} });
    const scope = { value: proxy, path: [] };
    expect(resolveSheetPath(parseSheetPath("ac"), scope, scope, refs).value).toBeUndefined();
    expect(reads).toContain("ac");
  });

  it("reads missing keys of get() through get", () => {
    const { proxy, reads } = watched({});
    const scope = { value: { stats: proxy }, path: [] };
    const ast = parseFormula("get(stats, 'dex')", { line: 1, column: 1, offset: 0 }).ast!;
    expect(evaluateSheetFormula(ast, scope, scope, refs)).toBeNull();
    expect(reads).toContain("dex");
  });
});

describe("sheet step budget", () => {
  it("splits the sheet's budget between its formulas", () => {
    expect(sheetStepBudget(1)).toBe(formulaLimits.maxSteps);
    expect(sheetStepBudget(0)).toBe(formulaLimits.maxSteps);
    expect(sheetStepBudget(2_000)).toBe(formulaLimits.maxSheetSteps / 2_000);
    const empty = { root: { hasStrictSchema: false, schema: {} }, types: {} };
    expect(compileSheet('<Value formula="1" /><Note>{2} {3}</Note>', empty).stepBudget).toBe(formulaLimits.maxSteps);
  });

  it("gives evaluations the sheet's budget", () => {
    const list = Array.from({ length: 50 }, (_, index) => index);
    const scope: SheetScope = { value: { list }, path: [] };
    const ast = parseFormula("sum(list)", { line: 1, column: 1, offset: 0 }).ast!;
    expect(evaluateSheetFormula(ast, scope, scope, refs, { definitions: new Map(), stepBudget: 100 })).toBe(1225);
    expect(evaluateSheetFormula(ast, scope, scope, refs, { definitions: new Map(), stepBudget: 20 })).toEqual(
      new FormulaError("budget", "This formula takes too many steps to compute"),
    );
  });
});

describe("choice fields", () => {
  const choiceSchemas: SheetSchemas = {
    root: {
      hasStrictSchema: true,
      schema: {
        rank: { type: "number", options: [{ value: 0, label: "Untrained" }, { value: 2, label: "Expert" }] },
      },
    },
    types: {},
  };

  it("shows the label for {path} text and the value for other formulas", () => {
    const compiled = compileSheet("<Note>{rank}, {rank + 0}, {/rank}</Note>", choiceSchemas);
    const parts = ((compiled.nodes[0] as ValidatedElement).children[0] as ValidatedText).parts;
    const scope: SheetScope = { value: { rank: 2 }, path: [] };
    expect(interpolateSheetText(parts, scope, scope, refs)).toBe("Expert, 2, Expert");
    const unlisted: SheetScope = { value: { rank: 3 }, path: [] };
    expect(interpolateSheetText(parts, unlisted, unlisted, refs)).toBe("3, 3, 3");
  });

  it("starts a new choice field at its first option", () => {
    expect(defaultSheetValue(choiceSchemas.root.schema.rank, choiceSchemas)).toBe(0);
    expect(
      defaultSheetValue(
        { type: "struct", entries: { size: { type: "string", required: true, options: [{ value: "m" }] } } },
        choiceSchemas,
      ),
    ).toEqual({ size: "m" });
  });
});

describe("struct entry rows", () => {
  const rank = { type: "struct" as const, entries: { rank: { type: "number" as const } } };
  const structSchemas: SheetSchemas = {
    root: {
      hasStrictSchema: true,
      schema: {
        skills: { type: "struct", entries: { acrobatics: rank, arcana: { ...rank, label: "Arcana Lore" } } },
        attributes: { type: "struct", entries: { str: { type: "number" }, dex: { type: "number" } } },
      },
    },
    types: {},
  };
  const entries = [
    { key: "acrobatics", label: "Acrobatics" },
    { key: "arcana", label: "Arcana Lore" },
  ];
  const sheetData = { skills: { arcana: { rank: 2 } }, attributes: { str: 3, dex: -1 } };
  const sheetRoot: SheetScope = { value: sheetData, path: [] };

  it("gives every entry a row, stored or not, with its key and label", () => {
    const skills = resolveSheetPath(parseSheetPath("skills"), sheetRoot, sheetRoot, refs);
    expect(entryScopes(skills, entries)).toEqual([
      { value: undefined, path: ["skills", "acrobatics"], item: { key: "acrobatics", label: "Acrobatics" } },
      { value: { rank: 2 }, path: ["skills", "arcana"], item: { key: "arcana", label: "Arcana Lore" } },
    ]);
    expect(entryScopes({ value: undefined, path: null }, entries).map((row) => row.path)).toEqual([null, null]);
    expect(entryScopes({ value: undefined, path: null, unavailable: true }, entries)).toEqual([]);
  });

  it("computes itemKey(), itemLabel(), and per-item functions over structs", () => {
    const compiled = compileSheet(
      `<Table field="skills"><Column formula="concat(itemLabel(), ' (', itemKey(), ') ', text(coalesce(rank, 0)))" /></Table>
       <Value formula="count(skills, rank > 0)" />
       <Value formula="sum(attributes)" />`,
      structSchemas,
    );
    expect(compiled.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const [table, ...values] = compiled.nodes.filter((node): node is ValidatedElement => node.type === "element");
    const column = table!.children[0] as ValidatedElement;
    const skills = resolveSheetPath(parseSheetPath("skills"), sheetRoot, sheetRoot, refs);
    const texts = entryScopes(skills, table!.entries!).map((row) =>
      evaluateSheetFormula(column.formula!.ast, sheetRoot, row, refs),
    );
    expect(texts).toEqual(["Acrobatics (acrobatics) 0", "Arcana Lore (arcana) 2"]);
    expect(values.slice(0, 2).map((node) => evaluateSheetFormula(node.formula!.ast, sheetRoot, sheetRoot, refs))).toEqual([1, 2]);
  });

  it("lets the list functions repeat over structs", () => {
    const compiled = compileSheet(
      `<Value formula="first(skills, rank > 0).rank" />
       <Value formula="sum(filter(attributes, . > 0))" />
       <Value formula="at(attributes, -1)" />
       <Value formula="join(map(sort(attributes, ., true), text(.)), ',')" />`,
      structSchemas,
    );
    expect(compiled.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const values = compiled.nodes.filter((node): node is ValidatedElement => node.type === "element");
    expect(values.map((node) => evaluateSheetFormula(node.formula!.ast, sheetRoot, sheetRoot, refs))).toEqual([
      2, 3, -1, "3,-1",
    ]);
  });

  it("gives array rows their index as itemKey()", () => {
    const compiled = compileSheet(`<Value formula="sum(tags, itemKey())" />`, {
      root: { hasStrictSchema: true, schema: { tags: { type: "array", itemType: { type: "string" } } } },
      types: {},
    });
    const node = compiled.nodes[0] as ValidatedElement;
    expect(evaluateSheetFormula(node.formula!.ast, root, root, refs)).toBe(1);
  });
  it("tells formulas whether the sheet is being edited with editing()", () => {
    const compiled = compileSheet(`<Value formula="editing()" /><Define name="mode" formula="if(editing(), 'edit', 'play')" />`, {
      root: { hasStrictSchema: true, schema: {} },
      types: {},
    });
    const node = compiled.nodes[0] as ValidatedElement;
    expect(compiled.diagnostics).toEqual([]);
    expect(evaluateSheetFormula(node.formula!.ast, root, root, refs)).toBe(false);
    const formulas = { definitions: compiled.definitions, editing: true };
    expect(evaluateSheetFormula(node.formula!.ast, root, root, refs, formulas)).toBe(true);
    expect(evaluateSheetDefinition("mode", root, refs, formulas)).toBe("edit");
    expect(evaluateSheetDefinition("mode", root, refs, { ...formulas, editing: false })).toBe("play");
  });
});
