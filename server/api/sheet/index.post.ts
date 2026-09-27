import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { requireName, requireSlug } from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, sheetCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Create a Sheet",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "slug", "contentTypeId"],
            properties: {
              name: { type: "string" },
              slug: { type: "string" },
              contentTypeId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              markup: { type: "string" },
              cssStyles: { type: "string" },
              isDefault: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created Sheet" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, sheetCreateSchema);
  const name = requireName(body?.name);
  const slug = requireSlug(body?.slug);
  if (typeof body.contentTypeId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "contentTypeId is required",
    });
  const database = useDatabase();
  const [typeResource] = await database
    .select({ type: contentType, resource })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId))
    .where(eq(contentType.resourceId, body.contentTypeId))
    .limit(1);
  if (!typeResource)
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  const context = await loadResourceAccessContext(user, [
    typeResource.resource.id,
  ]);
  if (!getResourceAccess(typeResource.resource, context).canRead)
    throw createError({
      statusCode: 403,
      statusMessage: "ContentType is not accessible",
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
          kind: "sheet",
          ownerUserId: ownerGroupId ? null : user.id,
          ownerGroupId,
          slug,
          name,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("Sheet Resource was not created");
      const [createdSheet] = await tx
        .insert(sheet)
        .values({
          resourceId: createdResource.id,
          contentTypeId: body.contentTypeId as string,
          markup: typeof body.markup === "string" ? body.markup : "",
          cssStyles: typeof body.cssStyles === "string" ? body.cssStyles : "",
          isDefault: body.isDefault === true,
        })
        .returning();
      return { ...createdResource, ...createdSheet };
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
