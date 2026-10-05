# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Sheet schema design done** (#83 choice fields, #84 tables over fixed rows; worktrees, branches, and the plan file removed; decisions are in `docs/sheet-system.md`). Next up in `TODO.md` is empty.
- **Next session (the user's plan): sheet feature planning.** Go through "Sheet features found missing while building the D&D 2024 and Pathfinder 2e sheets" (Phase 1 in `TODO.md`) with the user: design each feature (with Opus), split it into items, and order them in Next up. Nothing is started yet.
- The Obsidian docs review is done; the user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- The old `sheet-formulas` worktree (branch left over from #78) can be removed. The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax and fails validation until edited.
- **Unverified on the Mac:** that `code` is on the PATH. (`agent-run.sh` finds nvm there, and Playwright with `channel: "chrome"` works.)
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
