// The failure paths of profile creation, against a fake database whose
// inserts and deletes fail on demand (the real-database case is in
// `resource-address.db.test.ts`).
import { afterEach, describe, expect, it, vi } from "vitest";

const uniqueViolation = () => Object.assign(new Error("duplicate key"), { code: "23505" });

const fake = vi.hoisted(() => ({
  // One entry per insert: a row to return, or an error to throw.
  inserts: [] as unknown[],
  deleteError: undefined as unknown,
  deletes: 0,
}));

vi.mock("./database", () => ({
  useDatabase: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({
      values: () => {
        const run = async () => {
          const next = fake.inserts.shift();
          if (next instanceof Error) throw next;
          return next ? [next] : [];
        };
        return { returning: run, onConflictDoNothing: () => ({ returning: run }) };
      },
    }),
    delete: () => ({
      where: async () => {
        fake.deletes += 1;
        if (fake.deleteError) throw fake.deleteError;
      },
    }),
  }),
}));

const { createProfileOrRemoveUser, ensureUserProfile } = await import("./user-profile");

afterEach(() => {
  fake.inserts = [];
  fake.deleteError = undefined;
  fake.deletes = 0;
  vi.restoreAllMocks();
});

describe("createProfileOrRemoveUser", () => {
  it("removes the user and rethrows the insert's error", async () => {
    const insertError = uniqueViolation();
    fake.inserts = [insertError];
    await expect(createProfileOrRemoveUser("u1", "taken")).rejects.toBe(insertError);
    expect(fake.deletes).toBe(1);
  });

  it("still rethrows the insert's error when the cleanup delete fails", async () => {
    const insertError = uniqueViolation();
    fake.inserts = [insertError];
    fake.deleteError = new Error("connection dropped");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createProfileOrRemoveUser("u1", "taken")).rejects.toBe(insertError);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("ensureUserProfile", () => {
  it("tries another username when one is a group's readable ID", async () => {
    const profile = { userId: "u1", username: "violet-1234abcd" };
    fake.inserts = [uniqueViolation(), profile];
    await expect(ensureUserProfile({ id: "u1", name: "Violet" })).resolves.toBe(profile);
  });

  it("rethrows errors other than a unique violation", async () => {
    const other = Object.assign(new Error("fk"), { code: "23503" });
    fake.inserts = [other];
    await expect(ensureUserProfile({ id: "u1", name: "Violet" })).rejects.toBe(other);
  });
});
