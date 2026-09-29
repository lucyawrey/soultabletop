import { eq, inArray } from "drizzle-orm";
import type { User } from "better-auth";
import {
  gameMembership,
  game,
  group,
  groupMembership,
  resourceGrant,
  resource,
  userProfile,
  type Resource,
} from "../database/schema";
import { useDatabase } from "./database";

export interface ResourceAccessContext {
  userId: string;
  isSiteAdmin: boolean;
  groupRoles: Map<string, "admin" | "editor" | "member">;
  gameRoles: Map<string, "gm" | "player">;
  gameOwners: Map<string, { userId: string | null; groupId: string | null }>;
  systemGroupIds: Set<string>;
  grants: (typeof resourceGrant.$inferSelect)[];
}

export interface ResourceAccess {
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export async function loadResourceAccessContext(
  user: Pick<User, "id" | "name">,
  resourceIds: string[],
): Promise<ResourceAccessContext> {
  const database = useDatabase();
  const [profiles, groups, games, grants, systemGroups] = await Promise.all([
    database
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, user.id))
      .limit(1),
    database
      .select({ groupId: groupMembership.groupId, role: groupMembership.role })
      .from(groupMembership)
      .where(eq(groupMembership.userId, user.id)),
    database
      .select({ gameId: gameMembership.gameId, role: gameMembership.role })
      .from(gameMembership)
      .where(eq(gameMembership.userId, user.id)),
    resourceIds.length
      ? database
          .select()
          .from(resourceGrant)
          .where(inArray(resourceGrant.resourceId, resourceIds))
      : Promise.resolve([]),
    database
      .select({ id: group.id })
      .from(group)
      .where(eq(group.kind, "system")),
  ]);
  const gameIds = [
    ...new Set(grants.flatMap((grant) => (grant.gameId ? [grant.gameId] : []))),
  ];
  const gameOwnerRows = gameIds.length
    ? await database
        .select({
          gameId: game.resourceId,
          userId: resource.ownerUserId,
          groupId: resource.ownerGroupId,
        })
        .from(game)
        .innerJoin(resource, eq(resource.id, game.resourceId))
        .where(inArray(game.resourceId, gameIds))
    : [];

  return {
    userId: user.id,
    isSiteAdmin: profiles[0]?.role === "admin",
    groupRoles: new Map(groups.map(({ groupId, role }) => [groupId, role])),
    gameRoles: new Map(games.map(({ gameId, role }) => [gameId, role])),
    gameOwners: new Map(
      gameOwnerRows.map(({ gameId, userId, groupId }) => [
        gameId,
        { userId, groupId },
      ]),
    ),
    systemGroupIds: new Set(systemGroups.map(({ id }) => id)),
    grants,
  };
}

export function getResourceAccess(
  resource: Resource,
  context: ResourceAccessContext,
): ResourceAccess {
  // Site admins can read and delete (moderate) anything and edit official
  // resources (owned by system groups), on top of the access every user has
  // to their own and their groups' resources.
  if (context.isSiteAdmin) {
    const own = getResourceAccess(resource, { ...context, isSiteAdmin: false });
    return {
      canRead: true,
      canEdit:
        own.canEdit ||
        (!!resource.ownerGroupId &&
          context.systemGroupIds.has(resource.ownerGroupId)),
      canDelete: true,
    };
  }

  const isUserOwner = resource.ownerUserId === context.userId;
  const ownerGroupRole = resource.ownerGroupId
    ? context.groupRoles.get(resource.ownerGroupId)
    : undefined;
  const isGroupOwner = !!ownerGroupRole;

  if (resource.isAdminHidden) {
    if (isUserOwner) return { canRead: true, canEdit: true, canDelete: true };
    if (isGroupOwner) {
      return {
        canRead: true,
        canEdit: ownerGroupRole !== "member",
        canDelete: ownerGroupRole === "admin",
      };
    }
    return { canRead: false, canEdit: false, canDelete: false };
  }

  if (isUserOwner) return { canRead: true, canEdit: true, canDelete: true };
  if (isGroupOwner) {
    return {
      canRead: true,
      canEdit: ownerGroupRole !== "member",
      canDelete: ownerGroupRole === "admin",
    };
  }

  let canRead = resource.isPubliclyReadable;
  let canEdit = false;

  for (const grant of context.grants) {
    if (grant.resourceId !== resource.id) continue;

    if (grant.userId === context.userId) {
      canRead = true;
      canEdit ||= grant.permission === "edit";
    }

    if (grant.groupId) {
      const role = context.groupRoles.get(grant.groupId);
      if (role) {
        canRead = true;
        canEdit ||= grant.permission === "edit" && role !== "member";
      }
    }

    if (grant.gameId) {
      const role = context.gameRoles.get(grant.gameId);
      const gameOwner = context.gameOwners.get(grant.gameId);
      const isGameOwner =
        gameOwner?.userId === context.userId ||
        (!!gameOwner?.groupId &&
          ["admin", "editor"].includes(
            context.groupRoles.get(gameOwner.groupId) ?? "",
          ));
      const includedInAudience =
        isGameOwner ||
        (role !== undefined &&
          (grant.gameAudience === "members" ||
            (grant.gameAudience === "gms" && role === "gm")));
      if (includedInAudience) {
        canRead = true;
        canEdit ||= grant.permission === "edit";
      }
    }
  }

  return { canRead, canEdit, canDelete: false };
}

// Like getResourceAccess, but for routes that allow anonymous visitors (no
// context): they can read public, non-hidden Resources and edit nothing.
export function getResourceAccessOrPublic(
  resource: Resource,
  context: ResourceAccessContext | null,
): ResourceAccess {
  if (context) return getResourceAccess(resource, context);
  return {
    canRead: resource.isPubliclyReadable && !resource.isAdminHidden,
    canEdit: false,
    canDelete: false,
  };
}
