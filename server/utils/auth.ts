import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type User } from "better-auth";
import { eq } from "drizzle-orm";
import { createError, getRequestHeaders, type H3Event } from "h3";
import { user as userTable } from "../database/schema";
import type { ApiKeyAccess } from "../../shared/api-keys";
import {
  API_KEY_PREFIX,
  apiKeyAccess,
  isReadOnlyMethod,
  readApiKey,
} from "./api-key-rules";
import { useDatabase } from "./database";

// Hosts the app may be served from. Better Auth builds its URLs (and checks
// request origins) from each request's host, if it matches one of these, so
// no base URL has to be configured per environment. On Vercel, the system
// env vars give the production domain and this deployment's URLs (hosts
// without protocol). localhost is always allowed so dev and `pnpm preview`
// work; Vercel never routes requests with that host to a deployment.
function allowedHosts() {
  const vercelHosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ].filter((host): host is string => !!host);
  return [...vercelHosts, "localhost:*", "127.0.0.1:*"];
}

function createAuth() {
  const config = useRuntimeConfig();

  return betterAuth({
    database: drizzleAdapter(useDatabase(), { provider: "pg" }),
    secret: config.betterAuthSecret || undefined,
    // Protocol defaults to "auto": http for localhost, https otherwise.
    baseURL: { allowedHosts: allowedHosts() },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        // Enough of the key (after the prefix) to tell keys apart in a list.
        startingCharactersConfig: { charactersLength: API_KEY_PREFIX.length + 6 },
        requireName: true,
        enableMetadata: false,
        keyExpiration: { defaultExpiresIn: null, minExpiresIn: 1, maxExpiresIn: 365 },
        // Per key. The plugin's default (10 a day) would stop scripts cold.
        rateLimit: { enabled: true, timeWindow: 60 * 1000, maxRequests: 600 },
      }),
    ],
    // The plugin's own HTTP routes are off: keys are managed through
    // `/api/profile/api-keys`, which sets each key's access level (a field
    // the plugin only accepts from the server) and refuses key-authenticated
    // requests. The server-side `auth.api` calls still work.
    disabledPaths: [
      "/api-key/create",
      "/api-key/get",
      "/api-key/list",
      "/api-key/update",
      "/api-key/delete",
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function useAuth() {
  return (auth ??= createAuth());
}

interface RequestAuth {
  user: User | null;
  // Set when the request was authenticated by an API key, not a session.
  apiKeyAccess?: ApiKeyAccess;
}

declare module "h3" {
  interface H3EventContext {
    requestAuth?: Promise<RequestAuth>;
  }
}

const RATE_LIMIT_CODES = ["RATE_LIMITED", "RATE_LIMIT_EXCEEDED", "USAGE_EXCEEDED"];

// Checks an API key and loads its user. A key that is sent but doesn't work
// is an error, never a quiet fall back to logged out, so scripts notice.
// `headers` only let Better Auth work out the site URL (there is no fixed
// base URL); verifying never reads a session from them.
async function authenticateApiKey(
  key: string,
  headers: Headers,
): Promise<RequestAuth> {
  const result = await useAuth().api.verifyApiKey({ body: { key }, headers });
  if (!result.valid || !result.key) {
    const code = result.error?.code ?? "";
    if (RATE_LIMIT_CODES.includes(code))
      throw createError({
        statusCode: 429,
        statusMessage: "API key rate limit reached, try again shortly",
      });
    throw createError({
      statusCode: 401,
      statusMessage:
        code === "KEY_EXPIRED" ? "API key has expired" : "Invalid API key",
    });
  }
  const [owner] = await useDatabase()
    .select()
    .from(userTable)
    .where(eq(userTable.id, result.key.referenceId))
    .limit(1);
  if (!owner)
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  return { user: owner, apiKeyAccess: apiKeyAccess(result.key.permissions) };
}

// Who is making the request: the session cookie first, else an API key
// (`x-api-key` or `Authorization: Bearer`). Worked out once per request, since
// verifying a key counts against its rate limit.
function resolveRequestAuth(event: H3Event) {
  return (event.context.requestAuth ??= (async () => {
    const headers = new Headers(getRequestHeaders(event) as HeadersInit);
    const session = await useAuth().api.getSession({ headers });
    if (session) return { user: session.user };
    const key = readApiKey(headers);
    return key ? await authenticateApiKey(key, headers) : { user: null };
  })());
}

// The signed-in user, or null for a logged-out visitor. Read-only API keys
// are refused here on any request that changes data, which covers every
// route, since all of them find their user through this function.
export async function getAuthenticatedUser(event: H3Event) {
  const auth = await resolveRequestAuth(event);
  if (auth.apiKeyAccess === "read" && !isReadOnlyMethod(event.method))
    throw createError({
      statusCode: 403,
      statusMessage: "This API key is read-only",
    });
  return auth.user;
}

export async function requireAuthenticatedUser(event: H3Event) {
  const user = await getAuthenticatedUser(event);

  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  return user;
}

// For routes a key must never reach (managing API keys): a signed-in
// session only.
export async function requireSessionUser(event: H3Event) {
  const auth = await resolveRequestAuth(event);
  if (auth.apiKeyAccess)
    throw createError({
      statusCode: 403,
      statusMessage: "API keys can't be used to manage API keys; sign in instead",
    });
  if (!auth.user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return auth.user;
}
