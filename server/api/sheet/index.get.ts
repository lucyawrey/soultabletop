import { count, eq } from "drizzle-orm";
import { contentType, group, resource, sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { resourceListColumns, sheetListColumns } from "../../utils/list-columns";
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

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "List accessible sheets",
    description:
      "Each row has the `systemId` of its content type's system. Rows leave out `markup` and `cssStyles`; get a sheet by ID for them.",
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Sheet list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
  const systemId = requireSystemFilter(event);
  const database = useDatabase();
  const { rows, page } = await listResources({
    query,
    user,
    where: systemId ? eq(contentType.systemId, systemId) : undefined,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({
          sheet: sheetListColumns,
          resource: resourceListColumns,
          systemId: contentType.systemId,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
        })
        .from(sheet)
        .innerJoin(resource, eq(resource.id, sheet.resourceId))
        .innerJoin(contentType, eq(contentType.resourceId, sheet.contentTypeId))
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
        .innerJoin(contentType, eq(contentType.resourceId, sheet.contentTypeId))
        .where(where);
      return row?.total ?? 0;
    },
  });
  return respondWithList(
    rows.map(({ sheet: item, resource: owner, ownerReadableId, systemId: typeSystemId, source, access }) => ({
      ...owner,
      ...item,
      ownerReadableId,
      systemId: typeSystemId,
      source,
      canEdit: access.canEdit,
    })),
    page,
  );
});
