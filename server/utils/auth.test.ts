// The session cookie cache as `auth.ts` configures it, run against a real
// Better Auth instance (the app's own config) on an in-memory database, so the
// cookies checked here are the ones Better Auth really writes.
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createEvent, type H3Event } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Better Auth decides on `__Secure-` cookie names from NODE_ENV when it loads,
// so set it before anything imports it (the modules are imported below).
const originalNodeEnv = vi.hoisted(() => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  return original;
});

type Row = Record<string, unknown>;
const memory: Record<string, Row[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
  apikey: [],
};

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: () => memoryAdapter(memory),
}));
// Only `authenticateApiKey` queries through it, for the key's owner (the
// tests have one user when they use a key).
vi.mock("./database", () => ({
  useDatabase: () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => memory.user!.slice(0, 1) }) }),
    }),
  }),
}));
vi.stubGlobal("useRuntimeConfig", () => ({
  betterAuthSecret: "test-secret-for-the-session-cookie-cache-tests",
}));

let authModule: typeof import("./auth");

beforeAll(async () => {
  authModule = await import("./auth");
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  for (const rows of Object.values(memory)) rows.length = 0;
});

const TOKEN = "__Secure-better-auth.session_token";
const CACHE = "__Secure-better-auth.session_data";

function cookieName(setCookie: string) {
  return setCookie.slice(0, setCookie.indexOf("="));
}

// A browser's cookie jar: applies `Set-Cookie` values in order, so a later
// one wins, and `Max-Age=0` deletes.
function applySetCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(";");
    const name = cookieName(pair!);
    const value = pair!.slice(name.length + 1);
    if (/;\s*max-age=0(;|$)/i.test(setCookie)) jar.delete(name);
    else jar.set(name, value);
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function requestEvent(
  jar: Map<string, string>,
  method = "GET",
  url = "/api/profile",
  headers: Record<string, string> = {},
) {
  const request = new IncomingMessage(new Socket());
  request.method = method;
  request.url = url;
  request.headers = { host: "localhost:3000", ...headers };
  if (jar.size) request.headers.cookie = cookieHeader(jar);
  return createEvent(request, new ServerResponse(request));
}

function responseSetCookies(event: H3Event) {
  const value = event.node.res.getHeader("set-cookie");
  return value === undefined ? [] : ([] as string[]).concat(value as string | string[]);
}

