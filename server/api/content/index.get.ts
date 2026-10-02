import { createError, getQuery } from "h3";
import { and, count, eq, exists, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { content, contentType, group, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { contentListColumns } from "../../utils/list-columns";
import { useDatabase } from "../../utils/database";
import { readableBy, type ListViewer } from "../../utils/resource-access-sql";
import { requiresReadableType } from "../../utils/resource-list-filter";
import { requireUuid } from "../../utils/resource-management";
import { CONTENT_CATEGORIES, type ContentCategory } from "../../../shared/content-categories";
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
    tags: ["Content"],
    summary: "List accessible content records",
    description:
      "Without signing in, lists public content only. Each row has the `systemId` of its content type's system. Rows leave out `data`; get content by ID for it.",
    parameters: [
      ...listQueryParameters,
      systemIdParameter,
      {
        name: "categories",
        in: "query",
        required: false,
        description:
          "Comma-separated content categories to include, e.g. `playerCharacter,nonPlayerCharacter`",
        schema: { type: "string" },
      },
      {
        name: "contentTypeId",
        in: "query",
        required: false,
        description: "Only content of this content type",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: { description: "Content list. Each row has `source` (you, yourGroups, shared, official, or community) and `ownerReadableId`, the owner's username or group ID, which with `readableId` is the resource's address" },
    },
  },
});

// The content's content type, as a resource, for checking it's readable.
const typeResource = alias(resource, "type_resource");

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
  const systemId = requireSystemFilter(event);
  const { contentTypeId, categories } = getQuery(event);
  if (contentTypeId !== undefined) requireUuid(contentTypeId, "contentTypeId");
  let categoryFilter: ContentCategory[] | undefined;
  if (categories !== undefined) {
    categoryFilter = String(categories).split(",") as ContentCategory[];
    if (categoryFilter.some((item) => !CONTENT_CATEGORIES.includes(item)))
      throw createError({
        statusCode: 400,
        statusMessage: `categories must be a comma-separated list of: ${CONTENT_CATEGORIES.join(", ")}`,
      });
  }
  // The Characters and Content lists (which send `categories`) show content
  // only when its content type is readable too, since sheets and schemas come
  // from the type. Pickers and dropdowns (no `categories`) get everything
  // readable.
  const database = useDatabase();
  const filter = (viewer: ListViewer | null) =>
    and(
      requiresReadableType(categories)
        ? exists(
            database
              .select({ one: sql`1` })
              .from(typeResource)
              .where(
                and(
                  eq(typeResource.id, content.contentTypeId),
                  readableBy(typeResource, viewer),
                ),
              ),
          )
        : undefined,
      systemId ? eq(contentType.systemId, systemId) : undefined,
      typeof contentTypeId === "string"
        ? eq(content.contentTypeId, contentTypeId)
        : undefined,
      categoryFilter
        ? inArray(contentType.contentCategory, categoryFilter)
        : undefined,
    );
  const { rows, page } = await listResources({
    query,
    user,
    where: filter,
    fetchRows: ({ where, limit, offset }) => {
      const select = database
        .select({
          item: contentListColumns,
          resource,
          systemId: contentType.systemId,
          official: officialColumn,
          ownerReadableId: ownerReadableIdColumn,
        })
        .from(content)
        .innerJoin(resource, eq(resource.id, content.resourceId))
        .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
        .leftJoin(group, eq(group.id, resource.ownerGroupId))
        .where(where)
        .orderBy(...listOrder)
        .$dynamic();
      return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
    },
    countRows: async (where) => {
      const [row] = await database
        .select({ total: count() })
        .from(content)
        .innerJoin(resource, eq(resource.id, content.resourceId))
        .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
        .where(where);
      return row?.total ?? 0;
    },
  });

  return respondWithList(
    rows.map(({ item, resource: resourceItem, ownerReadableId, systemId: typeSystemId, source, access }) => ({
      id: resourceItem.id,
      readableId: resourceItem.readableId,
      ownerReadableId,
      isPubliclyReadable: resourceItem.isPubliclyReadable,
      source,
      name: resourceItem.name,
      createdAt: resourceItem.createdAt,
      updatedAt: resourceItem.updatedAt,
      contentTypeId: item.contentTypeId,
      systemId: typeSystemId,
      sheetId: item.sheetId,
      canEdit: access.canEdit,
    })),
    page,
  );
});
