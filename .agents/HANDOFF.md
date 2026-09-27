# Soul Tabletop — Agent Handoff

Written 2026-09-27 to hand off from a Claude session (via GitHub Copilot) to a fresh
Claude Pro / Claude Code session. This is a snapshot, not living documentation —
verify against `git log`, the code, and `TODO.md` before trusting specifics.

## Project

`soultabletop` — a Nuxt 4 app for managing tabletop RPG Systems, Games, Content
(character sheets, NPCs, docs, etc.), built on a polymorphic `resource` table
(kind: system/game/contentType/sheet/content) with user-or-group ownership and
a grant-based sharing model. Postgres (Neon) via Drizzle ORM, better-auth for
auth, Nuxt UI v4 for the frontend, TypeBox for request validation.

Repo: `/Users/lucy/Developer/games/soultabletop`, branch `main`, package manager `pnpm`.

## Environment quirks (important)

- Run all node/pnpm commands via:
  `zsh -ilc 'nvm use >/dev/null 2>&1 && <command>' 2>&1 | grep -v "command not found"`
  — a plain non-login shell breaks pnpm here due to nvm/corepack version mismatch.
- Bracketed Nuxt/Nitro filenames (`[id].vue`, `[id].get.ts`) get glob-expanded by
  bash and silently fail unless quoted: `"path/to/[id].get.ts"`.
- User runs `pnpm format` themselves — don't "fix" formatting, only typecheck/lint
  (`pnpm typecheck && pnpm lint`, or `pnpm check` for both plus format:check).
- `DATABASE_URL` in `.env` points at a **live Neon Postgres instance** with real
  data (the user's own account, systems/games created during testing). Treat
  schema migrations with care — see the enum migration note below.

## Conventions established this session

- All enum values (DB `pgEnum` and matching TypeBox `Type.Literal`s) use
  consistent camelCase: single words lowercase (`admin`, `member`, `gm`,
  `player`, `general`, `document`), multi-word values lowerCamelCase
  (`nonPlayerCharacter`, `playerCharacter`, `contentType`). Previously this was
  inconsistent (PascalCase in some enums, `"GM"`/`"GMs"` acronyms in others).
- Slugs: client-side auto-generate from the Name/Display-Name field as the user
  types (`app/utils/slug.ts` `slugify`/`getSlugError`, `app/composables/useSlugFromName.ts`),
  stop auto-updating once the user manually edits the slug, and show an inline
  `UFormField :error` warning immediately if the slug format is invalid (not
  just on submit). Wired into Systems/Games create+edit forms and the signup
  username field in `app/pages/index.vue`.
- API error surfacing: `app/utils/api-error.ts` `extractApiErrorMessage()`
  turns TypeBox validation errors / h3 `createError` responses into a
  human-readable message for form error alerts. Use it in every form's catch
  block.
- Drizzle migrations: `pnpm db:generate` produces enum-change migrations that
  just `CAST col::new_enum` — this **fails or silently loses data** if existing
  rows hold old enum labels. Always hand-check generated enum migrations and
  insert `UPDATE ... SET col = CASE col WHEN 'Old' THEN 'new' ... END` before
  the final cast when the enum's *values* (not just the type) are changing on
  a database that already has rows.
- Future Characters page: no new backend needed — it will just hit the
  existing `/api/content` endpoints filtered client-side (or via query) to
  `contentCategory = "playerCharacter"`, same pattern as how Systems/Games
  pages already filter `/api/content-type` client-side by `systemId`.

## What's built so far

- **Backend**: full CRUD for `system`, `game`, `contentType`, `sheet`,
  `content`, `resourceGrant`, group/game membership — see `server/api/**` and
  `server/utils/{resource-management,resource-access,api-schemas}.ts`.
  Single-resource GET endpoints (`system/[id]`, `game/[id]`) were added this
  session for the new detail pages.
- **Frontend routes**: `/` (auth + dashboard with a Content tab; Characters tab
  is a placeholder), `/systems`, `/systems/[id]`, `/games`, `/games/[id]` — all
  behind `app/middleware/auth.ts`. Nav in `app.vue` shows Games, Characters
  (disabled placeholder), Content (disabled placeholder), Systems when logged in.
- **Auth**: better-auth (`app/utils/auth-client.ts`), `useAuthSession()`
  composable, register flow collects a profile `slug` (username) with the same
  auto-slug + inline-validation UX as Systems/Games.

## Not yet built

- Dedicated `/characters` and `/content` pages (nav links are disabled
  placeholders per explicit instruction — "make the links do nothing for
  unimplemented pages for now").
- Group management UI (backend exists, no frontend).
- Game/Group membership management UI (backend exists — `POST
  /api/game/[id]/members`, no GET-members endpoint yet either).
- See `TODO.md` for additional low-priority items (external copy file,
  dashboard-as-recents-welcome-page, TypeBox-based OpenAPI generation).

## Current state as of this handoff

- Enum casing normalization (this session's task) is **complete and applied**:
  schema, TypeBox schemas, and all server route literals updated; migration
  `server/database/migrations/0004_cute_bushwacker.sql` hand-patched with data
  remap and run against the live Neon DB (`pnpm db:migrate` succeeded).
  `pnpm typecheck && pnpm lint` both clean.
- Nothing else is mid-flight / half-finished at handoff time.
