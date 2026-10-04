import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { contentTypeSchemaSchema } from "./api-schemas";
import { assertFieldKeys, freeObjectError } from "./content-validation";

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
