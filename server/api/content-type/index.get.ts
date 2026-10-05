import { and, count, eq, or, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { content, contentType, group, resource, sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { contentTypeListColumns } from "../../utils/list-columns";
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
import { readableBy, type ListViewer } from "../../utils/resource-access-sql";

// How many sheets and content of a content type its own owner made (the same
// user or group, as systems count their content types) that the viewer can
// read: the cards' summary, counted in the list query itself.
const itemResource = alias(resource, "item_resource");
function readableCount(
  table: typeof sheet | typeof content,
  typeColumn: PgColumn,
  viewer: ListViewer | null,
) {
  const items = useDatabase()
    .select({ total: count() })
    .from(table)
    .innerJoin(itemResource, eq(itemResource.id, table.resourceId))
    .where(
      and(
        eq(typeColumn, resource.id),
        or(
          eq(itemResource.ownerUserId, resource.ownerUserId),
          eq(itemResource.ownerGroupId, resource.ownerGroupId),
        ),
        readableBy(itemResource, viewer),
      ),
    );
  return sql<number>`(${items})`.mapWith(Number);
}

// Whether the content type has a default sheet row (else its generated sheet
// is the default), so create dialogs can offer to make a new sheet the default.
function hasDefaultSheet() {
  const defaults = useDatabase()
    .select({ id: sheet.resourceId })
    .from(sheet)
    .where(and(eq(sheet.contentTypeId, resource.id), eq(sheet.isDefault, true)));
  return sql<boolean>`exists (${defaults})`;
}

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "List accessible content types",
    description:
      "Rows leave out the `schema`; get a content type by ID for it.",
    parameters: [...listQueryParameters, systemIdParameter],
    responses: {
      200: { description: "Content type list. Each row has `source` (official, you, yourGroups, shared, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address, `sheetCount` and `contentCount`, how many sheets and content its own owner made for it that you can read, and `hasDefaultSheet`, whether a sheet is its default (else the one generated from the schema is)" },
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
    fetchRows: ({ where, viewer, limit, offset }) => {
      const select = database
        .select({
          type: contentTypeListColumns,
          resource,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
          sheetCount: readableCount(sheet, sheet.contentTypeId, viewer),
          contentCount: readableCount(content, content.contentTypeId, viewer),
          hasDefaultSheet: hasDefaultSheet(),
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
    rows.map(({ type, resource: item, ownerReadableId, sheetCount, contentCount, hasDefaultSheet, source, access }) => ({
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
      sheetCount,
      contentCount,
      hasDefaultSheet,
      ownerUserId: item.ownerUserId,
      ownerGroupId: item.ownerGroupId,
      updatedAt: item.updatedAt,
      canEdit: access.canEdit,
      canChangeOwner:
        !!user && !!context && canChangeResourceOwner(item, user, context),
    })),
    page,
  );
});
