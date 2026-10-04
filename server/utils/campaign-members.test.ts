import { describe, expect, it } from "vitest";
import { gmMemberChangeError, type MemberChange } from "./campaign-members";

const change = (overrides: Partial<MemberChange>): MemberChange => ({
  actorId: "gm",
  targetId: "someone",
  currentRole: undefined,
  role: "player",
  targetIsOwner: false,
  ...overrides,
});

describe("gmMemberChangeError", () => {
  it("lets a GM add players and remove them", () => {
    expect(gmMemberChangeError(change({}))).toBeUndefined();
    expect(gmMemberChangeError(change({ currentRole: "player", role: undefined }))).toBeUndefined();
  });

  it("doesn't let a GM make anyone a GM", () => {
    expect(gmMemberChangeError(change({ role: "gm" }))).toBeDefined();
    expect(gmMemberChangeError(change({ currentRole: "player", role: "gm" }))).toBeDefined();
  });

  it("doesn't let a GM change or remove another GM", () => {
    expect(gmMemberChangeError(change({ currentRole: "gm", role: "player" }))).toBeDefined();
    expect(gmMemberChangeError(change({ currentRole: "gm", role: undefined }))).toBeDefined();
  });

  it("lets a GM step down or leave", () => {
    const self = { targetId: "gm", currentRole: "gm" } as const;
    expect(gmMemberChangeError(change({ ...self, role: "player" }))).toBeUndefined();
    expect(gmMemberChangeError(change({ ...self, role: undefined }))).toBeUndefined();
    expect(gmMemberChangeError(change({ ...self, role: "gm" }))).toBeUndefined();
  });

  it("never lets a GM change an owner's membership", () => {
    for (const currentRole of [undefined, "player", "gm"] as const)
      for (const role of [undefined, "player", "gm"] as const)
        expect(
          gmMemberChangeError(change({ targetIsOwner: true, currentRole, role })),
        ).toBeDefined();
  });
});
