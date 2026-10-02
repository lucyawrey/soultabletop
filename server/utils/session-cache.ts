// Rules for Better Auth's session cookies as the app's own routes pass them
// on (`lookUpSession` in `auth.ts`), kept apart from `auth.ts` so they can be
// tested without Nuxt.

// How long a cached session is trusted, in seconds: a revoked session or a
// changed name can take this long to show where the cookie was cached.
export const SESSION_CACHE_MAX_AGE = 5 * 60;

// The `Set-Cookie` values for the cache cookie `cacheCookieName` (Better
// Auth splits a long one into `<name>.0`, `<name>.1`, ...). Everything else,
// the session token cookie in particular, is left out.
export function sessionCacheSetCookies(setCookies: string[], cacheCookieName: string) {
  return setCookies.filter((cookie) => isCacheCookie(setCookieName(cookie), cacheCookieName));
}

interface SessionCookieNames {
  tokenCookieName: string;
  cacheCookieName: string;
}

interface ForwardOptions extends SessionCookieNames {
  // The response already carries a token renewal (from an earlier lookup in
  // the same request), so no new cache cookie may join it.
  tokenAlreadyRenewed?: boolean;
}

// The `Set-Cookie` values from a session lookup that the app passes on to the
// browser, and whether one of them renews the session token cookie.
// Normally that is only the cache cookie (`sessionCacheSetCookies`). When
// Better Auth has just extended the session in the database (its daily
// refresh), it also sets the session token cookie again with a new Max-Age.
// That one is passed on only if it re-sets exactly the token the request sent
// (`requestCookieHeader`) with a positive Max-Age, so a response can only
// extend the cookie the browser already has, never hand it another session.
//
// A response that renews the token never also writes the cache (cache
// expiries still go through; the next request writes the cache again). What
// that guarantees: one response that lands after the user signed out can't
// sign them back in, since it brings back only the token, which the server
// rejects because sign-out deleted the session (a token plus a cache would be
// trusted without the database for up to 5 minutes). What it doesn't: two
// overlapping responses that both land after sign-out, one renewing the token
// and one writing the cache, can together sign the user back in for up to 5
// minutes (wherever the cache is trusted; `requireSessionUser` still checks
// the database). Better Auth's own `/api/auth/get-session` sends both in one
// response on the day it extends the session, so this is no complete fix.
// Also, a renewal that lands after the user signed out and straight back in
// replaces the new token cookie with the old, deleted one, which signs them
// out again (it can only ever re-set the token that request sent).
export function sessionSetCookiesToForward(
  setCookies: string[],
  requestCookieHeader: string | null | undefined,
  { tokenCookieName, cacheCookieName, tokenAlreadyRenewed = false }: ForwardOptions,
) {
  const sentTokens = requestCookieValues(requestCookieHeader ?? "", tokenCookieName);
  const tokenRenewal = setCookies.find(
    (cookie) =>
      setCookieName(cookie) === tokenCookieName &&
      setCookieValue(cookie) !== "" &&
      sentTokens.length > 0 &&
      sentTokens.every((sent) => sent === setCookieValue(cookie)) &&
      (maxAgeOf(cookie) ?? 0) > 0,
  );
  const cache = sessionCacheSetCookies(setCookies, cacheCookieName);
  if (!tokenRenewal && !tokenAlreadyRenewed) return { cookies: cache, renewedToken: false };
  const cacheExpiries = cache.filter((cookie) => maxAgeOf(cookie) === 0);
  return {
    cookies: tokenRenewal ? [tokenRenewal, ...cacheExpiries] : cacheExpiries,
    renewedToken: !!tokenRenewal,
  };
}

function isCacheCookie(name: string, cacheCookieName: string) {
  return (
    name === cacheCookieName ||
    new RegExp(`^${escapeRegExp(cacheCookieName)}\\.\\d+$`).test(name)
  );
}

function setCookieName(setCookie: string) {
  return setCookie.slice(0, setCookie.indexOf("=")).trim();
}

// The raw (still encoded) value, as the browser will send it back.
function setCookieValue(setCookie: string) {
  const pair = setCookie.split(";", 1)[0]!;
  return pair.slice(pair.indexOf("=") + 1).trim();
}

function maxAgeOf(setCookie: string) {
  const match = /;\s*max-age=(-?\d+)\s*(?:;|$)/i.exec(setCookie);
  return match ? Number(match[1]) : undefined;
}

// Every raw value the request's `Cookie` header has for `name` (a browser
// can send the same name more than once, e.g. set for different paths).
function requestCookieValues(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes("=") && part.slice(0, part.indexOf("=")).trim() === name)
    .map((part) => part.slice(part.indexOf("=") + 1).trim());
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
