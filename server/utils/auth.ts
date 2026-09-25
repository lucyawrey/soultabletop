import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
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
