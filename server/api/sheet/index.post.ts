import { createError } from "h3";
import { eq } from "drizzle-orm";
import { contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import { requireName, requireSlug } from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, sheetCreateSchema } from "../../utils/api-schemas";
import {
  assertValidSheetCss,
  assertValidSheetMarkup,
  loadSheetSchemas,
} from "../../utils/sheet-schemas";
import {
  generatedSheetDefaults,
  generateSheetMarkup,
} from "../../../shared/sheet/generate";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Create a Sheet",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "slug", "contentTypeId"],
            properties: {
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              slug: { type: "string" },
              contentTypeId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              markup: {
                type: "string",
                description: "Defaults to markup generated from the schema",
              },
              cssStyles: { type: "string" },
              isDefault: { type: "boolean" },
              defaultEditMode: {
                type: "boolean",
                description: "Defaults by the ContentType's content category",
              },
              defaultAutosave: {
                type: "boolean",
                description: "Defaults by the ContentType's content category",
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created Sheet" },
      400: { description: "Invalid request or markup errors" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, sheetCreateSchema);
  const name = requireName(body?.name);
  const slug = requireSlug(body?.slug);
  if (typeof body.contentTypeId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "contentTypeId is required",
    });
  const database = useDatabase();
  const [typeResource] = await database
    .select({ type: contentType, resource })
    .from(contentType)
    .innerJoin(resource, eq(resource.id, contentType.resourceId))
    .where(eq(contentType.resourceId, body.contentTypeId))
    .limit(1);
  if (!typeResource)
    throw createError({
      statusCode: 404,
      statusMessage: "ContentType not found",
    });
  const context = await loadResourceAccessContext(user, [
    typeResource.resource.id,
  ]);
  const typeAccess = getResourceAccess(typeResource.resource, context);
  const switchDefaults = generatedSheetDefaults(
    typeResource.type.contentCategory,
  );
  if (!typeAccess.canRead)
    throw createError({
      statusCode: 403,
      statusMessage: "ContentType is not accessible",
    });
  if (body.isDefault === true && !typeAccess.canEdit)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only editors of the ContentType can set its default Sheet",
    });
  // New Sheets without markup start from the one generated from the schema.
  let markup = body.markup;
  if (markup === undefined) {
    const schemas = await loadSheetSchemas(body.contentTypeId);
    markup = schemas ? generateSheetMarkup(schemas) : "";
  } else {
    await assertValidSheetMarkup(markup, body.contentTypeId);
  }
  if (typeof body.cssStyles === "string") assertValidSheetCss(body.cssStyles);
  const ownerGroupId =
    typeof body.ownerGroupId === "string" ? body.ownerGroupId : null;
  if (
    ownerGroupId &&
    !context.groupRoles.has(ownerGroupId) &&
    !context.isSiteAdmin
  )
    throw createError({
      statusCode: 403,
      statusMessage: "Not allowed to use this Group",
    });
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "sheet",
          ownerUserId: ownerGroupId ? null : user.id,
          ownerGroupId,
          slug,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("Sheet Resource was not created");
      // Only one default Sheet per ContentType (partial unique index).
      if (body.isDefault === true)
        await tx
          .update(sheet)
          .set({ isDefault: false })
          .where(eq(sheet.contentTypeId, body.contentTypeId as string));
      const [createdSheet] = await tx
        .insert(sheet)
        .values({
          resourceId: createdResource.id,
          contentTypeId: body.contentTypeId as string,
          markup,
          cssStyles: typeof body.cssStyles === "string" ? body.cssStyles : "",
          isDefault: body.isDefault === true,
          // Unless given, the Edit/Autosave switches start as the content
          // category suggests (characters: on), like generated sheets.
          defaultEditMode:
            body.defaultEditMode ?? switchDefaults.defaultEditMode,
          defaultAutosave:
            body.defaultAutosave ?? switchDefaults.defaultAutosave,
        })
        .returning();
      return { ...createdResource, ...createdSheet };
    });
    setResponseStatus(event, 201);
    return result;
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw createError({
        statusCode: 409,
        statusMessage: "Slug is already in use",
      });
    throw error;
  }
});
