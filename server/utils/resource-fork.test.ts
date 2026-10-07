import { describe, expect, it } from "vitest";
import { freeReadableId, selectForkCopies, type ForkOptions } from "./resource-fork";

// A sheet whose content type and system have the same owner, with another
// type in the system and a sheet on each type.
const options: ForkOptions = {
  resource: { id: "sheet", kind: "sheet", name: "Sheet", readableId: "sheet", parentId: "type" },
  parents: [
    { id: "type", kind: "contentType", name: "Type", readableId: "type", parentId: "system" },
    { id: "system", kind: "system", name: "System", readableId: "system", parentId: null },
  ],
  extras: [
    { id: "feat", kind: "contentType", name: "Feat", readableId: "feat", parentId: "system" },
    { id: "type-sheet", kind: "sheet", name: "Other", readableId: "other", parentId: "type" },
    { id: "feat-sheet", kind: "sheet", name: "Feat card", readableId: "card", parentId: "feat" },
  ],
};

const ids = (request: Parameters<typeof selectForkCopies>[1]) =>
  selectForkCopies(options, request).map((item) => item.id);

describe("selectForkCopies", () => {
  it("copies the resource alone, or with its parents first", () => {
    expect(ids({})).toEqual(["sheet"]);
    expect(ids({ withParents: true })).toEqual(["system", "type", "sheet"]);
  });

  it("adds extras whose parent is copied, ordered by kind", () => {
    expect(ids({ withParents: true, include: ["feat-sheet", "feat", "type-sheet"] })).toEqual([
      "system",
      "type",
      "feat",
      "sheet",
      "type-sheet",
      "feat-sheet",
    ]);
  });

  it("refuses extras without their parent, and resources it doesn't offer", () => {
    expect(() => ids({ include: ["type-sheet"] })).toThrow("only be copied with its parent");
    expect(() => ids({ withParents: true, include: ["feat-sheet"] })).toThrow(
      "only be copied with its parent",
    );
    expect(() => ids({ withParents: true, include: ["system"] })).toThrow("can't copy");
  });
});

describe("freeReadableId", () => {
  it("keeps a free readable ID and numbers a taken one", () => {
    expect(freeReadableId("pf2e", new Set())).toBe("pf2e");
    expect(freeReadableId("pf2e", new Set(["pf2e", "pf2e-2"]))).toBe("pf2e-3");
  });
});
