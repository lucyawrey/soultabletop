import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  requireName,
  requireResourceEditor,
  requireSlug,
} from "../../utils/resource-management";
import { parseBody, sheetPatchSchema } from "../../utils/api-schemas";

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
              slug: { type: "string" },
              markup: { type: "string" },
              cssStyles: { type: "string" },
              isDefault: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated Sheet" },
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
  const [updatedResource] = await database
    .update(resource)
    .set({
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: requireSlug(body.slug) } : {}),
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id))
    .returning();
  const [updatedSheet] = await database
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
    })
    .where(eq(sheet.resourceId, id))
    .returning();
  return { ...updatedResource, ...updatedSheet };
});
