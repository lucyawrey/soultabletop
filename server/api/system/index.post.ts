import { createError } from "h3";
import { resource, system } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { resolveResourceOwner } from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, resourceCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Create a system",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "readableId"],
            properties: {
              name: { type: "string" },
              readableId: { type: "string" },
              ownerGroupId: { type: "string", format: "uuid" },
              isPubliclyReadable: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created system" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, resourceCreateSchema);
  const { name, readableId } = body;
  const database = useDatabase();
  const owner = await resolveResourceOwner(user, body.ownerGroupId);
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "system",
          ...owner,
          readableId,
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
        statusMessage: "ID is already in use",
      });
    throw error;
  }
});
