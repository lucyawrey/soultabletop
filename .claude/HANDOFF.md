# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (evening, paused)

- **In progress:** reference previews ([plan](plans/reference-previews.md), all decisions made). Step 1 (#96, `<Sheet>` root required) merged; its worktree and branch are removed.
- **Next:** step 2 (generated card and overrides, `preview` on `Ref`/`Value`/`Column`) in a new worktree off `main`, in a fresh session. Then dice buttons, then the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md) and the skill's notes on the required root. Open a docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet (only test sheets so far).
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
