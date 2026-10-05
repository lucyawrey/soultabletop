import { count, eq, sql } from "drizzle-orm";
import { campaign, campaignMembership, group, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  listOrder,
  listQueryParameters,
  listResources,
  officialColumn,
  ownerReadableIdColumn,
  requireListQuery,
  requireSystemFilter,
  respondWithList,
  systemIdParameter,
} from "../../utils/resource-list";
import { canChangeResourceOwner } from "../../utils/resource-management";
import { canDeleteCampaign } from "../../utils/resource-access";

// How many members a campaign has: the cards' summary, counted in the list
// query itself.
function memberCount() {
  const members = useDatabase()
    .select({ total: count() })
    .from(campaignMembership)
    .where(eq(campaignMembership.campaignId, resource.id));
  return sql<number>`(${members})`.mapWith(Number);
}

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "List accessible campaigns",
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Campaign list. Each row has `source` (official, you, yourGroups, shared, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address, `memberCount`, plus `canEdit` and `canDelete` (GMs can edit a campaign but not delete it)" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const query = requireListQuery(event);
  const systemId = requireSystemFilter(event);
  const database = useDatabase();
  const { rows, context, page } = await listResources({
    query,
    user,
    where: systemId ? eq(campaign.systemId, systemId) : undefined,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({
          campaign,
          resource,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
          memberCount: memberCount(),
        })
        .from(campaign)
        .innerJoin(resource, eq(resource.id, campaign.resourceId))
        .leftJoin(group, eq(group.id, resource.ownerGroupId))
        .where(where)
        .orderBy(...listOrder)
        .$dynamic();
      return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
    },
    countRows: async (where) => {
      const [row] = await database
        .select({ total: count() })
        .from(campaign)
        .innerJoin(resource, eq(resource.id, campaign.resourceId))
        .where(where);
      return row?.total ?? 0;
    },
  });
  return respondWithList(
    rows.map(({ campaign: item, resource: owner, ownerReadableId, memberCount, source, access }) => ({
      ...owner,
      ...item,
      ownerReadableId,
      memberCount,
      source,
      canEdit: access.canEdit,
      canDelete: !!context && canDeleteCampaign(owner, context),
      canChangeOwner: !!context && canChangeResourceOwner(owner, user, context),
    })),
    page,
  );
});
