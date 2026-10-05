import { createError } from "h3";
import { and, eq } from "drizzle-orm";
import { contentType, resource, sheet } from "../../database/schema";
import { requireAuthenticatedUser } from "../../utils/auth";
import { useDatabase } from "../../utils/database";
import {
  getResourceAccess,
  loadResourceAccessContext,
} from "../../utils/resource-access";
import {
  requireName,
  requireReadableId,
  resolveResourceOwner,
} from "../../utils/resource-management";
import { isUniqueConstraintError } from "../../utils/user-profile";
import { parseBody, sheetCreateSchema } from "../../utils/api-schemas";
import {
  assertDefaultReplacementConfirmed,
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
    summary: "Create a sheet",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "readableId", "contentTypeId"],
            properties: {
              name: { type: "string" },
              isPubliclyReadable: { type: "boolean" },
              readableId: { type: "string" },
              contentTypeId: { type: "string", format: "uuid" },
              ownerGroupId: { type: "string", format: "uuid" },
              markup: {
                type: "string",
                description: "Defaults to markup generated from the schema",
              },
              cssStyles: { type: "string" },
              isDefault: {
                type: "boolean",
                description:
                  "When left out, the sheet becomes the default if its content type has no default sheet yet and you can edit the content type",
              },
              confirmReplaceDefault: {
                type: "boolean",
                description:
                  "Required to replace an existing default sheet (otherwise 409)",
              },
              defaultEditMode: {
                type: "boolean",
                description: "Defaults by the content type's content category",
              },
              defaultAutosave: {
                type: "boolean",
                description: "Defaults by the content type's content category",
              },
              defaultDisplay: {
                type: "string",
                enum: ["text", "box"],
                description:
                  "How fields look when they can't be edited; defaults by the content type's content category",
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created sheet" },
      400: { description: "Invalid request or markup errors" },
      401: { description: "Authentication required" },
      409: {
        description:
          "Readable ID in use, or would replace the default sheet without confirmReplaceDefault",
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const body = await parseBody(event, sheetCreateSchema);
  const name = requireName(body?.name);
  const readableId = requireReadableId(body?.readableId);
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
      statusMessage: "Content type not found",
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
      statusMessage: "Content type is not accessible",
    });
  if (body.isDefault === true && !typeAccess.canEdit)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only editors of the content type can set its default sheet",
    });
  if (body.isDefault === true)
    await assertDefaultReplacementConfirmed(
      user,
      body.contentTypeId,
      undefined,
      body.confirmReplaceDefault,
    );
  // New Sheets without markup start from the one generated from the schema.
  let markup = body.markup;
  if (markup === undefined) {
    const schemas = await loadSheetSchemas(body.contentTypeId);
    markup = schemas ? generateSheetMarkup(schemas) : "";
  } else {
    await assertValidSheetMarkup(markup, body.contentTypeId);
  }
  if (typeof body.cssStyles === "string") assertValidSheetCss(body.cssStyles);
  const owner = await resolveResourceOwner(user, body.ownerGroupId, context);
  try {
    const result = await database.transaction(async (tx) => {
      const [createdResource] = await tx
        .insert(resource)
        .values({
          kind: "sheet",
          ...owner,
          readableId,
          name,
          isPubliclyReadable: body.isPubliclyReadable === true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })
        .returning();
      if (!createdResource) throw new Error("Sheet Resource was not created");
      // Without `isDefault`, a content type's first Sheet becomes its default
      // (replacing the generated one, so no confirmation), for anyone who can
      // edit the type. Locking the type's row keeps two concurrent creates
      // from both taking it.
      let isDefault = body.isDefault === true;
      if (body.isDefault === undefined && typeAccess.canEdit) {
        await tx
          .select({ id: contentType.resourceId })
          .from(contentType)
          .where(eq(contentType.resourceId, body.contentTypeId as string))
          .for("update");
        const [existingDefault] = await tx
          .select({ id: sheet.resourceId })
          .from(sheet)
          .where(
            and(
              eq(sheet.contentTypeId, body.contentTypeId as string),
              eq(sheet.isDefault, true),
            ),
          )
          .limit(1);
        isDefault = !existingDefault;
      }
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
          isDefault,
          // Unless given, the Edit/Autosave switches start as the content
          // category suggests (characters: on), like generated sheets.
          defaultEditMode:
            body.defaultEditMode ?? switchDefaults.defaultEditMode,
          defaultAutosave:
            body.defaultAutosave ?? switchDefaults.defaultAutosave,
          defaultDisplay: body.defaultDisplay ?? switchDefaults.defaultDisplay,
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
        statusMessage: "ID is already in use",
      });
    throw error;
  }
});
