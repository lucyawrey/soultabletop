import { EventEmitter } from "node:events";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { instrumentPg, timeCall } from "./pg-timing";
import {
  createRequestTiming,
  runWithRequestTiming,
  type RequestTiming,
} from "./server-timing";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("timeCall", () => {
  it("times the callback form and passes results on", () => {
    let done = 0;
    let got: unknown;
    const fn = (_q: unknown, cb: (e: null, r: string) => string) => cb(null, "ok");
    timeCall(fn as never, null, ["q", (_e: unknown, r: unknown) => (got = r)], () => done++);
    expect(done).toBe(1);
    expect(got).toBe("ok");
  });

  it("times the promise form and keeps the result and errors", async () => {
    let done = 0;
    const ok = timeCall(() => Promise.resolve(7), null, [], () => done++);
    expect(await ok).toBe(7);
    const bad = timeCall(() => Promise.reject(new Error("boom")), null, [], () => done++);
    await expect(bad).rejects.toThrow("boom");
    expect(done).toBe(2);
  });

  it("passes through a submittable (no then) untouched", () => {
    const submittable = { submit() {} };
    let done = 0;
    expect(timeCall(() => submittable, null, [], () => done++)).toBe(submittable);
    expect(done).toBe(0);
  });
});

// A stub client the real pg Pool can drive: each query takes `queryMs`.
class StubClient extends EventEmitter {
  static queryMs = 5;
  static connectMs = 5;
  _queryable = true;
  connect(cb: (e?: Error) => void) {
    setTimeout(() => cb(), StubClient.connectMs);
  }

  query(...args: unknown[]) {
    const cb = args[args.length - 1];
    const run = () => ({ rows: [] });
    if (typeof cb === "function") {
      setTimeout(() => cb(null, run()), StubClient.queryMs);
      return undefined;
    }
    return wait(StubClient.queryMs).then(run);
  }

  end(cb?: () => void) {
    cb?.();
  }
}
class TestPool extends Pool {}
instrumentPg(TestPool, StubClient);

function makePool(max: number) {
  return new TestPool({ max, Client: StubClient } as never);
}
function inRequest<T>(fn: (t: RequestTiming) => Promise<T>) {
  const t = createRequestTiming(0);
  return runWithRequestTiming(t, () => fn(t));
}

describe("instrumentPg", () => {
  it("counts a Pool.query once, including connection setup", async () => {
    const pool = makePool(2);
    const t = await inRequest(async (t) => {
      await pool.query("select 1");
      return t;
    });
    expect(t.queries).toBe(1);
    // connect (5ms) + query (5ms), measured from the call
    expect(t.dbMs).toBeGreaterThanOrEqual(7);
    await pool.end();
  });

  it("does nothing outside a request", async () => {
    const pool = makePool(1);
    await expect(pool.query("select 1")).resolves.toBeDefined();
    await pool.end();
  });

  it("attributes queued queries to the request that made them", async () => {
    const pool = makePool(1);
    StubClient.queryMs = 20;
    const [a, b] = await Promise.all([
      inRequest(async (t) => {
        await pool.query("select 1");
        return t;
      }),
      inRequest(async (t) => {
        await pool.query("select 2");
        await pool.query("select 3");
        return t;
      }),
    ]);
    StubClient.queryMs = 5;
    expect(a.queries).toBe(1);
    expect(b.queries).toBe(2);
    // B waited for A's connection, and that wait counts as its database time
    expect(b.dbMs).toBeGreaterThan(a.dbMs);
    await pool.end();
  });

  it("times transaction queries on a checked-out client, once, until release", async () => {
    const pool = makePool(1);
    const t = await inRequest(async (t) => {
      const client = await pool.connect();
      await client.query("begin");
      await client.query("commit");
      client.release();
      return t;
    });
    expect(t.queries).toBe(2);
    expect(t.dbMs).toBeGreaterThanOrEqual(12);
    // a later pool query on the reused client counts once, not twice
    const t2 = await inRequest(async (t) => {
      await pool.query("select 1");
      return t;
    });
    expect(t2.queries).toBe(1);
    await pool.end();
  });

  it("propagates query errors", async () => {
    class FailingClient extends StubClient {
      query() {
        return Promise.reject(new Error("bad sql"));
      }
    }
    class FailPool extends Pool {}
    instrumentPg(FailPool, FailingClient);
    const pool = new FailPool({ max: 1, Client: FailingClient } as never);
    const t = createRequestTiming(0);
    await runWithRequestTiming(t, async () => {
      const c = await pool.connect();
      await expect(c.query("x")).rejects.toThrow("bad sql");
      c.release();
    });
    expect(t.queries).toBe(1);
    await pool.end();
  });
});
