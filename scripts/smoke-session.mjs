// Throwaway-user helper for browser and API checks against a running dev server:
//   import { withSmokeUser } from "./scripts/smoke-session.mjs";
//   await withSmokeUser("http://localhost:3000", async ({ cookie, request }) => { ... });
// Registers a `claude-smoke-*@example.invalid` user, signs in, runs the callback
// with the session cookie (a `Cookie` header value; for Playwright, split it
// into cookies on the base URL), and deletes the user afterwards (keys and
// profile cascade). Needs DATABASE_URL for the cleanup: run with
// `node --env-file=.env.local`. Only ever deletes the user it created.
import pg from "pg";

export async function withSmokeUser(baseUrl, callback) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `claude-smoke-${id}@example.invalid`;
  const username = `claude-smoke-${id}`;
  const password = `Smoke-${id}-pw!`;
  const json = { "content-type": "application/json", origin: baseUrl };

  try {
    const register = await fetch(`${baseUrl}/api/register`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ email, password, username }),
    });
    if (!register.ok) {
      throw new Error(`Register failed: ${register.status} ${await register.text()}`);
    }
    const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ email, password }),
    });
    if (!signIn.ok) throw new Error(`Sign-in failed: ${signIn.status} ${await signIn.text()}`);
    const cookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const request = (path, init = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { ...json, ...init.headers, cookie },
      });
    return await callback({ email, username, password, cookie, request });
  } finally {
    const connectionString = process.env.DATABASE_URL?.replace(
      /([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i,
      "$1verify-full",
    );
    if (connectionString) {
      const client = new pg.Client({ connectionString });
      await client.connect();
      try {
        await client.query(`DELETE FROM "user" WHERE email = $1`, [email]);
      } finally {
        await client.end();
      }
    } else {
      console.error(`DATABASE_URL not set: delete ${email} by hand.`);
    }
  }
}
