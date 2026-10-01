import type { Static, TSchema } from "@sinclair/typebox";
import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createError, readBody, type H3Event } from "h3";
import { uuidPattern } from "./resource-management";
import { CONTENT_CATEGORIES } from "../../shared/content-categories";
import { RESOURCE_LINK_KINDS } from "../../shared/content-schema";
import { SHEET_DISPLAYS } from "../../shared/sheet/registry";
import {
  API_KEY_ACCESS,
  API_KEY_EXPIRY_DAYS,
  MAX_API_KEY_NAME_LENGTH,
} from "../../shared/api-keys";
import { MAX_DISPLAY_NAME_LENGTH, MAX_USERNAME_LENGTH } from "../../shared/display-name";

FormatRegistry.Set("uuid", (value) => uuidPattern.test(value));

export const uuidSchema = Type.String({ format: "uuid" });
export const readableIdSchema = Type.String({
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});

export const profilePatchSchema = Type.Partial(
  Type.Object({
    // Any capitalization: it is stored lowercase, but the default display
    // name keeps what was typed.
    username: Type.String({
      pattern: "^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$",
      maxLength: MAX_USERNAME_LENGTH,
    }),
    // Empty or null resets the display name to the username.
    name: Type.Union([
      Type.String({ maxLength: MAX_DISPLAY_NAME_LENGTH }),
      Type.Null(),
    ]),
    iconImageUrl: Type.Union([
      Type.String({ pattern: "^https://\\S+$", maxLength: 2000 }),
      Type.Null(),
    ]),
  }),
);

export const createApiKeySchema = Type.Object({
  name: Type.String({
    minLength: 1,
    maxLength: MAX_API_KEY_NAME_LENGTH,
    pattern: "\\S",
  }),
  access: Type.Union(API_KEY_ACCESS.map((access) => Type.Literal(access))),
  // `null` for a key that never expires.
  expiresInDays: Type.Union([
    ...API_KEY_EXPIRY_DAYS.map((days) => Type.Literal(days)),
    Type.Null(),
  ]),
});

export const createContentSchema = Type.Object({
  readableId: readableIdSchema,
  name: Type.String({ minLength: 1 }),
  contentTypeId: uuidSchema,
  ownerGroupId: Type.Optional(uuidSchema),
  sheetId: Type.Optional(Type.Union([uuidSchema, Type.Null()])),
  data: Type.Optional(Type.Object({}, { additionalProperties: true })),
  isPubliclyReadable: Type.Optional(Type.Boolean()),
});

export const resourceCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  readableId: readableIdSchema,
  ownerGroupId: Type.Optional(uuidSchema),
  isPubliclyReadable: Type.Optional(Type.Boolean()),
});

export const resourcePatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    readableId: readableIdSchema,
    isPubliclyReadable: Type.Boolean(),
    // Move to a group, or null for the acting user (see resolveOwnerChange).
    ownerGroupId: Type.Union([uuidSchema, Type.Null()]),
  }),
);

const fieldKeySchema = Type.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" });

const fieldMeta = {
  required: Type.Optional(Type.Boolean()),
  label: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
};

// Mirrors `ContentFieldSchema` in shared/content-schema.ts.
export const contentFieldSchema = Type.Recursive((Self) =>
  Type.Union([
    Type.Object(
      {
        type: Type.Union([
          Type.Literal("string"),
          Type.Literal("number"),
          Type.Literal("boolean"),
          Type.Literal("scalar"),
          Type.Literal("object"),
        ]),
        ...fieldMeta,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      { type: Type.Literal("array"), itemType: Self, ...fieldMeta },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        type: Type.Literal("struct"),
        entries: Type.Record(fieldKeySchema, Self),
        ...fieldMeta,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        type: Type.Literal("resourceLink"),
        kind: Type.Optional(
          Type.Union(RESOURCE_LINK_KINDS.map((kind) => Type.Literal(kind))),
        ),
        ...fieldMeta,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        type: Type.Literal("content"),
        contentTypeId: uuidSchema,
        allow: Type.Union([
          Type.Literal("reference"),
          Type.Literal("local"),
          Type.Literal("both"),
        ]),
        ...fieldMeta,
      },
      { additionalProperties: false },
    ),
  ]),
);

export const contentTypeSchemaSchema = Type.Record(
  fieldKeySchema,
  contentFieldSchema,
);

