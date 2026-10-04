# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **No feature in progress.** #77–#81 merged; worktrees and branches removed. Next up in `TODO.md`: "`show` takes a bare formula; every `{…}` is a formula" (decisions made, path compatibility already checked; start it in a fresh session on Sonnet after the usage reset, plus one review), then the Sheet schema design. Usage reminders arrive through a user-level UserPromptSubmit hook (`~/.claude/scripts/usage-context.sh`, Linux machine only so far). A dev server may still be running on port 3000 from the main checkout.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
