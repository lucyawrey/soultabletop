# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **Sheet formulas, PR #71** (branch `sheet-formulas`, worktree `../soultabletop-worktrees/sheet-formulas`), Tier B. Cascading computed values are built, tested, documented, and pushed. **Next:** a browser check of cascading with the user's sheet (`hp formula="maxHp"`, `maxHp formula="floor(maxDex/2)"`), then a fresh-context review of the commits from `96cc2d3` on. Then the user checks and merges.
- **Agent workflow for the CLI, PR on branch `agent-cli-workflow`** (worktree `../soultabletop-worktrees/agent-cli-workflow`), Tier B: quieter `agent-run.sh`, new `scripts/check-secrets.sh`, plus the `docs` commit that moves the agent docs to the CLI (tab mode instead of VS Code windows), works on both Mac and Linux, and trims `CLAUDE.md`. After it merges: confirm with `gh pr view 72 --json state`, merge `origin/main` into `docs` (clean tree), push `docs`, then `git worktree remove ../soultabletop-worktrees/agent-cli-workflow` and `git branch -D agent-cli-workflow`.
- **Obsidian vault, PR on branch `obsidian-vault`** (worktree `../soultabletop-worktrees/obsidian-vault`), Tier B: ProjectComet's vault setup adapted for a code repo. Unverified: how Obsidian performs with `node_modules/` in the vault (it can only be excluded from search, not from loading); the user is to open it and report. After it merges, clean up its worktree and branch as for #72.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Pathfinder 2e test data** (user `lucyawrey`, system `pf2e-test`): the example sheet only has inputs for attributes, AC, HP and quantities; the user may want a fuller one. Step 8's "what formulas couldn't express" report isn't written.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`; merging #71 and the workflow PR.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