const contentCategorySchema = Type.Union(
  CONTENT_CATEGORIES.map((category) => Type.Literal(category)),
);

const sheetDisplaySchema = Type.Union(
  SHEET_DISPLAYS.map((display) => Type.Literal(display)),
);

export const contentTypeCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({
    systemId: uuidSchema,
    contentCategory: Type.Optional(
      contentCategorySchema,
    ),
    hasStrictSchema: Type.Optional(Type.Boolean()),
    showSheetWarnings: Type.Optional(Type.Boolean()),
    schema: Type.Optional(contentTypeSchemaSchema),
  }),
]);

export const contentTypePatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    readableId: readableIdSchema,
    isPubliclyReadable: Type.Boolean(),
    // Move to a group, or null for the acting user (see resolveOwnerChange).
    ownerGroupId: Type.Union([uuidSchema, Type.Null()]),
    contentCategory: contentCategorySchema,
    hasStrictSchema: Type.Boolean(),
    // Omitted: turned on when switching from strict to non-strict.
    showSheetWarnings: Type.Boolean(),
    schema: contentTypeSchemaSchema,
    // Save even if the change breaks existing Sheets (otherwise 409).
    confirmBrokenSheets: Type.Boolean(),
  }),
);

export const sheetCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({
    contentTypeId: uuidSchema,
    markup: Type.Optional(Type.String()),
    cssStyles: Type.Optional(Type.String()),
    isDefault: Type.Optional(Type.Boolean()),
    // Replace an existing default Sheet (otherwise 409).
    confirmReplaceDefault: Type.Optional(Type.Boolean()),
    defaultEditMode: Type.Optional(Type.Boolean()),
    defaultAutosave: Type.Optional(Type.Boolean()),
    defaultDisplay: Type.Optional(sheetDisplaySchema),
  }),
]);

export const sheetPatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    readableId: readableIdSchema,
    isPubliclyReadable: Type.Boolean(),
    // Move to a group, or null for the acting user (see resolveOwnerChange).
    ownerGroupId: Type.Union([uuidSchema, Type.Null()]),
    markup: Type.String(),
    cssStyles: Type.String(),
    isDefault: Type.Boolean(),
    // Replace an existing default Sheet (otherwise 409).
    confirmReplaceDefault: Type.Boolean(),
    defaultEditMode: Type.Boolean(),
    defaultAutosave: Type.Boolean(),
    defaultDisplay: sheetDisplaySchema,
  }),
);

export const campaignCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({ systemId: uuidSchema }),
]);

export const campaignPatchSchema = resourcePatchSchema;

export const groupCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  readableId: readableIdSchema,
});

export const groupPatchSchema = Type.Partial(groupCreateSchema);

export const groupCreateWithKindSchema = Type.Intersect([
  groupCreateSchema,
  // A system group, whose resources are official (site admins only).
  Type.Object({ official: Type.Optional(Type.Boolean()) }),
]);

export const campaignMembershipSchema = Type.Object({
  userId: Type.String({ minLength: 1 }),
  role: Type.Union([Type.Literal("gm"), Type.Literal("player")]),
});

// Identify the member by `userId` or by `username`; one is required.
export const groupMembershipSchema = Type.Object({
  userId: Type.Optional(Type.String({ minLength: 1 })),
  username: Type.Optional(Type.String({ minLength: 1 })),
  role: Type.Union([
    Type.Literal("admin"),
    Type.Literal("editor"),
    Type.Literal("member"),
  ]),
});

export const resourceGrantSchema = Type.Object({
  userId: Type.Optional(Type.String({ minLength: 1 })),
  groupId: Type.Optional(uuidSchema),
  campaignId: Type.Optional(uuidSchema),
  permission: Type.Union([Type.Literal("read"), Type.Literal("edit")]),
  campaignAudience: Type.Optional(
    Type.Union([Type.Literal("members"), Type.Literal("gms")]),
  ),
});

export async function parseBody<T extends TSchema>(
  event: H3Event,
  schema: T,
): Promise<Static<T>> {
  const body = await readBody(event);
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.readableId === "string")
      record.readableId = record.readableId.trim().toLowerCase();
    if (record.ownerGroupId === "") delete record.ownerGroupId;
  }
  if (!Value.Check(schema, body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request validation failed",
      data: [...Value.Errors(schema, body)],
    });
  }
  return body as Static<T>;
}
