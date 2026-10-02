import { count, eq } from "drizzle-orm";
import { group, resource, system } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  listOrder,
  listQueryParameters,
  listResources,
  officialColumn,
  ownerReadableIdColumn,
  requireListQuery,
  respondWithList,
} from "../../utils/resource-list";
import { canChangeResourceOwner } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "List accessible systems",
    parameters: [...listQueryParameters],
    responses: {
      200: { description: "System list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
  const database = useDatabase();
  const { rows, context, page } = await listResources({
    query,
    user,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({ resource, official: officialColumn, ownerReadableId: ownerReadableIdColumn })
        .from(system)
        .innerJoin(resource, eq(resource.id, system.resourceId))
        .leftJoin(group, eq(group.id, resource.ownerGroupId))
        .where(where)
        .orderBy(...listOrder)
        .$dynamic();
      return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
    },
    countRows: async (where) => {
      const [row] = await database
        .select({ total: count() })
        .from(system)
        .innerJoin(resource, eq(resource.id, system.resourceId))
        .where(where);
      return row?.total ?? 0;
    },
  });
  return respondWithList(
    rows.map(({ resource: item, ownerReadableId, source, access }) => ({
      ...item,
      ownerReadableId,
      source,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    })),
    page,
  );
});
