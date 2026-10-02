import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Client, Pool } from "pg";
import { withVerifiedSsl } from "../database/connection-url";
import * as schema from "../database/schema";
import { addQuery, currentRequestTiming } from "./server-timing";

const instrumented = Symbol.for("soultabletop.pg-query-timing");

/**
 * Times every query for the request timing in `server-timing.ts` by wrapping
 * `Client.prototype.query`, which every path goes through: pool queries,
 * transactions, and Better Auth's (same drizzle instance). Only the duration
 * is kept, never the SQL or parameters, and it is done once per process.
 */
function instrumentQueries() {
  const proto = Client.prototype as unknown as Record<symbol, unknown> & {
    query: (...args: unknown[]) => unknown;
  };
  if (proto[instrumented]) return;
  proto[instrumented] = true;

  const original = proto.query;
  proto.query = function (this: unknown, ...args: unknown[]) {
    const timing = currentRequestTiming();
    if (!timing) return original.apply(this, args);
    const start = performance.now();
    const done = () => addQuery(timing, performance.now() - start);
    const last = args[args.length - 1];
    if (typeof last === "function") {
      args[args.length - 1] = (...cbArgs: unknown[]) => {
        done();
        return (last as (...a: unknown[]) => unknown)(...cbArgs);
      };
      return original.apply(this, args);
    }
    const result = original.apply(this, args);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      (result as Promise<unknown>).then(done, done);
    }
    return result;
  };
}

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
    instrumentQueries();
    // Closes idle connections before a Fluid compute instance is suspended.
    // A no-op outside Vercel, so local development and tests are unaffected.
    attachDatabasePool(pool);
  }
  database ??= drizzle({ client: pool, schema });

  return database;
}
