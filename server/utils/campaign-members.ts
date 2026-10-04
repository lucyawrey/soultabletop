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
// when the resource isn't a campaign). For a GM, returns the role the check
// saw (null for no membership), which the write must still find
// (`writeMembership`, `removeMembership`); for an editor, undefined.
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
  if (getResourceAccess(item, context, { gmEdit: false }).canEdit) return undefined;
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
  return current?.role ?? null;
}

function membershipChanged() {
  return createError({
    statusCode: 409,
    statusMessage: "The membership changed meanwhile; try again",
  });
}

// Adds a member or changes their role. With `expected` (a GM's change), only
// while the membership is still what the check saw, so a GM can't overwrite
// a change an owner made between the check and the write: with a role, an
// update of the row that still has it; with null (no membership), an insert
// that doesn't touch a row added meanwhile, unless that row already has the
// requested role (the same change made twice). Otherwise 409.
export async function writeMembership(
  campaignId: string,
  userId: string,
  role: CampaignRole,
  expected?: CampaignRole | null,
) {
  const database = useDatabase();
  const target = and(
    eq(campaignMembership.campaignId, campaignId),
    eq(campaignMembership.userId, userId),
  );
  if (expected) {
    const [updated] = await database
      .update(campaignMembership)
      .set({ role })
      .where(and(target, eq(campaignMembership.role, expected)))
      .returning();
    if (!updated) throw membershipChanged();
    return updated;
  }
  const insert = database.insert(campaignMembership).values({ campaignId, userId, role });
  const [membership] = await (expected === null
    ? insert.onConflictDoNothing()
    : insert.onConflictDoUpdate({
        target: [campaignMembership.campaignId, campaignMembership.userId],
        set: { role },
      })
  ).returning();
  if (membership) return membership;
  const [existing] = await database.select().from(campaignMembership).where(target).limit(1);
  if (existing?.role === role) return existing;
  throw membershipChanged();
}

// Removes a member. With `expected` (a GM's change), only while their role is
// still the one the check saw; 409 if it changed. Removing someone who isn't
// a member (or, for a GM, wasn't when checked) does nothing.
export async function removeMembership(
  campaignId: string,
  userId: string,
  expected?: CampaignRole | null,
) {
  if (expected === null) return;
  const removed = await useDatabase()
    .delete(campaignMembership)
    .where(
      and(
        eq(campaignMembership.campaignId, campaignId),
        eq(campaignMembership.userId, userId),
        expected ? eq(campaignMembership.role, expected) : undefined,
      ),
    )
    .returning({ userId: campaignMembership.userId });
  if (expected && removed.length === 0) throw membershipChanged();
}
