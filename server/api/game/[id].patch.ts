import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  requireName,
  requireResourceEditor,
  resolveOwnerChange,
  rethrowSlugConflict,
  requireSlug,
} from "../../utils/resource-management";
import { parseBody, gamePatchSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Game"],
    summary: "Update a game",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              slug: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              ownerGroupId: {
                type: ["string", "null"],
                format: "uuid",
                description:
                  "Move to this group, or null to move to yourself. Only the owner, or admins of the owning group, may; the target group needs you as admin or editor.",
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated game" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const body = await parseBody(event, gamePatchSchema);
  const item = await requireResourceEditor(user, id);
  const owner = await resolveOwnerChange(user, item, body.ownerGroupId);
  if (item.kind !== "game")
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  const [updated] = await useDatabase()
    .update(resource)
    .set({
      ...owner,
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: requireSlug(body.slug) } : {}),
      ...(body.isPubliclyReadable !== undefined
        ? { isPubliclyReadable: body.isPubliclyReadable === true }
        : {}),
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id))
    .returning()
    .catch(rethrowSlugConflict);
  return updated;
});
