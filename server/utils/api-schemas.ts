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
    slug: slugSchema,
    iconImageUrl: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const createContentSchema = Type.Object({
  slug: slugSchema,
  name: Type.String({ minLength: 1 }),
  contentTypeId: uuidSchema,
  sheetId: Type.Optional(Type.Union([uuidSchema, Type.Null()])),
  data: Type.Optional(Type.Object({}, { additionalProperties: true })),
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

export const contentTypeCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({
    systemId: uuidSchema,
    contentCategory: Type.Optional(
      Type.Union([
        Type.Literal("General"),
        Type.Literal("NonPlayerCharacter"),
        Type.Literal("Document"),
        Type.Literal("PlayerCharacter"),
      ]),
    ),
    hasStrictSchema: Type.Optional(Type.Boolean()),
    schema: Type.Optional(Type.Object({}, { additionalProperties: true })),
  }),
]);

export const contentTypePatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: slugSchema,
    contentCategory: Type.Union([
      Type.Literal("General"),
      Type.Literal("NonPlayerCharacter"),
      Type.Literal("Document"),
      Type.Literal("PlayerCharacter"),
    ]),
    hasStrictSchema: Type.Boolean(),
    schema: Type.Object({}, { additionalProperties: true }),
  }),
);

export const sheetCreateSchema = Type.Intersect([
  resourceCreateSchema,
  Type.Object({
    contentTypeId: uuidSchema,
    markup: Type.Optional(Type.String()),
    cssStyles: Type.Optional(Type.String()),
    isDefault: Type.Optional(Type.Boolean()),
  }),
]);

export const sheetPatchSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: slugSchema,
    markup: Type.String(),
    cssStyles: Type.String(),
    isDefault: Type.Boolean(),
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
  role: Type.Union([Type.Literal("GM"), Type.Literal("Player")]),
});

export const groupMembershipSchema = Type.Object({
  userId: Type.String({ minLength: 1 }),
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
    Type.Union([Type.Literal("members"), Type.Literal("GMs")]),
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
