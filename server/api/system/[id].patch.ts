import { createError, getRouterParam, readBody } from "h3";
import { eq } from "drizzle-orm";
import { resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  requireName,
  requireResourceEditor,
  requireSlug,
} from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Update a System",
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
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated System" },
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
  const body = await readBody<{
    name?: unknown;
    slug?: unknown;
    isPubliclyReadable?: unknown;
  }>(event);
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  const database = useDatabase();
  const [updated] = await database
    .update(resource)
    .set({
      ...(body.name !== undefined ? { name: requireName(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: requireSlug(body.slug) } : {}),
      ...(body.isPubliclyReadable !== undefined
        ? { isPubliclyReadable: body.isPubliclyReadable === true }
        : {}),
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id))
    .returning();
  return updated;
});
