import { describe, expect, it } from "vitest";
import type { ContentFieldSchema } from "../content-schema";
import { parseSheetMarkup, type SheetText } from "./parser";
import {
  defaultSheetValue,
  setSheetValue,
  formatSheetValue,
  interpolateSheetText,
  itemScopes,
  resolveSheetPath,
  type SheetRefs,
  type SheetScope,
} from "./runtime";
import { parseSheetPath, type SheetSchemas } from "./validate";

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

  it("gives item scopes no path when the list came through a reference", () => {
    const scopes = itemScopes({ value: ["a"], path: null });
    expect(scopes).toEqual([{ value: "a", path: null }]);
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

  it("signs positive numbers when asked", () => {
    expect(formatSheetValue(2, refs, "signed")).toBe("+2");
    expect(formatSheetValue(0, refs, "signed")).toBe("0");
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
    [{ type: "any" }, null],
    [{ type: "resourceRef" }, null],
    [undefined, null],
  ] as const)("%j -> %j", (field, value) => {
    expect(defaultSheetValue(field as ContentFieldSchema | undefined, schemas)).toEqual(value);
  });

  it("fills required fields of objects and local Content", () => {
    expect(
      defaultSheetValue(
        {
          type: "object",
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
  it("fills in {paths}", () => {
    const text = parseSheetMarkup("{name} ({class.name}) has {hp} HP and {missing}.").nodes[0] as SheetText;
    expect(interpolateSheetText(text.parts, root, root, refs)).toBe("Violet (Wizard) has 7 HP and .");
  });
});
