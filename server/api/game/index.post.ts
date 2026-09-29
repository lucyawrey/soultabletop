import { createError } from "h3";
import { eq } from "drizzle-orm";
import { game, resource, system } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  requireName,
  requireSlug,
  resolveResourceOwner,
} from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, gameCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Game"],
    summary: "Create a game",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "slug", "systemId"],
            properties: {
              name: { type: "string" },
              slug: { type: "string" },
              systemId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              isPubliclyReadable: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created game" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, gameCreateSchema);
  const name = requireName(body?.name);
  const slug = requireSlug(body?.slug);
  if (typeof body.systemId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "systemId is required",
    });
  const database = useDatabase();
  const [systemResource] = await database
    .select({ resource })
    .from(system)
    .innerJoin(resource, eq(resource.id, system.resourceId))
    .where(eq(system.resourceId, body.systemId))
    .limit(1);
  if (!systemResource)
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  const context = await loadResourceAccessContext(user, [
    systemResource.resource.id,
  ]);
  if (!getResourceAccess(systemResource.resource, context).canRead)
    throw createError({
      statusCode: 403,
      statusMessage: "System is not accessible",
    });
  const owner = await resolveResourceOwner(user, body.ownerGroupId, context);
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "game",
          ...owner,
          slug,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("Game Resource was not created");
      const [createdGame] = await tx
        .insert(game)
        .values({
          resourceId: createdResource.id,
          systemId: body.systemId as string,
        })
        .returning();
      return { ...createdResource, ...createdGame };
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
