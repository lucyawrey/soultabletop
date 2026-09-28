import type { Static, TSchema } from "@sinclair/typebox";
import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createError, readBody, type H3Event } from "h3";
import { uuidPattern } from "./resource-management";

FormatRegistry.Set("uuid", (value) => uuidPattern.test(value));

export const uuidSchema = Type.String({ format: "uuid" });
export const slugSchema = Type.String({
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});

export const profilePatchSchema = Type.Partial(
  Type.Object({
    username: slugSchema,
    iconImageUrl: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const createContentSchema = Type.Object({
  slug: slugSchema,
  name: Type.String({ minLength: 1 }),
  contentTypeId: uuidSchema,
  sheetId: Type.Optional(Type.Union([uuidSchema, Type.Null()])),
  data: Type.Optional(Type.Object({}, { additionalProperties: true })),
  isPubliclyReadable: Type.Optional(Type.Boolean()),
});

export const resourceCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: slugSchema,
  ownerGroupId: Type.Optional(uuidSchema),
  isPubliclyReadable: Type.Optional(Type.Boolean()),
});

export const resourcePatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: slugSchema,
    isPubliclyReadable: Type.Boolean(),
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
          Type.Literal("any"),
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
        type: Type.Literal("object"),
        entries: Type.Record(fieldKeySchema, Self),
        ...fieldMeta,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      { type: Type.Literal("resourceRef"), ...fieldMeta },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        type: Type.Literal("content"),
        contentTypeId: uuidSchema,
        allow: Type.Union([
          Type.Literal("ref"),
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

export const contentTypeCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({
    systemId: uuidSchema,
    contentCategory: Type.Optional(
      Type.Union([
        Type.Literal("general"),
        Type.Literal("nonPlayerCharacter"),
        Type.Literal("document"),
        Type.Literal("playerCharacter"),
      ]),
    ),
    hasStrictSchema: Type.Optional(Type.Boolean()),
    schema: Type.Optional(contentTypeSchemaSchema),
  }),
]);

export const contentTypePatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: slugSchema,
    isPubliclyReadable: Type.Boolean(),
    contentCategory: Type.Union([
      Type.Literal("general"),
      Type.Literal("nonPlayerCharacter"),
      Type.Literal("document"),
      Type.Literal("playerCharacter"),
    ]),
    hasStrictSchema: Type.Boolean(),
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
    defaultEditMode: Type.Optional(Type.Boolean()),
    defaultAutosave: Type.Optional(Type.Boolean()),
  }),
]);

export const sheetPatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: slugSchema,
    isPubliclyReadable: Type.Boolean(),
    markup: Type.String(),
    cssStyles: Type.String(),
    isDefault: Type.Boolean(),
    defaultEditMode: Type.Boolean(),
    defaultAutosave: Type.Boolean(),
  }),
);

export const gameCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({ systemId: uuidSchema }),
]);

export const gamePatchSchema = resourcePatchSchema;

export const groupCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: slugSchema,
});

export const groupPatchSchema = Type.Partial(groupCreateSchema);

export const gameMembershipSchema = Type.Object({
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
  gameId: Type.Optional(uuidSchema),
  permission: Type.Union([Type.Literal("read"), Type.Literal("edit")]),
  gameAudience: Type.Optional(
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
    if (typeof record.slug === "string")
      record.slug = record.slug.trim().toLowerCase();
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
