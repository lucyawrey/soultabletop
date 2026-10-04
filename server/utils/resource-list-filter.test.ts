import { describe, expect, it } from "vitest";
import type { Resource } from "../database/schema";
import { getResourceAccessOrPublic, type ResourceAccessContext } from "./resource-access";
import {
  excludesMineFromFind,
  getResourceSource,
  isListed,
  requiresReadableType,
} from "./resource-list-filter";

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

    it("includes a limited campaign the user is a member of, in every list", () => {
      const item = resource({ kind: "campaign" });
      for (const role of ["player", "gm"] as const) {
        const ctx = context({ campaignRoles: new Map([[item.id, role]]) });
        expect(listed(item, ctx, "mine")).toBe(true);
        expect(listed(item, ctx, undefined)).toBe(true);
      }
    });

    it("includes a public campaign the user is a member of", () => {
      const item = resource({ kind: "campaign", isPubliclyReadable: true });
      const ctx = context({ campaignRoles: new Map([[item.id, "player"]]) });
      expect(listed(item, ctx, "mine")).toBe(true);
      expect(listed(item, context(), "mine")).toBe(false);
    });
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

  it("keeps official resources they can edit only as admins out of their Mine list", () => {
    const official = resource({ ownerUserId: null, ownerGroupId: PARTY });
    const ctx = context({ isSiteAdmin: true, systemGroupIds: new Set([PARTY]) });
    expect(getResourceAccessOrPublic(official, ctx).canEdit).toBe(true);
    expect(listed(official, ctx, "mine")).toBe(false);
    expect(listed(official, ctx, undefined)).toBe(true);
  });

  it("lists hidden resources for a site admin only", () => {
    const hidden = resource({ id: "h", isPubliclyReadable: true, isAdminHidden: true });
    expect(listed(hidden, admin, undefined)).toBe(true);
    expect(listed(hidden, context(), undefined)).toBe(false);
    expect(listed(hidden, null, undefined)).toBe(false);
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
    expect(listed(hidden, member, undefined)).toBe(true);
  });

  it("are dropped for everyone else", () => {
    expect(listed(hidden, context(), undefined)).toBe(false);
    expect(listed(hidden, null, "public")).toBe(false);
  });
});

describe("getResourceSource", () => {
  const grantFor = (item: Resource, overrides: object) =>
    ({ resourceId: item.id, permission: "read", ...overrides }) as never;

  it("says You for the viewer's own resources, even official ones", () => {
    expect(getResourceSource(resource({ ownerUserId: "me" }), false, context())).toBe("you");
  });

  it("says Your Groups for any role, including a system group the viewer is in", () => {
    const ctx = context({ groupRoles: new Map([[PARTY, "member"]]) });
    const owned = resource({ ownerUserId: null, ownerGroupId: PARTY });
    expect(getResourceSource(owned, false, ctx)).toBe("yourGroups");
    expect(getResourceSource(owned, true, ctx)).toBe("yourGroups");
  });

  it("says Official for system group resources the viewer isn't part of", () => {
    const item = resource({ ownerUserId: null, ownerGroupId: PARTY });
    expect(getResourceSource(item, true, context())).toBe("official");
    expect(getResourceSource(item, true, null)).toBe("official");
  });

  it("prefers Official over Shared when a grant lands on an official resource", () => {
    const item = resource({ ownerUserId: null, ownerGroupId: PARTY });
    const ctx = context({ grants: [grantFor(item, { userId: "me" })] });
    expect(getResourceSource(item, true, ctx)).toBe("official");
  });

  it("says Shared only when a grant reaches the viewer", () => {
    const item = resource({ isPubliclyReadable: true });
    const mine = context({ grants: [grantFor(item, { userId: "me" })] });
    const other = context({ grants: [grantFor(item, { userId: "someone-else" })] });
    const viaGroup = context({
      groupRoles: new Map([[PARTY, "member"]]),
      grants: [grantFor(item, { groupId: PARTY })],
    });
    expect(getResourceSource(item, false, mine)).toBe("shared");
    expect(getResourceSource(item, false, viaGroup)).toBe("shared");
    expect(getResourceSource(item, false, other)).toBe("community");
  });

  it("says Shared for a campaign audience grant that includes the viewer", () => {
    const item = resource({});
    const grant = grantFor(item, { campaignId: "camp", campaignAudience: "members" });
    const member = context({ campaignRoles: new Map([["camp", "player"]]), grants: [grant] });
    expect(getResourceSource(item, false, member)).toBe("shared");
    expect(getResourceSource(item, false, context({ grants: [grant] }))).toBe("community");
  });

  it("gives logged-out viewers only Official and Community", () => {
    expect(getResourceSource(resource({ ownerUserId: "me" }), false, null)).toBe("community");
    expect(getResourceSource(resource({}), true, null)).toBe("official");
  });
});

