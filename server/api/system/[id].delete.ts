import { createError } from "h3";
import { count, eq } from "drizzle-orm";
import { contentType, campaign, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceEditor } from "../../utils/resource-management";
import { isForeignKeyConstraintError } from "../../utils/user-profile";
import { resolveResourceRouteId } from "../../utils/resource-address";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Delete a system",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: { description: "Campaigns or content types still use the system" },
    },
  },
});

const inUseMessage =
  "Delete this system's campaigns and content types before deleting the system";

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "system", user);
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  const database = useDatabase();
  // Campaigns and ContentTypes reference their System with ON DELETE RESTRICT.
  const [[campaigns], [types]] = await Promise.all([
    database.select({ total: count() }).from(campaign).where(eq(campaign.systemId, id)),
    database
      .select({ total: count() })
      .from(contentType)
      .where(eq(contentType.systemId, id)),
  ]);
  if (campaigns?.total || types?.total)
    throw createError({
      statusCode: 409,
      statusMessage: `${inUseMessage} (${campaigns?.total ?? 0} campaigns, ${types?.total ?? 0} content types)`,
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
