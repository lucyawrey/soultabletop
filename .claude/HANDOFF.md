# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Database reset done** (2026-10-05): the user took a Neon backup branch, then the `public` and `drizzle` schemas were dropped and `0000_baseline` applied from PR #90 (`squash-migrations`, worktree `../soultabletop-worktrees/squash-migrations`; the user reviews and merges). The user re-registered as `lucy` (site admin). **Don't run `db:migrate` from `main` until #90 merges.**
- **Next:** each machine needs a new API key from `/profile` (the Mac's `.env.local` names it `SOUL_API_KEY`, the README says `SOUL_TABLETOP_API_KEY`). Then the PF2e demo system, step 2 of `.claude/plans/pf2e-demo.md` (step 1, the `pf2e-test` export, is in `.claude/pf2e/legacy/`).
- **PF2e sheet mockup:** v2 in `.claude/mockups/pf2e-sheet/mockup.html` waits for the user's review (not yet rendered in a browser by an agent).
- **UI mockups:** a comparison of the landing page with `.claude/mockups/ui-redesign/` found small drift (nav order: Content before Characters; smaller sign-in tab text; Sign in button looks disabled until filled), not yet logged in `TODO.md` or checked with the user.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
