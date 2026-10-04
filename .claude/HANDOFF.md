# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **Two Tier B PRs wait for the user to merge:** #78 (`sheet-formulas-and-fixes`) and #80 (`campaign-member-access`, two Opus review rounds, all findings fixed). Both worktrees are still under `../soultabletop-worktrees/` (briefs in `briefs/`); after each merge, remove its worktree and branch, delete its In progress item from `TODO.md`, and merge `origin/main` into the other branch if needed. Then: update the Source-priority item in `TODO.md` (labels are now You/Group/Shared/Official/Community, members get Shared) and start Next up (the Sheet schema design). `ui-polish` (#77) and `group-name-wrap` (#79) were auto-merged. A dev server may still be running on port 3000 from the main checkout.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
