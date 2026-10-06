# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (evening)

- **In progress:** reference previews, designed with the user ([plan](plans/reference-previews.md)). Step 1, #96 (`<Sheet>` root required; worktree `../soultabletop-worktrees/require-sheet-root`), is open and waiting on the user's review (Tier B). Full check and browser check passed; its throwaway test data was deleted.
- **Next:** after #96 merges, ask which tags open a preview (the plan's "Still open"), then step 2 in a new worktree. Then dice buttons, then the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md) and the skill's notes on the required root. Open a docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet (only test sheets so far).
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
