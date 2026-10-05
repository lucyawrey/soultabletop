import { eq, inArray } from "drizzle-orm";
import type { User } from "better-auth";
import { createError } from "h3";
import { content, contentType, resource } from "../database/schema";
import {
  choiceLabel,
  fieldKeyPattern,
  fieldOptions,
  fieldOptionsError,
  isReservedKey,
  MAX_CONTENT_DEPTH,
  MAX_CONTENT_REFS,
  NAME_FIELD,
  referencedContentTypeIds,
  type ContentFieldOption,
  type ContentFieldSchema,
  type ContentTypeRules,
  type ContentTypeSchema,
  type ResourceLinkKind,
} from "../../shared/content-schema";
import { useDatabase } from "./database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "./resource-access";
import { uuidPattern } from "./resource-management";

// `content` field values found while walking data, checked afterwards in
// batches because they need database lookups.
interface Pending {
  // Skip "is required" for missing fields (new Content created with default
  // data, whose reference fields start empty).
  allowMissingRequired: boolean;
  locals: {
    value: Record<string, unknown>;
    contentTypeId: string;
    path: string;
    depth: number;
  }[];
  refs: { id: string; contentTypeId: string; path: string }[];
  links: { id: string; kind: ResourceLinkKind | undefined; path: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateField(
  value: unknown,
  field: ContentFieldSchema,
  strict: boolean,
  path: string,
  depth: number,
  pending: Pending,
): string | undefined {
  switch (field.type) {
    case "string":
      if (typeof value !== "string") return `${path} must be a string`;
      return optionError(value, field.options, path);
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value))
        return `${path} must be a number`;
      return optionError(value, field.options, path);
    case "boolean":
      return typeof value === "boolean"
        ? undefined
        : `${path} must be a boolean`;
    case "scalar":
      return value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
        ? undefined
        : `${path} must be a string, number, boolean, or null`;
    case "object":
      return isRecord(value)
        ? freeObjectError(value, path, 0)
        : `${path} must be an object`;
    case "resourceLink":
      if (typeof value !== "string" || !uuidPattern.test(value))
        return `${path} must be a resource ID`;
      pending.links.push({ id: value, kind: field.kind, path });
      return undefined;
    case "content":
      if (typeof value === "string") {
        if (field.allow === "local")
          return `${path} must be custom data, not a reference`;
        if (!uuidPattern.test(value)) return `${path} must be a content ID`;
        pending.refs.push({ id: value, contentTypeId: field.contentTypeId, path });
        return undefined;
      }
      if (isRecord(value)) {
        if (field.allow === "reference")
          return `${path} must reference existing content`;
        if (depth >= MAX_CONTENT_DEPTH)
          return `${path} nests custom content more than ${MAX_CONTENT_DEPTH} levels deep`;
        pending.locals.push({
          value,
          contentTypeId: field.contentTypeId,
          path,
          depth: depth + 1,
        });
        return undefined;
      }
      return `${path} must be a content ID or an object`;
    case "array":
      if (!Array.isArray(value)) return `${path} must be an array`;
      for (let index = 0; index < value.length; index += 1) {
        const error = validateField(
          value[index],
          field.itemType,
          strict,
          `${path}[${index}]`,
          depth,
          pending,
        );
        if (error) return error;
      }
      return undefined;
    case "struct":
      return validateObject(value, field.entries, strict, path, depth, pending);
    default:
      // Field types from older schemas are accepted as-is.
      return undefined;
  }
}

// A choice field's value must be one of its options, whatever the strictness.
function optionError(
  value: string | number,
  options: ContentFieldOption[] | undefined,
  path: string,
) {
  if (!options || choiceLabel(options, value) !== undefined) return undefined;
  const listed = options
    .slice(0, 10)
    .map((option) => JSON.stringify(option.value))
    .join(", ");
  return `${path} must be one of ${listed}${options.length > 10 ? ", …" : ""}`;
}

