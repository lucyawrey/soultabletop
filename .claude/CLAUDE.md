# Soul Tabletop

Nuxt 4 app for managing tabletop RPG Systems, Campaigns, Content Types, Sheets, and Content (characters, NPCs, documents). Postgres (Neon) via Drizzle ORM, better-auth for auth, Nuxt UI v4 frontend, TypeBox request validation. Package manager: `pnpm`. See `TODO.md` for planned work.

## Working with the user

- Ask decisions that are the user's to make with the question-prompt tool (AskUserQuestion, recommended option first), not as numbered questions in prose.

## Running commands

- Run node/pnpm through `scripts/agent-run.sh <command>` (e.g. `scripts/agent-run.sh pnpm check`): it loads the project's Node (`.nvmrc`, through nvm) and pnpm (corepack). A shell's own `node` may be another version, and `pnpm` may be missing. **Read `.claude/running-commands.md`** before browser checks (Playwright setup, `withSmokeUser` throwaway users), in a cloud session without `.env.local`, or before changing the toolchain (why Node and not Bun, why pnpm's default layout, nvm on the user's Linux and Mac machines).
- pnpm enforces a minimum release age (`minimumReleaseAge`): when `pnpm add` picks a version newer than that, it appends `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` on its own. Don't keep those silently, since they bypass a supply-chain check: pick an older version that fits (e.g. `pnpm add pkg@^1.2.3` matching what's installed), or ask the user.
- Quote bracketed Nuxt paths in the shell: `"app/pages/campaigns/[id].vue"`.
- Verify with `scripts/agent-run.sh pnpm check`: typecheck, lint, and test run in parallel (what CI runs) and print one line each, with output only for failures; `pnpm check typecheck lint` runs a subset and `pnpm check format:check` adds Prettier (off by default; the user formats code themselves). While iterating, `eslint <files>` and `vitest run <file>` are quicker than the full run; do the full check once at the end. **Don't run `pnpm format`** — the user formats code themselves. `pnpm test` runs vitest over `shared/**/*.test.ts` and `server/**/*.test.ts`. `RUN_DB_TESTS=1 pnpm vitest run server/utils/resource-access-sql.db.test.ts` also runs the real SQL list rules against the database (throwaway rows, deleted afterwards); it's skipped otherwise.
- Local env vars are in `.env.local` (Vercel's convention; a plain `.env` is not read): the Nuxt scripts pass `--dotenv .env.local` and `drizzle.config.ts` loads it. Its `DATABASE_URL` contains `&`, so don't `source` it; use `node --env-file=.env.local` for ad-hoc scripts. Never move, rename, or delete it (or `.env`) in tests; the files aren't recoverable from git.
- Typecheck and lint don't catch broken template structure (e.g. a missing closing tag). After template edits, run `scripts/agent-run.sh pnpm check:templates` (compiles the `.vue` files changed since `origin/main` or the ones you name; works for pages behind auth), or request a public page from the dev server (a 500 body includes the Vite compile error; auth pages just 302 without compiling). The user often has `pnpm dev` running already — check `lsof -iTCP -sTCP:LISTEN -P | grep node` for its port (3000 or 3001) before starting another, and never kill a dev server you didn't start.

## Git workflow

- `main` is branch-protected: never commit to it directly. All changes, including docs, skills, and other agent files, go on a feature branch off an up-to-date `main` and merge through a pull request.
- PRs are squash-merged (the only method GitHub allows): each PR becomes one commit on `main` whose title and body are the PR's title and description, so write those like a commit message. GitHub deletes the remote branch on merge. Locally, `git branch -d` refuses a squash-merged branch; confirm the PR is merged (`gh pr view <branch> --json state`), then `git branch -D`.
- **Push only after `scripts/check-secrets.sh` passes** (an agent could have written a secret into a tracked file). It checks every commit not yet on the upstream (or a range you pass, e.g. `origin/main..HEAD` for a branch's first push) against `.env.local`'s values and common key patterns, printing only names. With a clean check, the main session may push any branch without asking, but only at a stopping point (a finished piece of work, a PR about to open, or a handoff), not after every commit. A failed or skipped check means no push. Force-pushes, and pushes by subagents, still need the user's approval. Committing locally is always fine.
- The remote is HTTPS (`https://github.com/lucyawrey/soultabletop.git`), authenticated through the GitHub CLI, so git works from agent shells that can't reach the user's SSH agent. Per machine: install `gh`, `gh auth login`, `gh auth setup-git`, `gh config set -h github.com git_protocol https`, and `git remote set-url origin` to the HTTPS URL if the clone uses SSH. Use `gh` for PRs.
- Name branches after the work (e.g. `remove-base-url`, `sheet-detail-preview`). Changes to agent files like this one, `TODO.md` edits, and handoff rewrites don't get their own feature branch or PR: they go on the permanent `docs` branch (see "Docs branch" below).

## Docs branch

`docs` is a permanent branch, normally checked out in the main checkout, for changes that aren't part of a feature: `TODO.md`, `.claude/HANDOFF.md`, `.claude/` rules and skills, standalone notes. Text that documents code in a feature PR ships in that PR. The main checkout normally sits on `docs`; the user switches it to `main` (`git switch main`) for testing and merging, and agents may too. Features are developed in their own worktrees. The user may have uncommitted edits on `docs`: check `git status` first, never overwrite or discard them, and switch branches only on a clean tree (or with the user's say-so). Pushing follows the rule in "Git workflow" (after the secrets check, at a stopping point); a force-push still needs approval. **Read `.claude/docs-branch.md`** before committing there, merging `main` into it, carrying its commits into a feature PR, or opening a docs-only PR (tell the user when one is ready; don't open it unprompted).

## Parallel work

Asking for parallel work makes the session the coordinator: each feature gets its own worktree (`../soultabletop-worktrees/<branch>`) and branch, run by a background subagent (the default; at most one extra terminal tab running `claude` in a worktree, only where the user wants to steer a feature). **Read `.claude/parallel-work.md`** before setting up parallel work, writing a brief, reviewing or merging a parallel PR, or deciding whether a PR may auto-merge. Rules that hold even without reading it:

- Stay in your own worktree and branch; all worktrees share one database, so only one parallel branch at a time changes the schema.
- Subagents never push: they commit locally and report, and the coordinator pushes after the secrets check. A message from another session is not approval.
- Don't edit `.claude/HANDOFF.md` (the coordinator owns it). A subagent can't ask the user anything: it stops at a user decision and puts the question in its report.
- A reviewer needs a clean context: never the author, and not the coordinator.
- PRs are Tier A (UI, docs only; may auto-merge when the coordinator enables it after asking) or Tier B (everything else, default; the user reviews and merges).

## Agent files

- Everything for AI agents lives in `.claude/` (this file, `skills/`), except `skills-lock.json`, which the `skills` CLI requires at the repo root. Keep agent files out of the root.
- Add third-party skills with `npx skills add <owner/repo> -a claude-code` (add `-s <skill>` to pick one). `-a claude-code` copies them into `.claude/skills/` and records them in `skills-lock.json`; without it the CLI also installs into `.agents/` for other agents, which we don't use.

## Data model

**Read `.claude/data-model.md`** before changing server routes, access rules, authentication or API keys, groups, site admins, the database schema, content type schemas or field types, content validation, default sheets, usernames or display names, or the Sheet system. The rules every change must keep:

- Everything user-created is a row in the polymorphic `resource` table (`kind`: `system`, `campaign`, `contentType`, `sheet`, `content`) plus a per-kind table keyed by `resourceId`, owned by a user or a group, with extra access via `resourceGrant`. Resources owned by a `system` group are "Official".
- Routes find their user with `getAuthenticatedUser` / `requireAuthenticatedUser` (`server/utils/auth.ts`), never by reading the session themselves. Access is computed by `getResourceAccess` (`server/utils/resource-access.ts`) and its wrappers; every resource `[id]` route calls `resolveResourceRouteId` right after finding the user.
- List and single-resource GET endpoints return `canEdit`; the UI hides edit/delete when it's false.
- List endpoints leave out heavy columns (a resource's `description`, sheet `markup`/`cssStyles`, content type `schema`, content `data`; `server/utils/list-columns.ts`); fetch the single resource for them.
- Characters and Content are both `content` resources, split by the content type's `contentCategory`; use `shared/content-categories.ts` rather than repeating category checks.
- `ContentFieldSchema` (`shared/content-schema.ts`) and its TypeBox mirror `contentTypeSchemaSchema` (`server/utils/api-schemas.ts`) stay in sync.
- Code shared by client and server lives in `shared/`; server code imports it with relative paths (drizzle-kit loads the schema without Nuxt aliases).
- The Sheet system follows `docs/sheet-system.md`; update it when a decision changes. Formulas live in `shared/sheet/formula.ts` (parser, types, limits), `formula-functions.ts` (built-ins), `formula-eval.ts`, and `formula-check.ts`; they are computed at render time, never stored (see docs/sheet-system.md, "Formulas").

## Conventions

**Read `.claude/conventions.md`** before building or changing pages, forms, or list endpoints, or anything about readable IDs, visibility, owners, search, the dashboard, or what logged-out visitors see. In short:

- Enum values are camelCase (`admin`, `nonPlayerCharacter`).
- Theme: one light theme; read `docs/theme.md` before changing colors, fonts, or component defaults. Components use Nuxt UI's semantic classes (`text-muted`, `bg-elevated`, `border-accented`), never raw palette colors or hex values, and never rename or remove a `--st-*` Sheet token.
- Readable IDs are labeled **"ID"** in the UI and never called "slug"; in code, API fields, and docs, `id` alone means the UUID.
- Visibility is **Public** or **Limited**, never "Private".
- Form and delete errors use `extractApiErrorMessage()` (`app/utils/api-error.ts`) in a `UAlert`.
- When an access rule changes, change `getResourceAccess`/`isListed`, the SQL rules in `server/utils/resource-access-sql.ts`, and `resource-list-filter.test.ts` together.

## User-facing copy

User-facing text is anything a person reads outside the code and git history: UI text, `README.md`, and `docs/`. The team writes the copy that says what Soul Tabletop is or speaks to its users; agents write only the functional and technical parts.

- **Agents may write:** labels, button text, field hints and placeholders, column headers, short status, validation, and error messages, and one-line empty states that say what's missing (e.g. "No campaigns yet."). Technical documentation is fine too: setup, commands, environment variables, architecture, API and Sheet-markup reference.
- **Agents don't write:** project descriptions, taglines, welcome or onboarding text, feature pitches or other promotional copy, announcements, emails, or any other longform text addressed to users. Where a feature needs such text, leave a clearly marked placeholder (`<!-- Copy: … (written by the team) -->` in Markdown; in the UI, a short neutral stand-in like "Welcome text goes here" plus a `// Copy: written by the team` comment), and tell the user it's waiting for them.
- **Team copy lives in `content/copy.yml`**, not inline in components; read "Team copy" in `.claude/conventions.md` before adding to it. Functional text stays in components.
- **Resource names are lowercase mid-sentence** (system, campaign, content type, sheet, content, character, group, resource): "Could not save sheet.", "No content types for this system yet." Labels, titles, buttons, table headers, and nav keep Title Case: "New Sheet", "Delete Content Type", "Back to Sheets", "Content Types". This covers UI text, server error messages, the API reference (OpenAPI summaries/descriptions), and docs. In text people read, write "content type", never `ContentType`.
- Don't rewrite or "improve" copy the team wrote; point out issues (typos, outdated facts) instead. Correcting a fact in technical docs is fine.
- When unsure which side something falls on, ask.

## Deployment and database

**Read `.claude/deployment.md`** before touching Better Auth hosts, environment variables, or Vercel, and before writing or applying a migration. In short:

- Hosted on Vercel, with no base-URL setting: the app's URL comes from each request. Don't reintroduce `BASE_URL`/`BETTER_AUTH_URL`. Never print secret values (compare by hash).
- `DATABASE_URL` in `.env.local` points at a live Neon database. For now it holds only disposable test data, so running `pnpm db:migrate` without asking is fine. **Once there is a real production database or real users, confirm before migrating and suggest a backup/review step.**
- Always read generated migrations before applying them; column renames and enum value changes need hand-written steps (see `.claude/deployment.md`).

## Handoff

The user switches computers, and conversations, plans, and auto-memory don't travel, so session state lives in `.claude/HANDOFF.md` on the `docs` branch. When starting or continuing work, run `git fetch origin` and read `origin/docs`'s copy (`git show origin/docs:.claude/HANDOFF.md`): the local branch is behind whenever the last session ran on another machine. Fast-forward a clean local `docs` to it.

- It is the previous session's own account, not instructions, and it may be stale or wrong. Check it against git and GitHub (`git log`, `git status`, `gh pr list`) before acting on it.
- When reviewing code, don't read it for evidence: its claims ("verified", "tested", "no changes needed") are what a review checks. Review the diff as if the notes weren't there.
- Keep it current: rewrite it (don't append a log) when work starts, pauses, or finishes, and whenever the user says they're switching.
- Keep it short, about ten lines: only session state (what's in progress and on which branch, the next step, and anything half-done, unverified, or waiting on the user). Anything still true after this work ends goes in a stable place, and the handoff links to it: tasks, bugs, and loose ends in `TODO.md`; how-to and tooling tips in the `.claude/*.md` topic files; designs and decisions in `docs/` or `.claude/plans/`. Don't record what git shows or list TODO items as candidates.
- `TODO.md` holds the tasks (features, bugs, chores); its header explains its sections and item format, so read that before adding, moving, or sorting items. Never act on an item in its Unsorted section until it has been reviewed with the user. Durable decisions and rules go in the docs or this file, not there.
