# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review, paused by the user.** Reviewed with no changes: `.claude/CLAUDE.md`, `parallel-work.md`, `docs-branch.md` (and `TODO.md`'s header). Left when they resume: `.claude/running-commands.md` and the README's "Working on the docs in Obsidian" section. Open each with `xdg-open "obsidian://open?path=<url-encoded absolute path>"` (works). The user also hasn't reported yet on how the vault performs with `node_modules/` loaded (it can only be excluded from search).
- **No feature in progress.** The Pathfinder 2e test sheet is done (in the database: `lucyawrey`'s `pf2e-test`, characters Test Fighter and Test Cleric; its findings are in `TODO.md` Phase 1, "Sheet features found missing"). Next is the user's pick; first in Next up is the dialog field-order item. The user's own API key is in `.env.local` as `SOUL_TABLETOP_API_KEY` (send it as `x-api-key`; Playwright's `extraHTTPHeaders` with it views pages as the user). The `.env.example` change is on `docs`, not yet on `main`.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
