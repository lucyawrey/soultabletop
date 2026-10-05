# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Choice fields (part A of [plans/sheet-schema-design.md](plans/sheet-schema-design.md)): PR #83**, branch and worktree `choice-fields`, waiting for the user's review (Tier B). Checked in a browser except picking several values in the multiple select. Next: part B, "Tables over fixed rows in Sheets" (Next up in `TODO.md`), after #83 merges.
- The Obsidian docs review is done; the user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- The old `sheet-formulas` worktree (branch left over from #78) can be removed. The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax and fails validation until edited.
- **Unverified on the Mac:** that `code` is on the PATH. (`agent-run.sh` finds nvm there, and Playwright with `channel: "chrome"` works.)
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
