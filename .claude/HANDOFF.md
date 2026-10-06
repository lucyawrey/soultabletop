# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (evening, Mac)

- **In progress: dice buttons, design only.** Decisions so far are in [plans/sheet-actions.md](plans/sheet-actions.md). The mockup's v1 is in [mockups/dice-rolls/](mockups/dice-rolls/) (`brief.md`, `mockup.html`), not yet reviewed by the user: a Rogue slice of the PF2e sheet with toggles for result look, die shapes (CSS shapes or game-icons, user asked for both), Recent rolls (drawer, panel, stack), toast position, roll target, entry detail, and viewer. Next: the user clicks through and decides; record the decisions in a `spec.md`, then freeze, then the markup details and a build branch. Reference previews are done (#96 to #98); #99 merged.
- **Open gap from step 3:** in `TODO.md` (end of Phase 4), "Show a sheet's own `<Preview>` in the Sheet editor".
- **After dice:** the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews. They depend on each other, so they reach `main` in one docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
