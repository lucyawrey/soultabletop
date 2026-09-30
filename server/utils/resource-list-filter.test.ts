import { describe, expect, it } from "vitest";
import type { Resource } from "../database/schema";
import { getResourceAccessOrPublic, type ResourceAccessContext } from "./resource-access";
import { isListed, readableResourceIds, requiresReadableType } from "./resource-list-filter";

const PARTY = "00000000-0000-4000-8000-00000000000b";

function context(overrides: Partial<ResourceAccessContext> = {}): ResourceAccessContext {
  return {
    userId: "me",
    isSiteAdmin: false,
    groupRoles: new Map(),
    campaignRoles: new Map(),
    campaignOwners: new Map(),
    systemGroupIds: new Set(),
    grants: [],
    ...overrides,
  };
}

function resource(overrides: Partial<Resource>): Resource {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "sheet",
    ownerUserId: "someone",
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

function listed(
  item: Resource,
  ctx: ResourceAccessContext | null,
  scope: "mine" | "public" | undefined,
) {
  return isListed(item, getResourceAccessOrPublic(item, ctx), ctx, scope);
}

describe("isListed", () => {
  it("drops anything the viewer can't read", () => {
    const item = resource({});
    for (const scope of ["mine", "public", undefined] as const)
      expect(listed(item, context(), scope)).toBe(false);
  });

  it("lists public resources in public and unscoped lists, for anyone", () => {
    const item = resource({ isPubliclyReadable: true });
    expect(listed(item, context(), "public")).toBe(true);
    expect(listed(item, context(), undefined)).toBe(true);
    expect(listed(item, null, "public")).toBe(true);
  });

  it("hides admin-hidden resources from visitors and non-owners", () => {
    const item = resource({ isPubliclyReadable: true, isAdminHidden: true });
    expect(listed(item, null, "public")).toBe(false);
    expect(listed(item, context(), "public")).toBe(false);
    expect(listed(resource({ ownerUserId: "me", isAdminHidden: true }), context(), "mine")).toBe(true);
  });

  describe("mine", () => {
    it("includes resources the user owns, public or not", () => {
      expect(listed(resource({ ownerUserId: "me" }), context(), "mine")).toBe(true);
    });

    it("includes resources owned by the user's groups, for any role", () => {
      const ctx = context({ groupRoles: new Map([[PARTY, "member"]]) });
      expect(listed(resource({ ownerUserId: null, ownerGroupId: PARTY }), ctx, "mine")).toBe(true);
    });

    it("leaves out other people's public resources", () => {
      expect(listed(resource({ isPubliclyReadable: true }), context(), "mine")).toBe(false);
    });

    it("includes shared resources only with edit permission", () => {
      const item = resource({});
      const read = context({
        grants: [{ resourceId: item.id, userId: "me", permission: "read" } as never],
      });
      const edit = context({
        grants: [{ resourceId: item.id, userId: "me", permission: "edit" } as never],
      });
      expect(listed(item, read, "mine")).toBe(false);
      expect(listed(item, edit, "mine")).toBe(true);
    });

    it("includes a public campaign the user is a member of", () => {
      const item = resource({ kind: "campaign", isPubliclyReadable: true });
      const ctx = context({ campaignRoles: new Map([[item.id, "player"]]) });
      expect(listed(item, ctx, "mine")).toBe(true);
      expect(listed(item, context(), "mine")).toBe(false);
    });
  });
});

describe("readableResourceIds", () => {
  it("returns only the readable resources' IDs", () => {
    const open = resource({ id: "a", isPubliclyReadable: true });
    const closed = resource({ id: "b" });
    const mine = resource({ id: "c", ownerUserId: "me" });
    expect(readableResourceIds([open, closed, mine], context())).toEqual(["a", "c"]);
    expect(readableResourceIds([open, closed, mine], null)).toEqual(["a"]);
  });
});

describe("requiresReadableType", () => {
  it("applies only to the lists that send categories", () => {
    expect(requiresReadableType("playerCharacter")).toBe(true);
    expect(requiresReadableType(undefined)).toBe(false);
  });
});

describe("site admins and hidden resources", () => {
  const admin = context({ isSiteAdmin: true });

  it("lists everything they can read in unscoped and public lists", () => {
    const item = resource({ isPubliclyReadable: false });
    expect(listed(item, admin, undefined)).toBe(true);
  });

  it("keeps other people's resources out of their Mine list", () => {
    expect(listed(resource({ isPubliclyReadable: true }), admin, "mine")).toBe(false);
    expect(listed(resource({ ownerUserId: "me" }), admin, "mine")).toBe(true);
  });

  it("readableResourceIds includes hidden resources for a site admin only", () => {
    const hidden = resource({ id: "h", isPubliclyReadable: true, isAdminHidden: true });
    expect(readableResourceIds([hidden], admin)).toEqual(["h"]);
    expect(readableResourceIds([hidden], context())).toEqual([]);
    expect(readableResourceIds([hidden], null)).toEqual([]);
  });
});

describe("admin-hidden group-owned resources", () => {
  const hidden = resource({
    ownerUserId: null,
    ownerGroupId: PARTY,
    isPubliclyReadable: true,
    isAdminHidden: true,
  });

  it("stay listed for group members, including in Mine", () => {
    const member = context({ groupRoles: new Map([[PARTY, "member"]]) });
    expect(listed(hidden, member, "mine")).toBe(true);
    expect(readableResourceIds([hidden], member)).toEqual([hidden.id]);
  });

  it("are dropped for everyone else", () => {
    expect(listed(hidden, context(), undefined)).toBe(false);
    expect(listed(hidden, null, "public")).toBe(false);
  });
});
