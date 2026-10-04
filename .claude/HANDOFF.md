# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review, paused by the user.** Reviewed with no changes: `.claude/CLAUDE.md`, `parallel-work.md`, `docs-branch.md` (and `TODO.md`'s header). Left when they resume: `.claude/running-commands.md` and the README's "Working on the docs in Obsidian" section. Open each with `xdg-open "obsidian://open?path=<url-encoded absolute path>"` (works). The user also hasn't reported yet on how the vault performs with `node_modules/` loaded (it can only be excluded from search).
- **System-prefixed IDs, PR #76** (branch `system-id-prefix`, worktree `../soultabletop-worktrees/system-id-prefix`), Tier B. Built, `pnpm check` green, browser-checked (`p2e-strength-check`, follows the system, a hand-typed ID stays). **In progress:** a fresh Sonnet reviewer; if the session ended before its report, run a new one (review `git diff origin/main...HEAD` in that worktree). Then fix findings; the user merges (they enable auto-merge: poll until merged, then remove the worktree and branch, merge `main` into `docs`, and delete the TODO item). The Pathfinder 2e test sheet is done (`lucyawrey`'s `pf2e-test`); the user's API key is in `.env.local` as `SOUL_TABLETOP_API_KEY` (`x-api-key`; Playwright `extraHTTPHeaders` views pages as the user). A dev server for the user runs on port 3000 from the main checkout (started by the previous session).
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
