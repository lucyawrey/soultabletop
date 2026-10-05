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
    | { type: "string"; options?: ContentFieldOption<string>[] }
    | { type: "number"; options?: ContentFieldOption<number>[] }
    | { type: "boolean" }
    // One string, number, boolean, or null (never an object or array).
    | { type: "scalar" }
    | { type: "array"; itemType: ContentFieldSchema }
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

// Starting data for new Content created without data: required fields get
// empty values ("", 0, false, null, [], {}; a choice field its first option; a
// struct with its own required entries filled the same way). Resource links and content fields have no
// valid empty value, so they are left out for the user to fill in.
export function defaultContentData(
  schema: ContentTypeSchema,
  depth = 0,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
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
