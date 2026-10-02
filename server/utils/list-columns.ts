import { getTableColumns } from "drizzle-orm";
import { content, contentType, sheet } from "../database/schema";

// The columns of the per-kind tables that list endpoints select. Lists leave
// out the large ones (a sheet's `markup` and `cssStyles`, about 20 KB a page; a
// content type's `schema`; a content's `data`), which single-resource GETs
// still return. Everything else is kept, so a column added later shows up in
// lists unless it is added to the omitted set here.

function omit<T extends Record<string, unknown>, K extends keyof T>(
  columns: T,
  omitted: readonly K[],
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(columns).filter(([key]) => !omitted.includes(key as K)),
  ) as Omit<T, K>;
}

export const SHEET_LIST_OMITTED = ["markup", "cssStyles"] as const;
export const CONTENT_TYPE_LIST_OMITTED = ["schema"] as const;
export const CONTENT_LIST_OMITTED = ["data"] as const;

export const sheetListColumns = omit(getTableColumns(sheet), SHEET_LIST_OMITTED);
export const contentTypeListColumns = omit(
  getTableColumns(contentType),
  CONTENT_TYPE_LIST_OMITTED,
);
export const contentListColumns = omit(
  getTableColumns(content),
  CONTENT_LIST_OMITTED,
);
