# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-07 (evening, Linux)

- **PF2e demo** (`.claude/plans/pf2e-demo.md`): step 5 merged (#107) and run for real: the Official `soul/pf2e` system is loaded (11 types, 90 items, and now the sheet). **Step 6 in progress** on `pf2e-sheet` (draft PR #108), worktree `../soultabletop-worktrees/pf2e-sheet`: the character sheet in `systems/pf2e/sheets/`, and the loader now loads sheets. Dev server on port 3005 from that worktree (started by the agent; stop it when the user is done).
- **Waiting on the user:** a look at the next version of the sheet (after the second round of review: strong borders on every panel, tabs as tall as the skills column and flush, Raise Shield strip and AC outline like the mockup, centered header strip); the user has more feedback once they see it. Draft PR #108 is open (Tier B: it also changes Sheet code and the PF2e schemas); mark it ready when the review is done.
- **Test characters** in the user's account (`test-pf2e-kyra`, `test-pf2e-merisiel`), made through the API: delete after the PR merges (`DELETE /api/content/eac28915-17a6-4218-aa34-1156db0916b8` and `/api/content/10d94439-ce1d-48e4-a533-6e86ac5fb78a` with the API key).
- **On `docs`, not yet on `main`:** the dice mockup folder, the fork, sheet-actions, and PF2e plans, the SSH remote and nvm notes, and the TODO and handoff; one docs-only PR when the user wants.
- **Also waiting:** keep or delete `icons.html` in the PF2e mockup folder; on the Mac, set the SSH remote and `nvm alias default 24.21.0`, and check `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
