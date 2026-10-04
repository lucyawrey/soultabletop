# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **Parallel work in progress (coordinator: this session's successor).** Three background subagents, one worktree each under `../soultabletop-worktrees/`: `campaign-member-access` (Opus, Tier B), `sheet-formulas-and-fixes` (Sonnet, Tier B), `ui-polish` (Sonnet, Tier A if it qualifies). Briefs in `../soultabletop-worktrees/briefs/`. Nothing pushed or opened as a PR yet: on report, check secrets, push, open PRs, then a fresh reviewer per PR. If the session ended, the subagents are gone: check each worktree's `git log origin/main..` and resume. Next up after them: the Sheet schema design (in `TODO.md`). A dev server may still be running on port 3000 from the main checkout.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
