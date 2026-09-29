import { createError, getRouterParam } from "h3";
import { resourceGrant } from "../../../database/schema";
import { requireAuthenticatedUser } from "../../../utils/auth";
import {
  requireResourceEditor,
  requireUuid,
} from "../../../utils/resource-management";
import { useDatabase } from "../../../utils/database";
import { parseBody, resourceGrantSchema } from "../../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Resource Grants"],
    summary: "Grant resource access",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["permission"],
            properties: {
              userId: { type: "string" },
              groupId: { type: "string", format: "uuid" },
              gameId: { type: "string", format: "uuid" },
              permission: { type: "string", enum: ["read", "edit"] },
              gameAudience: { type: "string", enum: ["members", "gms"] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Created grant" },
      400: { description: "Invalid grant" },
      401: { description: "Authentication required" },
      403: { description: "Resource not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const resourceId = requireUuid(getRouterParam(event, "id"), "resourceId");
  await requireResourceEditor(user, resourceId);
  const body = await parseBody(event, resourceGrantSchema);
  const targets = [body.userId, body.groupId, body.gameId].filter(
    (value) => value !== undefined && value !== null,
  );
  if (
    targets.length !== 1 ||
    !["read", "edit"].includes(body.permission as string)
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Exactly one target and a valid permission are required",
    });
  if (
    body.gameId !== undefined &&
    !["members", "gms"].includes(body.gameAudience as string)
  )
    throw createError({
      statusCode: 400,
      statusMessage: "gameAudience is required for game grants",
    });
  if (body.gameId === undefined && body.gameAudience !== undefined)
    throw createError({
      statusCode: 400,
      statusMessage: "gameAudience only applies to game grants",
    });
  try {
    const [grant] = await useDatabase()
      .insert(resourceGrant)
      .values({
        resourceId,
        userId: typeof body.userId === "string" ? body.userId : null,
        groupId: typeof body.groupId === "string" ? body.groupId : null,
        gameId: typeof body.gameId === "string" ? body.gameId : null,
        permission: body.permission as "read" | "edit",
        gameAudience: body.gameAudience as "members" | "gms" | undefined,
        createdByUserId: user.id,
      })
      .returning();
    return grant;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    )
      throw createError({
        statusCode: 409,
        statusMessage: "A grant for this target already exists",
      });
    throw error;
  }
});
