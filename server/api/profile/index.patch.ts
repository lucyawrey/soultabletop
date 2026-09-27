import { createError } from "h3";
import { eq } from "drizzle-orm";
import { userProfile } from "../../database/schema";
import { parseBody, profilePatchSchema } from "../../utils/api-schemas";
import { useDatabase } from "../../utils/database";
import { requireAuthenticatedUser } from "../../utils/auth";
import {
  ensureUserProfile,
  isUniqueConstraintError,
} from "../../utils/user-profile";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Update the current user's profile",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              slug: { type: "string" },
              iconImageUrl: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated profile" },
      400: { description: "Invalid profile data" },
      401: { description: "Authentication required" },
      409: { description: "Username already exists" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, profilePatchSchema);

  if (body.slug === undefined && body.iconImageUrl === undefined)
    throw createError({
      statusCode: 400,
      statusMessage: "No profile fields provided",
    });

  await ensureUserProfile(user);

  try {
    const database = useDatabase();
    const [profile] = await database
      .update(userProfile)
      .set({
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.iconImageUrl !== undefined
          ? { iconImageUrl: body.iconImageUrl }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, user.id))
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
