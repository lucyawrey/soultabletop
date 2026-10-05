import { resourceListColumns } from "../../utils/list-columns";
import { and, count, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { contentType, group, resource, system } from "../../database/schema";
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
import { readableBy, type ListViewer } from "../../utils/resource-access-sql";

// How many of a system's content types its own owner made (the same user or
// group; community types for it would inflate the number) that the viewer can
// read: the cards' summary, counted in the list query itself. A null owner
// column never matches, so comparing both columns is enough.
const typeResource = alias(resource, "type_resource");
function readableContentTypeCount(viewer: ListViewer | null) {
  const types = useDatabase()
    .select({ total: count() })
    .from(contentType)
    .innerJoin(typeResource, eq(typeResource.id, contentType.resourceId))
    .where(
      and(
        eq(contentType.systemId, resource.id),
        or(
          eq(typeResource.ownerUserId, resource.ownerUserId),
          eq(typeResource.ownerGroupId, resource.ownerGroupId),
        ),
        readableBy(typeResource, viewer),
      ),
    );
  return sql<number>`(${types})`.mapWith(Number);
}

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "List accessible systems",
    parameters: [...listQueryParameters],
    responses: {
      200: { description: "System list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address, and `contentTypeCount`, how many content types its own owner made for it that you can read" },
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
    fetchRows: ({ where, viewer, limit, offset }) => {
      const select = database
        .select({
          resource: resourceListColumns,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
          contentTypeCount: readableContentTypeCount(viewer),
        })
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
    rows.map(({ resource: item, ownerReadableId, contentTypeCount, source, access }) => ({
      ...item,
      ownerReadableId,
      contentTypeCount,
      source,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    })),
    page,
  );
});
