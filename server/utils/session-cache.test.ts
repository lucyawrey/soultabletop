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

  it("passes on only the cache when the token isn't renewed", () => {
    expect(sessionSetCookiesToForward([cache], request, names)).toEqual([cache]);
  });

  it("passes on a renewal of the token the request sent, holding back the new cache", () => {
    expect(sessionSetCookiesToForward([renewal, cache, cacheExpiry], request, names)).toEqual([
      renewal,
      cacheExpiry,
    ]);
  });

  it("never passes on a different token", () => {
    const other = renewal.replace(sent, "other.sig");
    expect(sessionSetCookiesToForward([other, cache], request, names)).toEqual([cache]);
  });

  it("never passes on a token when the request sent none, or sent two different ones", () => {
    expect(sessionSetCookiesToForward([renewal, cache], "other=1", names)).toEqual([cache]);
    expect(sessionSetCookiesToForward([renewal, cache], null, names)).toEqual([cache]);
    const twice = `${request}; ${tokenCookieName}=older.sig`;
    expect(sessionSetCookiesToForward([renewal, cache], twice, names)).toEqual([cache]);
  });

  it("never passes on a token expiry or a token without a Max-Age", () => {
    const expiry = `${tokenCookieName}=; Max-Age=0; Path=/`;
    const sessionOnly = `${tokenCookieName}=${sent}; Path=/; HttpOnly`;
    for (const cookie of [expiry, sessionOnly])
      expect(sessionSetCookiesToForward([cookie, cache], request, names)).toEqual([cache]);
    expect(
      sessionSetCookiesToForward([expiry], `${tokenCookieName}=`, names),
    ).toEqual([]);
  });

  it("doesn't take a cookie whose name only starts like the token's", () => {
    const lookalike = `${tokenCookieName}x=${sent}; Max-Age=604800; Path=/`;
    expect(
      sessionSetCookiesToForward([lookalike], `${tokenCookieName}x=${sent}`, names),
    ).toEqual([]);
  });
});
