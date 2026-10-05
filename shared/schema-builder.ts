// Editable form of a ContentType schema for the schema builder UI
// (`app/components/schema/`). A schema is an ordered object of fields; the
// builder edits it as ordered lists of rows with stable ids (for drag and
// drop and Vue keys), then converts back. Round trips keep key order and
// every setting the builder knows about.

import {
  DEFAULT_FIELD_TYPES,
  fieldDefault,
  fieldDefaultProblem,
  fieldKeyPattern,
  isReservedKey,
  MAX_FIELD_OPTIONS,
  MAX_OPTION_LABEL_LENGTH,
  NAME_FIELD,
  RESOURCE_LINK_KINDS,
  type ContentFieldAllow,
  type ContentFieldOption,
  type ContentFieldSchema,
  type ContentTypeSchema,
  type ResourceLinkKind,
} from "./content-schema";
import { humanizeFieldName } from "./sheet/registry";

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
  // `struct`: its entries.
  fields: BuilderField[];
  // `content`.
  contentTypeId: string;
  allow: ContentFieldAllow;
  // `resourceLink`: "" for any kind.
  kind: ResourceLinkKind | "";
  // `string` and `number`: whether it's a choice field, and its options.
  hasOptions: boolean;
  options: BuilderOption[];
  // The `default` as typed, "" for none: text for `string`, a number for
  // `number`, "true" or "false" for `boolean`, an option's value for a choice
  // field, and JSON for `scalar` and `array`.
  defaultText: string;
}

// One option of a choice field. `value` is text as typed; a `number` field's
// values must parse as numbers to save.
export interface BuilderOption {
  id: string;
  value: string;
  label: string;
}

export interface BuilderField extends BuilderNode {
  key: string;
}

// How the builder shows a schema name (type, property, or value): the same
// words, only spaced and capitalized (`resourceLink` → "Resource Link",
// `contentTypeId` → "Content Type ID"). Never a different word, since the
// builder edits the data format directly.
export function schemaDisplayName(name: string) {
  return humanizeFieldName(name).replace(/\bId\b/g, "ID");
}

// Field types in the order the builder offers them.
export const BUILDER_FIELD_TYPES: BuilderFieldType[] = [
  "string",
  "number",
  "boolean",
  "scalar",
  "resourceLink",
  "array",
  "struct",
  "object",
  "content",
];

// Field types the builder offers a `default` for.
export const DEFAULT_BUILDER_TYPES: readonly BuilderFieldType[] = DEFAULT_FIELD_TYPES;

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
    hasOptions: false,
    options: [],
    defaultText: "",
  };
}

export function newBuilderOption(value = "", label = ""): BuilderOption {
  return { id: newBuilderId(), value, label };
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
  if (field.type === "struct") node.fields = schemaToBuilder(field.entries);
  if (field.type === "content") {
    node.contentTypeId = field.contentTypeId;
    node.allow = field.allow;
  }
  if (field.type === "resourceLink") node.kind = field.kind ?? "";
  if ((field.type === "string" || field.type === "number") && field.options) {
    node.hasOptions = true;
    node.options = field.options.map((option) =>
      newBuilderOption(String(option.value), option.label ?? ""),
    );
  }
  const value = fieldDefault(field);
  if (value !== undefined) {
    node.defaultText =
      field.type === "array"
        ? JSON.stringify(value, null, 2)
        : field.type === "scalar"
          ? JSON.stringify(value)
          : String(value);
  }
  return node;
}

// A node's `default` from its text: undefined for none (or a type without
// defaults), else the value or why it can't be read.
export function builderDefault(
  node: BuilderNode,
): { value: unknown } | { error: string } | undefined {
  const text = node.defaultText;
  if (!text.trim() || !(DEFAULT_FIELD_TYPES as readonly string[]).includes(node.type))
    return undefined;
  switch (node.type) {
    case "string":
      return { value: text };
    case "number": {
      const value = parseNumberOption(text);
      return value === undefined ? { error: "Enter a number" } : { value };
    }
    case "boolean":
      return text === "true" || text === "false"
        ? { value: text === "true" }
        : { error: "Choose true or false" };
    default:
      try {
        return { value: JSON.parse(text) };
      } catch {
        return {
          error:
            node.type === "array"
              ? 'Enter a JSON array, like ["a", "b"] or [{ "name": "Unarmed" }]'
              : 'Enter JSON: text in quotes ("Medium"), a number, true, false, or null',
        };
      }
  }
}

function withDefault(node: BuilderNode) {
  const parsed = builderDefault(node);
  return parsed && "value" in parsed ? { default: parsed.value } : {};
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
        ...(withDefault(node) as { default?: unknown[] }),
        ...base,
      };
    case "struct":
      return { type: "struct", entries: builderToSchema(node.fields), ...base };
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
    case "string":
      return {
        type: "string",
        ...(node.hasOptions ? { options: builderOptions(node, (value) => value) } : {}),
        ...(withDefault(node) as { default?: string }),
        ...base,
      };
    case "number":
      return {
        type: "number",
        ...(node.hasOptions ? { options: builderOptions(node, (value) => Number(value.trim())) } : {}),
        ...(withDefault(node) as { default?: number }),
        ...base,
      };
    case "boolean":
      return { type: "boolean", ...(withDefault(node) as { default?: boolean }), ...base };
    case "scalar":
      return {
        type: "scalar",
        ...(withDefault(node) as { default?: string | number | boolean | null }),
        ...base,
      };
    case "object":
      return { type: node.type, ...base };
  }
}

