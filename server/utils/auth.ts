import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type User } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import {
  appendResponseHeader,
  createError,
  getRequestHeaders,
  type H3Event,
} from "h3";
import { user as userTable } from "../database/schema";
import {
  MAX_API_KEY_NAME_LENGTH,
  type ApiKeyAccess,
} from "../../shared/api-keys";
import {
  API_KEY_PREFIX,
  apiKeyAccess,
  isReadOnlyMethod,
  readApiKey,
} from "./api-key-rules";
import { getStoredNameError } from "../../shared/display-name";
import { useDatabase } from "./database";
import {
  SESSION_CACHE_MAX_AGE,
  sessionSetCookiesToForward,
} from "./session-cache";

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

function checkedName<T extends { name?: string }>(data: T): T {
  const name = String(data.name ?? "");
  const error = getStoredNameError(name);
  if (error) throw new APIError("BAD_REQUEST", { message: error });
  return { ...data, name: name.trim() };
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
    // Keeps the session and its user in a signed cookie for 5 minutes, so most
    // requests don't look the session up in the database. The cost: a revoked
    // session (signed out elsewhere, other sessions revoked on a password
    // change) keeps working for up to 5 minutes where its cookie was cached,
    // and the cached `user` (display name, email) can be that old. Nothing
    // that decides access is cached: the site role and group and campaign
    // roles are read from the database on every request. Better Auth's own
    // sensitive routes (change password, revoke sessions) skip the cache, as
    // do `requireSessionUser` and pages that just changed the user.
    session: {
      cookieCache: { enabled: true, maxAge: SESSION_CACHE_MAX_AGE, strategy: "compact" },
    },
    // Display names are validated whichever way they get written (the HTTP
    // update-user route is also off, see `disabledPaths`).
    databaseHooks: {
      user: {
        create: { before: async (data) => ({ data: checkedName(data) }) },
        update: {
          before: async (data) => ({
            data: data.name === undefined ? data : checkedName(data),
          }),
        },
      },
    },
    plugins: [
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        // Enough of the key (after the prefix) to tell keys apart in a list.
        startingCharactersConfig: { charactersLength: API_KEY_PREFIX.length + 6 },
        requireName: true,
        maximumNameLength: MAX_API_KEY_NAME_LENGTH,
        enableMetadata: false,
        keyExpiration: { defaultExpiresIn: null, minExpiresIn: 1, maxExpiresIn: 365 },
        // Off: the plugin's window only resets after a full window with no
        // requests, so any steady script would end up locked out. Sessions
        // have no per-user limit either; a real limiter is in TODO.md.
        rateLimit: { enabled: false },
      }),
    ],
    // The plugin's own HTTP routes are off: keys are managed through
    // `/api/profile/api-keys`, which sets each key's access level (a field
    // the plugin only accepts from the server) and refuses key-authenticated
    // requests. The server-side `auth.api` calls still work.
    // Users are created by `/api/register` (which also makes the profile, and
    // calls `auth.api.signUpEmail` directly) and edited through
    // `/api/profile`, so Better Auth's own routes for that are off.
    disabledPaths: [
      "/sign-up/email",
      "/update-user",
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
    // This response already renews the session token cookie, so it must not
    // write the cache cookie as well (`lookUpSession`).
    sessionTokenRenewed?: boolean;
  }
}

// Only reachable if the plugin's rate or usage limits are turned on.
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

// Looks up the request's session: from the cookie cache when it has a fresh
// one, else from the database (`fresh` always reads the database). When Better
// Auth (re)writes the cache cookie, it is passed on to the response, so the
// next requests hit the cache again. The session token cookie is passed on
// only when Better Auth has just extended the session (once a day) and re-set
// the very token this request sent, so an active user's cookie keeps up with
// the session. A response that renews the token never also writes the cache,
// even from a later lookup in the same request (`requireSessionUser` looks
// twice), so that one response landing after sign-out can't sign the user back
// in; overlapping responses still can, for up to 5 minutes (see
// `sessionSetCookiesToForward` for what is and isn't guaranteed).
async function lookUpSession(event: H3Event, headers: Headers, fresh = false) {
  const auth = useAuth();
  const { headers: responseHeaders, response } = await auth.api.getSession({
    headers,
    query: fresh ? { disableCookieCache: true } : undefined,
    returnHeaders: true,
  });
  const { sessionData, sessionToken } = (await auth.$context).authCookies;
  const { cookies, renewedToken } = sessionSetCookiesToForward(
    responseHeaders.getSetCookie(),
    // No session found: nothing to renew, only cache cookies (expiries).
    response ? headers.get("cookie") : null,
    {
      tokenCookieName: sessionToken.name,
      cacheCookieName: sessionData.name,
      tokenAlreadyRenewed: event.context.sessionTokenRenewed,
    },
  );
  if (renewedToken) event.context.sessionTokenRenewed = true;
  for (const cookie of cookies) appendResponseHeader(event, "set-cookie", cookie);
  return response;
}

// For server-rendered pages: looks the session up on the page request itself,
// so cookies Better Auth renews reach the browser with the page. The page's own
// `/api/...` calls during the render are internal requests whose `Set-Cookie`
// is dropped, so without this the daily extension usually happened where the
// browser never saw it (the first request after a while is a page load).
// Anything that goes wrong is left for the render to deal with.
export async function renewSessionCookies(event: H3Event) {
  const headers = new Headers(getRequestHeaders(event) as HeadersInit);
  if (!headers.get("cookie")) return;
  try {
    await lookUpSession(event, headers);
  } catch {
    // The render looks the session up again and handles it there.
  }
}

// Who is making the request: the session cookie first, else an API key
// (`x-api-key` or `Authorization: Bearer`). Worked out once per request, since
// verifying a key counts against its rate limit.
function resolveRequestAuth(event: H3Event) {
  return (event.context.requestAuth ??= (async () => {
    const headers = new Headers(getRequestHeaders(event) as HeadersInit);
    const session = await lookUpSession(event, headers);
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
// session only, checked in the database rather than the cookie cache, so a
// session revoked in the last few minutes can't create a key that outlives it.
export async function requireSessionUser(event: H3Event) {
  const auth = await resolveRequestAuth(event);
  if (auth.apiKeyAccess)
    throw createError({
      statusCode: 403,
      statusMessage: "API keys can't be used to manage API keys; sign in instead",
    });
  if (!auth.user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  const headers = new Headers(getRequestHeaders(event) as HeadersInit);
  const session = await lookUpSession(event, headers, true);
  if (session?.user.id !== auth.user.id)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return session.user;
}
