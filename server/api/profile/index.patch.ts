import { createError } from "h3";
import { eq } from "drizzle-orm";
import { user as userTable, userProfile } from "../../database/schema";
import { parseBody, profilePatchSchema } from "../../utils/api-schemas";
import { useDatabase } from "../../utils/database";
import { requireAuthenticatedUser } from "../../utils/auth";
import { resolveDisplayName, syncedDisplayName } from "../../../shared/display-name";
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
              username: {
                type: "string",
                description:
                  "Stored lowercase; a display name that is still the old username follows it, with this capitalization",
              },
              name: {
                type: ["string", "null"],
                description:
                  "Display name; empty or null resets it to the username",
              },
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

  if (
    body.username === undefined &&
    body.name === undefined &&
    body.iconImageUrl === undefined
  )
    throw createError({
      statusCode: 400,
      statusMessage: "No profile fields provided",
    });

  const currentProfile = await ensureUserProfile(user);

  try {
    const database = useDatabase();
    const newUsername = body.username?.toLowerCase();
    const [profile] = await database
      .update(userProfile)
      .set({
        ...(body.username !== undefined ? { username: newUsername } : {}),
        ...(body.iconImageUrl !== undefined
          ? { iconImageUrl: body.iconImageUrl }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, user.id))
      .returning();

    // Better Auth's `user.name` is the display name. It is required, so an
    // empty one is stored as the username.
    // When the username changes and the name is still the default (the old
    // username), the name follows it, unless this request sets the name.
    const followedName =
      body.name === undefined && body.username !== undefined
        ? syncedDisplayName(user.name, currentProfile.username, body.username)
        : undefined;
    if (followedName !== undefined) {
      await database
        .update(userTable)
        .set({ name: followedName, updatedAt: new Date() })
        .where(eq(userTable.id, user.id));
    }
    if (body.name !== undefined) {
      await database
        .update(userTable)
        .set({
          name: resolveDisplayName(body.name, profile?.username ?? currentProfile.username),
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, user.id));
    }

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
