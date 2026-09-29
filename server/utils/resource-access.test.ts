import { describe, expect, it } from "vitest";
import type { Resource } from "../database/schema";
import {
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
    gameRoles: new Map(),
    gameOwners: new Map(),
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
    slug: "x",
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
