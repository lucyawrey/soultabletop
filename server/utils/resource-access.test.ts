import { describe, expect, it } from "vitest";
import type { Resource } from "../database/schema";
import {
  canCreateForGroup,
  canDeleteCampaign,
  getResourceAccess,
  type ResourceAccessContext,
} from "./resource-access";

const OFFICIAL = "00000000-0000-4000-8000-00000000000a";
const PARTY = "00000000-0000-4000-8000-00000000000b";

function context(overrides: Partial<ResourceAccessContext> = {}): ResourceAccessContext {
  return {
    userId: "me",
    isSiteAdmin: false,
    groupRoles: new Map(),
    campaignRoles: new Map(),
    campaignOwners: new Map(),
    systemGroupIds: new Set([OFFICIAL]),
    grants: [],
    ...overrides,
  };
}

function resource(overrides: Partial<Resource>): Resource {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "system",
    ownerUserId: null,
    ownerGroupId: null,
    readableId: "x",
    name: "X",
    isPubliclyReadable: false,
    createdByUserId: null,
    updatedByUserId: null,
    isAdminHidden: false,
    moderationReason: null,
    moderatedAt: null,
    moderatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Resource;
}

describe("getResourceAccess", () => {
  it("gives owners full access", () => {
    expect(getResourceAccess(resource({ ownerUserId: "me" }), context())).toEqual({
      canRead: true,
      canEdit: true,
      canDelete: true,
    });
  });

  it("gives group editors edit but not delete", () => {
    expect(
      getResourceAccess(
        resource({ ownerGroupId: PARTY }),
        context({ groupRoles: new Map([[PARTY, "editor"]]) }),
      ),
    ).toEqual({ canRead: true, canEdit: true, canDelete: false });
  });

  describe("site admins", () => {
    const admin = context({ isSiteAdmin: true });

    it("can read and delete anything, but not edit other people's resources", () => {
      expect(getResourceAccess(resource({ ownerUserId: "someone" }), admin)).toEqual({
        canRead: true,
        canEdit: false,
        canDelete: true,
      });
    });

    it("can edit official resources", () => {
      expect(getResourceAccess(resource({ ownerGroupId: OFFICIAL }), admin).canEdit).toBe(true);
    });

    it("can edit their own resources and their groups' resources", () => {
      expect(getResourceAccess(resource({ ownerUserId: "me" }), admin).canEdit).toBe(true);
      expect(
        getResourceAccess(
          resource({ ownerGroupId: PARTY }),
          context({ isSiteAdmin: true, groupRoles: new Map([[PARTY, "editor"]]) }),
        ).canEdit,
      ).toBe(true);
    });
  });
});

describe("campaign members", () => {
  const campaign = resource({ kind: "campaign", ownerUserId: "someone" });
  const as = (role: "gm" | "player", overrides: Partial<ResourceAccessContext> = {}) =>
    context({ campaignRoles: new Map([[campaign.id, role]]), ...overrides });

  it("lets players read the campaign, nothing more", () => {
    expect(getResourceAccess(campaign, as("player"))).toEqual({
      canRead: true,
      canEdit: false,
      canDelete: false,
    });
    expect(canDeleteCampaign(campaign, as("player"))).toBe(false);
  });

  it("lets GMs read and edit the campaign, not delete it", () => {
    expect(getResourceAccess(campaign, as("gm"))).toEqual({
      canRead: true,
      canEdit: true,
      canDelete: false,
    });
    expect(canDeleteCampaign(campaign, as("gm"))).toBe(false);
  });

  it("leaves GM edit out with gmEdit: false, keeping read", () => {
    expect(getResourceAccess(campaign, as("gm"), { gmEdit: false })).toEqual({
      canRead: true,
      canEdit: false,
      canDelete: false,
    });
  });

  it("still lets a GM delete when they have edit access another way", () => {
    const grant = { resourceId: campaign.id, userId: "me", permission: "edit" } as never;
    expect(canDeleteCampaign(campaign, as("gm", { grants: [grant] }))).toBe(true);
    const owned = resource({ kind: "campaign", ownerUserId: "me" });
    expect(canDeleteCampaign(owned, context({ campaignRoles: new Map([[owned.id, "gm"]]) }))).toBe(true);
  });

  it("adds GM edit to a member of the owning group, with canDelete false", () => {
    const grouped = resource({ kind: "campaign", ownerGroupId: PARTY });
    const ctx = context({
      groupRoles: new Map([[PARTY, "member"]]),
      campaignRoles: new Map([[grouped.id, "gm"]]),
    });
    expect(getResourceAccess(grouped, ctx)).toEqual({ canRead: true, canEdit: true, canDelete: false });
    expect(getResourceAccess(grouped, ctx, { gmEdit: false }).canEdit).toBe(false);
    expect(canDeleteCampaign(grouped, ctx)).toBe(false);
  });

  it("adds an edit grant to a member of the owning group", () => {
    const grouped = resource({ ownerGroupId: PARTY });
    const grant = { resourceId: grouped.id, userId: "me", permission: "edit" } as never;
    const ctx = context({ groupRoles: new Map([[PARTY, "member"]]), grants: [grant] });
    expect(getResourceAccess(grouped, ctx)).toEqual({ canRead: true, canEdit: true, canDelete: false });
    expect(
      getResourceAccess(grouped, context({ groupRoles: new Map([[PARTY, "member"]]) })).canEdit,
    ).toBe(false);
  });

  it("doesn't let members read a campaign hidden by a site admin", () => {
    const hidden = { ...campaign, isAdminHidden: true };
    expect(getResourceAccess(hidden, as("gm")).canRead).toBe(false);
  });

  it("applies only to the campaign itself", () => {
    const other = resource({ kind: "campaign", id: "00000000-0000-4000-8000-000000000002" });
    expect(getResourceAccess(other, as("gm")).canRead).toBe(false);
  });
});

describe("canCreateForGroup", () => {
  it("allows group admins and editors, not members", () => {
    for (const role of ["admin", "editor"] as const)
      expect(canCreateForGroup(PARTY, context({ groupRoles: new Map([[PARTY, role]]) }))).toBe(true);
    expect(canCreateForGroup(PARTY, context({ groupRoles: new Map([[PARTY, "member"]]) }))).toBe(false);
    expect(canCreateForGroup(PARTY, context())).toBe(false);
  });

  it("lets site admins use system groups they aren't in", () => {
    expect(canCreateForGroup(OFFICIAL, context({ isSiteAdmin: true }))).toBe(true);
    expect(canCreateForGroup(OFFICIAL, context())).toBe(false);
  });

  it("holds site admins to the role rule for regular groups", () => {
    expect(canCreateForGroup(PARTY, context({ isSiteAdmin: true }))).toBe(false);
    expect(
      canCreateForGroup(
        PARTY,
        context({ isSiteAdmin: true, groupRoles: new Map([[PARTY, "member"]]) }),
      ),
    ).toBe(false);
  });
});
