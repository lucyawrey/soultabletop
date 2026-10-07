# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-07 (Linux)

- **Fork resources** merged (#102). The plan's "Agent defaults" stand unless the user changes them.
- **`origin` is now SSH on Linux** (2026-10-07, after HTTPS pushes failed). **On the Mac:** run `git remote set-url origin git@github.com:lucyawrey/soultabletop.git` and check that agent shells can push, and set `nvm alias default 24.21.0` (`.claude/running-commands.md`).
- **Unconfirmed agent defaults** for forks (plan's "Agent defaults"): kept names, `-2` readable ID suffixes, copies start Limited, default sheet only on a copied type.
- **Sheet page layout and editor `<Preview>`** merged (#103): side by side / stacked switch shared by the sheet page and editor (`sheet-layout` cookie); the sheet page stacks preview first, the editor code first.
- **First-visit dashboard** merged (#104).
- **PF2e demo** (`.claude/plans/pf2e-demo.md`; sources in `systems/pf2e/`, code in `scripts/`): types merged (#106). Step 5 is PR #107 (converter, 90-item slice, generic loader `scripts/load-system.mjs`; Tier B, waiting on review), worktree `../soultabletop-worktrees/pf2e-import`. After merge: run the loader for real (`node --env-file=.env.local scripts/load-system.mjs systems/pf2e --url <dev server>`; creates the Official `pf2e` system, Limited until step 7), then the sheet (step 6). The user merges PRs by hand now (auto-merge stalled on #106).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews; one docs-only PR when the user wants.
- **Waiting on the user:** keep or delete `icons.html` in the PF2e mockup folder; whether the Initiative "rolls with" picker should offer Lore skills; compact density on a real, full sheet not yet seen.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
