import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { contentType, resource } from "../../database/schema";
import type { ContentTypeSchema } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { assertContentTypeSchema } from "../../utils/content-validation";
import { findSheetsBrokenBy } from "../../utils/sheet-schemas";
import { useDatabase } from "../../utils/database";
import {
  requireName,
  requireResourceEditor,
  requireSlug,
} from "../../utils/resource-management";
import { parseBody, contentTypePatchSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Update a ContentType",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              slug: { type: "string" },
              contentCategory: {
                type: "string",
                enum: [
                  "general",
                  "nonPlayerCharacter",
                  "document",
                  "playerCharacter",
                ],
              },
              hasStrictSchema: { type: "boolean" },
              schema: { type: "object", additionalProperties: true },
              confirmBrokenSheets: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated ContentType" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: {
        description:
          "The change breaks existing Sheets (listed in data.brokenSheets); resend with confirmBrokenSheets",
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const body = await parseBody(event, contentTypePatchSchema);
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  if (body.schema !== undefined)
    await assertContentTypeSchema(user, body.schema as ContentTypeSchema);
  const database = useDatabase();
  if (
    (body.schema !== undefined || body.hasStrictSchema !== undefined) &&
    body.confirmBrokenSheets !== true
  ) {
    const [current] = await database
      .select({
        schema: contentType.schema,
        hasStrictSchema: contentType.hasStrictSchema,
      })
      .from(contentType)
      .where(eq(contentType.resourceId, id));
    if (current) {
      const brokenSheets = await findSheetsBrokenBy(id, {
        schema: (body.schema as ContentTypeSchema | undefined) ?? current.schema,
        hasStrictSchema: body.hasStrictSchema ?? current.hasStrictSchema,
      });
      if (brokenSheets.length)
        throw createError({
          statusCode: 409,
          statusMessage: `This change would break ${brokenSheets.length} Sheet${brokenSheets.length === 1 ? "" : "s"}`,
          data: { brokenSheets },
        });
    }
  }
  const [updatedResource] = await database
    .update(resource)
    .set({
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: requireSlug(body.slug) } : {}),
      ...(body.isPubliclyReadable !== undefined
        ? { isPubliclyReadable: body.isPubliclyReadable }
        : {}),
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id))
    .returning();
  const [updatedType] = await database
    .update(contentType)
    .set({
      ...(body.contentCategory !== undefined
        ? {
            contentCategory: body.contentCategory as
              "general" | "nonPlayerCharacter" | "document" | "playerCharacter",
          }
        : {}),
      ...(body.hasStrictSchema !== undefined
        ? { hasStrictSchema: body.hasStrictSchema === true }
        : {}),
      ...(body.schema !== undefined
        ? { schema: body.schema as ContentTypeSchema }
        : {}),
    })
    .where(eq(contentType.resourceId, id))
    .returning();
  return { ...updatedResource, ...updatedType };
});
