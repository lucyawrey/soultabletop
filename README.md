# Soul Tabletop

<!-- Copy: project description (written by the team) -->

## Tech stack

[Nuxt 4](https://nuxt.com) with [Nuxt UI](https://ui.nuxt.com), Postgres on
[Neon](https://neon.tech) through [Drizzle ORM](https://orm.drizzle.team),
[Better Auth](https://www.better-auth.com) for accounts, and
[TypeBox](https://github.com/sinclairzx81/typebox) for API request validation.
Hosted on [Vercel](https://vercel.com).

## Requirements

- Node.js 24 (see `.nvmrc`)
- [pnpm](https://pnpm.io)

## Setup

Install the dependencies, then set up the environment variables (see
[Local setup](#local-setup)):

```bash
pnpm install
```

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Environment variables

| Variable             | Used for                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`       | Pooled Neon Postgres connection string (app and `drizzle-kit`)           |
| `BETTER_AUTH_SECRET` | Signs sessions and tokens; generate with `openssl rand -base64 32`       |
| `EMAIL_API_KEY`      | Resend API key (reserved for email features; not read by the code yet)   |
| `SERVER_TIMING`      | Optional, read at runtime. `1`, `true`, `on`, or `yes` adds a `Server-Timing` response header (database time, query count, total time); `0` turns it off. On in `pnpm dev`, off in production unless set. Error responses and redirects never carry it |
| `SOUL_TABLETOP_API_KEY` | Optional, local only, and not read by the app: your own API key (create one on `/profile`), for development scripts that call the API as you, sent in the `x-api-key` header. Not in Vercel, so add it to `.env.local` by hand, and again after `vercel env pull`, which rewrites the file |

The app's variables are server-only and never sent to the browser. The first three are set in all
three Vercel environments (Production, Preview, Development). While the app is
a prototype, every environment, including local development, uses the same
Neon database.

### Local setup

Install the [Vercel CLI](https://vercel.com/docs/cli) globally (`pnpm add -g
vercel`), then link this folder to the Vercel project and pull the Development
values into `.env.local`:

```bash
vercel login
vercel link
vercel env pull
```

Local variables live in `.env.local`, following Vercel's convention: the
`dev`, `build`, and `preview` scripts pass `--dotenv .env.local` to Nuxt, and
`drizzle.config.ts` loads it for `drizzle-kit`. A plain `.env` is not read. The
pulled file also contains a short-lived `VERCEL_OIDC_TOKEN`, which the app
doesn't use. Without Vercel access, copy `.env.example` to `.env.local` and
fill in the values by hand.

### Changing a variable

Manage variables with the CLI rather than the dashboard, for every environment
that needs the change:

```bash
vercel env ls
vercel env add NAME production    # prompts for the value; also preview, development
vercel env rm NAME production
```

Preview and Production values are stored as sensitive, so they can't be pulled
back; Development values can. Redeploy after a change, since deployments keep
the values they were built with.

## Database

The server uses Drizzle with Neon Postgres. The schema is in
`server/database/schema.ts` and migrations are in
`server/database/migrations/`.

```bash
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply pending migrations to DATABASE_URL
```

Read a generated migration before applying it: renames and enum value changes
need hand-written migrations.

## Site admins

There is no in-app way to become a site admin. With database access (the
`DATABASE_URL` in `.env.local`, or set in the environment), run:

```bash
pnpm admin:set <username>            # make a site admin
pnpm admin:set <username> --remove   # back to a regular member
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # vitest
pnpm check       # typecheck, lint, and test in parallel (what CI runs)
pnpm check:templates   # compile the .vue templates changed since origin/main
pnpm format:check      # Prettier, not part of pnpm check
```

CI (GitHub Actions, the `ci` check) runs typecheck, lint, and tests on every
pull request; run `pnpm check` before opening one. Vercel also builds every
push, which catches build errors.

## Sheets agent skill

The repo includes an agent skill for writing Sheet markup and CSS
(`.claude/skills/soul-tabletop-sheets/`). Install it into another project with
the [`skills` CLI](https://skills.sh):

```bash
npx skills add lucyawrey/soultabletop -s soul-tabletop-sheets -a claude-code
```

Without `-s` the CLI lists the skills it finds and asks which to install. The
skill points at files in this repo (`shared/sheet/`, `docs/sheet-system.md`),
so it works best in a checkout of it.

## API reference

With the server running, the interactive API reference is at `/docs`,
generated from the server routes.

### Authenticating

Scripts and tools authenticate with a user API key, created in the API Keys
section of the profile page (the key is shown once). Send it as
`Authorization: Bearer <key>` or `x-api-key: <key>`:

```sh
curl -H "Authorization: Bearer st_..." https://<host>/api/profile
```

- A key acts as the user who made it. **Read Only** keys get 403 on anything
  but GET, HEAD, and OPTIONS; **Full Access** keys can do anything the user
  can, except manage API keys, which needs a signed-in session.
- A request with a session cookie uses the session and ignores any key.
- On any endpoint that looks up who is calling, public ones included, an
  invalid, expired, or deleted key gets 401 rather than being treated as
  logged out.
- Expired keys are deleted by the plugin (when used, or when any key is
  created), so they soon drop out of the list.
- There is no per-key rate limit yet: the plugin's limit is off, since its
  window only resets after a full window with no requests.

Keys are stored hashed by Better Auth's API key plugin (`apikey` table;
config in `server/utils/auth.ts`). The plugin's own `/api/auth/api-key/*`
routes are turned off: keys are managed through `/api/profile/api-keys`,
which sets each key's access level.

### Addressing resources

Every single-resource route for systems, campaigns, content types, sheets, and
content takes the resource's ID or its owner and readable ID:

```sh
curl https://<host>/api/sheet/<id>
curl https://<host>/api/sheet/lucy/fighter     # owner lucy, readable ID fighter
```

- The owner is a username or a group's readable ID. The two share one
  namespace (a database table, `owner_readable_id`, kept by triggers), so a
  name is either a user or a group, never both.
- Both parts are case-insensitive.
- Addressed by owner and readable ID, a resource the caller can't read answers
  exactly like one that doesn't exist (404), for every method. (By ID, PATCH
  and DELETE answer 403 for any resource the caller can't edit, as before.)
- `GET /api/resource/lookup?kind=sheet&owner=lucy&readableId=fighter` (or
  `&id=<id>`) returns just the resource's ID, kind, and system.
- Single GETs include `ownerReadableId`, the owner part of the address.

Pages work the same way (`/sheets/lucy/fighter`, `/sheets/lucy/fighter/edit`).
A page opened by ID shows the readable address in the address bar; links in
the app keep using IDs, which don't change when something is renamed or moved.
A sheet with the readable ID `edit` and a campaign with `members` keep their ID
addresses, since those paths belong to the sheet editor and the campaign
members route.

## Working on the docs in Obsidian

The repo root is also an [Obsidian](https://obsidian.md) vault, for reading and
editing the Markdown (`TODO.md`, `docs/`, `.claude/`): open it with "Open
folder as vault". The shared vault config and two community plugins are
committed, so they're ready after cloning (enable community plugins if Obsidian
asks):

- **Unhide**: shows dot-folders, so `.claude/` (the agent notes) is visible.
  `.git`, `.env` files, `.claude/worktrees`, and build and dependency folders
  stay hidden.
- **Git**: commit and pull from inside Obsidian.

`node_modules/` and the build folders are under "Excluded files", so they stay
out of search, the graph, and the quick switcher. New links are written as
relative Markdown links, not `[[wikilinks]]`, so they also work on GitHub.
Per-user vault state (open tabs, the Git plugin's settings) is gitignored.

## Deployment

Vercel builds every push: `main` deploys to production, and every other branch
gets a preview deployment. `main` is protected, so changes merge through pull
requests.

To try a production build locally:

```bash
pnpm build
pnpm preview
```

## License

[MIT](LICENSE)
