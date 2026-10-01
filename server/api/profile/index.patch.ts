import { createError } from "h3";
import { and, eq, sql } from "drizzle-orm";
import { user as userTable, userProfile } from "../../database/schema";
import { parseBody, profilePatchSchema } from "../../utils/api-schemas";
import { useDatabase } from "../../utils/database";
import { requireAuthenticatedUser } from "../../utils/auth";
import {
  getDisplayNameError,
  nameForNewUsername,
  resolveDisplayName,
} from "../../../shared/display-name";
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
                  "At most 40 characters; stored lowercase. A display name that is still the old username follows it, with this capitalization",
              },
              name: {
                type: ["string", "null"],
                description:
                  "Display name; empty or null resets it to the username. At most 100 characters, with no control or invisible characters",
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

  if (body.name !== undefined && body.name !== null) {
    const nameError = getDisplayNameError(body.name);
    if (nameError) throw createError({ statusCode: 400, statusMessage: nameError });
  }

  await ensureUserProfile(user);

  try {
    const database = useDatabase();
    const newUsername = body.username?.toLowerCase();
    // One transaction, so a failure can't leave the username changed and the
    // display name stale.
    const profile = await database.transaction(async (tx) => {
      // Locked, so concurrent requests see each other's username.
      const [before] = await tx
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, user.id))
        .for("update");
      const [updated] = await tx
        .update(userProfile)
        .set({
          ...(newUsername !== undefined ? { username: newUsername } : {}),
          ...(body.iconImageUrl !== undefined
            ? { iconImageUrl: body.iconImageUrl }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(userProfile.userId, user.id))
        .returning();
      if (!before || !updated) throw new Error("Profile not found");

      // Better Auth's `user.name` is the display name. It is required, so an
      // empty one is stored as the username (as typed, when it changes too).
      if (body.name !== undefined) {
        await tx
          .update(userTable)
          .set({
            name: resolveDisplayName(
              body.name,
              body.username?.trim() ?? updated.username,
            ),
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, user.id));
      } else if (body.username !== undefined) {
        // The name follows the username while it is still the default (the
        // old username in any capitalization), decided in the update itself.
        const followed = nameForNewUsername(before.username, body.username);
        if (followed !== undefined) {
          await tx
            .update(userTable)
            .set({ name: followed, updatedAt: new Date() })
            .where(
              and(
                eq(userTable.id, user.id),
                sql`lower(${userTable.name}) = ${before.username.toLowerCase()}`,
              ),
            );
        }
      }
      return updated;
    });

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
