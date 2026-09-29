// pg treats sslmode=require (and prefer, verify-ca) as verify-full today, and
// warns that pg v9 will switch them to weaker libpq semantics. Asking for
// verify-full explicitly keeps today's behavior and silences the warning.
// Used by the app and drizzle.config.ts; scripts/set-site-admin.mjs repeats it.
export function withVerifiedSsl(url: string) {
  return url.replace(
    /([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i,
    "$1verify-full",
  );
}
