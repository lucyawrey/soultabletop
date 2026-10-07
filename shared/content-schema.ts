// Shape of a ContentType's `schema`, shared by the server (validation) and the
// client (sheet rendering). Every ContentType also has a built-in `name` field
// that maps to the Content's resource name, so schemas can't define `name`.

export type ContentFieldAllow = "reference" | "local" | "both";

// Resource kinds a `resourceLink` field can be limited to.
export const RESOURCE_LINK_KINDS = [
  "system",
  "campaign",
  "contentType",
  "sheet",
  "content",
] as const;
export type ResourceLinkKind = (typeof RESOURCE_LINK_KINDS)[number];

interface ContentFieldBase {
  required?: boolean;
  label?: string;
  description?: string;
}

// One allowed value of a choice field; `label` is what sheets show (the value
// as text when absent).
export interface ContentFieldOption<V extends string | number = string | number> {
  value: V;
  label?: string;
}

export type ContentFieldSchema = ContentFieldBase &
  (
    // `options` makes a choice field: only the listed values are valid.
    // `default` is the starting value of new Content and new List items (see
    // `fieldDefaultError` for what it may hold).
    | { type: "string"; options?: ContentFieldOption<string>[]; default?: string }
    | { type: "number"; options?: ContentFieldOption<number>[]; default?: number }
    | { type: "boolean"; default?: boolean }
    // One string, number, boolean, or null (never an object or array).
    | { type: "scalar"; default?: string | number | boolean | null }
    // `default`: starting items (rows), each a value of `itemType`.
    | { type: "array"; itemType: ContentFieldSchema; default?: unknown[] }
    // Structured: exactly its `entries`, each checked like a top-level field.
    | { type: "struct"; entries: ContentTypeSchema }
    // Free-form: any keys (identifiers) and any nested values, unchecked.
    | { type: "object" }
    // The ID of any readable resource, or only of `kind` if given.
    | { type: "resourceLink"; kind?: ResourceLinkKind }
    // A value is either the ID of existing Content of `contentTypeId` (a
    // reference) or an object of local data following that ContentType's
    // schema. `allow` limits which forms are accepted.
    | { type: "content"; contentTypeId: string; allow: ContentFieldAllow }
  );

export type ContentTypeSchema = Record<string, ContentFieldSchema>;

export const MAX_FIELD_OPTIONS = 200;
// Starting items in an array field's `default`.
export const MAX_DEFAULT_ITEMS = 100;
export const MAX_OPTION_LABEL_LENGTH = 100;

// A choice field's options, or undefined for any other field.
export function fieldOptions(
  field: ContentFieldSchema | undefined,
): ContentFieldOption[] | undefined {
  if (field?.type !== "string" && field?.type !== "number") return undefined;
  return field.options;
}

export function optionLabel(option: ContentFieldOption) {
  return option.label ?? String(option.value);
}

// The label of `value` among `options`, or undefined if it isn't one of them.
export function choiceLabel(options: ContentFieldOption[], value: unknown) {
  const option = options.find((item) => item.value === value);
  return option && optionLabel(option);
}

// Problems with a field's `options` beyond their shape (see
// `contentTypeSchemaSchema`): count, label length, and duplicate values.
export function fieldOptionsError(options: ContentFieldOption[]): string | undefined {
  if (!options.length) return "needs at least one option";
  if (options.length > MAX_FIELD_OPTIONS)
    return `has more than ${MAX_FIELD_OPTIONS} options`;
  const seen = new Set<string | number>();
  for (const option of options) {
    if (typeof option.value === "number" && !Number.isFinite(option.value))
      return "has an option that isn't a finite number";
    if (seen.has(option.value)) return `lists the option ${JSON.stringify(option.value)} twice`;
    seen.add(option.value);
    if (option.label !== undefined && (!option.label.trim() || option.label.length > MAX_OPTION_LABEL_LENGTH))
      return `has an option label that is empty or longer than ${MAX_OPTION_LABEL_LENGTH} characters`;
  }
  return undefined;
}

// Field types that can have a `default`. Free-form objects, references, and
// links can't: a default is checked once, when the schema is saved, and
// references would need the saving user's access.
export const DEFAULT_FIELD_TYPES: readonly ContentFieldSchema["type"][] = [
  "string",
  "number",
  "boolean",
  "scalar",
  "array",
];

