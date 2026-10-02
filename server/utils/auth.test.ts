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
vi.mock("./database", () => ({ useDatabase: () => ({}) }));
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

function requestEvent(jar: Map<string, string>, method = "GET") {
  const request = new IncomingMessage(new Socket());
  request.method = method;
  request.url = "/api/profile";
  request.headers = { host: "localhost:3000", cookie: cookieHeader(jar) };
  return createEvent(request, new ServerResponse(request));
}

function responseSetCookies(event: H3Event) {
  const value = event.node.res.getHeader("set-cookie");
  return value === undefined ? [] : ([] as string[]).concat(value as string | string[]);
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

  it("rewrites the cache from the database but never forwards the token cookie", async () => {
    const { jar, userId } = await signUp();
    jar.delete(CACHE); // the cache has expired
    // Due for Better Auth's daily refresh, which rewrites the token cookie too.
    const session = memory.session![0]!;
    const dueAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 - 60_000);
    session.expiresAt = dueAt;

    const event = requestEvent(jar);
    expect((await authModule.getAuthenticatedUser(event))?.id).toBe(userId);
    expect((session.expiresAt as Date).getTime()).toBeGreaterThan(dueAt.getTime());

    const forwarded = responseSetCookies(event);
    expect(forwarded.map(cookieName)).toEqual([CACHE]);
    // The new cache works on its own: the session row is gone, the cache is not.
    memory.session!.length = 0;
    const next = applySetCookies(new Map(jar), forwarded);
    expect((await authModule.getAuthenticatedUser(requestEvent(next)))?.id).toBe(userId);
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
});
