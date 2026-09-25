import { createError, readBody } from "h3";
import { content } from "../../database/schema";
import { useDatabase } from "../../utils/database";

interface CreateContentBody {
  name?: unknown;
  displayName?: unknown;
  data?: unknown;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateContentBody>(event);

  if (typeof body?.name !== "string" || typeof body.displayName !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "name and displayName are required strings",
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

  const database = useDatabase();
  const [createdContent] = await database
    .insert(content)
    .values({
      name: body.name,
      displayName: body.displayName,
      data: (body.data ?? {}) as Record<string, unknown>,
    })
    .returning();

  setResponseStatus(event, 201);
  return createdContent;
});
