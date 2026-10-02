import { addDbTime, addQuery, currentRequestTiming } from "./server-timing";

type AnyFn = (...args: unknown[]) => unknown;
type Proto = Record<string | symbol, unknown>;

const patched = Symbol.for("soultabletop.pg-timing.patched");
const checkedOut = Symbol.for("soultabletop.pg-timing.checkedOut");

/**
 * Feeds the request timing (`server-timing.ts`) from pg, recording only
 * durations, never SQL or parameters. Two paths cover every query:
 *
 * - `Pool.query` (most queries): timed from the call, so pool wait and
 *   new-connection setup are included. The timing is read at call time, since
 *   pg-pool runs the inner `client.query` from a queue callback that can sit in
 *   another request's async context (and pg's callbacks run in the socket's).
 * - A client checked out with promise-form `pool.connect()` (transactions):
 *   its `query` calls are timed until it is released, and the connect wait is
 *   added to database time without counting as a query.
 *
 * `Pool.query`'s own use of `connect(callback)` and the client's `query` is
 * not counted again. Patches each prototype once.
 */
export function instrumentPg(PoolClass: { prototype: object }, ClientClass: { prototype: object }) {
  const pool = PoolClass.prototype as Proto;
  const client = ClientClass.prototype as Proto;
  if (Object.hasOwn(pool, patched)) return;
  pool[patched] = true;

  const poolQuery = pool.query as AnyFn;
  pool.query = function (this: unknown, ...args: unknown[]) {
    const timing = currentRequestTiming();
    if (!timing) return poolQuery.apply(this, args);
    const start = performance.now();
    const done = () => addQuery(timing, performance.now() - start);
    return timeCall(poolQuery, this, args, done);
  };

  const poolConnect = pool.connect as AnyFn;
  pool.connect = function (this: unknown, ...args: unknown[]) {
    const timing = currentRequestTiming();
    // Callback form is pg-pool's own (inside `query`); only user checkouts count.
    if (!timing || typeof args[args.length - 1] === "function") {
      return poolConnect.apply(this, args);
    }
    const start = performance.now();
    return (poolConnect.apply(this, args) as Promise<Proto>).then((c) => {
      addDbTime(timing, performance.now() - start);
      c[checkedOut] = true;
      const release = c.release as AnyFn;
      c.release = function (this: unknown, ...a: unknown[]) {
        c[checkedOut] = false;
        return release.apply(this, a);
      };
      return c;
    });
  };

  const clientQuery = client.query as AnyFn;
  client.query = function (this: Proto, ...args: unknown[]) {
    const timing = this[checkedOut] ? currentRequestTiming() : undefined;
    if (!timing) return clientQuery.apply(this, args);
    const start = performance.now();
    const done = () => addQuery(timing, performance.now() - start);
    return timeCall(clientQuery, this, args, done);
  };
}

/** Calls `fn`, running `done` when it finishes (callback or promise form). */
export function timeCall(fn: AnyFn, self: unknown, args: unknown[], done: () => void) {
  const last = args[args.length - 1];
  if (typeof last === "function") {
    args[args.length - 1] = (...cbArgs: unknown[]) => {
      done();
      return (last as AnyFn)(...cbArgs);
    };
    return fn.apply(self, args);
  }
  const result = fn.apply(self, args);
  if (result && typeof (result as PromiseLike<unknown>).then === "function") {
    // A separate branch: it must not change what the caller gets back, and
    // `done` as the rejection handler keeps this branch from being unhandled.
    (result as Promise<unknown>).then(done, done);
  }
  return result;
}
