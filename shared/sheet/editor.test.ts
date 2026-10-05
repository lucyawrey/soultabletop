import { describe, expect, it } from "vitest";
import {
  formulaHighlights,
  markupFormulaRanges,
  sampleSheetData,
  sheetFieldPaths,
} from "./editor";
import { generateSheetMarkup } from "./generate";
import { compileSheet, type SheetSchemas } from "./validate";

const schemas: SheetSchemas = {
  root: {
    hasStrictSchema: true,
    schema: {
      hp: { type: "number", label: "Hit Points" },
      bio: { type: "string" },
      alive: { type: "boolean" },
      link: { type: "resourceLink" },
      stats: { type: "struct", entries: { str: { type: "number" } } },
      attacks: {
        type: "array",
        itemType: { type: "struct", entries: { name: { type: "string" } } },
      },
      tags: { type: "array", itemType: { type: "string" } },
      class: { type: "content", contentTypeId: "cls", allow: "both" },
    },
  },
  types: {
    cls: {
      hasStrictSchema: true,
      schema: { hitDie: { type: "number" }, sub: { type: "content", contentTypeId: "cls", allow: "reference" } },
    },
  },
};

describe("sheetFieldPaths", () => {
  it("lists top-level, nested, List item, and referenced paths", () => {
    const paths = sheetFieldPaths(schemas).map((item) => `${item.path}: ${item.type}`);
    expect(paths).toEqual([
      "name: string",
      "hp: number",
      "bio: string",
      "alive: boolean",
      "link: resourceLink",
      "stats: struct",
      "stats.str: number",
      "attacks: list of struct",
      "attacks[].name: string",
      "tags: list of string",
      "class: content",
      "class.name: string",
      "class.hitDie: number",
      "class.sub: content",
      "class.sub.name: string",
      "class.sub.hitDie: number",
      "class.sub.sub: content",
      "class.sub.sub.name: string",
      "class.sub.sub.hitDie: number",
      "class.sub.sub.sub: content",
    ]);
  });

  it("uses schema labels", () => {
    expect(sheetFieldPaths(schemas).find((item) => item.path === "hp")?.label).toBe("Hit Points");
  });
});

describe("sampleSheetData", () => {
  it("fills every field with plausible values", () => {
    const data = sampleSheetData(schemas);
    expect(data).toMatchObject({
      name: "Sample Name",
      hp: 10,
      bio: "Sample bio",
      alive: true,
      stats: { str: 10 },
      attacks: [{ name: "Sample name" }, { name: "Sample name" }],
      tags: ["Sample tags 1", "Sample tags 2"],
      class: { name: "Sample Class", hitDie: 10 },
    });
    expect("link" in data).toBe(false);
  });

  it("shows defaults, and sample items for an empty array default", () => {
    const data = sampleSheetData({
      root: {
        hasStrictSchema: true,
        schema: {
          size: { type: "string", default: "Medium" },
          tags: { type: "array", itemType: { type: "string" }, default: [] },
          gear: { type: "array", itemType: { type: "string" }, default: ["Rope"] },
        },
      },
      types: {},
    });
    expect(data).toEqual({ name: "Sample Name", size: "Medium", tags: ["Sample tags 1", "Sample tags 2"], gear: ["Rope"] });
  });

  it("stops at self-referencing ContentTypes", () => {
    expect(() => sampleSheetData(schemas)).not.toThrow();
  });

  it("works with the generated sheet", () => {
    const markup = generateSheetMarkup(schemas);
    expect(compileSheet(markup, schemas).diagnostics).toEqual([]);
    expect(Object.keys(sampleSheetData(schemas)).length).toBeGreaterThan(5);
  });
});

describe("markupFormulaRanges", () => {
  function ranges(doc: string) {
    return markupFormulaRanges(doc).map((range) => ({ text: doc.slice(range.from, range.to), params: range.params }));
  }

  it("finds formula attributes and {} in text and attributes", () => {
    expect(
      ranges(`<Value formula="a + b" /><Note>x {c <d} y {concat('}', e)}</Note><Tracker max="{f}" show='g' />`),
    ).toEqual([
      { text: "a + b", params: [] },
      { text: "c <d", params: [] },
      { text: "concat('}', e)", params: [] },
      { text: "f", params: [] },
      { text: "g", params: [] },
    ]);
  });

  it("gives a Define's formula its params", () => {
    expect(ranges('<Define params="a, b" name="f" formula="a + b" />')).toEqual([
      { text: "a + b", params: ["a", "b"] },
    ]);
  });

  it("keeps reading after a tag missing its >", () => {
    expect(ranges('<Value formula="a"\n<Value formula="flo"')).toEqual([
      { text: "a", params: [] },
      { text: "flo", params: [] },
    ]);
  });

  it("skips comments and escapes, and runs an unclosed {to the line end", () => {
    expect(ranges("<!-- {no} --> \\{no} {yes\nnext")).toEqual([{ text: "yes", params: [] }]);
  });
});

describe("formulaHighlights", () => {
  it("colors built-ins, definitions, and parameters", () => {
    const source = "floor(rank) + prof(rank) + level + nope(1) + rank";
    const kinds = formulaHighlights(source, ["rank"], new Set(["prof"])).map(
      (item) => `${source.slice(item.from, item.to)}:${item.kind}`,
    );
    expect(kinds).toEqual(["floor:builtin", "rank:param", "prof:define", "rank:param", "rank:param"]);
  });

  it("uses offsets as written, entities included", () => {
    const source = "a &lt; max(b)";
    const [max] = formulaHighlights(source, [], new Set());
    expect(source.slice(max!.from, max!.to)).toBe("max");
  });
});

describe("markupFormulaRanges on unclosed formulas", () => {
  it("runs in linear time", () => {
    const time = (count: number) => {
      const start = performance.now();
      markupFormulaRanges(`<Note>${"{".repeat(count)}</Note>`);
      return performance.now() - start;
    };
    time(5_000); // Warm up the JIT.
    // A ratio rather than a fixed limit, so a slow CI runner doesn't fail it:
    // 4 times the input takes about 4 times as long if linear, 16 if quadratic.
    expect(time(20_000) / time(5_000)).toBeLessThan(8);
  });
});
