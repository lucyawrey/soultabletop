import { createError, getQuery, type H3Event } from "h3";
import { and, asc, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import type { User } from "better-auth";
import { group, resource, type Resource } from "../database/schema";
import {
  clampPage,
  escapeLike,
  LIST_PAGE_SIZE,
  LIST_SCOPES,
  MAX_PAGE,
  parseListQuery,
  type ListQuery,
  type ResourceSource,
  type Paginated,
} from "../../shared/resource-list";
import { requireUuid } from "./resource-management";
import { excludesMineFromFind, getResourceSource, isListed } from "./resource-list-filter";
import {
  getResourceAccessOrPublic,
  loadViewerAccessContext,
  withResourceGrants,
  type ResourceAccess,
  type ResourceAccessContext,
} from "./resource-access";
import {
  inViewerMine,
  notInViewerMine,
  publiclyListed,
  readableBy,
  type ListViewer,
} from "./resource-access-sql";

// Official resources (owned by a system group) are labeled as such and sort
// before Community ones; select `official` and order by `listOrder`.
export const officialColumn = sql<boolean>`coalesce(${group.kind} = 'system', false)`;
export const listOrder = [
  desc(officialColumn),
  asc(resource.name),
  asc(resource.id),
];

export function requireListQuery(event: H3Event): ListQuery {
  const parsed = parseListQuery(getQuery(event));
  if ("error" in parsed)
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  return parsed.query;
}

// The optional `systemId` filter of the lists tied to a system (campaigns,
// content types, sheets, content).
export function requireSystemFilter(event: H3Event) {
  const { systemId } = getQuery(event);
  return systemId === undefined ? undefined : requireUuid(systemId, "systemId");
}

export const systemIdParameter = {
  name: "systemId",
  in: "query" as const,
  required: false,
  description: "Only resources that belong to this system",
  schema: { type: "string" as const, format: "uuid" },
};

// The search part of a list query: name or readable ID.
function searchCondition(query: ListQuery) {
  if (!query.q) return undefined;
  const pattern = `%${escapeLike(query.q)}%`;
  return or(ilike(resource.name, pattern), ilike(resource.readableId, pattern));
}

// The rows a list shows, in SQL: what `isListed` allows for the scope, minus
// what the viewer's My list shows when Find leaves it out.
export function listCondition(query: ListQuery, viewer: ListViewer | null) {
  if (query.scope === "mine") {
    if (!viewer)
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    return inViewerMine(resource, viewer);
  }
  if (query.scope === "public") {
    return and(
      publiclyListed(resource),
      viewer && excludesMineFromFind(query, true)
        ? notInViewerMine(resource, viewer)
        : undefined,
    );
  }
  return readableBy(resource, viewer);
}

interface ListRow {
  resource: Resource;
  official: boolean;
}

// Runs a list query. `fetchRows` selects rows (with `resource` and `official`)
// for a where condition, ordered by `listOrder`, with an optional limit and
// offset; `countRows` counts the rows for a condition. The access rules are
// applied in SQL (`listCondition`), so totals and pages come from the
// database; each returned row is checked against `getResourceAccess` as well.
// `where` may be a function of the viewer, for conditions that check access
// to related resources. With `query.page` the result is a page, otherwise the
// plain array.
export async function listResources<T extends ListRow>(options: {
  query: ListQuery;
  user: User | null;
  where?: SQL | ((viewer: ListViewer | null) => SQL | undefined);
  fetchRows: (args: {
    where: SQL | undefined;
    limit?: number;
    offset?: number;
  }) => Promise<T[]>;
  countRows: (where: SQL | undefined) => Promise<number>;
}): Promise<{
  rows: (T & { access: ResourceAccess; source: ResourceSource })[];
  context: ResourceAccessContext | null;
  page?: Pick<Paginated<never>, "total" | "page" | "pageSize">;
}> {
  const { query, user, fetchRows, countRows } = options;
  const viewerContext = user ? await loadViewerAccessContext(user) : null;
  const viewer: ListViewer | null = viewerContext && {
    userId: viewerContext.userId,
    isSiteAdmin: viewerContext.isSiteAdmin,
  };
  const where = and(
    typeof options.where === "function" ? options.where(viewer) : options.where,
    searchCondition(query),
    listCondition(query, viewer),
  );

  async function withAccess(rows: T[]) {
    const context = viewerContext
      ? await withResourceGrants(
          viewerContext,
          rows.map((row) => row.resource.id),
        )
      : null;
    return {
      context,
      rows: rows
        .map((row) => ({
          ...row,
          access: getResourceAccessOrPublic(row.resource, context),
          source: getResourceSource(row.resource, row.official, context),
        }))
        // The SQL condition already applies these rules; this keeps
        // `getResourceAccess` the last word if the two ever disagree, and
        // logs the disagreement (the page comes out short and `total` high).
        .filter(({ access, resource: item }) => {
          if (isListed(item, access, context, query.scope)) return true;
          console.warn(
            "listResources: SQL list rules returned a row the access rules drop",
            {
              kind: item.kind,
              resourceId: item.id,
              viewerId: context?.userId ?? null,
              scope: query.scope ?? null,
            },
          );
          return false;
        }),
    };
  }

  if (!query.page) return withAccess(await fetchRows({ where }));
  const total = await countRows(where);
  const page = clampPage(query.page, total);
  const rows = await fetchRows({
    where,
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });
  return {
    ...(await withAccess(rows)),
    page: { total, page, pageSize: LIST_PAGE_SIZE },
  };
}

export function respondWithList<T>(
  items: T[],
  page: Pick<Paginated<T>, "total" | "page" | "pageSize"> | undefined,
): T[] | Paginated<T> {
  return page ? { items, ...page } : items;
}

// OpenAPI query parameters for endpoints that use `listResources`.
export const listQueryParameters = [
  {
    name: "q",
    in: "query" as const,
    required: false,
    description: "Search text, matched against name and ID",
    schema: { type: "string" as const },
  },
  {
    name: "scope",
    in: "query" as const,
    required: false,
    description:
      "`mine`: owned by you or your groups, shared with you to edit, or a campaign you belong to (only if you can read it). `public`: public resources; when signed in with no search text, it leaves out what `mine` lists.",
    schema: { type: "string" as const, enum: [...LIST_SCOPES] },
  },
  {
    name: "page",
    in: "query" as const,
    required: false,
    description:
      "Returns this page (25 per page) as `{ items, total, page, pageSize }` instead of the full array; a page past the end returns the last page",
    schema: { type: "integer" as const, minimum: 1, maximum: MAX_PAGE },
  },
];
