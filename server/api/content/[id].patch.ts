import { createError, getRouterParam, readBody } from "h3";
import { eq } from "drizzle-orm";
import { content } from "../../database/schema";
import { useDatabase } from "../../utils/database";

interface UpdateContentBody {
  name?: unknown;
  displayName?: unknown;
  data?: unknown;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<UpdateContentBody>(event);
  const database = useDatabase();
  const [contentItem] = await database
    .select()
    .from(content)
    .where(eq(content.id, id!))
    .limit(1);

  if (!contentItem) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  if (body.name !== undefined && typeof body.name !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "name must be a string",
    });
  }
  if (body.displayName !== undefined && typeof body.displayName !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "displayName must be a string",
    });
  }
  if (
    body.data !== undefined &&
    (typeof body.data !== "object" ||
      body.data === null ||
      Array.isArray(body.data))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "data must be a JSON object",
    });
  }

  const updates = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.displayName !== undefined
      ? { displayName: body.displayName }
      : {}),
    ...(body.data !== undefined
      ? { data: body.data as Record<string, unknown> }
      : {}),
    updatedAt: new Date(),
  };

  const [updatedContent] = await database
    .update(content)
    .set(updates)
    .where(eq(content.id, id!))
    .returning();

  return updatedContent;
});
