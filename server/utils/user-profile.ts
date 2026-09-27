import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { User } from "better-auth";
import { userProfile } from "../database/schema";
import { useDatabase } from "./database";

function slugBase(name: string) {
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
    const slug = `${slugBase(user.name)}-${randomUUID().slice(0, 8)}`;
    const [createdProfile] = await database
      .insert(userProfile)
      .values({ userId: user.id, slug })
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

  throw new Error("Could not create a unique default username slug.");
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
