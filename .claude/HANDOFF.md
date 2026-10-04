# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **#81 (`harden-registration-cleanup`, Tier B) waits for the user**: built by the coordinator alone while usage was above 80%, so no independent review yet; offer one once usage allows. Worktree in `../soultabletop-worktrees/`. #77–#80 merged; worktrees and branches removed (`../soultabletop-worktrees/briefs/` holds the old briefs). In progress in `TODO.md` is empty; Next up is the Sheet schema design (choice fields + tables over fixed rows), a design session with the user. The user asked to wait for direction before starting more. A dev server may still be running on port 3000 from the main checkout.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