function builderOptions<V extends string | number>(
  node: BuilderNode,
  parse: (value: string) => V,
): ContentFieldOption<V>[] {
  return node.options.map((option) => ({
    value: parse(option.value),
    ...(option.label.trim() ? { label: option.label.trim() } : {}),
  }));
}

// A number option's value, or undefined if it doesn't parse.
function parseNumberOption(value: string) {
  const number = Number(value.trim());
  return value.trim() && Number.isFinite(number) ? number : undefined;
}

export function builderToSchema(fields: BuilderField[]): ContentTypeSchema {
  return Object.fromEntries(
    fields.map((field) => [field.key.trim(), fromNode(field)]),
  );
}

// Problems that block saving: bad or duplicate keys and the reserved
// top-level `name` (by node id), content fields without a content type (by
// `contentTypeErrorId(node id)`), choice fields without options (by
// `optionsErrorId(node id)`), bad option values or labels (by option id), and
// bad defaults (by `defaultErrorId(node id)`).
export function builderErrors(fields: BuilderField[]): Map<string, string> {
  const errors = new Map<string, string>();
  const visitNode = (node: BuilderNode) => {
    if (node.type === "content" && !node.contentTypeId)
      errors.set(contentTypeErrorId(node.id), "Choose a content type");
    if ((node.type === "string" || node.type === "number") && node.hasOptions)
      visitOptions(node);
    const parsed = builderDefault(node);
    if (parsed && "error" in parsed) errors.set(defaultErrorId(node.id), parsed.error);
    else if (parsed) {
      const problem = fieldDefaultProblem(fromNode(node));
      if (problem) errors.set(defaultErrorId(node.id), `This default ${problem}`);
    }
    if (node.type === "array") visitNode(node.item ?? newBuilderNode());
    if (node.type === "struct") visitList(node.fields, false);
  };
  const visitOptions = (node: BuilderNode) => {
    if (!node.options.length)
      errors.set(optionsErrorId(node.id), "Add at least one option");
    else if (node.options.length > MAX_FIELD_OPTIONS)
      errors.set(optionsErrorId(node.id), `Use at most ${MAX_FIELD_OPTIONS} options`);
    const seen = new Set<string | number>();
    for (const option of node.options) {
      const value =
        node.type === "number" ? parseNumberOption(option.value) : option.value;
      if (value === undefined) errors.set(option.id, "Enter a number");
      else if (value === "") errors.set(option.id, "Enter a value");
      else if (seen.has(value)) errors.set(option.id, "This value is listed twice");
      else if (option.label.trim().length > MAX_OPTION_LABEL_LENGTH)
        errors.set(option.id, `Use at most ${MAX_OPTION_LABEL_LENGTH} characters for the label`);
      if (value !== undefined) seen.add(value);
    }
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
      else if (isReservedKey(key))
        errors.set(field.id, "That name is reserved; choose another key");
      else if (topLevel && key === NAME_FIELD)
        errors.set(field.id, '"name" is built in; choose another key');
      else if (seen.has(key)) errors.set(field.id, `"${key}" is used twice`);
      seen.add(key);
      if (!errors.has(field.id)) visitNode(field);
      else if (field.type === "struct") visitList(field.fields, false);
    }
  };
  visitList(fields, true);
  return errors;
}

export function contentTypeErrorId(nodeId: string) {
  return `${nodeId}:contentType`;
}

export function optionsErrorId(nodeId: string) {
  return `${nodeId}:options`;
}

export function defaultErrorId(nodeId: string) {
  return `${nodeId}:default`;
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
  // Other types would lose their default in the builder.
  if (field.default !== undefined && !(DEFAULT_FIELD_TYPES as readonly string[]).includes(field.type))
    return false;
  if (field.type === "array") return isFieldShape(field.itemType, depth + 1);
  if (field.type === "struct") return isSchemaShape(field.entries, depth + 1);
  if (field.type === "resourceLink")
    return (
      field.kind === undefined ||
      (RESOURCE_LINK_KINDS as readonly unknown[]).includes(field.kind)
    );
  if (field.type === "content")
    return (
      typeof field.contentTypeId === "string" &&
      ["reference", "local", "both"].includes(field.allow as string)
    );
  if (field.options !== undefined) {
    if (field.type !== "string" && field.type !== "number") return false;
    return (
      Array.isArray(field.options) &&
      field.options.every(
        (option: unknown) =>
          !!option &&
          typeof option === "object" &&
          typeof (option as ContentFieldOption).value === field.type &&
          ["undefined", "string"].includes(typeof (option as ContentFieldOption).label),
      )
    );
  }
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
        "The schema must be an object of fields, each with a known type (and itemType, entries, contentTypeId and allow, a known kind, or options of the field's type where needed; a default only on string, number, boolean, scalar, and array fields).",
    };
  return { schema: value as ContentTypeSchema };
}
