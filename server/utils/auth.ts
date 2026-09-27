import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { createError, getRequestHeaders, type H3Event } from "h3";
import { useDatabase } from "./database";

function createAuth() {
  const config = useRuntimeConfig();

  return betterAuth({
    database: drizzleAdapter(useDatabase(), { provider: "pg" }),
    secret: config.betterAuthSecret || undefined,
    baseURL: process.env.BASE_URL || undefined,
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
