# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **#78 merged and cleaned up. One Tier B PR waits for the user to merge:** #80 (`campaign-member-access`, two Opus review rounds, all findings fixed). Its worktree is still under `../soultabletop-worktrees/` (briefs in `briefs/`); after the merge, remove its worktree and branch and delete its In progress item from `TODO.md` (`main` with #78 is already merged into it). Then: update the Source-priority item in `TODO.md` (labels are now You/Group/Shared/Official/Community, members get Shared) and start Next up (the Sheet schema design). `ui-polish` (#77) and `group-name-wrap` (#79) were auto-merged. A dev server may still be running on port 3000 from the main checkout.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
