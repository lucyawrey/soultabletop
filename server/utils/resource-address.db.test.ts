// Runs the owner + readable ID lookup (`findReadableResourceId`) and the
// shared owner namespace (migration 0012's triggers) against the database.
// Opt-in, since it needs a database and writes throwaway rows:
//
//   RUN_DB_TESTS=1 pnpm vitest run server/utils/resource-address.db.test.ts
//
// It reads DATABASE_URL from the environment, or from `.env.local`. Every row
// it creates is deleted in `afterAll`, even when an assertion fails.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, or } from "drizzle-orm";
import type { User } from "better-auth";
import {
  group,
  groupMembership,
  ownerReadableId,
  resource,
  resourceGrant,
  user,
  userProfile,
  type Resource,
} from "../database/schema";

const runDbTests = process.env.RUN_DB_TESTS === "1";
if (runDbTests) {
  if (!process.env.DATABASE_URL && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const globals = globalThis as { useRuntimeConfig?: () => object };
  globals.useRuntimeConfig ??= () => ({});
}

describe.skipIf(!runDbTests)(
  "owner + readable ID lookup against the database (skipped unless RUN_DB_TESTS=1)",
  () => {
    const tag = randomUUID().slice(0, 8);
    const ids = {
      viewer: `claude-smoke-viewer-${tag}`,
      other: `claude-smoke-other-${tag}`,
      admin: `claude-smoke-admin-${tag}`,
    };
    const groupReadableId = `claude-smoke-group-${tag}`;
    let groupId: string | undefined;
    const createdUserIds: string[] = [];
    const resourceIds: string[] = [];
    let items: Resource[] = [];
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
      for (const [key, id] of Object.entries(ids)) {
        await database.insert(user).values({ id, name: id, email: `${id}@example.invalid` });
        createdUserIds.push(id);
        await database
          .insert(userProfile)
          .values({ userId: id, username: id, role: key === "admin" ? "admin" : "member" });
      }
      const [row] = await database
        .insert(group)
        .values({ name: "smoke group", readableId: groupReadableId })
        .returning();
      groupId = row!.id;
      await database
        .insert(groupMembership)
        .values({ groupId, userId: ids.viewer, role: "member" });

      // Owned by the other user or the viewer's group, public or not, hidden
      // or not, with or without a grant to the viewer (usernames are the user
      // IDs here).
      let counter = 0;
      for (const owner of [{ ownerUserId: ids.other }, { ownerGroupId: groupId }])
        for (const isPubliclyReadable of [false, true])
          for (const isAdminHidden of [false, true])
            for (const granted of [false, true]) {
              const [created] = await database
                .insert(resource)
                .values({
                  kind: "sheet",
                  readableId: `smoke-${counter++}`,
                  name: "smoke",
                  ...owner,
                  isPubliclyReadable,
                  isAdminHidden,
                  ...hiddenFields(isAdminHidden),
                })
                .returning();
              resourceIds.push(created!.id);
              if (granted)
                await database
                  .insert(resourceGrant)
                  .values({ resourceId: created!.id, userId: ids.viewer });
            }
      items = await database.select().from(resource).where(inArray(resource.id, resourceIds));
    }, 120_000);

    afterAll(async () => {
      if (!process.env.DATABASE_URL) return;
      const database = await db();
      if (resourceIds.length)
        await database.delete(resource).where(inArray(resource.id, resourceIds));
      if (groupId) await database.delete(group).where(eq(group.id, groupId));
      if (createdUserIds.length)
        await database.delete(user).where(inArray(user.id, createdUserIds));
      // The namespace rows went with their profiles and group.
      const left = await database
        .select()
        .from(ownerReadableId)
        .where(
          or(
            inArray(ownerReadableId.userId, createdUserIds),
            inArray(ownerReadableId.readableId, [groupReadableId]),
          ),
        );
      expect(left).toEqual([]);
    }, 120_000);

    it.each([
      { name: "anonymous", id: null },
      { name: "viewer", id: ids.viewer },
      { name: "other user", id: ids.other },
      { name: "site admin", id: ids.admin },
    ])("finds exactly what $name can read", async ({ id }) => {
      const { findReadableResourceId } = await import("./resource-address");
      const { getResourceAccessOrPublic, loadResourceAccessContext } = await import(
        "./resource-access"
      );
      const viewer = id ? ({ id, name: id } as User) : null;
      const context = viewer ? await loadResourceAccessContext(viewer, resourceIds) : null;
      const mismatches: string[] = [];
      for (const item of items) {
        const owner = item.ownerUserId ? item.ownerUserId : groupReadableId;
        // Mixed case: lookups are case-insensitive.
        const found = await findReadableResourceId(
          viewer,
          "sheet",
          owner.toUpperCase(),
          item.readableId.toUpperCase(),
        );
        const canRead = getResourceAccessOrPublic(item, context).canRead;
        if ((found === item.id) !== canRead || (found !== undefined && found !== item.id))
          mismatches.push(`${item.readableId}: found ${found}, canRead ${canRead}`);
        // The wrong kind finds nothing.
        if (await findReadableResourceId(viewer, "system", owner, item.readableId))
          mismatches.push(`${item.readableId}: found as a system`);
      }
      expect(mismatches).toEqual([]);
    }, 120_000);

    it("keeps usernames and group readable IDs in one namespace", async () => {
      const database = await db();
      const { isUniqueConstraintError } = await import("./user-profile");
      const { isOwnerReadableIdTaken } = await import("./owner-readable-id");
      expect(await isOwnerReadableIdTaken(ids.viewer.toUpperCase())).toBe(true);
      expect(await isOwnerReadableIdTaken(groupReadableId)).toBe(true);

      const clash = async (write: () => Promise<unknown>) => {
        try {
          await write();
          return false;
        } catch (error) {
          return isUniqueConstraintError(error);
        }
      };
      // A group named like a user, and the other way round, on insert and rename.
      expect(
        await clash(() =>
          database.insert(group).values({ name: "clash", readableId: ids.other }),
        ),
      ).toBe(true);
      expect(
        await clash(() =>
          database.update(group).set({ readableId: ids.other }).where(eq(group.id, groupId!)),
        ),
      ).toBe(true);
      expect(
        await clash(() =>
          database
            .update(userProfile)
            .set({ username: groupReadableId })
            .where(eq(userProfile.userId, ids.other)),
        ),
      ).toBe(true);

      // A rename moves the name: the old one is free, the new one taken.
      const renamed = `${groupReadableId}-renamed`;
      await database.update(group).set({ readableId: renamed }).where(eq(group.id, groupId!));
      expect(await isOwnerReadableIdTaken(groupReadableId)).toBe(false);
      expect(await isOwnerReadableIdTaken(renamed)).toBe(true);
      await database
        .update(group)
        .set({ readableId: groupReadableId })
        .where(eq(group.id, groupId!));
    }, 120_000);
  },
);
