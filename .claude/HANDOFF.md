# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Merged today:** #90 (one baseline migration; the database was reset and the user re-registered as `lucy`, site admin) and #91 (game icons in sheets, no Iconify API fallback, `/credits`). Their worktrees and branches are removed; `docs` has `origin/main` merged in.
- **Start of next session: remind the user to keep iterating on the PF2e sheet mockup** (user's request, 2026-10-05: "it's getting close"). It's `.claude/mockups/pf2e-sheet/mockup.html`, with a Tabs right / Tabs below layout toggle (Tabs right is the default); `brief.md` holds every decision so far. Ask for their notes before anything else in the PF2e work; freeze and spec come only after they approve it.
- **In progress: the PF2e demo system** (`TODO.md` In progress, plan `.claude/plans/pf2e-demo.md`). Step 1 is done (`pf2e-test` export in `.claude/pf2e/legacy/`). Waiting on the mockup.
- The nine reference content types are drafted in `.claude/pf2e/content-types/` (`build-types.mjs`). They aren't validated against the API or reviewed yet. The character type waits for the mockup.
- The Foundry pf2e sparse clone is on this Mac too (`~/Developer/foundry-pf2e`). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
