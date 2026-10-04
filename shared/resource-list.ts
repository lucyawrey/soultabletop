// Query handling shared by the list endpoints and the list pages: search text,
// "mine" / "public" scope, and numbered pagination.

export const LIST_SCOPES = ["mine", "public"] as const;
export type ListScope = (typeof LIST_SCOPES)[number];

// Where a listed resource comes from, relative to the viewer.
export const RESOURCE_SOURCES = [
  "you",
  "yourGroups",
  "shared",
  "official",
  "community",
] as const;
export type ResourceSource = (typeof RESOURCE_SOURCES)[number];

// One word each, so the badges stay short.
export const RESOURCE_SOURCE_LABELS: Record<ResourceSource, string> = {
  you: "You",
  yourGroups: "Group",
  shared: "Shared",
  official: "Official",
  community: "Community",
};

export const LIST_PAGE_SIZE = 25;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_PAGE = 10000;

export interface ListQuery {
  q: string;
  scope?: ListScope;
  // Set when the request asked for a page; list endpoints return the plain
  // array (everything readable) without it, for pickers and dropdowns.
  page?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

// Returns an error message for an invalid value, otherwise the parsed query.
export function parseListQuery(
  raw: Record<string, unknown>,
): { query: ListQuery } | { error: string } {
  const q = firstValue(raw.q);
  const scope = firstValue(raw.scope);
  const page = firstValue(raw.page);

  if (q !== undefined && typeof q !== "string")
    return { error: "q must be a string" };
  if (
    scope !== undefined &&
    !(LIST_SCOPES as readonly unknown[]).includes(scope)
  )
    return { error: `scope must be one of: ${LIST_SCOPES.join(", ")}` };

  let pageNumber: number | undefined;
  if (page !== undefined) {
    // Plain digits only: Number() would also accept "0x10", "1e3", " 2 ".
    pageNumber = typeof page === "string" && /^\d+$/.test(page) ? Number(page) : 0;
    if (pageNumber < 1 || pageNumber > MAX_PAGE)
      return { error: `page must be a whole number from 1 to ${MAX_PAGE}` };
  }

  return {
    query: {
      q: (q ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
      scope: scope as ListScope | undefined,
      page: pageNumber,
    },
  };
}

// Escapes `%`, `_`, and `\` so search text matches literally in a LIKE.
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// A page past the end becomes the last page that exists (page 1 when empty).
export function clampPage(page: number, total: number, pageSize = LIST_PAGE_SIZE) {
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize = LIST_PAGE_SIZE,
): Paginated<T> {
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page: current,
    pageSize,
  };
}
