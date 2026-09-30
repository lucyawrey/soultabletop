import { count, eq } from "drizzle-orm";
import { campaign, group, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  listOrder,
  listQueryParameters,
  listResources,
  officialColumn,
  requireListQuery,
  respondWithList,
} from "../../utils/resource-list";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "List accessible campaigns",
    parameters: [...listQueryParameters],
    responses: {
      200: { description: "Campaign list. Each row has `source`: you, yourGroups, shared, official, or community" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const query = requireListQuery(event);
  const database = useDatabase();
  const { rows, context, page } = await listResources({
    query,
    user,
    kind: "campaign",
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({ campaign, resource, official: officialColumn })
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
    rows.map(({ campaign: item, resource: owner, source, access }) => ({
      ...owner,
      ...item,
      source,
      canEdit: access.canEdit,
      canChangeOwner: !!context && canChangeResourceOwner(owner, user, context),
    })),
    page,
  );
});