// Free-form `object` values: anything goes, but keys at every level must be
// identifiers (so sheet paths can reach them) and nesting is bounded.
export function freeObjectError(
  value: unknown,
  path: string,
  nesting: number,
): string | undefined {
  if (nesting > 32) return `${path} is nested too deeply`;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = freeObjectError(value[index], `${path}[${index}]`, nesting + 1);
      if (error) return error;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, item] of Object.entries(value)) {
    if (!fieldKeyPattern.test(key))
      return `${path} has key "${key}"; keys must start with a letter or underscore and contain only letters, numbers, and underscores`;
    if (isReservedKey(key)) return `${path} has key "${key}", which is reserved`;
    const error = freeObjectError(item, `${path}.${key}`, nesting + 1);
    if (error) return error;
  }
  return undefined;
}

function validateObject(
  value: unknown,
  schema: ContentTypeSchema,
  strict: boolean,
  path: string,
  depth: number,
  pending: Pending,
): string | undefined {
  if (!isRecord(value)) return `${path || "data"} must be an object`;

  for (const [key, field] of Object.entries(schema)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(value, key)) {
      if (field.required && !pending.allowMissingRequired)
        return `${fieldPath} is required`;
      continue;
    }

    const error = validateField(
      value[key],
      field,
      strict,
      fieldPath,
      depth,
      pending,
    );
    if (error) return error;
  }

  if (strict) {
    const extraKey = Object.keys(value).find((key) => !Object.hasOwn(schema, key));
    if (extraKey) return `${path ? `${path}.` : ""}${extraKey} is not allowed`;
  }

  return undefined;
}

async function loadContentTypeRules(ids: string[]) {
  const rows = ids.length
    ? await useDatabase()
        .select({
          id: contentType.resourceId,
          schema: contentType.schema,
          hasStrictSchema: contentType.hasStrictSchema,
        })
        .from(contentType)
        .where(inArray(contentType.resourceId, ids))
    : [];
  return new Map<string, ContentTypeRules>(rows.map((row) => [row.id, row]));
}

// Validates Content `data` (without its `name`, see `extractDataName`) against
// its ContentType. Local data in `content` fields is validated against the
// referenced ContentType; references must exist, match that ContentType, and be
// readable by `user`. Returns the first problem found.
export async function validateContentData(
  user: Pick<User, "id" | "name">,
  data: unknown,
  rules: ContentTypeRules,
  options: { allowMissingRequired?: boolean } = {},
): Promise<string | undefined> {
  const pending: Pending = {
    allowMissingRequired: options.allowMissingRequired === true,
    locals: [],
    refs: [],
    links: [],
  };
  const error = validateObject(
    data,
    rules.schema,
    rules.hasStrictSchema,
    "",
    0,
    pending,
  );
  if (error) return error;

  const typeRules = new Map<string, ContentTypeRules>();
  while (pending.locals.length) {
    const batch = pending.locals.splice(0);
    const missingIds = [
      ...new Set(batch.map((local) => local.contentTypeId)),
    ].filter((id) => !typeRules.has(id));
    for (const [id, loaded] of await loadContentTypeRules(missingIds))
      typeRules.set(id, loaded);

    for (const local of batch) {
      const localRules = typeRules.get(local.contentTypeId);
      if (!localRules)
        return `${local.path} uses a content type that no longer exists`;
      const { [NAME_FIELD]: name, ...rest } = local.value;
      if (typeof name !== "string" || !name.trim())
        return `${local.path}.${NAME_FIELD} is required`;
      const localError = validateObject(
        rest,
        localRules.schema,
        localRules.hasStrictSchema,
        local.path,
        local.depth,
        pending,
      );
      if (localError) return localError;
    }
  }

  if (pending.refs.length > MAX_CONTENT_REFS)
    return `Content may reference at most ${MAX_CONTENT_REFS} other content`;
  if (pending.links.length > MAX_CONTENT_REFS)
    return `Content may link at most ${MAX_CONTENT_REFS} resources`;
  return (await checkRefs(user, pending)) ?? (await checkLinks(user, pending));
}

