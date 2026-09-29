import { createError } from "h3";
import { eq } from "drizzle-orm";
import { group, groupMembership, userProfile } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { parseBody, groupCreateWithKindSchema } from "../../utils/api-schemas";
import { isUniqueConstraintError } from "../../utils/user-profile";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "Create a group",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "slug"],
            properties: {
              name: { type: "string" },
              slug: { type: "string" },
              official: {
                type: "boolean",
                description:
                  "Create a system group, whose resources are official (site admins only)",
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created group" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const { name, slug, official } = await parseBody(
    event,
    groupCreateWithKindSchema,
  );
  if (official) {
    const [profile] = await useDatabase()
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, user.id));
    if (profile?.role !== "admin")
      throw createError({
        statusCode: 403,
        statusMessage: "Only site admins can create official groups",
      });
  }
  try {
    const database = useDatabase();
    const created = await database.transaction(async (tx) => {
      const [createdGroup] = await tx
        .insert(group)
        .values({
          name,
          slug,
          kind: official ? "system" : "user",
          createdByUserId: user.id,
        })
        .returning();
      if (!createdGroup) throw new Error("Group was not created");
      await tx
        .insert(groupMembership)
        .values({ groupId: createdGroup.id, userId: user.id, role: "admin" });
      return createdGroup;
    });
    setResponseStatus(event, 201);
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw createError({
        statusCode: 409,
        statusMessage: "Group slug is already in use",
      });
    throw error;
  }
});
