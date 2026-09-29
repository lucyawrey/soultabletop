import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { group } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireGroupMember } from "../../utils/group";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "Get a group",
    responses: {
      200: { description: "Group, with the current user's role" },
      401: { description: "Authentication required" },
      404: { description: "Group not found" },
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
  const role = await requireGroupMember(id, user.id);
  const [item] = await useDatabase().select().from(group).where(eq(group.id, id));
  if (!item)
    throw createError({ statusCode: 404, statusMessage: "Group not found" });
  return { ...item, role };
});
