import { describe, expect, it } from "vitest";
import {
  choiceLabel,
  defaultContentData,
  fieldOptions,
  fieldDefaultError,
  fieldOptionsError,
  remapContentTypeIds,
  resolveShowSheetWarnings,
  type ContentTypeSchema,
} from "./content-schema";

describe("defaultContentData", () => {
  it("fills required fields with empty values and skips optional ones", () => {
    const schema: ContentTypeSchema = {
      title: { type: "string", required: true },
      level: { type: "number", required: true },
      secret: { type: "boolean", required: true },
      notes: { type: "scalar", required: true },
      tags: { type: "array", itemType: { type: "string" }, required: true },
      optional: { type: "string" },
    };
    expect(defaultContentData(schema)).toEqual({
      title: "",
      level: 0,
      secret: false,
      notes: null,
      tags: [],
    });
  });

  it("fills required fields inside required groups", () => {
    const schema: ContentTypeSchema = {
      stats: {
        type: "struct",
        required: true,
        entries: {
          str: { type: "number", required: true },
          note: { type: "string" },
        },
      },
      extra: { type: "struct", entries: { x: { type: "number", required: true } } },
    };
    expect(defaultContentData(schema)).toEqual({ stats: { str: 0 } });
  });

  it("leaves out fields that need a real value", () => {
    const schema: ContentTypeSchema = {
      link: { type: "resourceLink", required: true },
      class: {
        type: "content",
        contentTypeId: "00000000-0000-4000-8000-000000000000",
        allow: "both",
        required: true,
      },
    };
    expect(defaultContentData(schema)).toEqual({});
  });
});

describe("resolveShowSheetWarnings", () => {
  const strictOff = { hasStrictSchema: true, showSheetWarnings: false };
  it("turns on when switching from strict to non-strict without a value", () => {
    expect(resolveShowSheetWarnings(strictOff, { hasStrictSchema: false })).toBe(true);
  });
  it("uses the explicit value when given", () => {
    expect(resolveShowSheetWarnings(strictOff, { hasStrictSchema: false, showSheetWarnings: false })).toBe(false);
    expect(resolveShowSheetWarnings({ ...strictOff, showSheetWarnings: true }, { showSheetWarnings: false })).toBe(false);
  });
  it("keeps the stored value otherwise", () => {
    expect(resolveShowSheetWarnings({ hasStrictSchema: false, showSheetWarnings: false }, { hasStrictSchema: false })).toBe(false);
    expect(resolveShowSheetWarnings(strictOff, {})).toBe(false);
    expect(resolveShowSheetWarnings(strictOff, { hasStrictSchema: true })).toBe(false);
    expect(resolveShowSheetWarnings({ hasStrictSchema: false, showSheetWarnings: true }, { hasStrictSchema: true })).toBe(true);
  });
});

describe("choice fields", () => {
  const options = [{ value: "s", label: "Small" }, { value: "m" }];

  it("starts a required choice field at its first option", () => {
    expect(
      defaultContentData({
        size: { type: "string", required: true, options },
        rank: { type: "number", required: true, options: [{ value: 2 }, { value: 4 }] },
        optional: { type: "string", options },
      }),
    ).toEqual({ size: "s", rank: 2 });
  });

  it("finds labels, defaulting to the value as text", () => {
    expect(choiceLabel(options, "s")).toBe("Small");
    expect(choiceLabel(options, "m")).toBe("m");
    expect(choiceLabel(options, "x")).toBeUndefined();
    expect(choiceLabel([{ value: 1 }], "1")).toBeUndefined();
  });

  it("reads options only from string and number fields", () => {
    expect(fieldOptions({ type: "string", options })).toBe(options);
    expect(fieldOptions({ type: "string" })).toBeUndefined();
    expect(fieldOptions({ type: "boolean" })).toBeUndefined();
    expect(fieldOptions(undefined)).toBeUndefined();
  });

  it("checks option lists", () => {
    expect(fieldOptionsError(options)).toBeUndefined();
    expect(fieldOptionsError([])).toBe("needs at least one option");
    expect(fieldOptionsError([{ value: 1 }, { value: 1 }])).toBe("lists the option 1 twice");
    expect(fieldOptionsError([{ value: Number.NaN }])).toMatch(/finite/);
    expect(fieldOptionsError([{ value: "a", label: "x".repeat(101) }])).toMatch(/label/);
    expect(fieldOptionsError(Array.from({ length: 201 }, (_, value) => ({ value })))).toMatch(/200/);
  });
});

