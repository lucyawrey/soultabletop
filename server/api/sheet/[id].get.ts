import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { sheet } from "../../database/schema";
import { getAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import { requireResourceReader } from "../../utils/resource-management";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Get a Sheet",
    responses: {
      200: { description: "Sheet" },
      404: { description: "Sheet not found" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Resource ID is required",
    });
  const item = await requireResourceReader(user, id);
  if (item.kind !== "sheet")
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  const [row] = await useDatabase()
    .select()
    .from(sheet)
    .where(eq(sheet.resourceId, id))
    .limit(1);
  if (!row)
    throw createError({ statusCode: 404, statusMessage: "Sheet not found" });
  return { ...item, ...row };
});
