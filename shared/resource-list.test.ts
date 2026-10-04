import { describe, expect, it } from "vitest";
import {
  clampPage,
  escapeLike,
  MAX_SEARCH_LENGTH,
  paginate,
  parseListQuery,
  RESOURCE_SOURCE_LABELS,
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

  it("rejects page values that aren't plain digits or are out of range", () => {
    for (const page of [
      "-1",
      "0x10",
      "1e3",
      " 2 ",
      "2.0",
      "10001",
      "400000000000000000",
      "1e20",
      "",
      {},
    ])
      expect(parseListQuery({ page }), String(page)).toHaveProperty("error");
    expect(parseListQuery({ page: "10000" })).toHaveProperty("query");
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseListQuery({ q: ["a", "b"], page: ["2", "x"] })).toEqual({
      query: { q: "a", scope: undefined, page: 2 },
    });
  });

  it("treats whitespace-only search as empty and rejects non-string search", () => {
    expect(parseListQuery({ q: "   " })).toEqual({
      query: { q: "", scope: undefined, page: undefined },
    });
    expect(parseListQuery({ q: {} })).toHaveProperty("error");
    expect(parseListQuery({ q: 5 })).toHaveProperty("error");
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

  it("returns the last page when asked for one past the end", () => {
    const result = paginate(items, 9);
    expect(result.page).toBe(3);
    expect(result.items).toEqual(items.slice(50));
  });

  it("stays on page 1 when empty", () => {
    expect(paginate([], 4)).toMatchObject({ items: [], total: 0, page: 1 });
  });
});

describe("clampPage", () => {
  it("clamps to the last page that exists", () => {
    expect(clampPage(99, 60)).toBe(3);
    expect(clampPage(3, 60)).toBe(3);
    expect(clampPage(2, 25)).toBe(1);
    expect(clampPage(5, 0)).toBe(1);
  });
});

describe("RESOURCE_SOURCE_LABELS", () => {
  it("are one word each", () => {
    expect(Object.values(RESOURCE_SOURCE_LABELS)).toEqual([
      "You",
      "Group",
      "Shared",
      "Official",
      "Community",
    ]);
  });
});
