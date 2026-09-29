# Soul Tabletop

Nuxt 4 app for managing tabletop RPG Systems, Games, Content Types, Sheets, and Content (characters, NPCs, documents). Postgres (Neon) via Drizzle ORM, better-auth for auth, Nuxt UI v4 frontend, TypeBox request validation. Package manager: `pnpm`. See `TODO.md` for planned work.

## Running commands

- Run node/pnpm through a login shell or pnpm breaks (nvm/corepack mismatch):
  `zsh -ilc 'nvm use >/dev/null 2>&1 && <command>' 2>&1 | grep -v "command not found"`
- Quote bracketed Nuxt paths in the shell: `"app/pages/games/[id].vue"`.
- Verify with `pnpm typecheck && pnpm lint && pnpm test`. **Don't run `pnpm format`** — the user formats code themselves. `pnpm test` runs vitest over `shared/**/*.test.ts` and `server/**/*.test.ts`.
- `.env`'s `DATABASE_URL` contains `&`, so don't `source` it; use `node --env-file=.env` for ad-hoc scripts.
- Typecheck and lint don't catch broken template structure (e.g. a missing closing tag). After template edits, compile the changed templates with `parse`/`compileTemplate` from the pnpm-installed `node_modules/.pnpm/@vue+compiler-sfc@*/node_modules/@vue/compiler-sfc` (works for pages behind auth), or request a public page from the dev server (a 500 body includes the Vite compile error; auth pages just 302 without compiling). The user often has `pnpm dev` running already — check `lsof -iTCP -sTCP:LISTEN -P | grep node` for its port (3000 or 3001) before starting another, and never kill a dev server you didn't start.

## Git workflow

- `main` is branch-protected: never commit to it directly. All changes, including docs, skills, and other agent files, go on a feature branch off an up-to-date `main` and merge through a pull request.
- Name branches after the work (e.g. `remove-base-url`, `sheet-detail-preview`). Changes to agent files like this one can ride along on whatever branch is current without being mentioned in branch names or commit messages; they don't need their own branch.

## Agent files

- Everything for AI agents lives in `.claude/` (this file, `skills/`), except `skills-lock.json`, which the `skills` CLI requires at the repo root. Keep agent files out of the root.
- Add third-party skills with `npx skills add <owner/repo> -a claude-code` (add `-s <skill>` to pick one). `-a claude-code` copies them into `.claude/skills/` and records them in `skills-lock.json`; without it the CLI also installs into `.agents/` for other agents, which we don't use.

## Data model

- Everything user-created is a row in the polymorphic `resource` table (`kind`: `system`, `game`, `contentType`, `sheet`, `content`) plus a per-kind table keyed by `resourceId`. Resources are owned by a user or a group, with extra access via `resourceGrant`.
- Access is computed by `getResourceAccess` in `server/utils/resource-access.ts` (`canRead`/`canEdit`/`canDelete`); use `getResourceAccessOrPublic` on routes that allow anonymous visitors. `requireResourceReader`/`requireResourceEditor` in `server/utils/resource-management.ts` wrap this for single-resource routes.
- List and single-resource GET endpoints return `canEdit`; the UI hides edit/delete when it's false. Keep this pattern for new resource endpoints.
- Characters and Content are both `content` resources, split by the ContentType's `contentCategory` (`playerCharacter` vs everything else) and filtered client-side from `/api/content`. No separate Characters API.
- A ContentType's default Sheet belongs to the ContentType: changing a Sheet's `isDefault` requires edit access to its ContentType, not just the Sheet.
- User profiles have a `username` (slug-formatted, unique, case-insensitive).
- ContentType schemas (`ContentFieldSchema` in `shared/content-schema.ts`, TypeBox mirror `contentTypeSchemaSchema` in `server/utils/api-schemas.ts`; keep both in sync) are stored as `json`, not `jsonb`, to keep field order. Every ContentType has a built-in `name` field that is the Content's resource name: schemas can't define `name`, and a `name` key in submitted Content data is moved to the resource name (`extractDataName`).
- A `content` schema field holds either the ID of existing Content of `contentTypeId` (a reference) or an object of local data validated against that ContentType (with its own `name`); `allow` restricts which. `validateContentData` in `server/utils/content-validation.ts` is async because it checks references and loads referenced schemas.
- Content PATCH accepts `expectedUpdatedAt` and returns 409 if the Content changed since; the returned `updatedAt` can be sent back as the next `expectedUpdatedAt`.
- Code shared by client and server lives in `shared/`; server code imports it with relative paths (drizzle-kit loads `server/database/schema.ts` without Nuxt aliases).
- The Sheet system (markup language, rendering, editing, CSS) is designed in `docs/sheet-system.md`; follow it and update it when a decision changes. Framework-free logic (parser, tag registry, validator, generator, runtime path resolution, CSS scoping) is in `shared/sheet/` with vitest tests; Vue components are in `app/components/sheet/` (`SheetRenderer`, one component per layout tag, `Field`/`FieldInput` for all field tags); the Sheet editor is `/sheets/[id]/edit` (CodeMirror, client-only). When adding a tag, add it to `shared/sheet/registry.ts` and render it in `sheet/Node.vue` (layout) or `sheet/Field.vue` + `sheet/FieldInput.vue` (fields).
- `sheet-*` classes are hooks for Sheet CSS, not Tailwind (ESLint ignores them).

