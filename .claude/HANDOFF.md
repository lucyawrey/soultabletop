# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-07 (evening, Linux; handing over to a new session)

- **PF2e demo** (`.claude/plans/pf2e-demo.md`): the Official `soul/pf2e` system is loaded (11 types, 90 items, the character sheet). **Step 6, the character sheet, is draft PR #108** (`pf2e-sheet`, worktree `../soultabletop-worktrees/pf2e-sheet`), opened at the user's request while still in review. How to work on it, and its styling hooks: the plan's step 6. Decisions from two review rounds: the mockup spec's "Decided after the mockup" (`.claude/mockups/pf2e-sheet/spec.md`).
- **Next:** the user has more feedback once they see the latest version (round 2 fixes: strong borders, tabs flush and full height, Raise Shield strip, AC outline, centered header strip). Start a dev server from the worktree on a spare port, load the system into it, and give the user the test characters' links. After their round, push the fixes and mark #108 ready (Tier B: it also changes Sheet code and the PF2e schemas).
- **Test characters** in the user's account, `test-pf2e-kyra` and `test-pf2e-merisiel`: `.claude/pf2e/test-characters.mjs` resets them; run it with `delete` after #108 merges.
- **On `docs`, not yet on `main`:** the dice mockup folder, the fork, sheet-actions, and PF2e plans, the PF2e sheet spec decisions and test-character script, the SSH remote and nvm notes, and the TODO and handoff; one docs-only PR when the user wants.
- **Also waiting:** keep or delete `icons.html` in the PF2e mockup folder; on the Mac, set the SSH remote and `nvm alias default 24.21.0`, and check `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
