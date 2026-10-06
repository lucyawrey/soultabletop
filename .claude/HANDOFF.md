# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (night, Linux)

- **In progress:** reference previews step 3 (a type's own `<Preview>` beside `<Sheet>`), branch `reference-cards`, worktree `../soultabletop-worktrees/reference-cards`, committed and pushed, no PR yet ([plan](plans/reference-previews.md); design in `docs/sheet-system.md`, "Reference previews"). `pnpm check` and a browser check passed. Tier B (new read route). Next: a review, then a PR, as the user decides.
- **Dev server** for it on Linux at :3005 (started by the agent; stop it when the PR merges). Test character: `/characters/dbe9bdc2-ded1-48ac-9788-0e3c1265ace3`. Delete the setup afterwards: `node --env-file=.env.local .claude/scripts/test-sheet.mjs delete /api/content/dbe9bdc2-ded1-48ac-9788-0e3c1265ace3 /api/content/d78d169f-5001-4391-a189-059c20a45772 /api/content/c2b9446a-d8bf-45ad-99e5-a141b0f2921a /api/sheet/1e10fcc5-002c-4030-befa-c8f93b1b6561 /api/content-type/eeebe792-bb41-4e54-b749-02fc90f11c71 /api/content-type/dfbdc394-f504-4286-ad81-289191f3c8c8 /api/sheet/39af9a13-713c-47f6-981b-1c24a778caa3 /api/content-type/3f747d9f-a701-42e4-8ce5-00ef7c3ae806 /api/system/c5deac81-583a-4bb1-82e3-6d984730d295 --base <a dev server>`.
- **Not done in step 3:** the Sheet editor's preview pane doesn't show the sheet's own `<Preview>`, so authors can't see it while writing it.
- **Then:** dice buttons, or the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, the skill and code-map rows for previews (now including step 3's own `<Preview>`). Carry the step-3 ones into its PR, or open a docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
