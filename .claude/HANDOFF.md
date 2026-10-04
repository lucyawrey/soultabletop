# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **First: finish the Obsidian vault, PR #73** (auto-merge was on, waiting on the Vercel build). Confirm with `gh pr view 73 --json state`. The main checkout has an untracked `.obsidian/` that Obsidian created when the user opened it as a vault, and `git merge origin/main` will refuse to overwrite it. Its `app.json` is Obsidian's empty `{}`, and `appearance.json` and `core-plugins.json` match the PR's copies, so delete those three (only if that's still true), keep `workspace.json` (gitignored), merge `origin/main` into `docs`, and push. Then `git worktree remove ../soultabletop-worktrees/obsidian-vault` and `git branch -D obsidian-vault`.
- **Then: the user reviews the docs in Obsidian.** Ask them to reload the vault so Unhide shows `.claude/`, then open each file with `xdg-open "obsidian://open?path=<url-encoded absolute path>"`: `.claude/CLAUDE.md`, `.claude/parallel-work.md`, `.claude/docs-branch.md`, `.claude/running-commands.md`, and the README's "Working on the docs in Obsidian" section (`TODO.md`'s new header was already opened). The user also hasn't reported yet on how the vault performs with `node_modules/` loaded (it can only be excluded from search).
- **Sheet formulas, PR #71** (branch `sheet-formulas`, worktree `../soultabletop-worktrees/sheet-formulas`), Tier B. Cascading computed values are built, tested, documented, and pushed. **Next:** a browser check of cascading with the user's sheet (`hp formula="maxHp"`, `maxHp formula="floor(maxDex/2)"`), then a fresh-context review of the commits from `96cc2d3` on. Then the user checks and merges.
- **Unverified on the Mac:** that `agent-run.sh` finds nvm there (Homebrew or `~/.nvm`), that `code` is on the PATH, and Playwright with `channel: "chrome"`. Check on first use there and fix `.claude/running-commands.md` if needed.
- **Pathfinder 2e test data** (user `lucyawrey`, system `pf2e-test`): the example sheet only has inputs for attributes, AC, HP and quantities; the user may want a fuller one. Step 8's "what formulas couldn't express" report isn't written.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`; merging #71.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
