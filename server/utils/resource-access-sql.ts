import { and, eq, exists, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  campaign,
  campaignMembership,
  groupMembership,
  resource,
  resourceGrant,
} from "../database/schema";
import { useDatabase } from "./database";

// SQL versions of the list rules, so lists can filter, count, and page in the
// database. They must select exactly the rows that `getResourceAccess` and
// `isListed` (`resource-list-filter.ts`) allow: `getResourceAccess` stays the
// source of truth, `listResources` still checks every returned row against it,
// and `resource-list-filter.test.ts` checks the rules below (transcribed there
// as `sqlListed`) against it case by case. Change both together.
//
// Each condition takes the resource table to test, so a query can also check a
// joined resource (e.g. a content's content type) through an alias. Viewer
// facts come from subqueries on the viewer's ID, so the cost grows with the
// viewer's memberships, not with the site.

export interface ResourceTable {
  id: AnyPgColumn;
  ownerUserId: AnyPgColumn;
  ownerGroupId: AnyPgColumn;
  isPubliclyReadable: AnyPgColumn;
  isAdminHidden: AnyPgColumn;
}

export interface ListViewer {
  userId: string;
  isSiteAdmin: boolean;
}

// The owner of a campaign a grant names, kept apart from the outer `resource`.
const campaignOwner = alias(resource, "campaign_owner");

function viewerGroupIds(userId: string, roles?: ("admin" | "editor")[]) {
  return useDatabase()
    .select({ id: groupMembership.groupId })
    .from(groupMembership)
    .where(
      and(
        eq(groupMembership.userId, userId),
        roles ? inArray(groupMembership.role, roles) : undefined,
      ),
    );
}

function viewerCampaignIds(userId: string, role?: "gm") {
  return useDatabase()
    .select({ id: campaignMembership.campaignId })
    .from(campaignMembership)
    .where(
      and(
        eq(campaignMembership.userId, userId),
        role ? eq(campaignMembership.role, role) : undefined,
      ),
    );
}

// Campaigns the viewer owns for grant purposes: their own, or owned by a group
// where they're an admin or editor (`getGrantEffect`'s `isCampaignOwner`).
function viewerOwnedCampaignIds(userId: string) {
  return useDatabase()
    .select({ id: campaign.resourceId })
    .from(campaign)
    .innerJoin(campaignOwner, eq(campaignOwner.id, campaign.resourceId))
    .where(
      or(
        eq(campaignOwner.ownerUserId, userId),
        inArray(campaignOwner.ownerGroupId, viewerGroupIds(userId, ["admin", "editor"])),
      ),
    );
}

// Owned by the viewer or by a group they're in (any role).
export function ownedByViewer(table: ResourceTable, userId: string) {
  return or(
    eq(table.ownerUserId, userId),
    inArray(table.ownerGroupId, viewerGroupIds(userId)),
  )!;
}

// A grant on the resource reaches the viewer (`getGrantEffect(...).applies`),
// or with `edit`, reaches them with edit (`getGrantEffect(...).canEdit`):
// group grants edit only for the group's admins and editors.
export function grantReachesViewer(
  table: ResourceTable,
  userId: string,
  permission: "read" | "edit",
) {
  const edit = permission === "edit";
  return exists(
    useDatabase()
      .select({ one: sql`1` })
      .from(resourceGrant)
      .where(
        and(
          eq(resourceGrant.resourceId, table.id),
          edit ? eq(resourceGrant.permission, "edit") : undefined,
          or(
            eq(resourceGrant.userId, userId),
            inArray(
              resourceGrant.groupId,
              viewerGroupIds(userId, edit ? ["admin", "editor"] : undefined),
            ),
            inArray(resourceGrant.campaignId, viewerOwnedCampaignIds(userId)),
            and(
              eq(resourceGrant.campaignAudience, "members"),
              inArray(resourceGrant.campaignId, viewerCampaignIds(userId)),
            ),
            and(
              eq(resourceGrant.campaignAudience, "gms"),
              inArray(resourceGrant.campaignId, viewerCampaignIds(userId, "gm")),
            ),
          ),
        ),
      ),
  );
}

// Public and not hidden: what anyone, signed in or not, can read.
export function publiclyListed(table: ResourceTable) {
  return and(eq(table.isPubliclyReadable, true), eq(table.isAdminHidden, false))!;
}

// `getResourceAccessOrPublic(...).canRead`. `undefined` (no condition) for a
// site admin, who can read everything. Campaign members read the campaign.
export function readableBy(table: ResourceTable, viewer: ListViewer | null) {
  if (!viewer) return publiclyListed(table);
  if (viewer.isSiteAdmin) return undefined;
  return or(
    ownedByViewer(table, viewer.userId),
    and(
      eq(table.isAdminHidden, false),
      or(
        eq(table.isPubliclyReadable, true),
        inArray(table.id, viewerCampaignIds(viewer.userId)),
        grantReachesViewer(table, viewer.userId, "read"),
      ),
    ),
  )!;
}

// The viewer's stake in a resource for their My list (`isListed` with scope
// "mine"): owned by them or their groups, shared with them to edit, or a
// campaign they're a member of (which also covers a GM's edit access).
// Readability is checked separately.
function viewerStake(table: ResourceTable, userId: string) {
  return or(
    ownedByViewer(table, userId),
    and(
      eq(table.isAdminHidden, false),
      grantReachesViewer(table, userId, "edit"),
    ),
    inArray(table.id, viewerCampaignIds(userId)),
  )!;
}

// Listed in the viewer's My list: readable, with a stake in it.
export function inViewerMine(table: ResourceTable, viewer: ListViewer) {
  return and(readableBy(table, viewer), viewerStake(table, viewer.userId))!;
}

// Not in the viewer's My list. `IS NOT TRUE` treats NULL (e.g. comparing a
// NULL owner column) as "not listed", where NOT would drop the row.
export function notInViewerMine(table: ResourceTable, viewer: ListViewer): SQL {
  return sql`(${inViewerMine(table, viewer)}) is not true`;
}
