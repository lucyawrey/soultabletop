import { createError, readBody } from "h3";
import { userProfile } from "../../database/schema";
import { useDatabase } from "../../utils/database";
import { requireAuthenticatedUser } from "../../utils/auth";
import { isUniqueConstraintError } from "../../utils/user-profile";

interface UpdateProfileBody {
  slug?: unknown;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await readBody<UpdateProfileBody>(event);

  if (typeof body?.slug !== "string" || !body.slug.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Username is required",
    });
  }

  const slug = body.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: "slug must use lowercase letters, numbers, and hyphens",
    });
  }

  try {
    const database = useDatabase();
    const [profile] = await database
      .insert(userProfile)
      .values({ userId: user.id, slug })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: { slug, updatedAt: new Date() },
      })
      .returning();

    return profile;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: "That username is already in use",
      });
    }

    throw error;
  }
});
