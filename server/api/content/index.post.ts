import { createError } from "h3";
import { eq } from "drizzle-orm";
import { content, contentType, resource, sheet } from "../../database/schema";
import { createContentSchema, parseBody } from "../../utils/api-schemas";
import { requireAuthenticatedUser } from "../../utils/auth";
import { validateContentData } from "../../utils/content-validation";
import { useDatabase } from "../../utils/database";
import { isUniqueConstraintError } from "../../utils/user-profile";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Create a Content record",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["slug", "name", "contentTypeId"],
            properties: {
              slug: { type: "string" },
              name: { type: "string" },
              contentTypeId: { format: "uuid", type: "string" },
              sheetId: { type: ["string", "null"] },
              data: { type: "object", additionalProperties: true },
            },
          } as const,
        },
      },
    },
    responses: {
      201: { description: "Created Content record" },
      400: { description: "Invalid Content data" },
      401: { description: "Authentication required" },
      403: { description: "Referenced resource is inaccessible" },
      404: { description: "ContentType or Sheet not found" },
      409: { description: "Slug already exists" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, createContentSchema);
  const { slug, name } = body;

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

  const data = body.data;
  const validationError = validateContentData(
    data,
    typeRecord.type.schema,
    typeRecord.type.hasStrictSchema,
  );
  if (validationError) {
    throw createError({ statusCode: 400, statusMessage: validationError });
  }

  let sheetId: string | null = null;
  if (body.sheetId) {
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
      if (!createdResource) throw new Error("Content Resource was not created");
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
