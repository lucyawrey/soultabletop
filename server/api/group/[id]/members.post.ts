import { createError, getRouterParam } from "h3";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { groupMembership, userProfile } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";
import { getGroupRole } from "../../../utils/group";
import { parseBody, groupMembershipSchema } from "../../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Group Membership"],
    summary: "Add or update a Group member",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["role"],
            properties: {
              userId: { type: "string" },
              slug: { type: "string", description: "Username; alternative to userId" },
              role: { type: "string", enum: ["admin", "editor", "member"] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated membership" },
      400: { description: "userId or slug is required" },
      401: { description: "Authentication required" },
      403: { description: "Group admin access required" },
      404: { description: "User not found" },
      409: { description: "Group would be left without an admin" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const groupId = getRouterParam(event, "id");
  if (!groupId)
    throw createError({
      statusCode: 400,
      statusMessage: "Group ID is required",
    });
  const body = await parseBody(event, groupMembershipSchema);
  if ((await getGroupRole(groupId, user.id)) !== "admin")
    throw createError({
      statusCode: 403,
      statusMessage: "Group admin access required",
    });
  const database = useDatabase();

  let userId = body.userId;
  if (!userId && body.slug) {
    const [profile] = await database
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(sql`lower(${userProfile.slug}) = ${body.slug.toLowerCase()}`);
    if (!profile)
      throw createError({
        statusCode: 404,
        statusMessage: `No user with username "${body.slug}"`,
      });
    userId = profile.userId;
  }
  if (!userId)
    throw createError({
      statusCode: 400,
      statusMessage: "userId or username is required",
    });

  if (body.role !== "admin") {
    const [otherAdmins] = await database
      .select({ total: count() })
      .from(groupMembership)
      .where(
        and(
          eq(groupMembership.groupId, groupId),
          eq(groupMembership.role, "admin"),
          ne(groupMembership.userId, userId),
        ),
      );
    if (!otherAdmins?.total)
      throw createError({
        statusCode: 409,
        statusMessage: "A Group must keep at least one admin",
      });
  }

  const [membership] = await database
    .insert(groupMembership)
    .values({ groupId, userId, role: body.role })
    .onConflictDoUpdate({
      target: [groupMembership.groupId, groupMembership.userId],
      set: { role: body.role },
    })
    .returning();
  return membership;
});
