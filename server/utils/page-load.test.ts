import { describe, expect, it } from "vitest";
import { isPageLoad } from "./page-load";

const html = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

function headers(values: Record<string, string>) {
  return (name: string) => values[name];
}

describe("isPageLoad", () => {
  it("allows page navigations", () => {
    for (const path of ["/", "/campaigns", "/sheets/soul/basic/edit", "/?redirect=/campaigns"])
      expect(isPageLoad("GET", path, headers({ accept: html }))).toBe(true);
    expect(
      isPageLoad("GET", "/", headers({ accept: html, "sec-fetch-dest": "document" })),
    ).toBe(true);
  });

  it("is GET only", () => {
    for (const method of ["POST", "HEAD", "PATCH", "DELETE", "OPTIONS"])
      expect(isPageLoad(method, "/", headers({ accept: html }))).toBe(false);
  });

  it("skips API calls, build assets, Nuxt's own routes, and payloads", () => {
    for (const path of [
      "/api/profile",
      "/api/auth/get-session",
      "/_nuxt/entry.js",
      "/__nuxt_error",
      "/__nuxt_island/x",
      "/campaigns/_payload.json",
      "/_payload.json?abc",
    ])
      expect(isPageLoad("GET", path, headers({ accept: html }))).toBe(false);
  });

  it("skips requests that don't ask for HTML", () => {
    expect(isPageLoad("GET", "/", headers({}))).toBe(false);
    expect(isPageLoad("GET", "/", headers({ accept: "application/json" }))).toBe(false);
    expect(isPageLoad("GET", "/", headers({ accept: "*/*" }))).toBe(false);
  });

  it("skips prefetches and prerenders", () => {
    expect(isPageLoad("GET", "/", headers({ accept: html, "sec-purpose": "prefetch" }))).toBe(
      false,
    );
    expect(
      isPageLoad("GET", "/", headers({ accept: html, "sec-purpose": "prefetch;prerender" })),
    ).toBe(false);
    expect(isPageLoad("GET", "/", headers({ accept: html, purpose: "prefetch" }))).toBe(false);
  });
});
