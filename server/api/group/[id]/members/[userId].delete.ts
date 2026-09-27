import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { groupMembership } from "../../../../database/schema";
import { requireAuthenticatedUser } from "../../../../utils/auth";
import { useDatabase } from "../../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Group Membership"],
    summary: "Remove a Group member",
    responses: {
      204: { description: "Removed" },
      401: { description: "Authentication required" },
      403: { description: "Group admin access required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const groupId = getRouterParam(event, "id");
  const userId = getRouterParam(event, "userId");
  if (!groupId || !userId)
    throw createError({
      statusCode: 400,
      statusMessage: "Group ID and userId are required",
    });
  const database = useDatabase();
  const [caller] = await database
    .select({ role: groupMembership.role })
    .from(groupMembership)
    .where(
      and(
        eq(groupMembership.groupId, groupId),
        eq(groupMembership.userId, user.id),
      ),
    );
  if (caller?.role !== "admin")
    throw createError({
      statusCode: 403,
      statusMessage: "Group admin access required",
    });
  if (userId === user.id)
    throw createError({
      statusCode: 409,
      statusMessage: "Transfer admin access before removing yourself",
    });
  await database
    .delete(groupMembership)
    .where(
      and(
        eq(groupMembership.groupId, groupId),
        eq(groupMembership.userId, userId),
      ),
    );
  setResponseStatus(event, 204);
});
