import { appendResponseHeader, createError, readBody, toWebRequest } from "h3";
import { sql } from "drizzle-orm";
import { userProfile } from "../database/schema";
import { useDatabase } from "../utils/database";
import { useAuth } from "../utils/auth";
import { isUniqueConstraintError } from "../utils/user-profile";

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  slug?: unknown;
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
            required: ["name", "email", "password", "slug"],
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
              password: { type: "string" },
              slug: { type: "string" },
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const slug =
    typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";

  if (!name || !email || !password || !slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Display name, email, password, and username are required",
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Username must use lowercase letters, numbers, and hyphens",
    });
  }

  const database = useDatabase();
  const [existingProfile] = await database
    .select({ userId: userProfile.userId })
    .from(userProfile)
    .where(sql`lower(${userProfile.slug}) = ${slug}`)
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
      .values({ userId: signup.response.user.id, slug })
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
