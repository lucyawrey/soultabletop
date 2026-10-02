import { describe, expect, it } from "vitest";
import {
  addQuery,
  createRequestTiming,
  runWithRequestTiming,
  formatServerTiming,
  isServerTimingEnabled,
  currentRequestTiming,
} from "./server-timing";

describe("formatServerTiming", () => {
  it("reports database time, query count, and total time", () => {
    const t = createRequestTiming(100);
    addQuery(t, 10.04);
    addQuery(t, 32.1);
    expect(formatServerTiming(t, 180.34)).toBe(
      'db;dur=42.1;desc="2 queries", total;dur=80.3',
    );
  });

  it("uses the singular for one query and handles none", () => {
    const t = createRequestTiming(0);
    expect(formatServerTiming(t, 5)).toBe(
      'db;dur=0;desc="0 queries", total;dur=5',
    );
    addQuery(t, 1);
    expect(formatServerTiming(t, 5)).toContain('desc="1 query"');
  });
});

describe("currentRequestTiming", () => {
  it("has no current timing outside a request", () => {
    expect(currentRequestTiming()).toBeUndefined();
  });

  it("keeps concurrent requests apart", async () => {
    const run = (n: number) => {
      const t = createRequestTiming(0);
      return runWithRequestTiming(t, async () => {
        for (let i = 0; i < n; i++) {
          await new Promise((r) => setTimeout(r, 1));
          addQuery(currentRequestTiming()!, 1);
        }
        return t.queries;
      });
    };
    expect(await Promise.all([run(2), run(5), run(3)])).toEqual([2, 5, 3]);
  });
});

describe("isServerTimingEnabled", () => {
  it("falls back to dev when unset", () => {
    expect(isServerTimingEnabled(undefined, true)).toBe(true);
    expect(isServerTimingEnabled("", false)).toBe(false);
  });
  it("reads explicit values", () => {
    expect(isServerTimingEnabled("1", false)).toBe(true);
    expect(isServerTimingEnabled("true", false)).toBe(true);
    expect(isServerTimingEnabled("0", true)).toBe(false);
  });
});

describe("nested requests", () => {
  it("an inner call sees the outer timing, so the plugin reuses it", () => {
    const outer = createRequestTiming(0);
    runWithRequestTiming(outer, () => {
      expect(currentRequestTiming()).toBe(outer);
    });
  });
});
