import { describe, expect, it } from "vitest";
import type { ContentTypeSchema } from "./content-schema";
import {
  builderErrors,
  builderToSchema,
  contentTypeErrorId,
  moveBuilderItem,
  newBuilderField,
  parseSchemaJson,
  schemaToBuilder,
} from "./schema-builder";

const typeId = "00000000-0000-4000-8000-000000000001";

const schema: ContentTypeSchema = {
  level: { type: "number", required: true, label: "Level" },
  bio: { type: "string", description: "Backstory" },
  stats: {
    type: "object",
    entries: {
      str: { type: "number", required: true },
      dex: { type: "number" },
    },
  },
  tags: { type: "array", itemType: { type: "string" } },
  attacks: {
    type: "array",
    itemType: {
      type: "object",
      entries: { name: { type: "string" }, bonus: { type: "number" } },
    },
  },
  class: { type: "content", contentTypeId: typeId, allow: "ref", required: true },
  link: { type: "resourceRef" },
  extra: { type: "any" },
  alive: { type: "boolean" },
};

describe("schemaToBuilder / builderToSchema", () => {
  it("round-trips a schema, keeping key order", () => {
    const result = builderToSchema(schemaToBuilder(schema));
    expect(result).toEqual(schema);
    expect(Object.keys(result)).toEqual(Object.keys(schema));
    expect(Object.keys((result.stats as { entries: object }).entries)).toEqual([
      "str",
      "dex",
    ]);
  });

  it("gives every node a unique id", () => {
    const ids: string[] = [];
    const walk = (nodes: ReturnType<typeof schemaToBuilder>) =>
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.item) ids.push(node.item.id);
        walk(node.fields);
        if (node.item) walk(node.item.fields);
      });
    walk(schemaToBuilder(schema));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("saves only the current type's settings and drops empty text", () => {
    const [field] = schemaToBuilder({
      stats: { type: "object", entries: { str: { type: "number" } } },
    });
    field!.type = "string";
    field!.label = "  ";
    field!.description = " Notes ";
    expect(builderToSchema([field!])).toEqual({
      stats: { type: "string", description: "Notes" },
    });
    // Switching back restores the nested fields.
    field!.type = "object";
    expect(builderToSchema([field!]).stats).toMatchObject({
      type: "object",
      entries: { str: { type: "number" } },
    });
  });

  it("gives a new List a text item type", () => {
    const field = newBuilderField("tags");
    field.type = "array";
    expect(builderToSchema([field])).toEqual({
      tags: { type: "array", itemType: { type: "string" } },
    });
  });
});

describe("builderErrors", () => {
  it("accepts a valid schema", () => {
    expect(builderErrors(schemaToBuilder(schema)).size).toBe(0);
  });

  it("flags empty, invalid, duplicate, and reserved keys", () => {
    const fields = ["", "2fast", "hp", "hp", "name"].map((key) =>
      newBuilderField(key),
    );
    const errors = builderErrors(fields);
    expect(fields.map((field) => errors.has(field.id))).toEqual([
      true,
      true,
      false,
      true,
      true,
    ]);
    expect(errors.get(fields[4]!.id)).toMatch(/built in/);
  });

  it("allows `name` inside groups", () => {
    const fields = schemaToBuilder({
      stats: { type: "object", entries: { name: { type: "string" } } },
    });
    expect(builderErrors(fields).size).toBe(0);
  });

  it("checks nested fields and content types", () => {
    const fields = schemaToBuilder({
      stats: { type: "object", entries: { ok: { type: "number" } } },
      list: {
        type: "array",
        itemType: { type: "content", contentTypeId: "", allow: "both" },
      },
    });
    fields[0]!.fields.push(newBuilderField("bad key"));
    const errors = builderErrors(fields);
    expect(errors.get(fields[0]!.fields[1]!.id)).toMatch(/letters/);
    expect(errors.get(contentTypeErrorId(fields[1]!.item!.id))).toBe(
      "Choose a content type",
    );
    expect(errors.has(fields[1]!.item!.id)).toBe(false);
  });
});

describe("parseSchemaJson", () => {
  it("parses a valid schema", () => {
    expect(parseSchemaJson(JSON.stringify(schema))).toEqual({ schema });
  });

  it("rejects invalid JSON and unknown shapes", () => {
    expect(parseSchemaJson("{")).toHaveProperty("error");
    expect(parseSchemaJson("[]")).toHaveProperty("error");
    expect(parseSchemaJson('{"a":{"type":"text"}}')).toHaveProperty("error");
    expect(parseSchemaJson('{"a":{"type":"array"}}')).toHaveProperty("error");
    expect(
      parseSchemaJson('{"a":{"type":"content","contentTypeId":"x"}}'),
    ).toHaveProperty("error");
  });
});

describe("moveBuilderItem", () => {
  it("moves an item within a list", () => {
    const list = ["a", "b", "c", "d"];
    moveBuilderItem(list, 0, 2);
    expect(list).toEqual(["b", "c", "a", "d"]);
    moveBuilderItem(list, 3, 0);
    expect(list).toEqual(["d", "b", "c", "a"]);
  });
});
