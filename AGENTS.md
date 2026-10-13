# Agent guide

Notes for coding agents (and anyone else) working in this repo. Setup and the project overview are in `README.md`; the Sheet system is specified in `docs/sheet-system.md` and the theme in `docs/theme.md`.

Soul Tabletop is a Nuxt 4 app for managing tabletop RPG Systems, Campaigns, Content Types, Sheets, and Content (characters, NPCs, documents): Postgres (Neon) through Drizzle ORM, better-auth for auth, a Nuxt UI v4 frontend, and TypeBox request validation.

## Commands

- Use the Node version in `.nvmrc` and pnpm through corepack.
- `pnpm check` runs typecheck, lint, and tests, the same as CI. While iterating, run `pnpm exec eslint <files>` and `pnpm exec vitest run <file>`; after editing Sheet templates, also run `pnpm check:templates`.
- Local environment variables are in `.env.local`, not `.env`. Load them with `node --env-file=.env.local`; never `source` the file, and never print secret values (compare by hash).
- `pnpm add` may append `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml`. Don't keep them: pick an older version of the package instead.
- Quote bracketed Nuxt paths in the shell: `"app/pages/campaigns/[id].vue"`.

## Git

- `main` is protected. Every change goes through a pull request, and PRs are squash-merged, so the PR title and description become the commit message: write them like one.
- Run `scripts/check-secrets.sh` before pushing. It checks unpushed commits against `.env.local`'s values and common key patterns.

## Data model

- Everything user-created is a row in the polymorphic `resource` table (`kind`: `system`, `campaign`, `contentType`, `sheet`, `content`) plus a per-kind table keyed by `resourceId`, owned by a user or a group, with extra access through `resourceGrant`. Resources owned by a `system` group are "Official".
- Routes find their user with `getAuthenticatedUser` / `requireAuthenticatedUser` (`server/utils/auth.ts`), never by reading the session themselves. Access is computed by `getResourceAccess` (`server/utils/resource-access.ts`) and its wrappers; every resource `[id]` route calls `resolveResourceRouteId` right after finding the user.
- When an access rule changes, change `getResourceAccess`/`isListed`, the SQL rules in `server/utils/resource-access-sql.ts`, and `resource-list-filter.test.ts` together.
- List and single-resource GET endpoints return `canEdit`; the UI hides edit and delete when it's false.
- List endpoints leave out heavy columns (a resource's `description`, sheet `markup`/`cssStyles`, content type `schema`, content `data`; see `server/utils/list-columns.ts`). Fetch the single resource for them.
- Characters and Content are both `content` resources, split by the content type's `contentCategory`; use `shared/content-categories.ts` rather than repeating category checks.
- `ContentFieldSchema` (`shared/content-schema.ts`) and its TypeBox mirror `contentTypeSchemaSchema` (`server/utils/api-schemas.ts`) stay in sync.
- Code shared by client and server lives in `shared/`. Server code imports it with relative paths, since drizzle-kit loads the schema without Nuxt aliases.
- Sheet formulas live in `shared/sheet/` (`formula.ts`, `formula-functions.ts`, `formula-eval.ts`, `formula-check.ts`) and are computed at render time, never stored. Update `docs/sheet-system.md` when a Sheet decision changes.
- Always read generated migrations before applying them. Column renames and enum value changes need hand-written steps.
- The app's URL comes from each request; there is no base-URL setting. Don't reintroduce `BASE_URL` or `BETTER_AUTH_URL`.

## Conventions

- Enum values are camelCase (`admin`, `nonPlayerCharacter`).
- Components use Nuxt UI's semantic classes (`text-muted`, `bg-elevated`, `border-accented`), never raw palette colors or hex values. Never rename or remove a `--st-*` Sheet token. Read `docs/theme.md` before changing colors, fonts, or component defaults.
- Readable IDs are labeled **"ID"** in the UI and never called "slug". In code, API fields, and docs, `id` alone means the UUID.
- Visibility is **Public** or **Limited**, never "Private".
- Form and delete errors use `extractApiErrorMessage()` (`app/utils/api-error.ts`) in a `UAlert`.
- Resource names are lowercase mid-sentence ("Could not save sheet.") and Title Case in labels, titles, and buttons ("New Sheet").
- Markdown uses relative links, never `[[wikilinks]]`, so links work both on GitHub and in the Obsidian vault.

## User-facing copy

Agents write only functional and technical text: labels, buttons, hints, short status and error messages, one-line empty states, and technical docs. The team writes everything that says what Soul Tabletop is or speaks to its users (descriptions, taglines, welcome and onboarding text, announcements), and all art. Team copy lives in `content/copy.yml`. Where team copy is needed, leave a marked placeholder; never rewrite copy the team wrote.
