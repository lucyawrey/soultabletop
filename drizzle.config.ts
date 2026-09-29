import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local env vars live in .env.local (Vercel's convention), which drizzle-kit
// doesn't read on its own. Variables already set win, including any from a
// stray .env, which drizzle-kit loads before this runs.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
