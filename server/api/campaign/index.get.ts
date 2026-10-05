import { resourceListColumns } from "../../utils/list-columns";
import { count, eq } from "drizzle-orm";
import { campaign, group, resource } from "../../database/schema";
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

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "List accessible campaigns",
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Campaign list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address, plus `canEdit` and `canDelete` (GMs can edit a campaign but not delete it)" },
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
        .select({ campaign, resource: resourceListColumns, official: officialColumn, ownerReadableId: ownerReadableIdColumn })
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
    rows.map(({ campaign: item, resource: owner, ownerReadableId, source, access }) => ({
      ...owner,
      ...item,
      ownerReadableId,
      source,
      canEdit: access.canEdit,
      canDelete: !!context && canDeleteCampaign(owner, context),
      canChangeOwner: !!context && canChangeResourceOwner(owner, user, context),
    })),
    page,
  );
});
