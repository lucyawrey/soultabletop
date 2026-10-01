import { count, eq } from "drizzle-orm";
import { contentType, group, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  listOrder,
  listQueryParameters,
  listResources,
  officialColumn,
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
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Content type list. Each row has `source`: you, yourGroups, shared, official, or community" },
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
        .select({ type: contentType, resource, official: officialColumn })
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
    rows.map(({ type, resource: item, source, access }) => ({
      id: item.id,
      readableId: item.readableId,
      isPubliclyReadable: item.isPubliclyReadable,
      source,
      name: item.name,
      systemId: type.systemId,
      contentCategory: type.contentCategory,
      hasStrictSchema: type.hasStrictSchema,
      showSheetWarnings: type.showSheetWarnings,
      schema: type.schema,
      ownerUserId: item.ownerUserId,
      ownerGroupId: item.ownerGroupId,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    })),
    page,
  );
});
