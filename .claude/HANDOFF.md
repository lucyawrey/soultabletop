# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Sheet schema design decided** (2026-10-04): [plans/sheet-schema-design.md](plans/sheet-schema-design.md). Next step: build part A, "Choice fields in schemas" (top of Next up in `TODO.md`), in its own worktree; then part B.
- The Obsidian docs review is done; the user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- The old `sheet-formulas` worktree (branch left over from #78) can be removed. The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax and fails validation until edited.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
