# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-07 (Linux)

- **Fork resources** is built and committed on `fork-resources` (worktree `../soultabletop-worktrees/fork-resources`, decisions in `.claude/plans/fork-resources.md`). `pnpm check` and a browser check pass. **Not pushed:** GitHub answered the push with "Internal Server Error" (request D212:12F4F0:9AE660:CF766B:6AC66186) while its status page was green. Next: push (after `scripts/check-secrets.sh origin/main..fork-resources`), open the PR (Tier B: schema change), and leave a dev server on it for the user. Migration 0001 is already applied to the shared dev database (a nullable column).
- **Unconfirmed agent defaults** for forks (plan's "Agent defaults"): kept names, `-2` readable ID suffixes, copies start Limited, default sheet only on a copied type.
- **Next after Fork:** the Sheet editor `<Preview>` gap (TODO, end of Phase 4), then the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6). Cairn is on the demo list (TODO, Next up).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews; one docs-only PR when the user wants.
- **Waiting on the user:** keep or delete `icons.html` in the PF2e mockup folder; whether the Initiative "rolls with" picker should offer Lore skills; compact density on a real, full sheet not yet seen.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
