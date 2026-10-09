# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-09 (Linux; user wrapped up for the day; #109 and #110 merged and merged into `pf2e-sheet`)

- **PF2e demo** (`.claude/plans/pf2e-demo.md`): the Official `soul/pf2e` system is loaded and Public. **Step 6, the character sheet, is draft PR #108** (`pf2e-sheet`, worktree `../soultabletop-worktrees/pf2e-sheet`, pushed, clean). How to work on it: the plan's step 6. Decisions: the mockup spec's "After the third look" and "View mode, area by area" (`.claude/mockups/pf2e-sheet/spec.md`).
- **Next:** the user does one last check of view mode, then edit mode starts. Approved so far: the Spells tab and the Class/Spells first line. Waiting on that check: Skills, Proficiencies, and the Class, Feats, Inventory, and Biography tabs (all reworked 2026-10-09). Known for edit mode: the IWR labels and "+ Add" pills sit a few px low; a lore row's × squeezes its columns left of the other skill rows. After edit mode, in order: a usability pass, the readability pass, custom `<Preview>`s (all in `TODO.md`, In progress).
- **Slots store `left`, not `used`** (slots, Divine Font, focus) since 2026-10-09. A schema change the stored sheet depends on needs a three-step load (schema with both fields, sheet, final schema); the server refuses a change that breaks a sheet.
- **Screenshots:** a throwaway user copies a test character (`.claude/running-commands.md`, "Browser checks"). On Linux, `tmp/shots/tab.mjs` in the worktree opens one tab in view or edit mode and runs a measurement (gitignored, so not on the Mac; the Mac has `tmp/shots/shot.mjs`). No dev server is left running.
- **Test characters** `test-pf2e-kyra` and `test-pf2e-merisiel`: `.claude/pf2e/test-characters.mjs` resets them; run it with `delete` after #108 merges.
- **On `docs`, not yet on `main`:** plans, the PF2e spec and test-character script, notes, TODO, and handoff; one docs-only PR when the user wants.
- **Also waiting:** keep or delete `icons.html` in the PF2e mockup folder; on the Mac, pull `claude-config` (tmux extended keys, UI-approval rule), set the SSH remote, `nvm alias default 24.21.0`, check `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
