import { createError, getRouterParam } from "h3";
import { count, eq } from "drizzle-orm";
import { content, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceEditor } from "../../utils/resource-management";
import { isForeignKeyConstraintError } from "../../utils/user-profile";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Delete a ContentType",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: { description: "Sheets or Content still use the ContentType" },
    },
  },
});

const inUseMessage =
  "Delete this ContentType's Sheets and Content before deleting the ContentType";

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "contentType")
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  const database = useDatabase();
  // Sheets and Content reference their ContentType with ON DELETE RESTRICT.
  const [[sheets], [contents]] = await Promise.all([
    database
      .select({ total: count() })
      .from(sheet)
      .where(eq(sheet.contentTypeId, id)),
    database
      .select({ total: count() })
      .from(content)
      .where(eq(content.contentTypeId, id)),
  ]);
  if (sheets?.total || contents?.total)
    throw createError({
      statusCode: 409,
      statusMessage: `${inUseMessage} (${sheets?.total ?? 0} Sheets, ${contents?.total ?? 0} Content)`,
    });
  try {
    await database.delete(resource).where(eq(resource.id, id));
  } catch (error) {
    // Something was added between the check and the delete.
    if (isForeignKeyConstraintError(error))
      throw createError({ statusCode: 409, statusMessage: inUseMessage });
    throw error;
  }
  setResponseStatus(event, 204);
});
