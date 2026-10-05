import { describe, expect, it } from "vitest";
import {
  choiceLabel,
  defaultContentData,
  fieldOptions,
  fieldOptionsError,
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
