# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (afternoon, step 2 waiting on review)

- **In review:** reference previews step 2, PR #97 (branch and worktree `reference-previews`; [plan](plans/reference-previews.md), decisions recorded there). Tier B: the user reviews and merges. After it merges, remove the worktree and branch, then delete the test setup: `node --env-file=.env.local .claude/scripts/test-sheet.mjs delete /api/content/346e9e25-edff-4b6b-92b7-e3384acc289c /api/sheet/fed7a0d4-7b2e-448d-8ead-74c1456d3d58 /api/content-type/d9a842ed-64b0-4eef-ba30-51f9730a725c /api/content/84625b36-4857-4eb1-bf0b-9949d77ef8ac /api/content/9e25e397-19e2-49bf-b97e-c48c6d676193 /api/content-type/bcb272ed-46f2-4cb2-9b78-8a7d8dc2b5e6 /api/content-type/b1b6f4e0-d501-4e4e-b1ed-593002c28de3 /api/system/ff6d6471-7be8-42cf-99f9-f49b586f2187 --base <a dev server>` (the script reads `SOUL_TABLETOP_API_KEY`; the Mac's `.env.local` calls it `SOUL_API_KEY`).
- **Next:** step 3 (`<Card>` beside `<Sheet>` in content-type sheets, fetched on first open), or dice buttons first if the demo needs them sooner; then the PF2e character sheet (`.claude/plans/pf2e-demo.md`, step 6).
- **On `docs`, not yet on `main`:** the usage changes (`sheet-code-map.md`, `test-sheet.mjs`, the slimmer SKILL.md), the skill's notes on the required root, and the skill and code-map rows for previews. Open a docs-only PR when the user wants.
- **Not yet seen by the user:** compact density on a real, full sheet (only test sheets so far); the reworked previews (expand by default, floating card), test character in "Test: reference previews"; a dev server on the branch may still be running on port 3005.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
