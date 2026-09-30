import type { User } from "better-auth";
import { createError, getQuery } from "h3";
import { and, count, eq, inArray } from "drizzle-orm";
import { content, contentType, group, resource } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { loadResourceAccessContext } from "../../utils/resource-access";
import { readableResourceIds, requiresReadableType } from "../../utils/resource-list-filter";
import { requireUuid } from "../../utils/resource-management";
import { CONTENT_CATEGORIES, type ContentCategory } from "../../../shared/content-categories";
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
    tags: ["Content"],
    summary: "List accessible content records",
    description: "Without signing in, lists public content only.",
    parameters: [
      ...listQueryParameters,
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
      200: { description: "Content list" },
    },
  },
});

async function loadReadableTypeIds(user: User | null) {
  const database = useDatabase();
  const typeResources = await database
    .select({ resource })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId));
  const context = user
    ? await loadResourceAccessContext(
        user,
        typeResources.map((row) => row.resource.id),
      )
    : null;
  return readableResourceIds(
    typeResources.map((row) => row.resource),
    context,
  );
}

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const query = requireListQuery(event);
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
  // from the type. The set is resolved up front so totals and pages stay
  // right. Pickers and dropdowns (no `categories`) get everything readable.
  const database = useDatabase();
  const readableTypeIds = requiresReadableType(categories)
    ? await loadReadableTypeIds(user)
    : undefined;
  const filter = and(
    readableTypeIds
      ? inArray(content.contentTypeId, readableTypeIds)
      : undefined,
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
        .select({ item: content, resource, official: officialColumn })
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
    rows.map(({ item, resource: resourceItem, official, access }) => ({
      id: resourceItem.id,
      readableId: resourceItem.readableId,
      isPubliclyReadable: resourceItem.isPubliclyReadable,
      official,
      name: resourceItem.name,
      createdAt: resourceItem.createdAt,
      updatedAt: resourceItem.updatedAt,
      contentTypeId: item.contentTypeId,
      sheetId: item.sheetId,
      data: item.data,
      canEdit: access.canEdit,
    })),
    page,
  );
});
