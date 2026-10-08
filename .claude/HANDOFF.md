# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-08 (Mac; in progress)

- **PF2e demo** (`.claude/plans/pf2e-demo.md`): the Official `soul/pf2e` system is loaded (11 types, 90 items, the character sheet). **Step 6, the character sheet, is draft PR #108** (`pf2e-sheet`, worktree `../soultabletop-worktrees/pf2e-sheet`), opened at the user's request while still in review. How to work on it, and its styling hooks: the plan's step 6. Decisions from two review rounds: the mockup spec's "Decided after the mockup"; every remaining difference from `frozen.html`, with who chose it (user, agent approved, or agent unconfirmed): its "Differences from frozen.html that remain" (`.claude/mockups/pf2e-sheet/spec.md`).
- **Now (2026-10-08, Mac):** third review round on #108. The user found the sheet far from the mockup, especially edit mode; it was reworked to match `frozen.html` (commit "edit mode looks like the mockup" on `pf2e-sheet`) and the spec's "Agent, unconfirmed" list rewritten for the user to go over. Resist / weak / immune are set aside (spec, "Third look"). A dev server on 3005 runs from the Mac's worktree. **Next:** go over the unconfirmed list with the user, then mark #108 ready (Tier B).
- **Test characters** in the user's account, `test-pf2e-kyra` and `test-pf2e-merisiel`: `.claude/pf2e/test-characters.mjs` resets them; run it with `delete` after #108 merges.
- **On `docs`, not yet on `main`:** the dice mockup folder, the fork, sheet-actions, and PF2e plans, the PF2e sheet spec decisions and test-character script, the SSH remote and nvm notes, and the TODO and handoff; one docs-only PR when the user wants.
- **Also waiting:** keep or delete `icons.html` in the PF2e mockup folder; on the Mac, set the SSH remote and `nvm alias default 24.21.0`, and check `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
