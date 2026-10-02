import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { content, contentType, sheet } from "../database/schema";
import {
  contentListColumns,
  contentTypeListColumns,
  sheetListColumns,
} from "./list-columns";

// A query builder with no connection: only builds SQL.
const db = drizzle.mock();

// The heavy columns each list leaves out; every other column must stay.
const cases = [
  { name: "sheet", table: sheet, kept: sheetListColumns, heavy: ["markup", "cssStyles"] },
  { name: "content type", table: contentType, kept: contentTypeListColumns, heavy: ["schema"] },
  { name: "content", table: content, kept: contentListColumns, heavy: ["data"] },
];

describe("list columns", () => {
  for (const { name, table, kept, heavy } of cases) {
    it(`${name} lists keep every column but ${heavy.join(" and ")}`, () => {
      const all = Object.keys(getTableColumns(table));
      for (const column of heavy) expect(all).toContain(column);
      expect(Object.keys(kept).sort()).toEqual(
        all.filter((column) => !heavy.includes(column)).sort(),
      );
    });

    it(`${name} lists select no heavy column in SQL`, () => {
      const { sql } = db.select(kept).from(table).toSQL();
      for (const column of heavy) {
        const dbName = (getTableColumns(table) as Record<string, { name: string }>)[column]!.name;
        expect(sql).not.toContain(`"${dbName}"`);
      }
      expect(sql).toContain("resource_id");
    });
  }
});
