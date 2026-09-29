// Shape of a ContentType's `schema`, shared by the server (validation) and the
// client (sheet rendering). Every ContentType also has a built-in `name` field
// that maps to the Content's resource name, so schemas can't define `name`.

export type ContentFieldAllow = "ref" | "local" | "both";

// Resource kinds a `resourceLink` field can be limited to.
export const RESOURCE_LINK_KINDS = [
  "system",
  "game",
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

export type ContentFieldSchema = ContentFieldBase &
  (
    | { type: "string" | "number" | "boolean" }
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

export const NAME_FIELD = "name";

// Field keys are used in dotted sheet paths, so they must be identifiers.
export const fieldKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

// How many `content` fields a value or sheet path may pass through.
export const MAX_CONTENT_DEPTH = 3;

// Upper bound on referenced Content per Content record.
export const MAX_CONTENT_REFS = 300;

export interface ContentTypeRules {
  schema: ContentTypeSchema;
  hasStrictSchema: boolean;
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
// empty values ("", 0, false, null, [], {}; a struct with its own required
// entries filled the same way). Resource links and content fields have no
// valid empty value, so they are left out for the user to fill in.
export function defaultContentData(
  schema: ContentTypeSchema,
  depth = 0,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    if (!field.required) continue;
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
