import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType, resource } from "../../database/schema";
import type { ContentTypeSchema } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { requireName, requireSlug } from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, contentTypeCreateSchema } from "../../utils/api-schemas";

const categories = new Set([
  "General",
  "NonPlayerCharacter",
  "Document",
  "PlayerCharacter",
]);

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Create a ContentType",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "slug", "systemId"],
            properties: {
              name: { type: "string" },
              slug: { type: "string" },
              systemId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              contentCategory: {
                type: "string",
                enum: [
                  "General",
                  "NonPlayerCharacter",
                  "Document",
                  "PlayerCharacter",
                ],
              },
              hasStrictSchema: { type: "boolean" },
              schema: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created ContentType" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, contentTypeCreateSchema);
  const name = requireName(body?.name);
  const slug = requireSlug(body?.slug);
  if (typeof body.systemId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "systemId is required",
    });
  if (
    body.contentCategory !== undefined &&
    (typeof body.contentCategory !== "string" ||
      !categories.has(body.contentCategory))
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid contentCategory",
    });
  const database = useDatabase();
  const [systemResource] = await database
    .select()
    .from(resource)
    .where(eq(resource.id, body.systemId))
    .limit(1);
  if (!systemResource || systemResource.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  const context = await loadResourceAccessContext(user, [systemResource.id]);
  if (!getResourceAccess(systemResource, context).canRead)
    throw createError({
      statusCode: 403,
      statusMessage: "System is not accessible",
    });
  const ownerGroupId =
    typeof body.ownerGroupId === "string" ? body.ownerGroupId : null;
  if (
    ownerGroupId &&
    !context.groupRoles.has(ownerGroupId) &&
    !context.isSiteAdmin
  )
    throw createError({
      statusCode: 403,
      statusMessage: "Not allowed to use this Group",
    });
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "contentType",
          ownerUserId: ownerGroupId ? null : user.id,
          ownerGroupId,
          slug,
          name,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource)
        throw new Error("ContentType Resource was not created");
      const [createdType] = await tx
        .insert(contentType)
        .values({
          resourceId: createdResource.id,
          systemId: body.systemId as string,
          contentCategory:
            (body.contentCategory as
              | "General"
              | "NonPlayerCharacter"
              | "Document"
              | "PlayerCharacter") ?? "General",
          hasStrictSchema: body.hasStrictSchema === true,
          schema: (body.schema ?? {}) as ContentTypeSchema,
        })
        .returning();
      return { ...createdResource, ...createdType };
    });
    setResponseStatus(event, 201);
    return result;
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw createError({
        statusCode: 409,
        statusMessage: "Slug is already in use",
      });
    throw error;
  }
});
