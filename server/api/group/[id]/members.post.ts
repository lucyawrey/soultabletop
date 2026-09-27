import { createError, getRouterParam } from "h3";
import { and, eq } from "drizzle-orm";
import { groupMembership } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";
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
            required: ["userId", "role"],
            properties: {
              userId: { type: "string" },
              role: { type: "string", enum: ["admin", "editor", "member"] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated membership" },
      401: { description: "Authentication required" },
      403: { description: "Group admin access required" },
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
  if (
    typeof body.userId !== "string" ||
    !["admin", "editor", "member"].includes(body.role as string)
  )
    throw createError({
      statusCode: 400,
      statusMessage: "userId and role are required",
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
  const [membership] = await database
    .insert(groupMembership)
    .values({
      groupId,
      userId: body.userId,
      role: body.role as "admin" | "editor" | "member",
    })
    .onConflictDoUpdate({
      target: [groupMembership.groupId, groupMembership.userId],
      set: { role: body.role as "admin" | "editor" | "member" },
    })
    .returning();
  return membership;
});
