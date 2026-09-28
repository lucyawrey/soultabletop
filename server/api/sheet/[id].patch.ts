import { createError, getRouterParam } from "h3";
import { and, eq, ne } from "drizzle-orm";
import { resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  requireName,
  requireResourceEditor,
  requireSlug,
} from "../../utils/resource-management";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { parseBody, sheetPatchSchema } from "../../utils/api-schemas";
import { assertValidSheetMarkup } from "../../utils/sheet-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Update a Sheet",
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
              markup: { type: "string" },
              cssStyles: { type: "string" },
              isDefault: { type: "boolean" },
              defaultEditMode: { type: "boolean" },
              defaultAutosave: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated Sheet" },
      400: { description: "Invalid request or markup errors" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
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
  const body = await parseBody(event, sheetPatchSchema);
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "sheet")
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  const database = useDatabase();
  const [current] = await database
    .select({ contentTypeId: sheet.contentTypeId, isDefault: sheet.isDefault })
    .from(sheet)
    .where(eq(sheet.resourceId, id));
  if (!current)
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  if (body.markup !== undefined)
    await assertValidSheetMarkup(body.markup, current.contentTypeId);
  // The default Sheet belongs to the ContentType, so changing it (either way)
  // needs edit access there, not just on this Sheet.
  const isDefaultChanging =
    body.isDefault !== undefined && body.isDefault !== current.isDefault;
  if (isDefaultChanging) {
    const [typeResource] = await database
      .select()
      .from(resource)
      .where(eq(resource.id, current.contentTypeId));
    const context = typeResource
      ? await loadResourceAccessContext(user, [typeResource.id])
      : null;
    if (!typeResource || !context || !getResourceAccess(typeResource, context).canEdit)
      throw createError({
        statusCode: 403,
        statusMessage:
          "Only editors of the ContentType can change its default Sheet",
      });
  }
  return database.transaction(async (tx) => {
  // Only one default Sheet per ContentType (partial unique index).
  if (isDefaultChanging && body.isDefault === true)
    await tx
      .update(sheet)
      .set({ isDefault: false })
      .where(
        and(
          eq(sheet.contentTypeId, current.contentTypeId),
          ne(sheet.resourceId, id),
        ),
      );
  const [updatedResource] = await tx
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
  const [updatedSheet] = await tx
    .update(sheet)
    .set({
      ...(body.markup !== undefined
        ? { markup: typeof body.markup === "string" ? body.markup : "" }
        : {}),
      ...(body.cssStyles !== undefined
        ? {
            cssStyles: typeof body.cssStyles === "string" ? body.cssStyles : "",
          }
        : {}),
      ...(body.isDefault !== undefined
        ? { isDefault: body.isDefault === true }
        : {}),
      ...(body.defaultEditMode !== undefined
        ? { defaultEditMode: body.defaultEditMode }
        : {}),
      ...(body.defaultAutosave !== undefined
        ? { defaultAutosave: body.defaultAutosave }
        : {}),
    })
    .where(eq(sheet.resourceId, id))
    .returning();
  return { ...updatedResource, ...updatedSheet };
  });
});
