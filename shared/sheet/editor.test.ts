import { describe, expect, it } from "vitest";
import { sampleSheetData, sheetFieldPaths } from "./editor";
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

  it("stops at self-referencing ContentTypes", () => {
    expect(() => sampleSheetData(schemas)).not.toThrow();
  });

  it("works with the generated sheet", () => {
    const markup = generateSheetMarkup(schemas);
    expect(compileSheet(markup, schemas).diagnostics).toEqual([]);
    expect(Object.keys(sampleSheetData(schemas)).length).toBeGreaterThan(5);
  });
});
