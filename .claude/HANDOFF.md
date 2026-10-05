# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Obsidian docs review done** (2026-10-04). The user hasn't reported yet on how the vault performs with `node_modules/` (hidden by Unhide and excluded from search).
- **No feature in progress.** #77–#82 merged (#82: every `{…}` is a formula, `show` takes a bare formula); the `show-bare-formula` worktree and branch are removed. The old `sheet-formulas` worktree (branch left over from #78) is still there and can be removed. Next up in `TODO.md`: "Sheet schema design: choice fields and tables over fixed rows" (design with Opus). The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax and fails validation until edited. Not tried in a browser by the agent (the user checked the PR). Usage reminders arrive through a user-level UserPromptSubmit hook (`~/.claude/scripts/usage-context.sh`).
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