## Conventions

- **Enum values** (Drizzle `pgEnum` and matching TypeBox `Type.Literal`s) are camelCase: single words lowercase (`admin`, `gm`, `general`), multi-word lowerCamelCase (`nonPlayerCharacter`, `playerCharacter`, `contentType`).
- **Slugs**: forms use `useSlugFromName` (auto-generates from Name until the user edits the slug; pass a key like `"username"` for other field names) and show `slugError` inline via `UFormField :error`. `getSlugError` returns `undefined` when valid — never `""`, because `UFormField`'s `error` prop is `[Boolean, String]` and Vue casts `""` to `true`, marking the field as errored.
- **Visibility**: `isPubliclyReadable` is always labeled "Visibility" in the UI, with values **Public** (true) and **Limited** (false) — never "Private", since non-public Resources can still be shared. Use `visibilityLabel()` (`app/utils/visibility.ts`) for text, `<VisibilityBadge>` in list tables (every resource list has a Visibility column), and `<VisibilityField v-model>` in forms, always placed directly after the Slug field. Every resource kind accepts `isPubliclyReadable` on create and update; new Resources default to Limited.
- **API errors in forms**: every form/delete `catch` uses `extractApiErrorMessage()` from `app/utils/api-error.ts` and shows the message in a `UAlert` (inside the modal for delete dialogs).
- **Pages**: each resource kind has a list page (`/things`) and a detail page (`/things/[id]`), all behind `middleware: "auth"`. Follow the existing pages for structure. `/content/[id]` and `/characters/[id]` share `app/components/ContentDetail.vue`. `/` is the sign-in/register form when logged out and a welcome dashboard when logged in, fed by `GET /api/dashboard`: recently updated Games the user or their Groups own or that the user is a member of, and Characters/Content owned by the user or their Groups. Public or merely shared items are deliberately excluded.
- A lone "username"-like text field inside a `<form>` makes Firefox autofill saved logins (it ignores `autocomplete="off"`); see the add-member row in `app/pages/groups/[id].vue`.

## Deployment and URLs

- Hosted on Vercel. There is no base-URL setting: the app's URL comes from each request. Don't reintroduce `BASE_URL`/`BETTER_AUTH_URL` (Better Auth reads both from the environment on its own, so a leftover value anywhere would take effect).
- Better Auth (`server/utils/auth.ts`) uses a per-request `baseURL` with `allowedHosts`: Vercel's system env vars (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_URL`) plus `localhost:*`. A host outside the list fails with "not in the allowed hosts list", so a custom domain that isn't the production domain must be added there. Cookies are `Secure` when `NODE_ENV=production`.
- Scalar's API reference uses the relative server URL `"/"` (`nuxt.config.ts`).
- Manage Vercel env vars with the Vercel CLI (`vercel env ls/add/rm/pull`), not the dashboard. It's installed globally per machine, not as a project dependency: `pnpm add -g vercel` (on the user's main machine pnpm's `global-bin-dir` is `~/.local/bin`, since pnpm is system-installed and `pnpm setup` can't write to `/usr/bin`). Each machine then needs `vercel login` and `vercel link` (interactive; the user runs these, e.g. with `! vercel login` at the Claude prompt). `.vercel/` is gitignored.

