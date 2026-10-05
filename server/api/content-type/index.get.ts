import { count, eq } from "drizzle-orm";
import { contentType, group, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { contentTypeListColumns, resourceListColumns } from "../../utils/list-columns";
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

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "List accessible content types",
    description:
      "Rows leave out the `schema`; get a content type by ID for it.",
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Content type list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
  const systemId = requireSystemFilter(event);
  const database = useDatabase();
  const { rows, context, page } = await listResources({
    query,
    user,
    where: systemId ? eq(contentType.systemId, systemId) : undefined,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({
          type: contentTypeListColumns,
          resource: resourceListColumns,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
        })
        .from(contentType)
        .innerJoin(resource, eq(resource.id, contentType.resourceId))
        .leftJoin(group, eq(group.id, resource.ownerGroupId))
        .where(where)
        .orderBy(...listOrder)
        .$dynamic();
      return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
    },
    countRows: async (where) => {
      const [row] = await database
        .select({ total: count() })
        .from(contentType)
        .innerJoin(resource, eq(resource.id, contentType.resourceId))
        .where(where);
      return row?.total ?? 0;
    },
  });

  return respondWithList(
    rows.map(({ type, resource: item, ownerReadableId, source, access }) => ({
      id: item.id,
      readableId: item.readableId,
      ownerReadableId,
      isPubliclyReadable: item.isPubliclyReadable,
      source,
      name: item.name,
      systemId: type.systemId,
      contentCategory: type.contentCategory,
      hasStrictSchema: type.hasStrictSchema,
      showSheetWarnings: type.showSheetWarnings,
      ownerUserId: item.ownerUserId,
      ownerGroupId: item.ownerGroupId,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    })),
    page,
  );
});
