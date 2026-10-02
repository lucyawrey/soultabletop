import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { content, contentType, sheet } from "../database/schema";
import {
  CONTENT_LIST_OMITTED,
  CONTENT_TYPE_LIST_OMITTED,
  SHEET_LIST_OMITTED,
  contentListColumns,
  contentTypeListColumns,
  sheetListColumns,
} from "./list-columns";

function check(
  table: Parameters<typeof getTableColumns>[0],
  kept: Record<string, unknown>,
  omitted: readonly string[],
) {
  const all = Object.keys(getTableColumns(table));
  expect(Object.keys(kept).sort()).toEqual(
    all.filter((name) => !omitted.includes(name)).sort(),
  );
  for (const name of omitted) expect(kept).not.toHaveProperty(name);
}

describe("list columns", () => {
  it("sheet lists leave out markup and cssStyles only", () => {
    expect(SHEET_LIST_OMITTED).toEqual(["markup", "cssStyles"]);
    check(sheet, sheetListColumns, SHEET_LIST_OMITTED);
    expect(sheetListColumns).toHaveProperty("isDefault");
    expect(sheetListColumns).toHaveProperty("contentTypeId");
  });

  it("content type lists leave out the schema only", () => {
    expect(CONTENT_TYPE_LIST_OMITTED).toEqual(["schema"]);
    check(contentType, contentTypeListColumns, CONTENT_TYPE_LIST_OMITTED);
    expect(contentTypeListColumns).toHaveProperty("hasStrictSchema");
  });

  it("content lists leave out the data only", () => {
    expect(CONTENT_LIST_OMITTED).toEqual(["data"]);
    check(content, contentListColumns, CONTENT_LIST_OMITTED);
    expect(contentListColumns).toHaveProperty("sheetId");
  });
});
