import { createError, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { content } from "../../database/schema";
import { useDatabase } from "../../utils/database";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const database = useDatabase();
  const [contentItem] = await database
    .select()
    .from(content)
    .where(eq(content.id, id!))
    .limit(1);

  if (!contentItem) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  return contentItem;
});