// A copy of a field's `default` to store (JSON values only; works on Vue's
// reactive schemas, which structuredClone rejects).
export function copyDefault(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// A field's `default`, or undefined if it has none.
export function fieldDefault(field: ContentFieldSchema | undefined): unknown {
  if (!field || !(DEFAULT_FIELD_TYPES as readonly string[]).includes(field.type)) return undefined;
  return (field as { default?: unknown }).default;
}

// Problems with a field's `default`: it must be a valid value of the field
// (one of a choice field's options; an array's items valid items, structs with
// their required entries and no others), hold no object, content, or
// resourceLink values, and have at most MAX_DEFAULT_ITEMS items per array.
export function fieldDefaultError(field: ContentFieldSchema): string | undefined {
  if (!("default" in field) || field.default === undefined) return undefined;
  if (!(DEFAULT_FIELD_TYPES as readonly string[]).includes(field.type))
    return `can't have a default: only ${DEFAULT_FIELD_TYPES.join(", ")} fields can`;
  const error = fieldDefaultProblem(field);
  return error && `has a default that ${error}`;
}

// What's wrong with a field's `default` value ("isn't one of the options"),
// for messages that name the default themselves.
export function fieldDefaultProblem(field: ContentFieldSchema): string | undefined {
  const value = fieldDefault(field);
  return value === undefined ? undefined : defaultValueError(value, field, "", 0);
}

function defaultValueError(
  value: unknown,
  field: ContentFieldSchema,
  path: string,
  depth: number,
): string | undefined {
  const at = path ? ` at ${path}` : "";
  const options = fieldOptions(field);
  switch (field.type) {
    case "string":
    case "number":
      if (field.type === "string" ? typeof value !== "string" : typeof value !== "number" || !Number.isFinite(value))
        return `isn't a ${field.type}${at}`;
      if (options && choiceLabel(options, value) === undefined) return `isn't one of the options${at}`;
      return undefined;
    case "boolean":
      return typeof value === "boolean" ? undefined : `isn't true or false${at}`;
    case "scalar":
      return value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
        ? undefined
        : `isn't a string, number, boolean, or null${at}`;
    case "array": {
      if (!Array.isArray(value)) return `isn't an array${at}`;
      if (value.length > MAX_DEFAULT_ITEMS) return `has more than ${MAX_DEFAULT_ITEMS} items${at}`;
      if (depth > 8) return `is nested too deeply${at}`;
      for (let index = 0; index < value.length; index += 1) {
        const error = defaultValueError(value[index], field.itemType, `${path}[${index}]`, depth + 1);
        if (error) return error;
      }
      return undefined;
    }
    case "struct": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return `isn't an object${at}`;
      if (depth > 8) return `is nested too deeply${at}`;
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!Object.hasOwn(field.entries, key) || isReservedKey(key))
          return `has a key "${key}" the schema doesn't define${at}`;
      }
      for (const [key, entry] of Object.entries(field.entries)) {
        const entryPath = path ? `${path}.${key}` : key;
        if (!Object.hasOwn(record, key)) {
          if (entry.required) return `is missing the required ${entryPath}`;
          continue;
        }
        const error = defaultValueError(record[key], entry, entryPath, depth + 1);
        if (error) return error;
      }
      return undefined;
    }
    default:
      return `holds a ${field.type} value${at}; defaults can't hold object, content, or resourceLink values`;
  }
}

export const NAME_FIELD = "name";

// Field keys are used in dotted sheet paths, so they must be identifiers.
export const fieldKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Names JavaScript objects inherit or treat specially. They're never field
// keys or path segments, so data and sheet paths can't reach (or write into)
// the object prototype.
export const RESERVED_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

export function isReservedKey(key: string) {
  return RESERVED_KEYS.includes(key);
}

// How many `content` fields a value or sheet path may pass through.
export const MAX_CONTENT_DEPTH = 3;

// Upper bound on referenced Content per Content record.
export const MAX_CONTENT_REFS = 300;

export interface ContentTypeRules {
  schema: ContentTypeSchema;
  hasStrictSchema: boolean;
  // Only the Sheet's own content type's value is used. Missing counts as off.
  showSheetWarnings?: boolean;
}

