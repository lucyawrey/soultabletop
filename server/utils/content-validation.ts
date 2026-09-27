import type { ContentFieldSchema, ContentTypeSchema } from "../database/schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateField(
  value: unknown,
  field: ContentFieldSchema,
  strict: boolean,
  path: string,
): string | undefined {
  switch (field.type) {
    case "string":
      return typeof value === "string" ? undefined : `${path} must be a string`;
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? undefined
        : `${path} must be a number`;
    case "boolean":
      return typeof value === "boolean"
        ? undefined
        : `${path} must be a boolean`;
    case "any":
    case "localType":
      return undefined;
    case "resourceRef":
      return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        )
        ? undefined
        : `${path} must be a Resource ID`;
    case "contentType":
      return value === field.resourceId
        ? undefined
        : `${path} must reference the specified ContentType`;
    case "array":
      if (!Array.isArray(value)) return `${path} must be an array`;
      for (let index = 0; index < value.length; index += 1) {
        const error = validateField(
          value[index],
          field.itemType,
          strict,
          `${path}[${index}]`,
        );
        if (error) return error;
      }
      return undefined;
    case "object":
      return validateObject(value, field.entries, strict, path);
  }
}

function validateObject(
  value: unknown,
  schema: ContentTypeSchema,
  strict: boolean,
  path: string,
): string | undefined {
  if (!isRecord(value)) return `${path} must be an object`;

  for (const [key, field] of Object.entries(schema)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (!(key in value)) {
      if (field.required) return `${fieldPath} is required`;
      continue;
    }

    const error = validateField(value[key], field, strict, fieldPath);
    if (error) return error;
  }

  if (strict) {
    const extraKey = Object.keys(value).find((key) => !(key in schema));
    if (extraKey) return `${path ? `${path}.` : ""}${extraKey} is not allowed`;
  }

  return undefined;
}

export function validateContentData(
  value: unknown,
  schema: ContentTypeSchema,
  strict: boolean,
) {
  return validateObject(value, schema, strict, "");
}
