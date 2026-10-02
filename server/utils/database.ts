import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Client, Pool } from "pg";
import { withVerifiedSsl } from "../database/connection-url";
import * as schema from "../database/schema";
import { instrumentPg } from "./pg-timing";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
let pool: Pool | undefined;
let attached = false;

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
  if (!attached) {
    attached = true;
    instrumentPg(Pool, Client);
    // Closes idle connections before a Fluid compute instance is suspended.
    // A no-op outside Vercel, so local development and tests are unaffected.
    attachDatabasePool(pool);
  }
  database ??= drizzle({ client: pool, schema });

  return database;
}
