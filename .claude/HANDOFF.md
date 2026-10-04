# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-04

- **In progress:** Sheet formulas, PR #71 (branch `sheet-formulas`, worktree `../soultabletop-worktrees/sheet-formulas`), Tier B. Cascading computed values are built, tested, documented, and pushed; the PR description has an "Added after review" section for them. `pnpm check` and `check:templates` pass.
- **Next:** a browser check of cascading with the user's sheet (`hp formula="maxHp"`, `maxHp formula="floor(maxDex/2)"`: hp follows until either is typed in, the reset button brings it back), then a fresh-context review of the last three commits (`96cc2d3..`). Then the user checks and merges #71.
- **Pathfinder 2e test data** (user `lucyawrey`, system `pf2e-test`): the example sheet only has inputs for attributes, AC, HP and quantities; the user may want a fuller one. Step 8's "what formulas couldn't express" report isn't written.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`; merging #71.
- **Remind the user at the start of the next session:** they plan to switch from mostly VS Code with the Claude extension to mostly the Claude CLI in a terminal, and want the workflow checked for it first: e.g. `.claude/parallel-work.md`'s "Showing files" (`code -r`) and windows mode, the VS Code-specific bits of `CLAUDE.md`, and permissions/settings for the CLI.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
