// Query handling shared by the list endpoints and the list pages: search text,
// "mine" / "public" scope, and numbered pagination.

export const LIST_SCOPES = ["mine", "public"] as const;
export type ListScope = (typeof LIST_SCOPES)[number];

export const LIST_PAGE_SIZE = 25;
export const MAX_SEARCH_LENGTH = 100;

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
    pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1)
      return { error: "page must be a positive integer" };
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

export function paginate<T>(
  items: T[],
  page: number,
  pageSize = LIST_PAGE_SIZE,
): Paginated<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}
