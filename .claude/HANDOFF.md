# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-09 (Linux; view-mode check in progress)

- **PF2e demo** (`.claude/plans/pf2e-demo.md`): **step 6, the character sheet, is draft PR #108** (`pf2e-sheet`, worktree `../soultabletop-worktrees/pf2e-sheet`, pushed and clean). Decisions: `.claude/mockups/pf2e-sheet/spec.md` ("After the third look", "View mode, area by area").
- **Now:** the user's last check of view mode, in progress. Approved: the Spells tab and the Class/Spells first line. Also approved: the inventory move pills reading Hold / Wear / Stow (`255d2cf`). Still to check: Skills, Proficiencies, and the Class, Feats, Inventory, and Biography tabs. Then edit mode. Known for edit mode: the IWR labels and "+ Add" pills sit a few px low; a lore row's × squeezes its columns. After edit mode: a usability pass, the readability pass, custom `<Preview>`s (`TODO.md`, In progress).
- **Test pages:** `/characters/lucy/test-pf2e-kyra` and `/characters/lucy/test-pf2e-merisiel` (the username is part of the path). `.claude/pf2e/test-characters.mjs` resets them; run it with `delete` after #108 merges. Screenshots: `.claude/running-commands.md`, "Browser checks". A Linux dev server on 3005 runs from the worktree; stop it when the check is done.
- **Slots store `left`, not `used`**: a schema change the stored sheet depends on needs a three-step load (schema with both fields, sheet, final schema).
- **On `docs`, not yet on `main`:** the commits since #111 (spec, TODO, handoff); one docs-only PR when the user wants.
- **Also waiting:** keep or delete `icons.html` in the PF2e mockup folder; on the Mac, pull `claude-config`, set the SSH remote, `nvm alias default 24.21.0`, check `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
