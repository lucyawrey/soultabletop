import { and, eq } from "drizzle-orm";
import type { User } from "better-auth";
import { createError } from "h3";
import { campaignMembership, groupMembership, resource, type Resource } from "../database/schema";
import { useDatabase } from "./database";
import { getResourceAccess, loadResourceAccessContext } from "./resource-access";

type CampaignRole = "gm" | "player";

// A change to one campaign membership: `role` is the new role, or undefined
// when the member is removed.
export interface MemberChange {
  actorId: string;
  targetId: string;
  currentRole: CampaignRole | undefined;
  role: CampaignRole | undefined;
  // The target manages the campaign through ownership: the owning user, or an
  // admin or editor of the owning group.
  targetIsOwner: boolean;
}

// Who manages a campaign's members: its editors (owner, owning group's admins
// and editors, edit grants) fully, and its GMs within limits, since their
// access comes from a role an owner gave them. A GM may add players and
// remove players, and may step down or leave themselves; they may not make
// anyone a GM, change or remove another GM, or touch an owner's membership.
// Returns why a GM can't make the change, or undefined when they can.
export function gmMemberChangeError(change: MemberChange): string | undefined {
  const self = change.targetId === change.actorId;
  if (change.targetIsOwner && !self)
    return "GMs can't change the membership of the campaign's owners";
  if (change.role === "gm" && change.currentRole !== "gm")
    return "Only the campaign's owners can make someone a GM";
  if (change.currentRole === "gm" && !self)
    return "Only the campaign's owners can change or remove another GM";
  return undefined;
}

async function isCampaignOwner(item: Resource, userId: string) {
  if (item.ownerUserId) return item.ownerUserId === userId;
  if (!item.ownerGroupId) return false;
  const [row] = await useDatabase()
    .select({ role: groupMembership.role })
    .from(groupMembership)
    .where(and(eq(groupMembership.groupId, item.ownerGroupId), eq(groupMembership.userId, userId)))
    .limit(1);
  return row?.role === "admin" || row?.role === "editor";
}

// For the member routes: allows the change for the campaign's editors, and
// for its GMs when `gmMemberChangeError` allows it; throws 403 otherwise (404
// when the resource isn't a campaign).
export async function requireCampaignMemberManager(
  user: Pick<User, "id" | "name">,
  campaignId: string,
  targetId: string,
  role: CampaignRole | undefined,
) {
  const database = useDatabase();
  const [item] = await database.select().from(resource).where(eq(resource.id, campaignId)).limit(1);
  if (!item || item.kind !== "campaign")
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  const context = await loadResourceAccessContext(user, [campaignId]);
  if (getResourceAccess(item, context, { gmEdit: false }).canEdit) return;
  if (!getResourceAccess(item, context).canEdit)
    throw createError({ statusCode: 403, statusMessage: "Resource is not editable" });

  const [current] = await database
    .select({ role: campaignMembership.role })
    .from(campaignMembership)
    .where(and(eq(campaignMembership.campaignId, campaignId), eq(campaignMembership.userId, targetId)))
    .limit(1);
  const error = gmMemberChangeError({
    actorId: user.id,
    targetId,
    currentRole: current?.role,
    role,
    targetIsOwner: await isCampaignOwner(item, targetId),
  });
  if (error) throw createError({ statusCode: 403, statusMessage: error });
}
