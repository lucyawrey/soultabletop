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
import {
  assertDefaultReplacementConfirmed,
  assertValidSheetCss,
  assertValidSheetMarkup,
} from "../../utils/sheet-schemas";

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
              confirmReplaceDefault: {
                type: "boolean",
                description:
                  "Required to replace an existing default Sheet (otherwise 409)",
              },
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
      409: {
        description:
          "Would replace the default Sheet without confirmReplaceDefault",
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
  if (body.cssStyles !== undefined) assertValidSheetCss(body.cssStyles);
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
    if (body.isDefault === true)
      await assertDefaultReplacementConfirmed(
        user,
        current.contentTypeId,
        id,
        body.confirmReplaceDefault,
      );
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
  const sheetValues = {
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
  };
  // Drizzle rejects an empty update, e.g. when only the name changes.
  const [updatedSheet] = Object.keys(sheetValues).length
    ? await tx
        .update(sheet)
        .set(sheetValues)
        .where(eq(sheet.resourceId, id))
        .returning()
    : await tx.select().from(sheet).where(eq(sheet.resourceId, id));
  return { ...updatedResource, ...updatedSheet };
  });
});
