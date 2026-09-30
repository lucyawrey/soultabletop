import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType, resource } from "../../database/schema";
import type { ContentTypeSchema } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { assertContentTypeSchema } from "../../utils/content-validation";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  requireName,
  requireReadableId,
  resolveResourceOwner,
} from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, contentTypeCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Create a content type",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "readableId", "systemId"],
            properties: {
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              readableId: { type: "string" },
              systemId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              contentCategory: {
                type: "string",
                enum: [
                  "general",
                  "nonPlayerCharacter",
                  "page",
                  "playerCharacter",
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
      201: { description: "Created content type" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, contentTypeCreateSchema);
  const name = requireName(body?.name);
  const readableId = requireReadableId(body?.readableId);
  if (typeof body.systemId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "systemId is required",
    });
  const schema = (body.schema ?? {}) as ContentTypeSchema;
  await assertContentTypeSchema(user, schema);
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
  const owner = await resolveResourceOwner(user, body.ownerGroupId, context);
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "contentType",
          ...owner,
          readableId,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
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
          contentCategory: body.contentCategory ?? "general",
          hasStrictSchema: body.hasStrictSchema === true,
          schema,
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
        statusMessage: "ID is already in use",
      });
    throw error;
  }
});
