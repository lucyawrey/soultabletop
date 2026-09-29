import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { group, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "Delete a group",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Group admin access required" },
      409: { description: "Resources still owned" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Group ID is required",
    });
  const database = useDatabase();
  await requireGroupAdmin(id, user.id);
  const owned = await database
    .select({ id: resource.id })
    .from(resource)
    .where(eq(resource.ownerGroupId, id));
  if (owned.length)
    throw createError({
      statusCode: 409,
      statusMessage:
        "Transfer or delete group resources before deleting the group",
    });
  await database.delete(group).where(eq(group.id, id));
  setResponseStatus(event, 204);
});
