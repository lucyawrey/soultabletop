import { createError } from "h3";
import { and, eq } from "drizzle-orm";
import {
  groupMembership,
  resource,
  system,
  userProfile,
} from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, resourceCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Create a System",
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
              ownerGroupId: { type: "string", format: "uuid" },
              isPubliclyReadable: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created System" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, resourceCreateSchema);
  const { name, slug } = body;
  const database = useDatabase();
  let ownerGroupId: string | null = null;
  if (body.ownerGroupId !== undefined && body.ownerGroupId !== null) {
    if (typeof body.ownerGroupId !== "string")
      throw createError({
        statusCode: 400,
        statusMessage: "ownerGroupId must be a UUID",
      });
    const [profile] = await database
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, user.id));
    const [membership] = await database
      .select({ role: groupMembership.role })
      .from(groupMembership)
      .where(
        and(
          eq(groupMembership.groupId, body.ownerGroupId),
          eq(groupMembership.userId, user.id),
        ),
      );
    if (
      profile?.role !== "Admin" &&
      membership?.role !== "admin" &&
      membership?.role !== "editor"
    )
      throw createError({
        statusCode: 403,
        statusMessage: "Not allowed to create group resources",
      });
    ownerGroupId = body.ownerGroupId;
  }
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "system",
          ownerUserId: ownerGroupId ? null : user.id,
          ownerGroupId,
          slug,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("System Resource was not created");
      const [createdSystem] = await tx
        .insert(system)
        .values({ resourceId: createdResource.id })
        .returning();
      return { ...createdResource, ...createdSystem };
    });
    setResponseStatus(event, 201);
    return result;
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw createError({
        statusCode: 409,
        statusMessage: "Slug is already in use",
      });
    throw error;
  }
});
