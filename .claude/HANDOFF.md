# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Database reset done** (2026-10-05): the user took a Neon backup branch, then the `public` and `drizzle` schemas were dropped and `0000_baseline` applied from PR #90 (`squash-migrations`, worktree `../soultabletop-worktrees/squash-migrations`; the user reviews and merges). The user re-registered as `lucy` (site admin). **Don't run `db:migrate` from `main` until #90 merges.**
- **Game icons:** PR #91 (`game-icons`, worktree `../soultabletop-worktrees/game-icons`), waiting for the user's review and merge.
- **Next:** the PF2e sheet mockup. v3 is in `.claude/mockups/pf2e-sheet/mockup.html`, and `brief.md` records the v2 review decisions plus what to try next (skills and proficiencies on the left, tabs on the right). Then freeze it and write the spec. The nine reference content types are drafted in `.claude/pf2e/content-types/` (`build-types.mjs`), not yet validated against the API or reviewed; the character type waits for the mockup. The Foundry pf2e sparse clone is now on this Mac too (`~/Developer/foundry-pf2e`). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
- **UI mockups:** a comparison of the landing page with `.claude/mockups/ui-redesign/` found small drift (nav order: Content before Characters; smaller sign-in tab text; Sign in button looks disabled until filled), not yet logged in `TODO.md` or checked with the user.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
