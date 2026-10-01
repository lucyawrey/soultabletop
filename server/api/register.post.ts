import { appendResponseHeader, createError, readBody, toWebRequest } from "h3";
import { sql } from "drizzle-orm";
import { userProfile } from "../database/schema";
import { useDatabase } from "../utils/database";
import { useAuth } from "../utils/auth";
import { isUniqueConstraintError } from "../utils/user-profile";
import {
  MAX_USERNAME_LENGTH,
  getDisplayNameError,
  resolveDisplayName,
} from "../../shared/display-name";

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  username?: unknown;
}

defineRouteMeta({
  openAPI: {
    tags: ["Authentication"],
    summary: "Register a user",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "password", "username"],
            properties: {
              name: {
                type: "string",
                description:
                  "Display name; optional, defaults to the username as typed. At most 100 characters, with no control or invisible characters",
              },
              email: { type: "string", format: "email" },
              password: { type: "string" },
              username: {
                type: "string",
                description:
                  "Display name; optional, defaults to the username as typed. At most 100 characters, with no control or invisible characters",
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Registered user" },
      400: { description: "Invalid registration" },
      409: { description: "Username already exists" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  // The username as typed: stored lowercase, but it is the default display
  // name, which keeps the capitalization.
  const typedUsername =
    typeof body?.username === "string" ? body.username.trim() : "";
  const username = typedUsername.toLowerCase();
  const name = resolveDisplayName(body?.name, typedUsername);

  if (!email || !password || !username) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email, password, and username are required",
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Username must use letters, numbers, and hyphens",
    });
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Username must be at most ${MAX_USERNAME_LENGTH} characters`,
    });
  }
  const nameError = getDisplayNameError(name);
  if (nameError) {
    throw createError({ statusCode: 400, statusMessage: nameError });
  }

  const database = useDatabase();
  const [existingProfile] = await database
    .select({ userId: userProfile.userId })
    .from(userProfile)
    .where(sql`lower(${userProfile.username}) = ${username}`)
    .limit(1);
  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "That username is already in use",
    });
  }

  try {
    const headers = Object.fromEntries(toWebRequest(event).headers.entries());
    const signup = await useAuth().api.signUpEmail({
      body: { name, email, password },
      headers,
      returnHeaders: true,
    });

    const [profile] = await database
      .insert(userProfile)
      .values({ userId: signup.response.user.id, username })
      .returning();

    for (const cookie of signup.headers.getSetCookie()) {
      appendResponseHeader(event, "set-cookie", cookie);
    }
    return { user: signup.response.user, profile };
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
