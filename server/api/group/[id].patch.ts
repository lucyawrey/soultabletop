import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { group } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { parseBody, groupPatchSchema } from "../../utils/api-schemas";

defineRouteMeta({
  openAPI: {
    tags: ["Group"],
    summary: "Update a group",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { name: { type: "string" }, slug: { type: "string" } },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated group" },
      401: { description: "Authentication required" },
      403: { description: "Group admin access required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Group ID is required",
    });
  const body = await parseBody(event, groupPatchSchema);
  const database = useDatabase();
  await requireGroupAdmin(id, user.id);
  const [updated] = await database
    .update(group)
    .set({
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: requireSlug(body.slug) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(group.id, id))
    .returning();
  return updated;
});
