import { createError } from "h3";
import { eq } from "drizzle-orm";
import {
  campaign,
  campaignMembership,
  resource,
  system,
} from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  requireName,
  requireReadableId,
  resolveResourceOwner,
} from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, campaignCreateSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Create a campaign",
    description:
      "The creating user becomes a member with the GM role; change roles with the members endpoint.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "readableId", "systemId"],
            properties: {
              name: { type: "string" },
              readableId: { type: "string" },
              systemId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              isPubliclyReadable: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created campaign" },
      400: { description: "Invalid request" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, campaignCreateSchema);
  const name = requireName(body?.name);
  const readableId = requireReadableId(body?.readableId);
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
          kind: "campaign",
          ...owner,
          readableId,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("Campaign Resource was not created");
      const [createdCampaign] = await tx
        .insert(campaign)
        .values({
          resourceId: createdResource.id,
          systemId: body.systemId as string,
        })
        .returning();
      // The creator is the campaign's GM by default; editors can change any
      // member's role later (members.post), including their own.
      await tx.insert(campaignMembership).values({
        campaignId: createdResource.id,
        userId: user.id,
        role: "gm",
      });
      return { ...createdResource, ...createdCampaign };
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
