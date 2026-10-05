import { describe, expect, it } from "vitest";
import type { ContentTypeSchema } from "./content-schema";
import {
  builderErrors,
  builderToSchema,
  contentTypeErrorId,
  defaultErrorId,
  moveBuilderItem,
  newBuilderField,
  newBuilderOption,
  optionsErrorId,
  parseSchemaJson,
  schemaDisplayName,
  schemaToBuilder,
} from "./schema-builder";

const typeId = "00000000-0000-4000-8000-000000000001";

const schema: ContentTypeSchema = {
  level: { type: "number", required: true, label: "Level" },
  bio: { type: "string", description: "Backstory" },
  stats: {
    type: "struct",
    entries: {
      str: { type: "number", required: true },
      dex: { type: "number" },
    },
  },
  tags: { type: "array", itemType: { type: "string" } },
  attacks: {
    type: "array",
    itemType: {
      type: "struct",
      entries: { name: { type: "string" }, bonus: { type: "number" } },
    },
  },
  class: { type: "content", contentTypeId: typeId, allow: "reference", required: true },
  link: { type: "resourceLink" },
  home: { type: "resourceLink", kind: "campaign" },
  extra: { type: "scalar" },
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
      stats: { type: "struct", entries: { str: { type: "number" } } },
    });
    field!.type = "string";
    field!.label = "  ";
    field!.description = " Notes ";
    expect(builderToSchema([field!])).toEqual({
      stats: { type: "string", description: "Notes" },
    });
    // Switching back restores the nested fields.
    field!.type = "struct";
    expect(builderToSchema([field!]).stats).toMatchObject({
      type: "struct",
      entries: { str: { type: "number" } },
    });
  });

  it("gives a new array a string item type", () => {
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

  it.each(["__proto__", "constructor", "prototype"])("rejects the reserved key %s", (key) => {
    const fields = schemaToBuilder({
      stats: { type: "struct", entries: { ok: { type: "number" } } },
    });
    fields.push(newBuilderField(key));
    fields[0]!.fields.push(newBuilderField(key));
    const errors = builderErrors(fields);
    expect(errors.get(fields[1]!.id)).toBe("That name is reserved; choose another key");
    expect(errors.get(fields[0]!.fields[1]!.id)).toBe("That name is reserved; choose another key");
  });

  it("allows `name` inside groups", () => {
    const fields = schemaToBuilder({
      stats: { type: "struct", entries: { name: { type: "string" } } },
    });
    expect(builderErrors(fields).size).toBe(0);
  });

  it("checks nested fields and content types", () => {
    const fields = schemaToBuilder({
      stats: { type: "struct", entries: { ok: { type: "number" } } },
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
    expect(
      parseSchemaJson('{"a":{"type":"resourceLink","kind":"group"}}'),
    ).toHaveProperty("error");
  });
});

describe("schemaDisplayName", () => {
  it("only spaces and capitalizes the schema's own words", () => {
    expect(
      ["struct", "resourceLink", "contentTypeId", "itemType", "contentType", "ref"].map(
        schemaDisplayName,
      ),
    ).toEqual(["Struct", "Resource Link", "Content Type ID", "Item Type", "Content Type", "Ref"]);
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

describe("options", () => {
  const choices: ContentTypeSchema = {
    size: { type: "string", options: [{ value: "s", label: "Small" }, { value: "m" }] },
    ranks: {
      type: "array",
      itemType: { type: "number", options: [{ value: 0, label: "Untrained" }, { value: 2 }] },
    },
  };

  it("round-trips options and their order", () => {
    expect(builderToSchema(schemaToBuilder(choices))).toEqual(choices);
    expect(parseSchemaJson(JSON.stringify(choices))).toEqual({ schema: choices });
  });

  it("drops options when turned off, and keeps them for turning back on", () => {
    const [field] = schemaToBuilder(choices);
    field!.hasOptions = false;
    expect(builderToSchema([field!])).toEqual({ size: { type: "string" } });
    field!.hasOptions = true;
    field!.options[1]!.label = "  Medium ";
    expect(builderToSchema([field!]).size).toEqual({
      type: "string",
      options: [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }],
    });
  });

  it("parses number values", () => {
    const field = newBuilderField("rank");
    field.type = "number";
    field.hasOptions = true;
    field.options = [newBuilderOption(" 1 "), newBuilderOption("2.5", "Half")];
    expect(builderToSchema([field])).toEqual({
      rank: { type: "number", options: [{ value: 1 }, { value: 2.5, label: "Half" }] },
    });
  });

  it("flags empty lists, empty or duplicate values, and numbers that don't parse", () => {
    const fields = schemaToBuilder(choices);
    expect(builderErrors(fields).size).toBe(0);
    const size = fields[0]!;
    size.options.push(newBuilderOption("s"), newBuilderOption(""));
    const item = fields[1]!.item!;
    item.options.push(newBuilderOption("two"));
    const empty = newBuilderField("empty");
    empty.hasOptions = true;
    const errors = builderErrors([...fields, empty]);
    expect(errors.get(size.options[2]!.id)).toBe("This value is listed twice");
    expect(errors.get(size.options[3]!.id)).toBe("Enter a value");
    expect(errors.get(item.options[2]!.id)).toBe("Enter a number");
    expect(errors.get(optionsErrorId(empty.id))).toBe("Add at least one option");
  });

  it("rejects options of the wrong type in JSON", () => {
    expect(parseSchemaJson('{"a": {"type": "number", "options": [{"value": "1"}]}}')).toHaveProperty("error");
    expect(parseSchemaJson('{"a": {"type": "boolean", "options": [{"value": true}]}}')).toHaveProperty("error");
    expect(parseSchemaJson('{"a": {"type": "string", "options": "a, b"}}')).toHaveProperty("error");
  });
});

describe("defaults", () => {
  const withDefaults: ContentTypeSchema = {
    name2: { type: "string", default: "Human" },
    size: { type: "string", options: [{ value: "s" }, { value: "m" }], default: "m" },
    level: { type: "number", default: 1 },
    alive: { type: "boolean", default: false },
    extra: { type: "scalar", default: "Medium" },
    tags: { type: "array", itemType: { type: "string", default: "new" }, default: ["a", "b"] },
  };

  it("round-trips defaults", () => {
    expect(builderToSchema(schemaToBuilder(withDefaults))).toEqual(withDefaults);
    expect(parseSchemaJson(JSON.stringify(withDefaults))).toEqual({ schema: withDefaults });
  });

  it("reads defaults from their text, and saves none for empty text", () => {
    const field = newBuilderField("level");
    field.type = "number";
    field.defaultText = " 2.5 ";
    expect(builderToSchema([field]).level).toEqual({ type: "number", default: 2.5 });
    field.defaultText = " ";
    expect(builderToSchema([field]).level).toEqual({ type: "number" });
    // Only types that take a default save one.
    field.type = "object";
    field.defaultText = "{}";
    expect(builderToSchema([field]).level).toEqual({ type: "object" });
  });

  it("flags defaults that don't parse or don't fit", () => {
    const fields = schemaToBuilder(withDefaults);
    expect(builderErrors(fields).size).toBe(0);
    const [, size, level, , extra, tags] = fields;
    size!.defaultText = "xl";
    level!.defaultText = "one";
    extra!.defaultText = "Medium";
    tags!.defaultText = '["a", 1]';
    const errors = builderErrors(fields);
    expect(errors.get(defaultErrorId(size!.id))).toBe("This default isn't one of the options");
    expect(errors.get(defaultErrorId(level!.id))).toBe("Enter a number");
    expect(errors.get(defaultErrorId(extra!.id))).toMatch(/^Enter JSON/);
    expect(errors.get(defaultErrorId(tags!.id))).toBe("This default isn't a string at [1]");
  });

  it("rejects defaults on types that can't have one in JSON", () => {
    expect(parseSchemaJson('{"a": {"type": "object", "default": {}}}')).toHaveProperty("error");
  });
});
