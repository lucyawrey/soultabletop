# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (late afternoon)

- **In progress:** PR #95, breakdown popovers (`<Part>` children), worktree `../soultabletop-worktrees/breakdown-popovers`. The agent review's findings are fixed; waiting on the user to review and merge.
- **After #95 merges:** delete its test data with `node --env-file=.env.local .claude/scripts/test-sheet.mjs delete /api/content/9973d6bc-8adf-482c-b572-a467229acf7d /api/sheet/3c582967-42ea-4dc0-ac51-757dbc3edfdc /api/content-type/8060add8-a017-411e-9a65-f0b79c2ca023 /api/system/77cc06e9-b408-45f5-bd30-25833ea368d4` against a dev server (previews refuse API keys); remove the worktree and branch; delete its TODO item and mark gap 5 done in `.claude/mockups/pf2e-sheet/spec.md`. Merging `main` into `docs` will conflict in the sheets skill's SKILL.md (#95 adds a "Breakdowns" section that `docs` replaced with a pointer): keep `docs`'s version.
- **Usage changes (2026-10-06):** global rules in `claude-config` (read ranges, one full check per PR, PRs don't address the user); here `.claude/sheet-code-map.md`, `.claude/scripts/test-sheet.mjs`, a slimmer SKILL.md, and a shorter CLAUDE.md. Not yet carried to `main`: open a docs-only PR when the user wants.
- **Next:** reference previews, then dice buttons (needs a design decision), then the PF2e character sheet build (`.claude/plans/pf2e-demo.md`, step 6).
- **Not yet seen by the user:** compact density on a real, full sheet (only test sheets so far).
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
