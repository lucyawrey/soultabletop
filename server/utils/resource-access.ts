import { eq, inArray } from "drizzle-orm";
import type { User } from "better-auth";
import {
  campaignMembership,
  campaign,
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
  campaignRoles: Map<string, "gm" | "player">;
  campaignOwners: Map<string, { userId: string | null; groupId: string | null }>;
  systemGroupIds: Set<string>;
  grants: (typeof resourceGrant.$inferSelect)[];
}

export interface ResourceAccess {
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Postgres takes at most 65,535 bound parameters per query, so long ID lists
// are looked up in batches.
const ID_BATCH_SIZE = 5000;

function batches<T>(items: T[]) {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += ID_BATCH_SIZE)
    result.push(items.slice(start, start + ID_BATCH_SIZE));
  return result;
}

// The access context for `user` over `resourceIds`: the user's site role,
// group and campaign roles, and the grants on those resources.
export async function loadResourceAccessContext(
  user: Pick<User, "id" | "name">,
  resourceIds: string[],
): Promise<ResourceAccessContext> {
  const [context, grants] = await Promise.all([
    loadViewerAccessContext(user),
    loadResourceGrants(resourceIds),
  ]);
  return { ...context, ...grants };
}

// The part of the access context that depends only on the user, with no
// grants loaded. Add the grants of the resources being checked with
// `withResourceGrants` before calling `getResourceAccess`.
export async function loadViewerAccessContext(
  user: Pick<User, "id" | "name">,
): Promise<ResourceAccessContext> {
  const database = useDatabase();
  const [profiles, groups, campaigns, systemGroups] = await Promise.all([
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
      .select({ campaignId: campaignMembership.campaignId, role: campaignMembership.role })
      .from(campaignMembership)
      .where(eq(campaignMembership.userId, user.id)),
    database
      .select({ id: group.id })
      .from(group)
      .where(eq(group.kind, "system")),
  ]);

  return {
    userId: user.id,
    isSiteAdmin: profiles[0]?.role === "admin",
    groupRoles: new Map(groups.map(({ groupId, role }) => [groupId, role])),
    campaignRoles: new Map(campaigns.map(({ campaignId, role }) => [campaignId, role])),
    campaignOwners: new Map(),
    systemGroupIds: new Set(systemGroups.map(({ id }) => id)),
    grants: [],
  };
}

// `context` with the grants on `resourceIds` (and the owners of the campaigns
// those grants name) in place of any it had.
export async function withResourceGrants(
  context: ResourceAccessContext,
  resourceIds: string[],
): Promise<ResourceAccessContext> {
  return { ...context, ...(await loadResourceGrants(resourceIds)) };
}

async function loadResourceGrants(
  resourceIds: string[],
): Promise<Pick<ResourceAccessContext, "grants" | "campaignOwners">> {
  const database = useDatabase();
  const ids = [...new Set(resourceIds)];
  const grants = (
    await Promise.all(
      batches(ids).map((batch) =>
        database
          .select()
          .from(resourceGrant)
          .where(inArray(resourceGrant.resourceId, batch)),
      ),
    )
  ).flat();
  const campaignIds = [
    ...new Set(grants.flatMap((grant) => (grant.campaignId ? [grant.campaignId] : []))),
  ];
  const campaignOwnerRows = (
    await Promise.all(
      batches(campaignIds).map((batch) =>
        database
          .select({
            campaignId: campaign.resourceId,
            userId: resource.ownerUserId,
            groupId: resource.ownerGroupId,
          })
          .from(campaign)
          .innerJoin(resource, eq(resource.id, campaign.resourceId))
          .where(inArray(campaign.resourceId, batch)),
      ),
    )
  ).flat();

  return {
    campaignOwners: new Map(
      campaignOwnerRows.map(({ campaignId, userId, groupId }) => [
        campaignId,
        { userId, groupId },
      ]),
    ),
    grants,
  };
}

// What one grant gives the user: whether it reaches them (through their own
// account, a group they're in, or a campaign audience) and whether it lets
// them edit.
export function getGrantEffect(
  grant: ResourceAccessContext["grants"][number],
  context: ResourceAccessContext,
): { applies: boolean; canEdit: boolean } {
  let applies = false;
  let canEdit = false;

  if (grant.userId === context.userId) {
    applies = true;
    canEdit ||= grant.permission === "edit";
  }

  if (grant.groupId) {
    const role = context.groupRoles.get(grant.groupId);
    if (role) {
      applies = true;
      canEdit ||= grant.permission === "edit" && role !== "member";
    }
  }

  if (grant.campaignId) {
    const role = context.campaignRoles.get(grant.campaignId);
    const campaignOwner = context.campaignOwners.get(grant.campaignId);
    const isCampaignOwner =
      campaignOwner?.userId === context.userId ||
      (!!campaignOwner?.groupId &&
        ["admin", "editor"].includes(
          context.groupRoles.get(campaignOwner.groupId) ?? "",
        ));
    const includedInAudience =
      isCampaignOwner ||
      (role !== undefined &&
        (grant.campaignAudience === "members" ||
          (grant.campaignAudience === "gms" && role === "gm")));
    if (includedInAudience) {
      applies = true;
      canEdit ||= grant.permission === "edit";
    }
  }

  return { applies, canEdit };
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
    const effect = getGrantEffect(grant, context);
    if (effect.applies) canRead = true;
    canEdit ||= effect.canEdit;
  }

  return { canRead, canEdit, canDelete: false };
}

// Whether the user may create resources owned by a group, or move resources
// into it: its admins and editors, and site admins for system groups (which
// they manage without being members).
export function canCreateForGroup(groupId: string, context: ResourceAccessContext) {
  const role = context.groupRoles.get(groupId);
  if (role === "admin" || role === "editor") return true;
  return context.isSiteAdmin && context.systemGroupIds.has(groupId);
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
