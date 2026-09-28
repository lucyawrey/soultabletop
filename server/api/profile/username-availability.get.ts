import { createError, getQuery } from "h3";
import { sql } from "drizzle-orm";
import { userProfile } from "../../database/schema";
import { useDatabase } from "../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Check username availability",
    responses: {
      200: { description: "Availability result" },
      400: { description: "Invalid username" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  if (typeof query.username !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "username is required",
    });
  }

  const username = query.username.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: "username must use lowercase letters, numbers, and hyphens",
    });
  }

  const database = useDatabase();
  const [existingProfile] = await database
    .select({ userId: userProfile.userId })
    .from(userProfile)
    .where(sql`lower(${userProfile.username}) = ${username}`)
    .limit(1);

  return { available: !existingProfile };
});
