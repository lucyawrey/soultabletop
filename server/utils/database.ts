import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withVerifiedSsl } from "../database/connection-url";
import * as schema from "../database/schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
let pool: Pool | undefined;

export function useDatabase() {
  const databaseUrl =
    useRuntimeConfig().databaseUrl || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database.");
  }

  pool ??= new Pool({
    connectionString: withVerifiedSsl(databaseUrl),
    ssl: true,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 10_000,
  });
  database ??= drizzle({ client: pool, schema });

  return database;
}
