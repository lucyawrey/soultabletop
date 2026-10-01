import { describe, expect, it } from "vitest";
import { defaultContentData, resolveShowSheetWarnings, type ContentTypeSchema } from "./content-schema";

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
