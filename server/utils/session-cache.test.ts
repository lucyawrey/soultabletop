import { describe, expect, it } from "vitest";
import { sessionCacheSetCookies } from "./session-cache";

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
