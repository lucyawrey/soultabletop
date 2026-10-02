import { describe, expect, it } from "vitest";
import { sessionCacheSetCookies, sessionSetCookiesToForward } from "./session-cache";

describe("sessionCacheSetCookies", () => {
  const name = "__Secure-better-auth.session_data";

  it("keeps only the cache cookie and its chunks", () => {
    const cookies = [
      "__Secure-better-auth.session_token=abc; Path=/; HttpOnly; Secure",
      `${name}=payload; Max-Age=300; Path=/; HttpOnly; Secure`,
      `${name}.0=part; Max-Age=300; Path=/`,
      `${name}.1=part; Max-Age=300; Path=/`,
      "__Secure-better-auth.dont_remember=; Max-Age=0; Path=/",
    ];
    expect(sessionCacheSetCookies(cookies, name)).toEqual(cookies.slice(1, 4));
  });

  it("keeps expiries of the cache cookie", () => {
    const expiry = `${name}=; Max-Age=0; Path=/`;
    expect(sessionCacheSetCookies([expiry], name)).toEqual([expiry]);
  });

  it("doesn't match other names that start the same way", () => {
    expect(
      sessionCacheSetCookies(
        [`${name}x=1`, `${name}.a=1`, "better-auth.session_data=1", "noequals"],
        name,
      ),
    ).toEqual([]);
  });
});

describe("sessionSetCookiesToForward", () => {
  const cacheCookieName = "__Secure-better-auth.session_data";
  const tokenCookieName = "__Secure-better-auth.session_token";
  const names = { cacheCookieName, tokenCookieName };
  const sent = "tok.sig%3D";
  const renewal = `${tokenCookieName}=${sent}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const cache = `${cacheCookieName}=payload; Max-Age=300; Path=/; HttpOnly; Secure`;
  const cacheExpiry = `${cacheCookieName}.1=; Max-Age=0; Path=/`;
  const request = `${tokenCookieName}=${sent}; other=1`;
  const forward = (...args: Parameters<typeof sessionSetCookiesToForward>) =>
    sessionSetCookiesToForward(...args).cookies;

  it("passes on only the cache when the token isn't renewed", () => {
    expect(forward([cache], request, names)).toEqual([cache]);
  });

  it("passes on a renewal of the token the request sent, holding back the new cache", () => {
    expect(forward([renewal, cache, cacheExpiry], request, names)).toEqual([
      renewal,
      cacheExpiry,
    ]);
  });

  it("says when it renewed the token", () => {
    expect(sessionSetCookiesToForward([renewal, cache], request, names).renewedToken).toBe(true);
    expect(sessionSetCookiesToForward([cache], request, names).renewedToken).toBe(false);
  });

  it("writes no cache on a response that already renews the token", () => {
    const already = { ...names, tokenAlreadyRenewed: true };
    expect(forward([cache, cacheExpiry], request, already)).toEqual([cacheExpiry]);
    expect(sessionSetCookiesToForward([cache], request, already).renewedToken).toBe(false);
  });

  it("never passes on a different token", () => {
    const other = renewal.replace(sent, "other.sig");
    expect(forward([other, cache], request, names)).toEqual([cache]);
  });

  it("never passes on a token when the request sent none, or sent two different ones", () => {
    expect(forward([renewal, cache], "other=1", names)).toEqual([cache]);
    expect(forward([renewal, cache], null, names)).toEqual([cache]);
    const twice = `${request}; ${tokenCookieName}=older.sig`;
    expect(forward([renewal, cache], twice, names)).toEqual([cache]);
  });

  it("never passes on a token expiry or a token without a Max-Age", () => {
    const expiry = `${tokenCookieName}=; Max-Age=0; Path=/`;
    const sessionOnly = `${tokenCookieName}=${sent}; Path=/; HttpOnly`;
    for (const cookie of [expiry, sessionOnly])
      expect(forward([cookie, cache], request, names)).toEqual([cache]);
    expect(
      forward([expiry], `${tokenCookieName}=`, names),
    ).toEqual([]);
  });

  it("doesn't take a cookie whose name only starts like the token's", () => {
    const lookalike = `${tokenCookieName}x=${sent}; Max-Age=604800; Path=/`;
    expect(
      forward([lookalike], `${tokenCookieName}x=${sent}`, names),
    ).toEqual([]);
  });
});
