# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Obsidian docs review, paused by the user.** Reviewed with no changes: `.claude/CLAUDE.md`, `parallel-work.md`, `docs-branch.md` (and `TODO.md`'s header). Left when they resume: `.claude/running-commands.md` and the README's "Working on the docs in Obsidian" section. Open each with `xdg-open "obsidian://open?path=<url-encoded absolute path>"` (works). The user also hasn't reported yet on how the vault performs with `node_modules/` loaded (it can only be excluded from search).
- **Sheet formulas, PR #71** (branch `sheet-formulas`, worktree `../soultabletop-worktrees/sheet-formulas`), Tier B. Cascading computed values are built, tested, documented, and pushed. **Next:** a browser check of cascading with the user's sheet (`hp formula="maxHp"`, `maxHp formula="floor(maxDex/2)"`), then a fresh-context review of the commits from `96cc2d3` on. Then the user checks and merges.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Pathfinder 2e test data** (user `lucyawrey`, system `pf2e-test`): the example sheet only has inputs for attributes, AC, HP and quantities; the user may want a fuller one. Step 8's "what formulas couldn't express" report isn't written.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`; merging #71.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
