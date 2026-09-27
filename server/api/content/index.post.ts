import { createError, readBody } from "h3";
import { eq } from "drizzle-orm";
import { content, contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { validateContentData } from "../../utils/content-validation";
import { useDatabase } from "../../utils/database";
import { isUniqueConstraintError } from "../../utils/user-profile";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

interface CreateContentBody {
  slug?: unknown;
  name?: unknown;
  contentTypeId?: unknown;
  sheetId?: unknown;
  data?: unknown;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await readBody<CreateContentBody>(event);

  if (
    typeof body?.slug !== "string" ||
    typeof body.name !== "string" ||
    typeof body.contentTypeId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.contentTypeId,
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "slug, name, and contentTypeId are required",
    });
  }

  const slug = body.slug.toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid slug" });
  }
  const name = body.name.trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
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
  const [typeRecord] = await database
    .select({ type: contentType, resource })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId))
    .where(eq(contentType.resourceId, body.contentTypeId))
    .limit(1);

  if (!typeRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  }

  const accessContext = await loadResourceAccessContext(user, [
    typeRecord.resource.id,
  ]);
  if (!getResourceAccess(typeRecord.resource, accessContext).canRead) {
    throw createError({
      statusCode: 403,
      statusMessage: "ContentType is not accessible",
    });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const validationError = validateContentData(
    data,
    typeRecord.type.schema,
    typeRecord.type.hasStrictSchema,
  );
  if (validationError) {
    throw createError({ statusCode: 400, statusMessage: validationError });
  }

  let sheetId: string | null = null;
  if (body.sheetId !== undefined && body.sheetId !== null) {
    if (
      typeof body.sheetId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.sheetId,
      )
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "sheetId must be a Resource ID",
      });
    }
    const [sheetRecord] = await database
      .select({ sheet, resource })
      .from(sheet)
      .innerJoin(resource, eq(resource.id, sheet.resourceId))
      .where(eq(sheet.resourceId, body.sheetId))
      .limit(1);
    if (
      !sheetRecord ||
      sheetRecord.sheet.contentTypeId !== body.contentTypeId
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Sheet does not match ContentType",
      });
    }
    const sheetAccess = await loadResourceAccessContext(user, [
      sheetRecord.resource.id,
    ]);
    if (!getResourceAccess(sheetRecord.resource, sheetAccess).canRead) {
      throw createError({
        statusCode: 403,
        statusMessage: "Sheet is not accessible",
      });
    }
    sheetId = body.sheetId;
  }

  try {
    const created = await database.transaction(async (transaction) => {
      const [createdResource] = await transaction
        .insert(resource)
        .values({
          kind: "content",
          ownerUserId: user.id,
          slug,
          name,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      const [createdContent] = await transaction
        .insert(content)
        .values({
          resourceId: createdResource.id,
          contentTypeId: body.contentTypeId,
          sheetId,
          data,
        })
        .returning();

      return {
        id: createdResource.id,
        slug: createdResource.slug,
        name: createdResource.name,
        createdAt: createdResource.createdAt,
        updatedAt: createdResource.updatedAt,
        ...createdContent,
      };
    });

    setResponseStatus(event, 201);
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: "Slug is already in use",
      });
    }
    throw error;
  }
});
