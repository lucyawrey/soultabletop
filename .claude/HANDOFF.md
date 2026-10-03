# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-02

- **In progress:** Sheet formulas on branch `sheet-formulas` (worktree `../soultabletop-worktrees/sheet-formulas`), built from `.claude/plans/sheet-formulas-build.md`. Steps 0–7 are committed (8 commits); `pnpm check`, template compile, and the browser checks passed. Not pushed, no PR yet.
- **Next:** the plan's review step: a fresh Opus reviewer (clean context, given the diff and the plan's "what it's meant to do") was running when the session paused, and its findings were not received; if they're lost, start a new reviewer. Fix what it finds (one round), run `pnpm check`, do the secrets check, push, and open the Tier B PR with `.claude/plans/sheet-formulas-pr.md` as the body (check its test count and the content-picker note first: that note was seen on the branch, not confirmed on `main`). Then delete that draft file, update the TODO item with the PR, and tell the user. Step 8 (Pathfinder 2e test sheet) needs the user's API key.
- **Scratchpad scripts** for the browser checks (Playwright, `withSmokeUser`) were in the old session's scratchpad and don't carry over; the PR draft lists what they checked.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening` (its worktree is gone); approval to merge the PR once open.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