describe("excludesMineFromFind", () => {
  const find = { q: "", scope: "public" as const };

  it("excludes My from Find for a signed-in viewer with no search", () => {
    expect(excludesMineFromFind(find, true)).toBe(true);
  });

  it("shows everything that matches when searching", () => {
    expect(excludesMineFromFind({ ...find, q: "dragon" }, true)).toBe(false);
  });

  it("doesn't apply to logged-out viewers, My, or unscoped lists", () => {
    expect(excludesMineFromFind(find, false)).toBe(false);
    expect(excludesMineFromFind({ q: "", scope: "mine" }, true)).toBe(false);
    expect(excludesMineFromFind({ q: "" }, true)).toBe(false);
  });
});

// The rules in `resource-access-sql.ts`, transcribed over the rows the SQL reads
// (memberships, campaign owners, grants) rather than over an access context.
// Keep this in step with that file; the test below checks it agrees with
// `getResourceAccess` and `isListed` across every combination.
interface Facts {
  viewer: { userId: string; isSiteAdmin: boolean } | null;
  groupRoles: Map<string, "admin" | "editor" | "member">;
  campaignRoles: Map<string, "gm" | "player">;
  campaigns: Map<string, { ownerUserId: string | null; ownerGroupId: string | null }>;
  grants: ResourceAccessContext["grants"];
}

function sqlListed(
  item: Resource,
  facts: Facts,
  scope: "mine" | "public" | undefined,
  excludeMineFromFind = false,
) {
  const { viewer } = facts;
  const publiclyListed = item.isPubliclyReadable && !item.isAdminHidden;
  if (!viewer) return scope === "mine" ? false : publiclyListed;
  const userId = viewer.userId;
  const groupIds = (roles?: string[]) =>
    [...facts.groupRoles]
      .filter(([, role]) => !roles || roles.includes(role))
      .map(([id]) => id);
  const campaignIds = (role?: string) =>
    [...facts.campaignRoles]
      .filter(([, r]) => !role || r === role)
      .map(([id]) => id);
  const ownedCampaignIds = [...facts.campaigns]
    .filter(
      ([, owner]) =>
        owner.ownerUserId === userId ||
        groupIds(["admin", "editor"]).includes(owner.ownerGroupId ?? ""),
    )
    .map(([id]) => id);
  const ownedByViewer =
    item.ownerUserId === userId || groupIds().includes(item.ownerGroupId ?? "");
  const grantReaches = (permission: "read" | "edit") => {
    const edit = permission === "edit";
    return facts.grants.some(
      (grant) =>
        grant.resourceId === item.id &&
        (!edit || grant.permission === "edit") &&
        (grant.userId === userId ||
          groupIds(edit ? ["admin", "editor"] : undefined).includes(grant.groupId ?? "") ||
          ownedCampaignIds.includes(grant.campaignId ?? "") ||
          (grant.campaignAudience === "members" &&
            campaignIds().includes(grant.campaignId ?? "")) ||
          (grant.campaignAudience === "gms" &&
            campaignIds("gm").includes(grant.campaignId ?? ""))),
    );
  };
  const readable =
    viewer.isSiteAdmin ||
    ownedByViewer ||
    (!item.isAdminHidden &&
      (item.isPubliclyReadable || campaignIds().includes(item.id) || grantReaches("read")));
  const stake =
    ownedByViewer ||
    (!item.isAdminHidden && grantReaches("edit")) ||
    campaignIds().includes(item.id);
  const inMine = readable && stake;
  if (scope === "mine") return inMine;
  if (scope === "public") return publiclyListed && !(excludeMineFromFind && inMine);
  return readable;
}

