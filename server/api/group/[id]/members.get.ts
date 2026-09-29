import { createError, getRouterParam } from "h3";
import { asc, eq } from "drizzle-orm";
import { groupMembership, user, userProfile } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";
import { requireGroupMember } from "../../../utils/group";

defineRouteMeta({
  openAPI: {
    tags: ["Group Membership"],
    summary: "List group members",
    responses: {
      200: { description: "Members with their username and role" },
      401: { description: "Authentication required" },
      404: { description: "Group not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event);
  const groupId = getRouterParam(event, "id");
  if (!groupId)
    throw createError({
      statusCode: 400,
      statusMessage: "Group ID is required",
    });
  await requireGroupMember(groupId, currentUser.id);
  return useDatabase()
    .select({
      userId: groupMembership.userId,
      role: groupMembership.role,
      joinedAt: groupMembership.createdAt,
      name: user.name,
      username: userProfile.username,
    })
    .from(groupMembership)
    .innerJoin(user, eq(user.id, groupMembership.userId))
    .leftJoin(userProfile, eq(userProfile.userId, groupMembership.userId))
    .where(eq(groupMembership.groupId, groupId))
    .orderBy(asc(user.name));
});
