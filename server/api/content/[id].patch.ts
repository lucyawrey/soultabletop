import { createError, readBody } from "h3";
import { eq } from "drizzle-orm";
import { content, contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import {
  extractDataName,
  validateContentData,
} from "../../utils/content-validation";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  resolveOwnerChange,
  rethrowReadableIdConflict,
} from "../../utils/resource-management";
import { resolveResourceRouteId } from "../../utils/resource-address";

interface UpdateContentBody {
  readableId?: unknown;
  name?: unknown;
  data?: unknown;
  sheetId?: unknown;
  isPubliclyReadable?: unknown;
  ownerGroupId?: unknown;
  expectedUpdatedAt?: unknown;
}

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Update a content record",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              readableId: { type: "string" },
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              ownerGroupId: {
                type: ["string", "null"],
                format: "uuid",
                description:
                  "Move to this group, or null to move to yourself. Only the owner, or admins of the owning group, may; the target group needs you as admin or editor.",
              },
              sheetId: { type: ["string", "null"] },
              data: { type: "object", additionalProperties: true },
              expectedUpdatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated content record" },
      401: { description: "Authentication required" },
      403: { description: "Not editable" },
      409: { description: "Changed since expectedUpdatedAt" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const id = await resolveResourceRouteId(event, "content", user);
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

  const owner = await resolveOwnerChange(
    user,
    record.resource,
    body.ownerGroupId,
  );
  const updates: { readableId?: string; name?: string; isPubliclyReadable?: boolean } =
    {};
  if (body.isPubliclyReadable !== undefined) {
    if (typeof body.isPubliclyReadable !== "boolean") {
      throw createError({
        statusCode: 400,
        statusMessage: "isPubliclyReadable must be a boolean",
      });
    }
    updates.isPubliclyReadable = body.isPubliclyReadable;
  }
  if (body.readableId !== undefined) {
    if (
      typeof body.readableId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(body.readableId)
    ) {
      throw createError({ statusCode: 400, statusMessage: "Invalid readableId" });
    }
    updates.readableId = body.readableId.toLowerCase();
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

  let data: Record<string, unknown> | undefined;
  if (body.data !== undefined) {
    const extracted = extractDataName(body.data as Record<string, unknown>);
    data = extracted.data;
    if (updates.name === undefined && extracted.name !== undefined)
      updates.name = extracted.name;
    const validationError = await validateContentData(user, data, record.type);
    if (validationError) {
      throw createError({ statusCode: 400, statusMessage: validationError });
    }
  }

  let expectedUpdatedAt: Date | undefined;
  if (body.expectedUpdatedAt !== undefined) {
    expectedUpdatedAt =
      typeof body.expectedUpdatedAt === "string"
        ? new Date(body.expectedUpdatedAt)
        : undefined;
    if (!expectedUpdatedAt || Number.isNaN(expectedUpdatedAt.getTime())) {
      throw createError({
        statusCode: 400,
        statusMessage: "expectedUpdatedAt must be a date-time string",
      });
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
        statusMessage: "sheetId must be a resource ID or null",
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
          statusMessage: "Sheet does not match content type",
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
    if (expectedUpdatedAt) {
      // Lock the row so a concurrent save can't slip in between the check and
      // the update.
      const [current] = await transaction
        .select({ updatedAt: resource.updatedAt })
        .from(resource)
        .where(eq(resource.id, record.resource.id))
        .for("update");
      if (current?.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw createError({
          statusCode: 409,
          statusMessage:
            "This content was changed by someone else since you loaded it",
        });
      }
    }

    const hasChanges =
      Object.keys(updates).length > 0 ||
      owner !== undefined ||
      data !== undefined ||
      sheetId !== undefined;
    // One timestamp for the row and the response, so clients can send it back
    // as `expectedUpdatedAt`.
    const now = new Date();
    if (hasChanges) {
      await transaction
        .update(resource)
        .set({
          ...updates,
          ...owner,
          updatedByUserId: user.id,
          updatedAt: now,
        })
        .where(eq(resource.id, record.resource.id))
        .catch(rethrowReadableIdConflict);
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
      readableId: updates.readableId ?? record.resource.readableId,
      name: updates.name ?? record.resource.name,
      isPubliclyReadable:
        updates.isPubliclyReadable ?? record.resource.isPubliclyReadable,
      createdAt: record.resource.createdAt,
      updatedAt: hasChanges ? now : record.resource.updatedAt,
      ...updatedContent,
    };
  });

  return updated;
});
