import { createError } from "h3";
import { and, eq } from "drizzle-orm";
import { group, groupMembership, userProfile } from "../database/schema";
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

// Groups the caller may see and manage: members see their groups, admins
// manage them, and site admins see and manage system groups (official
// content), which may have no members at all.
export async function getGroupAccess(groupId: string, userId: string) {
  const database = useDatabase();
  const [[item], role, [profile]] = await Promise.all([
    database.select({ kind: group.kind }).from(group).where(eq(group.id, groupId)),
    getGroupRole(groupId, userId),
    database
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, userId)),
  ]);
  const isSystem = item?.kind === "system";
  const siteAdminOfSystem = isSystem && profile?.role === "admin";
  return {
    exists: !!item,
    isSystem,
    role,
    canView: !!item && (!!role || siteAdminOfSystem),
    canManage: !!item && (role === "admin" || siteAdminOfSystem),
  };
}

export async function requireGroupViewer(groupId: string, userId: string) {
  const access = await getGroupAccess(groupId, userId);
  // 404 rather than 403 so non-members can't probe which Group IDs exist.
  if (!access.canView)
    throw createError({ statusCode: 404, statusMessage: "Group not found" });
  return access;
}

export async function requireGroupAdmin(groupId: string, userId: string) {
  const access = await requireGroupViewer(groupId, userId);
  if (!access.canManage)
    throw createError({
      statusCode: 403,
      statusMessage: "Group admin access required",
    });
  return access;
}