describe("the SQL list rules agree with getResourceAccess", () => {
  const ITEM = "00000000-0000-4000-8000-000000000001";
  const CAMP = "00000000-0000-4000-8000-0000000000c1";
  const SYSTEM_GROUP = "00000000-0000-4000-8000-00000000000a";
  const grant = (overrides: object) =>
    ({
      id: "g",
      resourceId: ITEM,
      permission: "read",
      userId: null,
      groupId: null,
      campaignId: null,
      campaignAudience: null,
      createdByUserId: null,
      createdAt: new Date(),
      ...overrides,
    }) as ResourceAccessContext["grants"][number];

  const owners = [
    { ownerUserId: "me", ownerGroupId: null },
    { ownerUserId: "someone", ownerGroupId: null },
    { ownerUserId: null, ownerGroupId: PARTY },
    { ownerUserId: null, ownerGroupId: SYSTEM_GROUP },
  ];
  const grantSets = [
    [],
    [grant({ userId: "me" })],
    [grant({ userId: "me", permission: "edit" })],
    [grant({ userId: "someone", permission: "edit" })],
    [grant({ groupId: PARTY })],
    [grant({ groupId: PARTY, permission: "edit" })],
    [grant({ groupId: SYSTEM_GROUP, permission: "edit" })],
    ...(["read", "edit"] as const).flatMap((permission) =>
      (["members", "gms"] as const).map((campaignAudience) => [
        grant({ campaignId: CAMP, campaignAudience, permission }),
      ]),
    ),
    [grant({ userId: "me" }), grant({ groupId: PARTY, permission: "edit" })],
    [grant({ resourceId: "other", userId: "me", permission: "edit" })],
  ];
  const campaignOwners = [
    { ownerUserId: "me", ownerGroupId: null },
    { ownerUserId: "someone", ownerGroupId: null },
    { ownerUserId: null, ownerGroupId: PARTY },
  ];
  const groupRoleOptions = [undefined, "member", "editor", "admin"] as const;
  const campaignRoleOptions = [undefined, "player", "gm"] as const;

  it("for every viewer, resource, membership, and grant combination", () => {
    let checked = 0;
    const failures: string[] = [];
    for (const viewerKind of ["anonymous", "user", "admin"] as const)
      for (const owner of owners)
        for (const isPubliclyReadable of [false, true])
          for (const isAdminHidden of [false, true])
            for (const isCampaign of [false, true])
              for (const grants of grantSets)
                for (const groupRole of groupRoleOptions)
                  for (const systemGroupRole of [undefined, "member"] as const)
                    for (const campaignRole of campaignRoleOptions)
                      for (const campaignOwner of campaignOwners) {
                        const id = isCampaign ? CAMP : ITEM;
                        const item = resource({ id, ...owner, isPubliclyReadable, isAdminHidden });
                        const itemGrants = grants.map((g) =>
                          g.resourceId === ITEM ? { ...g, resourceId: id } : g,
                        );
                        const groupRoles = new Map<string, "admin" | "editor" | "member">();
                        if (groupRole) groupRoles.set(PARTY, groupRole);
                        if (systemGroupRole) groupRoles.set(SYSTEM_GROUP, systemGroupRole);
                        const campaignRoles = new Map<string, "gm" | "player">();
                        if (campaignRole) campaignRoles.set(CAMP, campaignRole);
                        const campaigns = new Map([[CAMP, campaignOwner]]);
                        const viewer =
                          viewerKind === "anonymous"
                            ? null
                            : { userId: "me", isSiteAdmin: viewerKind === "admin" };
                        const facts: Facts = { viewer, groupRoles, campaignRoles, campaigns, grants: itemGrants };
                        // What `loadResourceAccessContext` builds from the same rows.
                        const ctx: ResourceAccessContext | null = viewer && {
                          userId: viewer.userId,
                          isSiteAdmin: viewer.isSiteAdmin,
                          groupRoles,
                          campaignRoles,
                          campaignOwners: new Map(
                            itemGrants.some((g) => g.campaignId === CAMP)
                              ? [[CAMP, { userId: campaignOwner.ownerUserId, groupId: campaignOwner.ownerGroupId }]]
                              : [],
                          ),
                          systemGroupIds: new Set([SYSTEM_GROUP]),
                          grants: itemGrants,
                        };
                        const access = getResourceAccessOrPublic(item, ctx);
                        // Find (public scope) lists only public, non-hidden
                        // resources, even for viewers who can read more.
                        const inFind =
                          isPubliclyReadable && !isAdminHidden && isListed(item, access, ctx, "public");
                        const expected = {
                          unscoped: isListed(item, access, ctx, undefined),
                          mine: !!ctx && isListed(item, access, ctx, "mine"),
                          public: inFind,
                          find: inFind && !(ctx && isListed(item, access, ctx, "mine")),
                        };
                        const actual = {
                          unscoped: sqlListed(item, facts, undefined),
                          mine: sqlListed(item, facts, "mine"),
                          public: sqlListed(item, facts, "public"),
                          find: sqlListed(item, facts, "public", true),
                        };
                        checked++;
                        if (JSON.stringify(expected) !== JSON.stringify(actual) && failures.length < 5)
                          failures.push(
                            JSON.stringify({ viewerKind, owner, isPubliclyReadable, isAdminHidden, isCampaign, grants: itemGrants.map(({ resourceId, permission, userId, groupId, campaignId, campaignAudience }) => ({ resourceId, permission, userId, groupId, campaignId, campaignAudience })), groupRole, systemGroupRole, campaignRole, campaignOwner, expected, actual }),
                          );
                      }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(50_000);
  });
});
