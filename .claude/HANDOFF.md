# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (evening, Mac)

- **In progress: dice buttons.** How a roll looks is frozen (2026-10-06): [mockups/dice-rolls/](mockups/dice-rolls/) (`frozen.html`, `spec.md`; review decisions in `brief.md`). Behavior: [plans/sheet-actions.md](plans/sheet-actions.md). Next: settle the markup details with the user (the plan's Open list: attribute lists, where `Roll`/`FollowUp` may appear, `crit`/`fumble` forms, how a sheet picks its roll target, error codes), then a build branch. Reference previews are done (#96 to #98); #99 merged.
- **Open gap from step 3:** in `TODO.md` (end of Phase 4), "Show a sheet's own `<Preview>` in the Sheet editor".
- **After dice:** the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews. They depend on each other, so they reach `main` in one docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