async function checkRefs(user: Pick<User, "id" | "name">, pending: Pending) {
  const refIds = [...new Set(pending.refs.map((ref) => ref.id))];
  if (!refIds.length) return undefined;

  const rows = await useDatabase()
    .select({ resource, contentTypeId: content.contentTypeId })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .where(inArray(content.resourceId, refIds));
  const byId = new Map(rows.map((row) => [row.resource.id, row]));
  const context = await loadResourceAccessContext(user, refIds);
  for (const ref of pending.refs) {
    const row = byId.get(ref.id);
    if (!row || !getResourceAccess(row.resource, context).canRead)
      return `${ref.path} references content that doesn't exist or isn't accessible`;
    if (row.contentTypeId !== ref.contentTypeId)
      return `${ref.path} must reference content of the field's content type`;
  }
  return undefined;
}

// `resourceLink` values must be resources `user` can read, of the field's
// `kind` if it has one.
async function checkLinks(user: Pick<User, "id" | "name">, pending: Pending) {
  const ids = [...new Set(pending.links.map((link) => link.id))];
  if (!ids.length) return undefined;

  const rows = await useDatabase()
    .select()
    .from(resource)
    .where(inArray(resource.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const context = await loadResourceAccessContext(user, ids);
  for (const link of pending.links) {
    const row = byId.get(link.id);
    if (!row || !getResourceAccess(row, context).canRead)
      return `${link.path} links to a resource that doesn't exist or isn't accessible`;
    if (link.kind && row.kind !== link.kind)
      return `${link.path} must link to a ${RESOURCE_KIND_NAMES[link.kind]}`;
  }
  return undefined;
}

const RESOURCE_KIND_NAMES: Record<ResourceLinkKind, string> = {
  system: "system",
  campaign: "campaign",
  contentType: "content type",
  sheet: "sheet",
  content: "content record",
};

// Every ContentType has a built-in `name` field stored as the resource name.
// A `name` key in submitted data is moved there; an explicit `name` in the
// request body takes precedence.
export function extractDataName(data: Record<string, unknown>) {
  if (!(NAME_FIELD in data)) return { data };
  const { [NAME_FIELD]: name, ...rest } = data;
  if (typeof name !== "string" || !name.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "data.name must be a non-empty string",
    });
  }
  return { data: rest, name: name.trim() };
}

// Rejects field keys that aren't identifiers or are reserved (TypeBox's Record
// ignores key patterns), and choice fields with bad `options`, at every
// nesting level.
export function assertFieldKeys(schema: ContentTypeSchema) {
  const visit = (field: ContentFieldSchema, key: string) => {
    const options = fieldOptions(field);
    const optionsError = options && fieldOptionsError(options);
    if (optionsError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Field "${key}" ${optionsError}`,
      });
    }
    if (field.type === "array") visit(field.itemType, key);
    else if (field.type === "struct") assertFieldKeys(field.entries);
  };
  for (const [key, field] of Object.entries(schema)) {
    if (!fieldKeyPattern.test(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Field key "${key}" must start with a letter or underscore and contain only letters, numbers, and underscores`,
      });
    }
    if (isReservedKey(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Field key "${key}" is reserved; choose another key`,
      });
    }
    visit(field, key);
  }
}

// Checks a ContentType schema beyond its shape (see `contentTypeSchemaSchema`):
// field keys are identifiers, options are valid, `name` is reserved, and `content` fields must
// point at ContentTypes the user can read.
export async function assertContentTypeSchema(
  user: Pick<User, "id" | "name">,
  schema: ContentTypeSchema,
) {
  assertFieldKeys(schema);
  if (NAME_FIELD in schema) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "\"name\" is a built-in field of every content type and can't be defined in the schema",
    });
  }

  const ids = [...referencedContentTypeIds(schema)];
  if (!ids.length) return;
  const rows = await useDatabase()
    .select()
    .from(resource)
    .where(inArray(resource.id, ids));
  const context = await loadResourceAccessContext(user, ids);
  for (const id of ids) {
    const row = rows.find((item) => item.id === id);
    if (
      !row ||
      row.kind !== "contentType" ||
      !getResourceAccess(row, context).canRead
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `Schema references content type ${id}, which doesn't exist or isn't accessible`,
      });
    }
  }
}
