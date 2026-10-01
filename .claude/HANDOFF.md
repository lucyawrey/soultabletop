# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-01

- **State:** merged today: #43-#52 (check scripts, `.claude/settings.json`, ESLint undeclared-imports rule, Edit Fields, Sheets skill README, readable ID pill, Tab/RowDetails flags rejected, live ID availability, `/docs` client-only, owner + readable ID addressing with one username/group namespace, migration 0012 applied to the shared database). Starting now: the queued "Option to hide Sheet warnings for free-form authoring" (needs a migration; the only schema-changing branch).
- **Next:** finish the warnings task (review, push with the user's approval, PR as Tier B), then pick from `TODO.md`: Sheet formulas (large, Opus; unblocks the D&D 2024 system), rate limiting (needs decisions), list filters and the category filter pattern, content type change, schema key rename values, TypeBox OpenAPI and Better Auth endpoint docs, read caching, separate dev/prod databases, private users, redirects for old readable IDs, registration cleanup hardening. The smoke helper (`scripts/smoke-session.mjs`) deletes the user but not resources it owns: note it in its header comment or make it clean up. Call the worktree's own `scripts/agent-run.sh`, not the main checkout's.
- **Docs branch:** `docs` (worktree `../soultabletop-worktrees/docs`, pushed) is ahead of `main` only by `TODO.md` and handoff updates made after the docs-only PR #32 merged; they can ride along with the next feature PR.
- **Parallel work:** the rules in `CLAUDE.md` ("Parallel work") haven't been run as written yet; correct whatever doesn't hold on first use. Delivery of `SendMessage` to an idle window is untested.
- **Loose ends:**
  - Browser checks: on this CachyOS machine, Chromium's headless shell is in `~/.cache/ms-playwright` (see `CLAUDE.md`); the Mac uses installed Chrome. Scripts live in the session scratchpad and are gone afterwards; an in-repo integration suite is part of the launch QA item in `TODO.md`.
  - Not confirmed in a browser by an agent: the logged-out sign-in return; a broken icon URL on a full page load (guarded, couldn't reproduce); the editable signed `Number` input ("+3") and `Field.vue`'s value wrapper layout; the sheet editor's content pickers after the Official-first ordering; the two review fixes from #16 (locked table cells in box mode show only the pencil; a disabled Markdown box doesn't dirty the draft on Reload or Discard); `CodeEditor`'s syntax colors in dark mode.
  - A campaign you belong to but don't own, with no grant, shows under My labeled "Community" (no membership label in the source badge).
  - The test database has about 50 leftover `claude-smoke-*@example.invalid` users from older sessions; removing them is one SQL statement if the user wants. This session's throwaway users were all deleted.
