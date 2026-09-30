import { count, eq } from "drizzle-orm";
import { group, resource, sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  listOrder,
  listQueryParameters,
  listResources,
  officialColumn,
  requireListQuery,
  respondWithList,
} from "../../utils/resource-list";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "List accessible sheets",
    parameters: [...listQueryParameters],
    responses: {
      200: { description: "Sheet list" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
  const database = useDatabase();
  const { rows, page } = await listResources({
    query,
    user,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({ sheet, resource, official: officialColumn })
        .from(sheet)
        .innerJoin(resource, eq(resource.id, sheet.resourceId))
        .leftJoin(group, eq(group.id, resource.ownerGroupId))
        .where(where)
        .orderBy(...listOrder)
        .$dynamic();
      return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
    },
    countRows: async (where) => {
      const [row] = await database
        .select({ total: count() })
        .from(sheet)
        .innerJoin(resource, eq(resource.id, sheet.resourceId))
        .where(where);
      return row?.total ?? 0;
    },
  });
  return respondWithList(
    rows.map(({ sheet: item, resource: owner, official, access }) => ({
      ...owner,
      ...item,
      official,
      canEdit: access.canEdit,
    })),
    page,
  );
});
