import { createError, getRouterParam } from "h3";
import { count, eq } from "drizzle-orm";
import { contentType, game, resource } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceEditor } from "../../utils/resource-management";
import { isForeignKeyConstraintError } from "../../utils/user-profile";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Delete a System",
    responses: {
      204: { description: "Deleted" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: { description: "Games or ContentTypes still use the System" },
    },
  },
});

const inUseMessage =
  "Delete this System's Games and ContentTypes before deleting the System";

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const item = await requireResourceEditor(user, id);
  if (item.kind !== "system")
    throw createError({ statusCode: 404, statusMessage: "System not found" });
  const database = useDatabase();
  // Games and ContentTypes reference their System with ON DELETE RESTRICT.
  const [[games], [types]] = await Promise.all([
    database.select({ total: count() }).from(game).where(eq(game.systemId, id)),
    database
      .select({ total: count() })
      .from(contentType)
      .where(eq(contentType.systemId, id)),
  ]);
  if (games?.total || types?.total)
    throw createError({
      statusCode: 409,
      statusMessage: `${inUseMessage} (${games?.total ?? 0} Games, ${types?.total ?? 0} ContentTypes)`,
    });
  try {
    await database.delete(resource).where(eq(resource.id, id));
  } catch (error) {
    // Something was added between the check and the delete.
    if (isForeignKeyConstraintError(error))
      throw createError({ statusCode: 409, statusMessage: inUseMessage });
    throw error;
  }
  setResponseStatus(event, 204);
});
