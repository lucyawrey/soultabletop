# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-09-30

- **State:** nothing in progress; the main checkout is on `main` and the only other worktree is `docs`. Recently merged: the current-system selector (#28), team copy in `content/copy.yml` (#29, #30), and user API keys (#31: Better Auth's API key plugin, `getAuthenticatedUser` takes the session then a key, Read Only or Full Access, managed on the profile page; the plugin's per-key rate limit is off, see the rate limiting item in `TODO.md`). The user checked both key types on the preview with `vercel curl` (curl flags go after `--`).
- **Next:** the logout-on-page-refresh bug (top of Next up in `TODO.md`); the user wants to start it first thing next session. Ask them when they see it (browser, local dev or deployed, how long after signing in), then reproduce on a dev server: sign in, refresh, check the session cookie and `/api/auth/get-session`, then the client session handling (`useAuthSession`, `useLoggedIn`, the `auth` middleware). After that: SQL-side list access filtering, then the small fixes (hydration mismatches, selector follow-ups, card header alignment), possibly bundled. `TODO.md` now also records the personal library and campaign entries design (Later tier), decided with the user on 2026-09-30.
- **Docs branch:** `docs` (worktree `../soultabletop-worktrees/docs`, pushed) is ahead of `main` only by `TODO.md` and handoff updates made after the docs-only PR #32 merged; they can ride along with the next feature PR.
- **Parallel work:** the rules in `CLAUDE.md` ("Parallel work") haven't been run as written yet; correct whatever doesn't hold on first use. Delivery of `SendMessage` to an idle window is untested.
- **Loose ends:**
  - Browser checks: on this CachyOS machine, Chromium's headless shell is in `~/.cache/ms-playwright` (see `CLAUDE.md`); the Mac uses installed Chrome. Scripts live in the session scratchpad and are gone afterwards; an in-repo integration suite is part of the launch QA item in `TODO.md`.
  - Not confirmed in a browser by an agent: the logged-out sign-in return; a broken icon URL on a full page load (guarded, couldn't reproduce); the editable signed `Number` input ("+3") and `Field.vue`'s value wrapper layout; the sheet editor's content pickers after the Official-first ordering; the two review fixes from #16 (locked table cells in box mode show only the pencil; a disabled Markdown box doesn't dirty the draft on Reload or Discard); `CodeEditor`'s syntax colors in dark mode.
  - A campaign you belong to but don't own, with no grant, shows under My labeled "Community" (no membership label in the source badge).
  - The test database has about 50 leftover `claude-smoke-*@example.invalid` users from older sessions; removing them is one SQL statement if the user wants. This session's throwaway users were all deleted.
