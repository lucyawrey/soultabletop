import { desc, eq } from "drizzle-orm";
import { apikey } from "../../../database/schema";
import { apiKeyAccess } from "../../../utils/api-key-rules";
import { requireSessionUser } from "../../../utils/auth";
import { useDatabase } from "../../../utils/database";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "List your API keys",
    description:
      "Newest first. Never includes the keys themselves, only `start` (their first characters). Needs a signed-in session; API keys can't call it.",
    // How to send a key, for the whole API reference (see `nuxt.config.ts`).
    $global: {
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "A user API key as a Bearer token",
          },
          apiKeyHeader: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "A user API key in the x-api-key header",
          },
        },
      },
    },
    responses: {
      200: { description: "API key list" },
      401: { description: "Authentication required" },
      403: { description: "Called with an API key" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  const keys = await useDatabase()
    .select()
    .from(apikey)
    .where(eq(apikey.referenceId, user.id))
    .orderBy(desc(apikey.createdAt));
  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    access: apiKeyAccess(key.permissions),
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastRequest,
  }));
});
