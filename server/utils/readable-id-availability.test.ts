import { describe, expect, it } from "vitest";
import { parseAvailabilityQuery } from "./readable-id-availability";

const GROUP = "00000000-0000-4000-8000-00000000000b";

describe("parseAvailabilityQuery", () => {
  it("accepts a resource kind and normalizes the readable ID", () => {
    expect(parseAvailabilityQuery({ kind: "sheet", readableId: " My-Sheet " })).toEqual({
      query: { kind: "sheet", readableId: "my-sheet", owner: undefined, resourceId: undefined },
    });
  });

  it("reads owner as the caller (me) or a group ID", () => {
    expect(parseAvailabilityQuery({ kind: "system", readableId: "a", owner: "me" })).toMatchObject({
      query: { owner: null },
    });
    expect(parseAvailabilityQuery({ kind: "system", readableId: "a", owner: GROUP })).toMatchObject({
      query: { owner: GROUP },
    });
  });

  it("rejects unknown kinds, bad IDs, and bad owners", () => {
    expect("error" in parseAvailabilityQuery({ kind: "user", readableId: "a" })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet" })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "Bad_Id" })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "-a" })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "a", owner: "nope" })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "a", resourceId: "x" })).toBe(true);
  });

  it("rejects a readable ID that is too long", () => {
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "a".repeat(101) })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: "a".repeat(100) })).toBe(false);
  });

  it("rejects arrays and an owner on groups", () => {
    expect("error" in parseAvailabilityQuery({ kind: "sheet", readableId: ["a", "b"] })).toBe(true);
    expect("error" in parseAvailabilityQuery({ kind: "group", readableId: "a", owner: "me" })).toBe(true);
  });
});
