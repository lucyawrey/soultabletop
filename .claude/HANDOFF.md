# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-09-30

- **State:** a background Opus subagent is building SQL-side list access filtering in worktree `../soultabletop-worktrees/sql-access-filtering` (branch `sql-access-filtering`, no schema change); it commits locally and reports, and the coordinator does the secrets check, asks the user, then pushes and opens the PR (then a fresh reviewer, one round). Recently merged: the logout-on-refresh fix (#33: `useAuthSession` requests `/api/auth/get-session` by relative path, since on Vercel Better Auth's client used the `VERCEL_URL` address server-side and lost the cookie; the user confirmed it on a preview), user API keys (#31), team copy in `content/copy.yml` (#29, #30), the current-system selector (#28). When #33's cause is relevant again: never build absolute auth URLs on the server.
- **Next:** finish and review the SQL-side filtering PR, then the small fixes in `TODO.md` (hydration mismatches, selector follow-ups, card header alignment), possibly bundled. After the filtering branch merges, `git fetch origin && git merge origin/main` in any other open worktree. The user's dev server on port 3000 was started before #31 and needs a restart (`pnpm install` was run).
- **Docs branch:** `docs` (worktree `../soultabletop-worktrees/docs`, pushed) is ahead of `main` only by `TODO.md` and handoff updates made after the docs-only PR #32 merged; they can ride along with the next feature PR.
- **Parallel work:** the rules in `CLAUDE.md` ("Parallel work") haven't been run as written yet; correct whatever doesn't hold on first use. Delivery of `SendMessage` to an idle window is untested.
- **Loose ends:**
  - Browser checks: on this CachyOS machine, Chromium's headless shell is in `~/.cache/ms-playwright` (see `CLAUDE.md`); the Mac uses installed Chrome. Scripts live in the session scratchpad and are gone afterwards; an in-repo integration suite is part of the launch QA item in `TODO.md`.
  - Not confirmed in a browser by an agent: the logged-out sign-in return; a broken icon URL on a full page load (guarded, couldn't reproduce); the editable signed `Number` input ("+3") and `Field.vue`'s value wrapper layout; the sheet editor's content pickers after the Official-first ordering; the two review fixes from #16 (locked table cells in box mode show only the pencil; a disabled Markdown box doesn't dirty the draft on Reload or Discard); `CodeEditor`'s syntax colors in dark mode.
  - A campaign you belong to but don't own, with no grant, shows under My labeled "Community" (no membership label in the source badge).
  - The test database has about 50 leftover `claude-smoke-*@example.invalid` users from older sessions; removing them is one SQL statement if the user wants. This session's throwaway users were all deleted.
