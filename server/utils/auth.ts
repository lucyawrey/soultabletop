import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { createError, getRequestHeaders, type H3Event } from "h3";
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
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function useAuth() {
  return (auth ??= createAuth());
}

export async function getAuthenticatedUser(event: H3Event) {
  const session = await useAuth().api.getSession({
    headers: new Headers(getRequestHeaders(event) as HeadersInit),
  });

  return session?.user ?? null;
}

export async function requireAuthenticatedUser(event: H3Event) {
  const user = await getAuthenticatedUser(event);

  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  return user;
}
