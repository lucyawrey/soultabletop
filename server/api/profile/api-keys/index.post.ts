import { count, eq } from "drizzle-orm";
import { createError, getRequestHeaders } from "h3";
import { apikey } from "../../../database/schema";
import { apiKeyPermissions } from "../../../utils/api-key-rules";
import { createApiKeySchema, parseBody } from "../../../utils/api-schemas";
import { requireSessionUser, useAuth } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";
import { MAX_API_KEYS_PER_USER } from "../../../../shared/api-keys";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Create an API key",
    description:
      "Returns the new key once, in `key`; it can't be shown again. `access` is `read` (refused on any request that changes data) or `full`. `expiresInDays` is 7, 30, 90, 365, or `null` for never. Needs a signed-in session; API keys can't call it.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "access", "expiresInDays"],
            properties: {
              name: { type: "string" },
              access: { type: "string", enum: ["read", "full"] },
              expiresInDays: {
                type: ["integer", "null"],
                enum: [7, 30, 90, 365, null],
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "The new key, including `key` (shown only this once)" },
      400: { description: "Invalid request, or too many keys" },
      401: { description: "Authentication required" },
      403: { description: "Called with an API key" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  const body = await parseBody(event, createApiKeySchema);

  const [existing] = await useDatabase()
    .select({ total: count() })
    .from(apikey)
    .where(eq(apikey.referenceId, user.id));
  if ((existing?.total ?? 0) >= MAX_API_KEYS_PER_USER)
    throw createError({
      statusCode: 400,
      statusMessage: `You can have at most ${MAX_API_KEYS_PER_USER} API keys; delete one first`,
    });

  // Created through the session's headers (Better Auth needs a request to
  // work out the site URL), which makes the plugin treat this as a client
  // call and refuse `permissions`. So the access level is written after; a
  // key whose write failed has no permissions, which counts as read-only.
  const created = await useAuth().api.createApiKey({
    body: {
      name: body.name.trim(),
      expiresIn:
        body.expiresInDays === null ? null : body.expiresInDays * 24 * 60 * 60,
    },
    headers: new Headers(getRequestHeaders(event) as HeadersInit),
  });
  await useDatabase()
    .update(apikey)
    .set({ permissions: JSON.stringify(apiKeyPermissions(body.access)) })
    .where(eq(apikey.id, created.id));
  return {
    id: created.id,
    name: created.name,
    start: created.start,
    access: body.access,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    lastUsedAt: null,
    key: created.key,
  };
});
