import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { User } from "better-auth";
import { user, userProfile } from "../database/schema";
import { useDatabase } from "./database";

function usernameBase(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "player";
}

export async function ensureUserProfile(user: Pick<User, "id" | "name">) {
  const database = useDatabase();
  const [existingProfile] = await database
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, user.id))
    .limit(1);

  if (existingProfile) return existingProfile;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `${usernameBase(user.name)}-${randomUUID().slice(0, 8)}`;
    const [createdProfile] = await database
      .insert(userProfile)
      .values({ userId: user.id, username })
      .onConflictDoNothing()
      .returning();

    if (createdProfile) return createdProfile;

    const [concurrentProfile] = await database
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, user.id))
      .limit(1);

    if (concurrentProfile) return concurrentProfile;
  }

  throw new Error("Could not create a unique default username.");
}

// Creates the profile of a user registration just created. If that fails (a
// username taken since it was checked: 23505), deletes the user again, with
// its session and account (they cascade), so the email isn't left registered
// to a user without a profile, then rethrows.
export async function createProfileOrRemoveUser(userId: string, username: string) {
  const database = useDatabase();
  try {
    const [profile] = await database
      .insert(userProfile)
      .values({ userId, username })
      .returning();
    return profile!;
  } catch (error) {
    await database.delete(user).where(eq(user.id, userId));
    throw error;
  }
}

// Postgres error code, looking through Drizzle's DrizzleQueryError, which
// wraps the driver error in `cause`.
function postgresErrorCode(error: unknown): unknown {
  for (let current = error; typeof current === "object" && current !== null; ) {
    if ("code" in current && typeof current.code === "string")
      return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export function isUniqueConstraintError(error: unknown) {
  return postgresErrorCode(error) === "23505";
}

// A row is still referenced through an `ON DELETE RESTRICT` foreign key.
export function isForeignKeyConstraintError(error: unknown) {
  return postgresErrorCode(error) === "23503";
}
