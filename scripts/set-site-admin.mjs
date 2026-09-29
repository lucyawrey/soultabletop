// Makes a user a site admin, or with --remove a regular member again. Needs
// database access, which is what makes it safe:
//   pnpm admin:set <username> [--remove]
// DATABASE_URL comes from .env.local, or from the environment (which wins).
import pg from "pg";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const username = args.find((arg) => !arg.startsWith("--"));
if (!username) {
  console.error("Usage: pnpm admin:set <username> [--remove]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

// Same as withVerifiedSsl in server/database/connection-url.ts.
const connectionString = process.env.DATABASE_URL.replace(
  /([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i,
  "$1verify-full",
);
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(
    `UPDATE user_profile SET role = $1, updated_at = now()
     WHERE lower(username) = lower($2)
     RETURNING username, role`,
    [remove ? "member" : "admin", username],
  );
  if (rows.length) console.log(`${rows[0].username} is now a site ${rows[0].role}.`);
  else {
    console.error(`No user with the username "${username}".`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
