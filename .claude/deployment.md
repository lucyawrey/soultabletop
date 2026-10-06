# Deployment and database

Moved out of `CLAUDE.md` so it is read only when needed. `CLAUDE.md` keeps the summary and the hard rules.

## Deployment and URLs

- Hosted on Vercel. There is no base-URL setting: the app's URL comes from each request. Don't reintroduce `BASE_URL`/`BETTER_AUTH_URL` (Better Auth reads both from the environment on its own, so a leftover value anywhere would take effect).
- Better Auth (`server/utils/auth.ts`) uses a per-request `baseURL` with `allowedHosts`: Vercel's system env vars (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_URL`) plus `localhost:*`. A host outside the list fails with "not in the allowed hosts list", so a custom domain that isn't the production domain must be added there. Cookies are `Secure` when `NODE_ENV=production`.
- Scalar's API reference uses the relative server URL `"/"` (`nuxt.config.ts`).
- Manage Vercel env vars with the Vercel CLI (`vercel env ls/add/rm/pull`), not the dashboard. It's installed globally per machine, not as a project dependency: `pnpm add -g vercel` (on the Linux machine pnpm's `global-bin-dir` is `~/.local/bin` and `global-dir` `~/.local/share/pnpm/global`, set with `pnpm config set`; on another machine, set them if `pnpm add -g` complains about a missing global bin directory). Each machine then needs `vercel login` and `vercel link` (interactive; the user runs these, e.g. with `! vercel login` at the Claude prompt). `.vercel/` is gitignored.
- The env vars, what they're for, and local setup (`vercel env pull` writes `.env.local`) are documented in `README.md`. All environments currently share one database. Preview/Production values are sensitive and can't be pulled; never print secret values (compare by hash).
- `SERVER_TIMING=1` is set for the Preview environment only (2026-10-01), so preview responses carry a `Server-Timing` header with database time (not yet confirmed on a preview response).
- The Main ruleset requires the `Vercel` status as well as `ci` before a PR can merge.

## Migrations

- In a worktree (no `.env.local` there), `pnpm db:generate` works, but `pnpm db:migrate` fails with an empty `url`. Run drizzle-kit with the main checkout's env instead: `.claude/scripts/agent-run.sh node --env-file=<main checkout>/.env.local node_modules/drizzle-kit/bin.cjs migrate`. Never copy or move `.env.local`.
- The migrations start from one baseline, `0000_baseline` (the database was reset on 2026-10-05). Its end is hand-written: the `owner_readable_id` triggers and the `soul` system group's row, which drizzle-kit doesn't model; a later migration that changes them hand-writes its own steps the same way.
- Always read generated migrations before applying them:
  - **Renames**: `drizzle-kit generate` stops to ask whether a column was renamed or dropped and recreated, and that prompt can't be answered non-interactively. Hand-write the migration (`ALTER TABLE ... RENAME COLUMN`, rename indexes/constraints), the matching `meta/NNNN_snapshot.json` and `_journal.json` entry, then run `pnpm db:generate` and confirm it reports "No schema changes".
  - **Enum value changes**: generated migrations drop/recreate the enum type and cast with `USING col::new_enum`, which fails or loses data for rows holding old labels. Insert `UPDATE "table" SET "col" = CASE "col" WHEN 'Old' THEN 'new' ... ELSE "col" END;` after the `SET DATA TYPE text` step and before the final cast.

