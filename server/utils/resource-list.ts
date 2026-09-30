import { createError, getQuery, type H3Event } from "h3";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { User } from "better-auth";
import {
  campaignMembership,
  group,
  groupMembership,
  resource,
  resourceGrant,
  type Resource,
} from "../database/schema";
import { useDatabase } from "./database";
import {
  clampPage,
  escapeLike,
  LIST_PAGE_SIZE,
  LIST_SCOPES,
  MAX_PAGE,
  paginate,
  parseListQuery,
  type ListQuery,
  type Paginated,
} from "../../shared/resource-list";
import { isListed } from "./resource-list-filter";
import {
  getResourceAccessOrPublic,
  loadResourceAccessContext,
  type ResourceAccess,
  type ResourceAccessContext,
} from "./resource-access";

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

// The SQL part of a list query: search over name and readable ID, and scope.
// "public" is exact; "mine" selects candidates (owned by the user or their
// groups, campaigns they belong to, or carrying any edit grant) that
// `listResources` then checks against the real access rules.
export function listCondition(query: ListQuery, user: User | null) {
  const conditions: (SQL | undefined)[] = [];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(
      or(ilike(resource.name, pattern), ilike(resource.readableId, pattern)),
    );
  }
  if (query.scope === "public") {
    conditions.push(
      eq(resource.isPubliclyReadable, true),
      eq(resource.isAdminHidden, false),
    );
  } else if (query.scope === "mine") {
    if (!user)
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    const database = useDatabase();
    conditions.push(
      or(
        eq(resource.ownerUserId, user.id),
        inArray(
          resource.ownerGroupId,
          database
            .select({ id: groupMembership.groupId })
            .from(groupMembership)
            .where(eq(groupMembership.userId, user.id)),
        ),
        inArray(
          resource.id,
          database
            .select({ id: campaignMembership.campaignId })
            .from(campaignMembership)
            .where(eq(campaignMembership.userId, user.id)),
        ),
        exists(
          database
            .select({ one: sql`1` })
            .from(resourceGrant)
            .where(
              and(
                eq(resourceGrant.resourceId, resource.id),
                eq(resourceGrant.permission, "edit"),
              ),
            ),
        ),
      ),
    );
  }
  return and(...conditions);
}

interface ListRow {
  resource: Resource;
}

// Runs a list query. `fetchRows` selects rows (with `resource` and `official`)
// for a where condition, ordered by `listOrder`, with an optional limit and
// offset; `countRows` counts the rows for a condition. Rows the user can't
// read are dropped. With `query.page` the result is a page, otherwise the
// plain array.
export async function listResources<T extends ListRow>(options: {
  query: ListQuery;
  user: User | null;
  where?: SQL;
  fetchRows: (args: {
    where: SQL | undefined;
    limit?: number;
    offset?: number;
  }) => Promise<T[]>;
  countRows: (where: SQL | undefined) => Promise<number>;
}): Promise<{
  rows: (T & { access: ResourceAccess })[];
  context: ResourceAccessContext | null;
  page?: Pick<Paginated<never>, "total" | "page" | "pageSize">;
}> {
  const { query, user, fetchRows, countRows } = options;
  const where = and(options.where, listCondition(query, user));

  async function withAccess(rows: T[]) {
    const context = user
      ? await loadResourceAccessContext(
          user,
          rows.map((row) => row.resource.id),
        )
      : null;
    return {
      context,
      rows: rows
        .map((row) => ({
          ...row,
          access: getResourceAccessOrPublic(row.resource, context),
        }))
        .filter(({ access, resource: item }) =>
          isListed(item, access, context, query.scope),
        ),
    };
  }

  // Public results are exact in SQL, so they page in SQL. Everything else is
  // filtered by the access rules in code, then paged.
  if (query.page && query.scope === "public") {
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

  const all = await withAccess(await fetchRows({ where }));
  if (!query.page) return all;
  const { items, ...page } = paginate(all.rows, query.page);
  return { ...all, rows: items, page };
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
      "`mine`: owned by you or your groups, shared with you to edit, or a campaign you belong to (only if you can read it). `public`: public resources.",
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