function maxAge(setCookie: string) {
  return Number(/;\s*max-age=(\d+)/i.exec(setCookie)?.[1]);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Better Auth's defaults: sessions last 7 days and are extended once a day.
const SESSION_EXPIRES_IN = 7 * 24 * 60 * 60;
const DAY = 24 * 60 * 60 * 1000;

// Makes the session's daily refresh due (it was last extended over a day
// ago) and drops the cache, which expires long before that.
function makeRefreshDue(jar: Map<string, string>) {
  jar.delete(CACHE);
  const dueAt = new Date(Date.now() + 6 * DAY - 60_000);
  for (const session of memory.session!) session.expiresAt = dueAt;
  return dueAt;
}

// Registers a user and returns the browser's cookies after sign-up. A long
// `image` makes the cached session too big for one cookie.
async function signUp({ longImage = false } = {}) {
  const { useAuth } = authModule;
  const result = await useAuth().api.signUpEmail({
    body: {
      name: "Cache Test",
      email: `cache-${memory.user!.length}@example.invalid`,
      password: "a-long-enough-password",
      ...(longImage ? { image: `https://example.invalid/${"x".repeat(6000)}` } : {}),
    },
    headers: new Headers({ host: "localhost:3000" }),
    returnHeaders: true,
  });
  const jar = applySetCookies(new Map(), result.headers.getSetCookie());
  return { jar, userId: result.response.user.id };
}

describe("session cookie cache", () => {
  it("uses the __Secure- names and caches the session on sign-up", async () => {
    const { jar } = await signUp();
    expect([...jar.keys()].sort()).toEqual([CACHE, TOKEN]);
  });

  it("serves a cached session after it is revoked, but requireSessionUser refuses it", async () => {
    const { jar, userId } = await signUp();
    memory.session!.length = 0; // signed out elsewhere

    const cached = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(cached))?.id).toBe(userId);

    const sensitive = requestEvent(jar);
    await expect(authModule.requireSessionUser(sensitive)).rejects.toMatchObject({
      statusCode: 401,
    });
    // The stale cache is cleared in the browser too; the token is left alone.
    const cleared = responseSetCookies(sensitive);
    expect(cleared.length).toBeGreaterThan(0);
    expect(cleared.every((cookie) => cookieName(cookie) === CACHE)).toBe(true);
    expect(applySetCookies(new Map(jar), cleared).has(CACHE)).toBe(false);
  });

  it("requireSessionUser accepts a live session", async () => {
    const { jar, userId } = await signUp();
    expect((await authModule.requireSessionUser(requestEvent(jar))).id).toBe(userId);
  });

  it("refuses a cache cookie without its session token", async () => {
    const { jar } = await signUp();
    jar.delete(TOKEN);
    expect(await authModule.getAuthenticatedUser(requestEvent(jar))).toBeNull();
  });

  it("rewrites the cache from the database without the token cookie when no refresh is due", async () => {
    const { jar, userId } = await signUp();
    jar.delete(CACHE); // the cache has expired
    const session = memory.session![0]!;
    const expiresAt = session.expiresAt as Date;

    const event = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(event))?.id).toBe(userId);
    expect(session.expiresAt).toBe(expiresAt);

    const forwarded = responseSetCookies(event);
    expect(forwarded.map(cookieName)).toEqual([CACHE]);
    // The new cache works on its own: the session row is gone, the cache is not.
    memory.session!.length = 0;
    const next = applySetCookies(new Map(jar), forwarded);
    expect((await authModule.getAuthenticatedUser(requestEvent(next)))?.id).toBe(userId);
  });

  it("passes on the renewed token cookie, alone, when the daily refresh is due", async () => {
    const { jar, userId } = await signUp();
    const token = jar.get(TOKEN);
    const dueAt = makeRefreshDue(jar);

    const event = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(event))?.id).toBe(userId);
    const session = memory.session![0]!;
    expect((session.expiresAt as Date).getTime()).toBeGreaterThan(dueAt.getTime());

    // The same token, with a new full lifetime; the new cache is held back.
    const forwarded = responseSetCookies(event);
    expect(forwarded.map(cookieName)).toEqual([TOKEN]);
    expect(forwarded[0]).toMatch(new RegExp(`^${TOKEN}=${escapeRegExp(token!)};`));
    expect(maxAge(forwarded[0]!)).toBe(SESSION_EXPIRES_IN);
    expect(forwarded[0]).toMatch(/; HttpOnly/i);
    expect(forwarded[0]).toMatch(/; Secure/i);

    // The next request reads the database (no refresh due now) and caches.
    const next = applySetCookies(new Map(jar), forwarded);
    expect(next.get(TOKEN)).toBe(token);
    const after = requestEvent(next);
    expect((await authModule.getAuthenticatedUser(after))?.id).toBe(userId);
    expect(responseSetCookies(after).map(cookieName)).toEqual([CACHE]);
  });

  it("passes the renewed token on from requireSessionUser too", async () => {
    const { jar, userId } = await signUp();
    makeRefreshDue(jar);
    const event = requestEvent(jar, "POST");
    expect((await authModule.requireSessionUser(event)).id).toBe(userId);
    const tokens = responseSetCookies(event).filter((c) => cookieName(c) === TOKEN);
    expect(tokens.map(maxAge)).toEqual([SESSION_EXPIRES_IN]);
  });

  it("renews the cookies on a page load", async () => {
    const { jar } = await signUp();
    const token = jar.get(TOKEN);
    makeRefreshDue(jar);
    const page = requestEvent(jar, "GET", "/campaigns");
    await authModule.renewSessionCookies(page);
    const forwarded = responseSetCookies(page);
    expect(forwarded.map(cookieName)).toEqual([TOKEN]);
    expect(applySetCookies(new Map(jar), forwarded).get(TOKEN)).toBe(token);

    // Without a refresh due, a page load only writes the cache.
    const again = requestEvent(applySetCookies(new Map(jar), forwarded), "GET", "/");
    await authModule.renewSessionCookies(again);
    expect(responseSetCookies(again).map(cookieName)).toEqual([CACHE]);
  });

  it("a page load from a logged-out visitor sets nothing", async () => {
    const page = requestEvent(new Map(), "GET", "/");
    await authModule.renewSessionCookies(page);
    expect(responseSetCookies(page)).toEqual([]);
  });

  it("never passes a token cookie on for a revoked session", async () => {
    const { jar } = await signUp();
    makeRefreshDue(jar);
    memory.session!.length = 0; // revoked (signed out elsewhere)

    const event = requestEvent(jar);
    expect(await authModule.getAuthenticatedUser(event)).toBeNull();
    expect(responseSetCookies(event).some((c) => cookieName(c) === TOKEN)).toBe(false);
  });

  it("a refresh that lands after sign-out can't sign the user back in", async () => {
    const { jar, userId } = await signUp();
    makeRefreshDue(jar);

    // A request starts before sign-out and is refreshed while the session
    // still exists; its response reaches the browser only after sign-out's.
    const inFlight = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(inFlight))?.id).toBe(userId);
    const signOut = await authModule.useAuth().api.signOut({
      headers: new Headers({ host: "localhost:3000", cookie: cookieHeader(jar) }),
      returnHeaders: true,
    });
    expect(memory.session).toEqual([]);
    const browser = applySetCookies(new Map(jar), signOut.headers.getSetCookie());
    expect(browser.size).toBe(0);
    applySetCookies(browser, responseSetCookies(inFlight));
    expect([...browser.keys()]).toEqual([TOKEN]); // the late token came back

    // ...but the session it names is gone, so it signs nobody in.
    expect(await authModule.getAuthenticatedUser(requestEvent(browser))).toBeNull();
    await expect(authModule.requireSessionUser(requestEvent(browser))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("would sign the user back in if the cache came with the late token (why it is held back)", async () => {
    const { jar, userId } = await signUp();
    makeRefreshDue(jar);
    // Better Auth's own response to the refresh: token and cache together.
    const refreshed = await authModule.useAuth().api.getSession({
      headers: new Headers({ host: "localhost:3000", cookie: cookieHeader(jar) }),
      returnHeaders: true,
    });
    const all = refreshed.headers.getSetCookie();
    expect(all.map(cookieName).sort()).toEqual([CACHE, TOKEN]);
    const signOut = await authModule.useAuth().api.signOut({
      headers: new Headers({ host: "localhost:3000", cookie: cookieHeader(jar) }),
      returnHeaders: true,
    });
    const browser = applySetCookies(new Map(jar), signOut.headers.getSetCookie());
    applySetCookies(browser, all);
    // Trusted from the cache, without the database, for up to 5 minutes.
    expect((await authModule.getAuthenticatedUser(requestEvent(browser)))?.id).toBe(userId);
  });

  it("forwards chunked caches in order, expiring stale chunks", async () => {
    const { jar, userId } = await signUp({ longImage: true });
    const chunks = [...jar.keys()].filter((name) => name.startsWith(`${CACHE}.`));
    expect(chunks.length).toBeGreaterThan(1);
    expect(jar.has(CACHE)).toBe(false);

    // A stale cache: one chunk more than needed, none of them valid.
    for (const name of chunks) jar.set(name, "stale");
    jar.set(`${CACHE}.${chunks.length}`, "stale");

    const event = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(event))?.id).toBe(userId);
    const forwarded = responseSetCookies(event);
    expect(forwarded.every((cookie) => cookieName(cookie).startsWith(CACHE))).toBe(true);
    // Better Auth's own order, kept: the unreadable cache expired, the new
    // chunks set, then the chunk no longer needed expired.
    expect(
      forwarded.map((c) => `${cookieName(c)} ${/max-age=0(;|$)/i.test(c) ? "expire" : "set"}`),
    ).toEqual([
      `${CACHE} expire`,
      ...[...chunks].sort().map((name) => `${name} set`),
      `${CACHE}.${chunks.length} expire`,
    ]);

    // Applied in the order sent, the jar ends with exactly the new chunks.
    const next = applySetCookies(new Map(jar), forwarded);
    expect([...next.keys()].filter((name) => name.startsWith(CACHE)).sort()).toEqual(
      [...chunks].sort(),
    );
    memory.session!.length = 0;
    expect((await authModule.getAuthenticatedUser(requestEvent(next)))?.id).toBe(userId);
  });

  it("API key requests get no session cookies, and read-only keys can't write", async () => {
    const { jar, userId } = await signUp();
    const { key } = await authModule.useAuth().api.createApiKey({
      body: { name: "Test key" },
      headers: new Headers({ host: "localhost:3000", cookie: cookieHeader(jar) }),
    });
    makeRefreshDue(jar);

    const read = requestEvent(new Map(), "GET", "/api/profile", { "x-api-key": key });
    expect((await authModule.getAuthenticatedUser(read))?.id).toBe(userId);
    expect(responseSetCookies(read)).toEqual([]);

    const write = requestEvent(new Map(), "POST", "/api/campaign", {
      authorization: `Bearer ${key}`,
    });
    await expect(authModule.getAuthenticatedUser(write)).rejects.toMatchObject({
      statusCode: 403,
    });
    const manage = requestEvent(new Map(), "POST", "/api/profile/api-keys", { "x-api-key": key });
    await expect(authModule.requireSessionUser(manage)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(responseSetCookies(manage)).toEqual([]);
  });
});
