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

All three are server-only and never sent to the browser. They are set in all
three Vercel environments (Production, Preview, Development). While the app is
a prototype, every environment, including local development, uses the same
Neon database.

### Local setup

Install the [Vercel CLI](https://vercel.com/docs/cli) globally (`pnpm add -g
vercel`), then link this folder to the Vercel project and pull the Development
values into `.env`:

```bash
vercel login
vercel link
vercel env pull .env
```

Pull into `.env`, not the CLI's default `.env.local`: Nuxt and `drizzle-kit`
only read `.env`. The pulled file also contains a short-lived
`VERCEL_OIDC_TOKEN`, which the app doesn't use. Without Vercel access, copy
`.env.example` to `.env` and fill in the values by hand.

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

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # vitest
pnpm check       # all of the above plus a Prettier check
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, and tests on every push.

## API reference

With the server running, the interactive API reference is at `/docs`,
generated from the server routes.

## Deployment

Vercel builds every push: `main` deploys to production, and every other branch
gets a preview deployment. `main` is protected, so changes merge through pull
requests.

To try a production build locally:

```bash
pnpm build
pnpm preview
```
