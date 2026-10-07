import { describe, expect, it } from "vitest";
import { sheetRowTitle, type SheetRefs } from "./scope";

const refs: SheetRefs = {
  "weapon-id": { name: "Rapier", contentTypeId: "item-type", data: {} },
};

describe("sheetRowTitle", () => {
  it("is nothing outside a row", () => {
    expect(sheetRowTitle(undefined, { name: "Rapier" }, refs)).toBeUndefined();
  });

  it("prefers a struct entry's label, then the row's name", () => {
    expect(sheetRowTitle({ key: "stealth", label: "Stealth" }, 2, refs)).toBe("Stealth");
    expect(sheetRowTitle({ key: 0 }, { name: "Longsword", weapon: "weapon-id" }, refs)).toBe("Longsword");
  });

  it("falls back to the name of the first loaded Content the row references", () => {
    expect(sheetRowTitle({ key: 0 }, { weapon: "weapon-id", attribute: "dex" }, refs)).toBe("Rapier");
    expect(sheetRowTitle({ key: 0 }, { name: "", attribute: "dex", weapon: "weapon-id" }, refs)).toBe("Rapier");
  });

  it("is nothing when the row names nothing loaded", () => {
    expect(sheetRowTitle({ key: 0 }, { weapon: "missing-id", attribute: "dex" }, refs)).toBeUndefined();
  });
});
