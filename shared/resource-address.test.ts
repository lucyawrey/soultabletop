import { describe, expect, it } from "vitest";
import {
  addressPath,
  parseResourceAddress,
  parseResourcePagePath,
  readableResourcePagePath,
} from "./resource-address";

const uuid = "0b6f2c8e-3c1a-4d2e-9f00-1234567890ab";

describe("parseResourceAddress", () => {
  it("takes an ID alone", () => {
    expect(parseResourceAddress(uuid, undefined)).toEqual({ id: uuid });
    expect(parseResourceAddress(uuid.toUpperCase(), undefined)).toEqual({ id: uuid });
  });

  it("refuses anything else alone", () => {
    expect(parseResourceAddress("lucy", undefined)).toBeNull();
    expect(parseResourceAddress(undefined, undefined)).toBeNull();
    expect(parseResourceAddress("", undefined)).toBeNull();
  });

  it("takes owner + readable ID, lowercase", () => {
    expect(parseResourceAddress("Lucy", "Fighter")).toEqual({
      owner: "lucy",
      readableId: "fighter",
    });
    // An owner shaped like an ID is still an owner in this form.
    expect(parseResourceAddress(uuid, "fighter")).toEqual({ owner: uuid, readableId: "fighter" });
  });

  it("refuses owner + readable ID that aren't readable IDs", () => {
    for (const [owner, readableId] of [
      ["lucy", ""],
      ["", "fighter"],
      [undefined, "fighter"],
      ["lu cy", "fighter"],
      ["lucy", "fighter-"],
      ["..", "fighter"],
      ["lucy", "a/b"],
      ["lucy", "x".repeat(201)],
    ])
      expect(parseResourceAddress(owner, readableId)).toBeNull();
  });
});

describe("addressPath", () => {
  it("builds the path segments", () => {
    expect(addressPath({ id: uuid })).toBe(uuid);
    expect(addressPath({ owner: "lucy", readableId: "fighter" })).toBe("lucy/fighter");
  });
});

describe("parseResourcePagePath", () => {
  it("reads ID paths", () => {
    expect(parseResourcePagePath(`/sheets/${uuid}`)).toEqual({
      section: "sheets",
      kind: "sheet",
      address: { id: uuid },
    });
    expect(parseResourcePagePath(`/sheets/${uuid}/edit?x=1`)?.address).toEqual({ id: uuid });
    expect(parseResourcePagePath(`/characters/${uuid}`)?.kind).toBe("content");
    expect(parseResourcePagePath(`/types/${uuid}`)?.kind).toBe("contentType");
  });

  it("reads owner + readable ID paths", () => {
    expect(parseResourcePagePath("/content/Lucy/Notes")).toEqual({
      section: "content",
      kind: "content",
      address: { owner: "lucy", readableId: "notes" },
    });
    expect(parseResourcePagePath("/sheets/lucy/fighter/edit")?.address).toEqual({
      owner: "lucy",
      readableId: "fighter",
    });
  });

  it("ignores other paths", () => {
    expect(parseResourcePagePath("/")).toBeNull();
    expect(parseResourcePagePath("/sheets")).toBeNull();
    expect(parseResourcePagePath("/sheets/lucy")).toBeNull();
    expect(parseResourcePagePath("/groups/lucy/x")).toBeNull();
    expect(parseResourcePagePath("/profile")).toBeNull();
    // The editor's static route, not a sheet called "edit".
    expect(parseResourcePagePath("/sheets/lucy/edit")).toBeNull();
  });
});

describe("readableResourcePagePath", () => {
  it("builds the owner + readable ID path", () => {
    expect(readableResourcePagePath("sheets", "lucy", "fighter")).toBe("/sheets/lucy/fighter");
    expect(readableResourcePagePath("sheets", "lucy", "fighter", "/edit")).toBe(
      "/sheets/lucy/fighter/edit",
    );
    expect(readableResourcePagePath("characters", "Lucy", "Hero")).toBe("/characters/lucy/hero");
  });

  it("has none where that path would lead elsewhere", () => {
    expect(readableResourcePagePath("sheets", null, "fighter")).toBeUndefined();
    expect(readableResourcePagePath("sheets", "lucy", undefined)).toBeUndefined();
    // `/sheets/lucy/edit` is the editor route.
    expect(readableResourcePagePath("sheets", "lucy", "edit")).toBeUndefined();
    expect(readableResourcePagePath("content", "lucy", "edit")).toBe("/content/lucy/edit");
    // `/api/campaign/lucy/members` is the members route.
    expect(readableResourcePagePath("campaigns", "lucy", "members")).toBeUndefined();
    // An owner shaped like an ID reads as an ID.
    expect(readableResourcePagePath("sheets", uuid, "fighter")).toBeUndefined();
  });
});