describe("defaults", () => {
  const options = [{ value: "s" }, { value: "m" }];

  it("starts fields at their default, required or not", () => {
    expect(
      defaultContentData({
        size: { type: "string", options, default: "m" },
        ancestry: { type: "string", required: true, default: "Human" },
        level: { type: "number", default: 1 },
        alive: { type: "boolean", default: true },
        extra: { type: "scalar", default: null },
        attacks: {
          type: "array",
          itemType: { type: "struct", entries: { name: { type: "string" } } },
          default: [{ name: "Unarmed" }],
        },
        notes: { type: "string" },
      }),
    ).toEqual({ size: "m", ancestry: "Human", level: 1, alive: true, extra: null, attacks: [{ name: "Unarmed" }] });
  });

  it("fills structs that have entries with defaults, even when optional", () => {
    expect(
      defaultContentData({
        stats: {
          type: "struct",
          entries: { str: { type: "number", default: 10 }, dex: { type: "number" } },
        },
        empty: { type: "struct", entries: { a: { type: "number" } } },
      }),
    ).toEqual({ stats: { str: 10 } });
  });

  it("leaves out an optional struct whose required entries can't start filled", () => {
    expect(
      defaultContentData({
        stats: {
          type: "struct",
          entries: { str: { type: "number", default: 10 }, owner: { type: "resourceLink", required: true } },
        },
        gear: {
          type: "struct",
          entries: { size: { type: "string", default: "m" }, notes: { type: "string", required: true } },
        },
      }),
    ).toEqual({ gear: { size: "m", notes: "" } });
  });

  it("copies defaults, so new content never shares them", () => {
    const schema: ContentTypeSchema = { tags: { type: "array", itemType: { type: "string" }, default: ["a"] } };
    const first = defaultContentData(schema);
    (first.tags as string[]).push("b");
    expect(defaultContentData(schema)).toEqual({ tags: ["a"] });
  });

  it("checks defaults against the field", () => {
    expect(fieldDefaultError({ type: "string", default: "x" })).toBeUndefined();
    expect(fieldDefaultError({ type: "string", options, default: "x" })).toBe(
      "has a default that isn't one of the options",
    );
    expect(fieldDefaultError({ type: "number", default: Number.NaN })).toBe("has a default that isn't a number");
    expect(fieldDefaultError({ type: "boolean", default: 1 as unknown as boolean })).toBe(
      "has a default that isn't true or false",
    );
    expect(fieldDefaultError({ type: "scalar", default: [] as unknown as null })).toMatch(/isn't a string, number/);
    const rows = { type: "struct" as const, entries: { name: { type: "string" as const, required: true }, bonus: { type: "number" as const } } };
    expect(fieldDefaultError({ type: "array", itemType: rows, default: [{ name: "Unarmed", bonus: 0 }] })).toBeUndefined();
    expect(fieldDefaultError({ type: "array", itemType: rows, default: [{ bonus: 0 }] })).toBe(
      "has a default that is missing the required [0].name",
    );
    expect(fieldDefaultError({ type: "array", itemType: rows, default: [{ name: "a", extra: 1 }] })).toBe(
      'has a default that has a key "extra" the schema doesn\'t define at [0]',
    );
    expect(fieldDefaultError({ type: "array", itemType: { type: "string" }, default: Array(101).fill("a") })).toMatch(/100/);
    expect(
      fieldDefaultError({ type: "array", itemType: { type: "resourceLink" }, default: ["x"] }),
    ).toMatch(/can't hold object, content, or resourceLink values/);
    expect(fieldDefaultError({ type: "object", default: {} } as never)).toMatch(/can't have a default/);
  });
});

describe("remapContentTypeIds", () => {
  it("points content fields at copied types, nested too, keeping the rest and the field order", () => {
    const schema: ContentTypeSchema = {
      ancestry: { type: "content", contentTypeId: "a", allow: "reference" },
      level: { type: "number" },
      feats: { type: "array", itemType: { type: "content", contentTypeId: "f", allow: "both" } },
      gear: {
        type: "struct",
        entries: { weapon: { type: "content", contentTypeId: "other", allow: "local" } },
      },
    };
    const remapped = remapContentTypeIds(schema, new Map([["a", "a2"], ["f", "f2"]]));
    expect(Object.keys(remapped)).toEqual(["ancestry", "level", "feats", "gear"]);
    expect(remapped.ancestry).toEqual({ type: "content", contentTypeId: "a2", allow: "reference" });
    expect(remapped.feats).toEqual({
      type: "array",
      itemType: { type: "content", contentTypeId: "f2", allow: "both" },
    });
    expect(remapped.gear).toEqual(schema.gear);
    expect(schema.ancestry).toEqual({ type: "content", contentTypeId: "a", allow: "reference" });
  });
});
