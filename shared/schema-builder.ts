// Editable form of a ContentType schema for the schema builder UI
// (`app/components/schema/`). A schema is an ordered object of fields; the
// builder edits it as ordered lists of rows with stable ids (for drag and
// drop and Vue keys), then converts back. Round trips keep key order and
// every setting the builder knows about.

import {
  fieldKeyPattern,
  NAME_FIELD,
  RESOURCE_LINK_KINDS,
  type ContentFieldAllow,
  type ContentFieldSchema,
  type ContentTypeSchema,
  type ResourceLinkKind,
} from "./content-schema";

export type BuilderFieldType = ContentFieldSchema["type"];

// One field, or the item type of an `array`. Every node keeps the settings of all
// types, so switching a field's type and back doesn't lose its nested fields
// or content type choice; only the current type's settings are saved.
export interface BuilderNode {
  id: string;
  type: BuilderFieldType;
  required: boolean;
  label: string;
  description: string;
  // `array`: the type of each item.
  item: BuilderNode | null;
  // `object`: its entries.
  fields: BuilderField[];
  // `content`.
  contentTypeId: string;
  allow: ContentFieldAllow;
  // `resourceLink`: "" for any kind.
  kind: ResourceLinkKind | "";
}

export interface BuilderField extends BuilderNode {
  key: string;
}

// Field types in the order the builder offers them. The builder shows the
// schema's own type names, since it edits the data format directly.
export const BUILDER_FIELD_TYPES: BuilderFieldType[] = [
  "string",
  "number",
  "boolean",
  "any",
  "resourceLink",
  "array",
  "object",
  "content",
];

let nextId = 0;
export function newBuilderId() {
  nextId += 1;
  return `field-${nextId}`;
}

export function newBuilderNode(type: BuilderFieldType = "string"): BuilderNode {
  return {
    id: newBuilderId(),
    type,
    required: false,
    label: "",
    description: "",
    item: null,
    fields: [],
    contentTypeId: "",
    allow: "both",
    kind: "",
  };
}

export function newBuilderField(key = ""): BuilderField {
  return { ...newBuilderNode(), key };
}

function toNode(field: ContentFieldSchema): BuilderNode {
  const node = newBuilderNode(field.type);
  node.required = field.required === true;
  node.label = field.label ?? "";
  node.description = field.description ?? "";
  if (field.type === "array") node.item = toNode(field.itemType);
  if (field.type === "object") node.fields = schemaToBuilder(field.entries);
  if (field.type === "content") {
    node.contentTypeId = field.contentTypeId;
    node.allow = field.allow;
  }
  if (field.type === "resourceLink") node.kind = field.kind ?? "";
  return node;
}

export function schemaToBuilder(schema: ContentTypeSchema): BuilderField[] {
  return Object.entries(schema).map(([key, field]) => ({
    ...toNode(field),
    key,
  }));
}

function fromNode(node: BuilderNode): ContentFieldSchema {
  const base = {
    ...(node.required ? { required: true } : {}),
    ...(node.label.trim() ? { label: node.label.trim() } : {}),
    ...(node.description.trim()
      ? { description: node.description.trim() }
      : {}),
  };
  switch (node.type) {
    case "array":
      return {
        type: "array",
        itemType: fromNode(node.item ?? newBuilderNode()),
        ...base,
      };
    case "object":
      return { type: "object", entries: builderToSchema(node.fields), ...base };
    case "content":
      return {
        type: "content",
        contentTypeId: node.contentTypeId,
        allow: node.allow,
        ...base,
      };
    case "resourceLink":
      return {
        type: "resourceLink",
        ...(node.kind ? { kind: node.kind } : {}),
        ...base,
      };
    default:
      return { type: node.type, ...base };
  }
}

export function builderToSchema(fields: BuilderField[]): ContentTypeSchema {
  return Object.fromEntries(
    fields.map((field) => [field.key.trim(), fromNode(field)]),
  );
}

// Problems that block saving: bad or duplicate keys and the reserved
// top-level `name` (by node id), and content fields without a content type
// (by `contentTypeErrorId(node id)`).
export function builderErrors(fields: BuilderField[]): Map<string, string> {
  const errors = new Map<string, string>();
  const visitNode = (node: BuilderNode) => {
    if (node.type === "content" && !node.contentTypeId)
      errors.set(contentTypeErrorId(node.id), "Choose a content type");
    if (node.type === "array") visitNode(node.item ?? newBuilderNode());
    if (node.type === "object") visitList(node.fields, false);
  };
  const visitList = (list: BuilderField[], topLevel: boolean) => {
    const seen = new Set<string>();
    for (const field of list) {
      const key = field.key.trim();
      if (!key) errors.set(field.id, "Enter a key");
      else if (!fieldKeyPattern.test(key))
        errors.set(
          field.id,
          "Use letters, numbers, and underscores, starting with a letter or underscore",
        );
      else if (topLevel && key === NAME_FIELD)
        errors.set(field.id, '"name" is built in; choose another key');
      else if (seen.has(key)) errors.set(field.id, `"${key}" is used twice`);
      seen.add(key);
      if (!errors.has(field.id)) visitNode(field);
      else if (field.type === "object") visitList(field.fields, false);
    }
  };
  visitList(fields, true);
  return errors;
}

export function contentTypeErrorId(nodeId: string) {
  return `${nodeId}:contentType`;
}

// Moves an item within one list (drag and drop).
export function moveBuilderItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(to, list.length)), 0, item as T);
}

const FIELD_TYPES = new Set<string>(BUILDER_FIELD_TYPES);

function isFieldShape(value: unknown, depth: number): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const field = value as Record<string, unknown>;
  if (typeof field.type !== "string" || !FIELD_TYPES.has(field.type)) return false;
  if (depth > 32) return false;
  if (field.type === "array") return isFieldShape(field.itemType, depth + 1);
  if (field.type === "object") return isSchemaShape(field.entries, depth + 1);
  if (field.type === "resourceLink")
    return (
      field.kind === undefined ||
      (RESOURCE_LINK_KINDS as readonly unknown[]).includes(field.kind)
    );
  if (field.type === "content")
    return (
      typeof field.contentTypeId === "string" &&
      ["ref", "local", "both"].includes(field.allow as string)
    );
  return true;
}

function isSchemaShape(value: unknown, depth: number): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((field) => isFieldShape(field, depth))
  );
}

// Parses the builder's JSON view. Only checks the shape the builder needs;
// the server does the full validation on save.
export function parseSchemaJson(
  text: string,
): { schema: ContentTypeSchema } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { error: `Invalid JSON: ${(error as Error).message}` };
  }
  if (!isSchemaShape(value, 0))
    return {
      error:
        "The schema must be an object of fields, each with a known type (and itemType, entries, contentTypeId and allow, or a known kind where needed).",
    };
  return { schema: value as ContentTypeSchema };
}
