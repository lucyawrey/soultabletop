import { createError, getRouterParam, readBody } from "h3";
import { eq } from "drizzle-orm";
import { content, contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { validateContentData } from "../../utils/content-validation";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";

interface UpdateContentBody {
  slug?: unknown;
  name?: unknown;
  data?: unknown;
  sheetId?: unknown;
}

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Update a Content record",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              slug: { type: "string" },
              name: { type: "string" },
              sheetId: { type: ["string", "null"] },
              data: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated Content record" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Resource ID",
    });

  const user = await requireAuthenticatedUser(event);
  const body = await readBody<UpdateContentBody>(event);
  const database = useDatabase();
  const [record] = await database
    .select({ item: content, resource, type: contentType })
    .from(content)
    .innerJoin(resource, eq(resource.id, content.resourceId))
    .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
    .where(eq(content.resourceId, id))
    .limit(1);

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }

  const context = await loadResourceAccessContext(user, [record.resource.id]);
  const access = getResourceAccess(record.resource, context);
  if (!access.canEdit) {
    throw createError({
      statusCode: 403,
      statusMessage: "Content is not editable",
    });
  }

  const updates: { slug?: string; name?: string } = {};
  if (body.slug !== undefined) {
    if (
      typeof body.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(body.slug)
    ) {
      throw createError({ statusCode: 400, statusMessage: "Invalid slug" });
    }
    updates.slug = body.slug.toLowerCase();
  }
  if (body.name !== undefined && typeof body.name !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "name must be a string",
    });
  }
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (updates.name !== undefined && !updates.name) {
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

  const data = body.data as Record<string, unknown> | undefined;
  if (data) {
    const validationError = validateContentData(
      data,
      record.type.schema,
      record.type.hasStrictSchema,
    );
    if (validationError) {
      throw createError({ statusCode: 400, statusMessage: validationError });
    }
  }

  let sheetId: string | null | undefined;
  if (body.sheetId !== undefined) {
    if (
      body.sheetId !== null &&
      (typeof body.sheetId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.sheetId,
        ))
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "sheetId must be a Resource ID or null",
      });
    }
    if (typeof body.sheetId === "string") {
      const [sheetRecord] = await database
        .select({ sheet, resource })
        .from(sheet)
        .innerJoin(resource, eq(resource.id, sheet.resourceId))
        .where(eq(sheet.resourceId, body.sheetId))
        .limit(1);
      if (
        !sheetRecord ||
        sheetRecord.sheet.contentTypeId !== record.item.contentTypeId
      ) {
        throw createError({
          statusCode: 400,
          statusMessage: "Sheet does not match ContentType",
        });
      }
      const sheetContext = await loadResourceAccessContext(user, [
        sheetRecord.resource.id,
      ]);
      if (!getResourceAccess(sheetRecord.resource, sheetContext).canRead) {
        throw createError({
          statusCode: 403,
          statusMessage: "Sheet is not accessible",
        });
      }
    }
    sheetId = body.sheetId;
  }

  const updated = await database.transaction(async (transaction) => {
    const hasChanges =
      Object.keys(updates).length > 0 ||
      data !== undefined ||
      sheetId !== undefined;
    if (hasChanges) {
      await transaction
        .update(resource)
        .set({
          ...updates,
          updatedByUserId: user.id,
          updatedAt: new Date(),
        })
        .where(eq(resource.id, record.resource.id));
    }

    const contentUpdates = {
      ...(data !== undefined ? { data } : {}),
      ...(sheetId !== undefined ? { sheetId } : {}),
    };
    const [updatedContent] = Object.keys(contentUpdates).length
      ? await transaction
          .update(content)
          .set(contentUpdates)
          .where(eq(content.resourceId, record.resource.id))
          .returning()
      : [record.item];

    return {
      id: record.resource.id,
      slug: updates.slug ?? record.resource.slug,
      name: updates.name ?? record.resource.name,
      createdAt: record.resource.createdAt,
      updatedAt: hasChanges ? new Date() : record.resource.updatedAt,
      ...updatedContent,
    };
  });

  return updated;
});
