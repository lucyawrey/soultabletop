import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request timing: database time and query count, fed by the pg client
 * instrumentation in `database.ts` and written to a `Server-Timing` header by
 * `server/plugins/server-timing.ts`. Only numbers are recorded, never SQL or
 * parameters.
 */
export type RequestTiming = {
  startedAt: number;
  dbMs: number;
  queries: number;
};

const storage = new AsyncLocalStorage<RequestTiming>();

export function createRequestTiming(now = performance.now()): RequestTiming {
  return { startedAt: now, dbMs: 0, queries: 0 };
}

/** Runs `fn` with `timing` as the current request's timing. */
export function runWithRequestTiming<T>(timing: RequestTiming, fn: () => T) {
  return storage.run(timing, fn);
}

/**
 * The current request's timing, if any. Read it when a query starts, not when
 * it finishes: pg's callbacks run in the socket's async context, which
 * belongs to whichever request opened the connection.
 */
export function currentRequestTiming() {
  return storage.getStore();
}

export function addQuery(timing: RequestTiming, durationMs: number) {
  timing.dbMs += durationMs;
  timing.queries += 1;
}

/** `db;dur=42.1;desc="6 queries", total;dur=80.3` */
export function formatServerTiming(timing: RequestTiming, now: number) {
  const total = Math.max(0, now - timing.startedAt);
  const noun = timing.queries === 1 ? "query" : "queries";
  const parts = [
    `db;dur=${round(timing.dbMs)};desc="${timing.queries} ${noun}"`,
    `total;dur=${round(total)}`,
  ];
  return parts.join(", ");
}

function round(ms: number) {
  return Math.round(ms * 10) / 10;
}

/** Truthy values of the `SERVER_TIMING` setting; unset falls back to dev. */
export function isServerTimingEnabled(
  setting: string | undefined,
  isDev: boolean,
) {
  if (setting === undefined || setting.trim() === "") return isDev;
  return ["1", "true", "on", "yes"].includes(setting.trim().toLowerCase());
}