## Database and migrations

- `DATABASE_URL` in `.env` points at a live Neon database. For now it holds only disposable test data, so running `pnpm db:migrate` without asking is fine. **Once there is a real production database or real users, confirm before migrating and suggest a backup/review step.**
- Always read generated migrations before applying them:
  - **Renames**: `drizzle-kit generate` stops to ask whether a column was renamed or dropped and recreated, and that prompt can't be answered non-interactively. Hand-write the migration (`ALTER TABLE ... RENAME COLUMN`, rename indexes/constraints), the matching `meta/NNNN_snapshot.json` and `_journal.json` entry, then run `pnpm db:generate` and confirm it reports "No schema changes". See `0005_rename_profile_slug_to_username`.
  - **Enum value changes**: generated migrations drop/recreate the enum type and cast with `USING col::new_enum`, which fails or loses data for rows holding old labels. Insert `UPDATE "table" SET "col" = CASE "col" WHEN 'Old' THEN 'new' ... ELSE "col" END;` after the `SET DATA TYPE text` step and before the final cast. See `0004_cute_bushwacker`.

## Handoff

The user switches computers, and conversations, plans, and auto-memory don't travel, so session state lives here. Keep this section current: rewrite it (don't append a log) when work starts, pauses, or finishes, and whenever the user says they're switching. Keep it short: what's in progress, what's next, and anything half-done, unverified, or waiting on the user. Work a human would recognize as a task (features, bugs, chores) goes in `TODO.md`; this section only points at it. Durable decisions go in the docs or the sections above, not here.

**Last updated:** 2026-09-29

- **State:** on branch `remove-base-url` (committed, not yet pushed). `BASE_URL` is gone from the code, `.env.example`, and the local `.env`: Better Auth uses a per-request `baseURL` with `allowedHosts`, Scalar a relative server URL (see "Deployment and URLs"). Verified locally: sign-in works in dev and against a production build posing as a Vercel deployment, foreign origins get 403, hosts outside the allowlist are refused, and with `NODE_ENV=production` the session cookie is `__Secure-…; Secure; HttpOnly`. The Vercel CLI (60.1.3) is installed globally on this machine; not yet logged in or linked.
- **Next:** the user runs `vercel login` and `vercel link`. Then, with the CLI: list env vars per environment, remove `BASE_URL`/`BETTER_AUTH_URL`, check `BETTER_AUTH_SECRET`/`DATABASE_URL` and that the database has all migrations, push `remove-base-url` (a preview deployment, if the Vercel project is connected to GitHub), check login on the preview, open the PR, and after merge check production (top of `TODO.md`). Then the rest of `TODO.md` in the agreed order: quick wins (nav swap, default-sheet replacement warning) → category split and `document` → `page` rename (a migration; do it before real data) → no raw JSON in create dialogs together with the schema builder → Group-owned resources → Sheet detail preview, file import/export, text/box display → the Soul Tabletop Sheets agent skill last.
- **Loose ends:**
  - The end-to-end API/SSR check scripts used during the Sheet work lived in a machine-local temp folder and are gone. Moving checks like them into the repo as an integration suite (run against the dev server, cleaning up after themselves) was suggested but not done.
  - The test database has 32 leftover `claude-smoke-*@example.invalid` users from those checks (their other data was deleted); removing them takes one SQL statement if the user wants.
  - Unverified in a browser: the Sheet editor's syntax colors in dark mode (CodeMirror's default highlight style is light-only; listed in `TODO.md`).
