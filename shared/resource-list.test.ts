import { describe, expect, it } from "vitest";
import {
  escapeLike,
  MAX_SEARCH_LENGTH,
  paginate,
  parseListQuery,
} from "./resource-list";

describe("parseListQuery", () => {
  it("defaults to no scope, no page, and empty search", () => {
    expect(parseListQuery({})).toEqual({
      query: { q: "", scope: undefined, page: undefined },
    });
  });

  it("trims and truncates search text", () => {
    const result = parseListQuery({ q: `  ${"a".repeat(200)}  ` });
    expect("query" in result && result.query.q).toBe(
      "a".repeat(MAX_SEARCH_LENGTH),
    );
  });

  it("accepts scope and page", () => {
    expect(parseListQuery({ scope: "mine", page: "3" })).toEqual({
      query: { q: "", scope: "mine", page: 3 },
    });
  });

  it("rejects bad scope and page values", () => {
    expect(parseListQuery({ scope: "all" })).toHaveProperty("error");
    expect(parseListQuery({ page: "0" })).toHaveProperty("error");
    expect(parseListQuery({ page: "1.5" })).toHaveProperty("error");
    expect(parseListQuery({ page: "x" })).toHaveProperty("error");
  });
});

describe("escapeLike", () => {
  it("escapes wildcard characters", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 60 }, (_, index) => index);

  it("slices a page and reports the total", () => {
    const result = paginate(items, 2);
    expect(result.items).toEqual(items.slice(25, 50));
    expect(result).toMatchObject({ total: 60, page: 2, pageSize: 25 });
  });

  it("returns no items past the last page", () => {
    expect(paginate(items, 9).items).toEqual([]);
  });
});
