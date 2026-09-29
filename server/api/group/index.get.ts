import { asc, count, eq } from "drizzle-orm";
import { group, groupMembership, userProfile } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "List the current user's groups",
    responses: {
      200: { description: "Groups the user belongs to, with their role" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const database = useDatabase();
  const memberCounts = database
    .select({ groupId: groupMembership.groupId, memberCount: count().as("member_count") })
    .from(groupMembership)
    .groupBy(groupMembership.groupId)
    .as("member_counts");
  const rows = await database
    .select({
      group,
      role: groupMembership.role,
      memberCount: memberCounts.memberCount,
    })
    .from(groupMembership)
    .innerJoin(group, eq(group.id, groupMembership.groupId))
    .innerJoin(memberCounts, eq(memberCounts.groupId, group.id))
    .where(eq(groupMembership.userId, user.id))
    .orderBy(asc(group.name));
  const mine = rows.map(({ group: item, role, memberCount }) => ({
    ...item,
    role: role as typeof role | null,
    memberCount: Number(memberCount),
  }));

  // Site admins also see the system groups (official content) they aren't in.
  const [profile] = await database
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, user.id));
  if (profile?.role !== "admin") return mine;
  const memberOf = new Set(mine.map((item) => item.id));
  const systemGroups = await database
    .select({ group, memberCount: memberCounts.memberCount })
    .from(group)
    .leftJoin(memberCounts, eq(memberCounts.groupId, group.id))
    .where(eq(group.kind, "system"))
    .orderBy(asc(group.name));
  return [
    ...mine,
    ...systemGroups
      .filter(({ group: item }) => !memberOf.has(item.id))
      .map(({ group: item, memberCount }) => ({
        ...item,
        role: null,
        memberCount: Number(memberCount ?? 0),
      })),
  ];
});
