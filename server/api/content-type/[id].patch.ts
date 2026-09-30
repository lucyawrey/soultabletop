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
  resolveOwnerChange,
  rethrowReadableIdConflict,
  requireReadableId,
} from "../../utils/resource-management";
import { parseBody, contentTypePatchSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Update a content type",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              ownerGroupId: {
                type: ["string", "null"],
                format: "uuid",
                description:
                  "Move to this group, or null to move to yourself. Only the owner, or admins of the owning group, may; the target group needs you as admin or editor.",
              },
              readableId: { type: "string" },
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
              confirmBrokenSheets: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated content type" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: {
        description:
          "The change breaks existing sheets (readable ones listed in data.brokenSheets, the rest counted in data.hiddenBrokenSheets); resend with confirmBrokenSheets",
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
  const owner = await resolveOwnerChange(user, item, body.ownerGroupId);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "Content type not found",
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
      const broken = await findSheetsBrokenBy(user, id, {
        schema: (body.schema as ContentTypeSchema | undefined) ?? current.schema,
        hasStrictSchema: body.hasStrictSchema ?? current.hasStrictSchema,
      });
      const total = broken.sheets.length + broken.hiddenCount;
      if (total)
        throw createError({
          statusCode: 409,
          statusMessage: `This change would break ${total} sheet${total === 1 ? "" : "s"}`,
          // Details only for Sheets the editor can read; the rest are counted.
          data: {
            brokenSheets: broken.sheets,
            hiddenBrokenSheets: broken.hiddenCount,
          },
        });
    }
  }
  const [updatedResource] = await database
    .update(resource)
    .set({
      ...owner,
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.readableId !== undefined ? { readableId: requireReadableId(body.readableId) } : {}),
      ...(body.isPubliclyReadable !== undefined
        ? { isPubliclyReadable: body.isPubliclyReadable }
        : {}),
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id))
    .returning()
    .catch(rethrowReadableIdConflict);
  const typeValues = {
      ...(body.contentCategory !== undefined
        ? {
            contentCategory: body.contentCategory,
          }
        : {}),
      ...(body.hasStrictSchema !== undefined
        ? { hasStrictSchema: body.hasStrictSchema === true }
        : {}),
      ...(body.schema !== undefined
        ? { schema: body.schema as ContentTypeSchema }
        : {}),
  };
  // Drizzle rejects an empty update, e.g. when only the name changes.
  const [updatedType] = Object.keys(typeValues).length
    ? await database
        .update(contentType)
        .set(typeValues)
        .where(eq(contentType.resourceId, id))
        .returning()
    : await database
        .select()
        .from(contentType)
        .where(eq(contentType.resourceId, id));
  return { ...updatedResource, ...updatedType };
});