// The value of `showSheetWarnings` after a content type update: switching from
// strict to non-strict turns it on unless the request sets it.
export function resolveShowSheetWarnings(
  current: { hasStrictSchema: boolean; showSheetWarnings: boolean },
  body: { hasStrictSchema?: boolean; showSheetWarnings?: boolean },
): boolean {
  if (body.showSheetWarnings !== undefined) return body.showSheetWarnings;
  if (current.hasStrictSchema && body.hasStrictSchema === false) return true;
  return current.showSheetWarnings;
}

// IDs of the ContentTypes that `content` fields in `schema` point at.
export function referencedContentTypeIds(
  schema: ContentTypeSchema,
  ids = new Set<string>(),
) {
  const visit = (field: ContentFieldSchema) => {
    if (field.type === "content") ids.add(field.contentTypeId);
    else if (field.type === "array") visit(field.itemType);
    else if (field.type === "struct") referencedContentTypeIds(field.entries, ids);
  };
  Object.values(schema).forEach(visit);
  return ids;
}

// A copy of `schema` whose `content` fields point at `idMap`'s new IDs, for
// ContentTypes copied together (forks). IDs not in the map are kept, and
// field order is kept.
export function remapContentTypeIds(
  schema: ContentTypeSchema,
  idMap: ReadonlyMap<string, string>,
): ContentTypeSchema {
  const remap = (field: ContentFieldSchema): ContentFieldSchema => {
    if (field.type === "content")
      return { ...field, contentTypeId: idMap.get(field.contentTypeId) ?? field.contentTypeId };
    if (field.type === "array") return { ...field, itemType: remap(field.itemType) };
    if (field.type === "struct") return { ...field, entries: remapContentTypeIds(field.entries, idMap) };
    return field;
  };
  return Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, remap(field)]));
}

// Whether an optional struct with these entries starts filled in: some entry
// (or a nested struct's entry) has a `default`, and every required entry can
// get a starting value. A required resourceLink or content entry without a
// default can't, so the struct is left out rather than stored without it,
// which would fail the next save.
export function hasFieldDefaults(schema: ContentTypeSchema, depth = 0): boolean {
  return canFillRequired(schema, depth) && Object.values(schema).some(
    (field) =>
      fieldDefault(field) !== undefined ||
      (field.type === "struct" && depth < 8 && hasFieldDefaults(field.entries, depth + 1)),
  );
}

function canFillRequired(schema: ContentTypeSchema, depth: number): boolean {
  return Object.values(schema).every((field) => {
    if (!field.required || fieldDefault(field) !== undefined) return true;
    if (field.type === "resourceLink" || field.type === "content") return false;
    return field.type !== "struct" || (depth < 8 && canFillRequired(field.entries, depth + 1));
  });
}

// Starting data for new Content created without data: every field with a
// `default` gets a copy of it, and other required fields get empty values
// ("", 0, false, null, [], {}; a choice field its first option). A struct is
// filled the same way when it's required or has entries with defaults.
// Resource links and content fields have no valid empty value, so they are
// left out for the user to fill in.
export function defaultContentData(
  schema: ContentTypeSchema,
  depth = 0,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    const fallback = fieldDefault(field);
    if (fallback !== undefined) {
      data[key] = copyDefault(fallback);
      continue;
    }
    if (field.type === "struct" && depth <= 8 && hasFieldDefaults(field.entries, depth + 1)) {
      data[key] = defaultContentData(field.entries, depth + 1);
      continue;
    }
    if (!field.required) continue;
    const options = fieldOptions(field);
    if (options?.length) {
      data[key] = options[0]!.value;
      continue;
    }
    switch (field.type) {
      case "string":
        data[key] = "";
        break;
      case "number":
        data[key] = 0;
        break;
      case "boolean":
        data[key] = false;
        break;
      case "scalar":
        data[key] = null;
        break;
      case "object":
        data[key] = {};
        break;
      case "array":
        data[key] = [];
        break;
      case "struct":
        data[key] = depth > 8 ? {} : defaultContentData(field.entries, depth + 1);
        break;
    }
  }
  return data;
}
