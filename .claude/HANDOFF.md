# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-07 (Linux)

- **Fork resources:** PR #102 (Tier B: schema change; the user reviews and merges), worktree `../soultabletop-worktrees/fork-resources`, decisions in `.claude/plans/fork-resources.md`. `pnpm check` and a browser check pass. Migration 0001 is already applied to the shared dev database (a nullable column). After merge: remove the worktree and branch.
- **GitHub HTTPS pushes fail** (2026-10-07): "Internal Server Error" on every push to this repo over HTTPS, while reads work. Pushing over SSH works: `git push git@github.com:lucyawrey/soultabletop.git <branch>`.
- **Unconfirmed agent defaults** for forks (plan's "Agent defaults"): kept names, `-2` readable ID suffixes, copies start Limited, default sheet only on a copied type.
- **Sheet editor `<Preview>`:** PR #103 (Tier A: UI and docs), worktree `../soultabletop-worktrees/sheet-editor-preview`. `pnpm check` and a browser check pass. After merge: remove the worktree and branch, and delete its TODO item.
- **Next:** the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6). Cairn and the first-visit dashboard are on the demo list (TODO, Next up).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews; one docs-only PR when the user wants.
- **Waiting on the user:** keep or delete `icons.html` in the PF2e mockup folder; whether the Initiative "rolls with" picker should offer Lore skills; compact density on a real, full sheet not yet seen.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
