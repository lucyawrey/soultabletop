import { createError, getQuery } from "h3";
import { sql } from "drizzle-orm";
import { userProfile } from "../../database/schema";
import { useDatabase } from "../../utils/database";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  if (typeof query.slug !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "slug is required",
    });
  }

  const slug = query.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: "slug must use lowercase letters, numbers, and hyphens",
    });
  }

  const database = useDatabase();
  const [existingProfile] = await database
    .select({ userId: userProfile.userId })
    .from(userProfile)
    .where(sql`lower(${userProfile.slug}) = ${slug}`)
    .limit(1);

  return { available: !existingProfile };
});
