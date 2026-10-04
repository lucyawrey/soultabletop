// Runs the real SQL list rules (`listCondition`, `readableBy`) against the
// database and compares them with `getResourceAccess` + `isListed`, so the
// transcription in `resource-list-filter.test.ts` can't drift from the SQL
// unnoticed. Opt-in, since it needs a database and writes throwaway rows:
//
//   RUN_DB_TESTS=1 pnpm vitest run server/utils/resource-access-sql.db.test.ts
//
// It reads DATABASE_URL from the environment, or from `.env.local`. Every row
// it creates is deleted in `afterAll`, even when an assertion fails.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq, exists, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { User } from "better-auth";
import {
  campaign,
  campaignMembership,
  group,
  groupMembership,
  resource,
  resourceGrant,
  system,
  user,
  userProfile,
} from "../database/schema";
import type { ListQuery } from "../../shared/resource-list";

const runDbTests = process.env.RUN_DB_TESTS === "1";
if (runDbTests) {
  if (!process.env.DATABASE_URL && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  // `useDatabase` reads Nuxt's runtime config, which doesn't exist here; it
  // falls back to DATABASE_URL.
  const globals = globalThis as { useRuntimeConfig?: () => object };
  globals.useRuntimeConfig ??= () => ({});
}

describe.skipIf(!runDbTests)(
  "SQL list rules against the database (skipped unless RUN_DB_TESTS=1)",
  () => {
    const tag = randomUUID().slice(0, 8);
    const viewerId = `claude-smoke-viewer-${tag}`;
    const otherId = `claude-smoke-other-${tag}`;
    // The viewer's role in each group; SG is a system group.
    const groupRoles = { G1: "admin", G2: "editor", G3: "member", G4: null, SG: null } as const;
    const groupIds: Record<string, string> = {};
    const createdUserIds: string[] = [];
    const resourceIds: string[] = [];
    const campaignIds: string[] = [];
    let systemId: string | undefined;
    let counter = 0;
    const readableId = () => `claude-smoke-${tag}-${counter++}`;
    const hiddenFields = (hidden: boolean) =>
      hidden ? { moderationReason: "test", moderatedAt: new Date() } : {};

    async function db() {
      const { useDatabase } = await import("./database");
      return useDatabase();
    }

    beforeAll(async () => {
      if (!process.env.DATABASE_URL)
        throw new Error("RUN_DB_TESTS=1 needs DATABASE_URL (or .env.local).");
      const database = await db();
      for (const id of [viewerId, otherId]) {
        await database
          .insert(user)
          .values({ id, name: id, email: `${id}@example.invalid` });
        createdUserIds.push(id);
        await database.insert(userProfile).values({ userId: id, username: id });
      }
      for (const [name, role] of Object.entries(groupRoles)) {
        const [row] = await database
          .insert(group)
          .values({
            name,
            readableId: `claude-smoke-${tag}-${name.toLowerCase()}`,
            kind: name === "SG" ? "system" : "user",
          })
          .returning();
        groupIds[name] = row!.id;
        if (role)
          await database
            .insert(groupMembership)
            .values({ groupId: row!.id, userId: viewerId, role });
      }

      const [systemRow] = await database
        .insert(resource)
        .values({ kind: "system", readableId: readableId(), name: "smoke system", ownerUserId: otherId })
        .returning();
      systemId = systemRow!.id;
      await database.insert(system).values({ resourceId: systemId });

      // Campaigns: owner, the viewer's membership, public, hidden.
      const campaigns: [object, "gm" | "player" | null, boolean, boolean][] = [
        [{ ownerUserId: viewerId }, null, false, false],
        [{ ownerGroupId: groupIds.G2 }, null, false, false],
        [{ ownerGroupId: groupIds.G3 }, "player", false, false],
        [{ ownerUserId: otherId }, "gm", false, false],
        [{ ownerUserId: otherId }, "player", true, false],
        [{ ownerUserId: otherId }, null, true, false],
        [{ ownerUserId: otherId }, "player", false, false],
        [{ ownerUserId: otherId }, "player", true, true],
      ];
      for (const [owner, role, isPubliclyReadable, isAdminHidden] of campaigns) {
        const [row] = await database
          .insert(resource)
          .values({
            kind: "campaign",
            readableId: readableId(),
            name: `smoke ${counter}`,
            ...owner,
            isPubliclyReadable,
            isAdminHidden,
            ...hiddenFields(isAdminHidden),
          })
          .returning();
        campaignIds.push(row!.id);
        await database.insert(campaign).values({ resourceId: row!.id, systemId });
        if (role)
          await database
            .insert(campaignMembership)
            .values({ campaignId: row!.id, userId: viewerId, role });
      }

      // Resources for every owner × public × hidden × grant set.
      type Grant = Partial<typeof resourceGrant.$inferInsert>;
      const owners = [
        { ownerUserId: viewerId },
        { ownerUserId: otherId },
        ...Object.keys(groupRoles).map((name) => ({ ownerGroupId: groupIds[name] })),
      ];
      const permissions = ["read", "edit"] as const;
      const grantSets: Grant[][] = [
        [],
        [{ userId: viewerId }],
        [{ userId: viewerId, permission: "edit" }],
        [{ userId: otherId, permission: "edit" }],
        ...Object.keys(groupRoles).flatMap((name) =>
          permissions.map((permission) => [{ groupId: groupIds[name], permission }]),
        ),
        ...campaignIds.slice(0, 7).flatMap((campaignId) =>
          permissions.flatMap((permission) =>
            (["members", "gms"] as const).map((campaignAudience) => [
              { campaignId, campaignAudience, permission },
            ]),
          ),
        ),
      ];
      const rows: (typeof resource.$inferInsert)[] = [];
      const grantsByRow: Grant[][] = [];
      for (const owner of owners)
        for (const isPubliclyReadable of [false, true])
          for (const isAdminHidden of [false, true])
            for (const grants of grantSets) {
              rows.push({
                kind: "system",
                readableId: readableId(),
                name: `smoke ${counter}`,
                ...owner,
                isPubliclyReadable,
                isAdminHidden,
                ...hiddenFields(isAdminHidden),
              });
              grantsByRow.push(grants);
            }
      for (let start = 0; start < rows.length; start += 500) {
        const inserted = await database
          .insert(resource)
          .values(rows.slice(start, start + 500))
          .returning({ id: resource.id });
        resourceIds.push(...inserted.map(({ id }) => id));
        const grantRows = inserted.flatMap(({ id }, index) =>
          grantsByRow[start + index]!.map((grant) => ({ resourceId: id, ...grant })),
        );
        if (grantRows.length) await database.insert(resourceGrant).values(grantRows);
      }
    }, 300_000);

    afterAll(async () => {
      if (!process.env.DATABASE_URL) return;
      const database = await db();
      // Owners restrict deletes, so resources go first (grants cascade), then
      // campaigns (their memberships cascade), the system, groups, and users.
      for (let start = 0; start < resourceIds.length; start += 1000)
        await database
          .delete(resource)
          .where(inArray(resource.id, resourceIds.slice(start, start + 1000)));
      if (campaignIds.length)
        await database.delete(resource).where(inArray(resource.id, campaignIds));
      if (systemId) await database.delete(resource).where(eq(resource.id, systemId));
      const groups = Object.values(groupIds);
      if (groups.length) await database.delete(group).where(inArray(group.id, groups));
      if (createdUserIds.length)
        await database.delete(user).where(inArray(user.id, createdUserIds));
      const [left] = await database
        .select({ total: count() })
        .from(resource)
        .where(sql`${resource.readableId} like ${`claude-smoke-${tag}-%`}`);
      expect(left!.total).toBe(0);
    }, 300_000);

    const viewers = [
      { name: "anonymous", userId: null, isSiteAdmin: false },
      { name: "viewer", userId: () => viewerId, isSiteAdmin: false },
      { name: "viewer as site admin", userId: () => viewerId, isSiteAdmin: true },
      { name: "other user", userId: () => otherId, isSiteAdmin: false },
    ];

    it.each(viewers)("listCondition and readableBy match the access rules for $name", async (viewer) => {
      const database = await db();
      const { getResourceAccessOrPublic, loadResourceAccessContext } = await import("./resource-access");
      const { isListed } = await import("./resource-list-filter");
      const { listCondition } = await import("./resource-list");
      const { readableBy } = await import("./resource-access-sql");
      const testIds = [...resourceIds, ...campaignIds];
      const items = await database.select().from(resource).where(inArray(resource.id, testIds));
      expect(items.length).toBe(testIds.length);

      const id = viewer.userId?.();
      // The site admin flag comes from the viewer, not the database, so one
      // user can be checked both ways.
      const context = id
        ? {
            ...(await loadResourceAccessContext({ id, name: id } as User, testIds)),
            isSiteAdmin: viewer.isSiteAdmin,
          }
        : null;
      const listViewer = context && { userId: context.userId, isSiteAdmin: viewer.isSiteAdmin };

      const selectIds = async (condition: ReturnType<typeof listCondition>) =>
        new Set(
          (
            await database
              .select({ id: resource.id })
              .from(resource)
              .where(and(inArray(resource.id, testIds), condition))
          ).map((row) => row.id),
        );

      const mismatches: string[] = [];
      const scopes: [string, ListQuery][] = [
        ["unscoped", { q: "" }],
        ["mine", { q: "", scope: "mine" }],
        ["public with search", { q: "smoke", scope: "public" }],
        ["find", { q: "", scope: "public" }],
      ];
      for (const [label, query] of scopes) {
        if (query.scope === "mine" && !context) continue;
        const listed = await selectIds(listCondition(query, listViewer));
        for (const item of items) {
          const access = getResourceAccessOrPublic(item, context);
          const publiclyListed = item.isPubliclyReadable && !item.isAdminHidden;
          const inMine = !!context && isListed(item, access, context, "mine");
          const expected =
            label === "unscoped"
              ? isListed(item, access, context, undefined)
              : label === "mine"
                ? inMine
                : label === "public with search"
                  ? publiclyListed
                  : publiclyListed && !inMine;
          if (listed.has(item.id) !== expected)
            mismatches.push(`${label}: ${item.id} should be ${expected ? "listed" : "left out"}`);
        }
      }

      // Through an alias, as `/api/content` checks a content's content type.
      const typeResource = alias(resource, "type_resource");
      const readable = await selectIds(
        exists(
          database
            .select({ one: sql`1` })
            .from(typeResource)
            .where(and(eq(typeResource.id, resource.id), readableBy(typeResource, listViewer))),
        ),
      );
      for (const item of items)
        if (readable.has(item.id) !== getResourceAccessOrPublic(item, context).canRead)
          mismatches.push(`readableBy (alias): ${item.id}`);

      expect(mismatches.slice(0, 20)).toEqual([]);
    }, 300_000);

    it("lets campaign members read limited campaigns, by ID and by owner + readable ID", async () => {
      const database = await db();
      const { readableBy } = await import("./resource-access-sql");
      const { findReadableResourceId } = await import("./resource-address");
      // campaignIds[3]: limited, viewer is GM; [6]: limited, viewer is a
      // player; [7]: viewer is a player, but hidden by a site admin.
      const member = [campaignIds[3]!, campaignIds[6]!];
      const hidden = campaignIds[7]!;
      const items = await database
        .select()
        .from(resource)
        .where(inArray(resource.id, [...member, hidden]));
      const readable = new Set(
        (
          await database
            .select({ id: resource.id })
            .from(resource)
            .where(
              and(
                inArray(resource.id, [...member, hidden]),
                readableBy(resource, { userId: viewerId, isSiteAdmin: false }),
              ),
            )
        ).map((row) => row.id),
      );
      expect([...readable].sort()).toEqual([...member].sort());
      for (const item of items) {
        const found = await findReadableResourceId(
          { id: viewerId },
          "campaign",
          otherId,
          item.readableId,
        );
        expect(found).toBe(item.id === hidden ? undefined : item.id);
      }
    }, 300_000);

    it("listResources counts and pages in SQL", async () => {
      const database = await db();
      const { listOrder, listResources, officialColumn } = await import("./resource-list");
      const testIds = [...resourceIds, ...campaignIds];
      for (const scope of [undefined, "mine", "public"] as const) {
        const run = (page?: number) =>
          listResources({
            query: { q: "", scope, page },
            user: { id: viewerId, name: viewerId } as User,
            where: inArray(resource.id, testIds),
            fetchRows: ({ where, limit, offset }) => {
              const select = database
                .select({ resource, official: officialColumn })
                .from(resource)
                .leftJoin(group, eq(group.id, resource.ownerGroupId))
                .where(where)
                .orderBy(...listOrder)
                .$dynamic();
              return limit === undefined ? select : select.limit(limit).offset(offset ?? 0);
            },
            countRows: async (where) =>
              (await database.select({ total: count() }).from(resource).where(where))[0]!.total,
          });
        const all = await run();
        expect(all.rows.length).toBeGreaterThan(0);
        const [first, second, past] = await Promise.all([run(1), run(2), run(10_000)]);
        const ids = (result: typeof all) => result.rows.map((row) => row.resource.id);
        expect(first.page!.total).toBe(all.rows.length);
        expect(ids(first)).toEqual(ids(all).slice(0, 25));
        expect(ids(second)).toEqual(ids(all).slice(25, 50));
        expect(past.page!.page).toBe(Math.max(1, Math.ceil(all.rows.length / 25)));
      }
    }, 300_000);
  },
);
