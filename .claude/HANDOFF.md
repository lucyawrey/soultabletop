# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (night, Mac)

- **Dice buttons in review: PR #101** (`sheet-dice-rolls`, worktree `../soultabletop-worktrees/sheet-dice-rolls`), Tier B, for the user to review and merge. A dev server on the branch runs at http://localhost:3005 (started by the agent; stop it after the merge). Test sheet in the user's account: `/characters/09740bb5-7bb8-46b4-b1bf-5ccae63070a6`; after the merge run `test-sheet.mjs delete /api/content/09740bb5-7bb8-46b4-b1bf-5ccae63070a6 /api/sheet/3b8777c2-c100-4430-b272-00382aa2ccea /api/content-type/cb9c39aa-42a2-42b2-bb1b-8d6476d3e75b /api/system/e9f7dcc1-19ff-4bf4-b390-49c9910a54c6` (see `running-commands.md` for the key), then remove the worktree and branch. Then move "Sheet dice buttons" out of `TODO.md`.
- **Open gap from step 3:** in `TODO.md` (end of Phase 4), "Show a sheet's own `<Preview>` in the Sheet editor".
- **After dice:** the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews. They depend on each other, so they reach `main` in one docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
