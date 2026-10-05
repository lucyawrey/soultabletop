import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { contentTypeSchemaSchema } from "./api-schemas";
import { assertFieldKeys, freeObjectError, validateContentData } from "./content-validation";

const reserved = ["__proto__", "constructor", "prototype"];

describe("freeObjectError", () => {
  it("accepts identifier keys at any depth", () => {
    expect(freeObjectError({ a: { b_2: [{ c: 1 }] } }, "notes", 0)).toBeUndefined();
  });

  it.each(reserved)("rejects the reserved key %s at any depth", (key) => {
    const top = JSON.parse(`{"${key}": 1}`) as Record<string, unknown>;
    const nested = JSON.parse(`{"a": [{"${key}": {}}]}`) as Record<string, unknown>;
    expect(freeObjectError(top, "notes", 0)).toBe(`notes has key "${key}", which is reserved`);
    expect(freeObjectError(nested, "notes", 0)).toBe(`notes.a[0] has key "${key}", which is reserved`);
  });
});

describe("assertFieldKeys", () => {
  it.each(reserved)("rejects the reserved key %s, also inside structs", (key) => {
    const top = JSON.parse(`{"${key}": {"type": "string"}}`);
    const nested = JSON.parse(
      `{"stats": {"type": "struct", "entries": {"${key}": {"type": "number"}}}}`,
    );
    expect(() => assertFieldKeys(top)).toThrow(`Field key "${key}" is reserved`);
    expect(() => assertFieldKeys(nested)).toThrow(`Field key "${key}" is reserved`);
  });

  it("accepts identifier keys", () => {
    expect(() => assertFieldKeys({ hp: { type: "number" } })).not.toThrow();
  });
});

describe("contentTypeSchemaSchema keys", () => {
  // Type.Record doesn't enforce its key pattern, which is why assertFieldKeys
  // runs on every schema save. This pins that down so the check isn't removed
  // on the assumption that the request schema already covers it.
  it("leaves key checks to assertFieldKeys", () => {
    for (const key of [...reserved, "bad-key"]) {
      expect(Value.Check(contentTypeSchemaSchema, JSON.parse(`{"${key}": {"type": "string"}}`))).toBe(true);
    }
  });
});

describe("choice fields", () => {
  const user = { id: "u", name: "User" };
  const rules = {
    hasStrictSchema: true,
    schema: {
      size: {
        type: "string" as const,
        options: [{ value: "small" }, { value: "medium", label: "Medium" }],
      },
      rank: {
        type: "number" as const,
        options: [0, 1, 2].map((value) => ({ value })),
      },
      ranks: {
        type: "array" as const,
        itemType: { type: "number" as const, options: [{ value: 1 }] },
      },
    },
  };

  it("accepts listed values", async () => {
    expect(await validateContentData(user, { size: "medium", rank: 2, ranks: [1] }, rules)).toBeUndefined();
  });

  it("rejects values that aren't listed, whatever the strictness", async () => {
    expect(await validateContentData(user, { size: "huge" }, rules)).toBe(
      'size must be one of "small", "medium"',
    );
    expect(await validateContentData(user, { rank: 3 }, { ...rules, hasStrictSchema: false })).toBe(
      "rank must be one of 0, 1, 2",
    );
    expect(await validateContentData(user, { ranks: [1, 2] }, rules)).toBe("ranks[1] must be one of 1");
    expect(await validateContentData(user, { size: "" }, rules)).toBe('size must be one of "small", "medium"');
  });

  it("checks options on schema save", () => {
    const schema = (options: unknown) =>
      ({ size: { type: "string", options } }) as Parameters<typeof assertFieldKeys>[0];
    expect(() => assertFieldKeys(schema([]))).toThrow('Field "size" needs at least one option');
    expect(() => assertFieldKeys(schema([{ value: "a" }, { value: "a" }]))).toThrow(
      'Field "size" lists the option "a" twice',
    );
    expect(() => assertFieldKeys(schema([{ value: "a", label: " " }]))).toThrow("option label");
    expect(() =>
      assertFieldKeys({
        list: { type: "array", itemType: { type: "number", options: [] } },
      }),
    ).toThrow('Field "list" needs at least one option');
    expect(() => assertFieldKeys(schema([{ value: "a", label: "A" }]))).not.toThrow();
  });

  it("accepts options of the field's type only", () => {
    const check = (field: unknown) => Value.Check(contentTypeSchemaSchema, { field });
    expect(check({ type: "string", options: [{ value: "a", label: "A" }] })).toBe(true);
    expect(check({ type: "number", options: [{ value: 1 }] })).toBe(true);
    expect(check({ type: "string", options: [{ value: 1 }] })).toBe(false);
    expect(check({ type: "number", options: [{ value: "1" }] })).toBe(false);
    expect(check({ type: "boolean", options: [{ value: true }] })).toBe(false);
    expect(check({ type: "string", options: [{ value: "a", extra: 1 }] })).toBe(false);
  });
});
