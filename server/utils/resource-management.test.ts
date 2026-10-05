import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION_LENGTH, requireDescription } from "./resource-management";
import { RESOURCE_LIST_OMITTED, resourceListColumns } from "./list-columns";

describe("requireDescription", () => {
  it("keeps Markdown as written, and turns null or blank text into none", () => {
    expect(requireDescription("# Credits\n\nData from …  ")).toBe("# Credits\n\nData from …  ");
    expect(requireDescription(null)).toBeNull();
    expect(requireDescription("  \n ")).toBeNull();
  });

  it("rejects other types and text over the limit", () => {
    expect(() => requireDescription(5)).toThrow("description must be text or null");
    expect(() => requireDescription("x".repeat(MAX_DESCRIPTION_LENGTH + 1))).toThrow("at most 20,000 characters");
    expect(requireDescription("x".repeat(MAX_DESCRIPTION_LENGTH))).toHaveLength(MAX_DESCRIPTION_LENGTH);
  });
});

describe("resourceListColumns", () => {
  it("leaves the description out of lists", () => {
    expect(RESOURCE_LIST_OMITTED).toEqual(["description"]);
    expect("description" in resourceListColumns).toBe(false);
    expect("name" in resourceListColumns).toBe(true);
  });
});
