import { createError } from "h3";
import { and, eq } from "drizzle-orm";
import { groupMembership } from "../database/schema";
import { useDatabase } from "./database";

export type GroupRole = "admin" | "editor" | "member";

export async function getGroupRole(
  groupId: string,
  userId: string,
): Promise<GroupRole | null> {
  const [membership] = await useDatabase()
    .select({ role: groupMembership.role })
    .from(groupMembership)
    .where(
      and(eq(groupMembership.groupId, groupId), eq(groupMembership.userId, userId)),
    );
  return membership?.role ?? null;
}

export async function requireGroupMember(groupId: string, userId: string) {
  const role = await getGroupRole(groupId, userId);
  // 404 rather than 403 so non-members can't probe which Group IDs exist.
  if (!role)
    throw createError({ statusCode: 404, statusMessage: "Group not found" });
  return role;
}
