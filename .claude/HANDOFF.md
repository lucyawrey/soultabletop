# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-03

- **In progress:** Sheet formulas, PR #71 (branch `sheet-formulas`, worktree `../soultabletop-worktrees/sheet-formulas`), Tier B. The user asked to add **cascading computed values** to #71 before merging: a formula reading a top-level override field (`field` + `formula`) with nothing stored gets that field's computed value. Core is in the WIP commit `72ae492` (pushed): `computedField` hook in `formula-eval.ts`, lookup and cycle guard in `runtime.ts` `formulaEnv` (cached definitions are skipped inside a cascade), `computedFields` plus a `computed-field-conflict` error in `validate.ts`, passed through `Renderer.vue`. Typecheck, lint, and the 628 sheet tests pass. Only the user's case (`hp formula="maxHp"`, `maxHp formula="floor(maxDex/2)"`) was checked, by a throwaway test.
- **Next for cascading:** real tests (cascade, stored value wins, Text `""` counts as empty, cycles `a`↔`b` and self, depth limit, conflict error, same formula twice is fine, overrides inside List rows don't register, a parameterless Define reading a computed field); docs (`docs/sheet-system.md` Formulas, the Sheets skill's SKILL.md/tags.md: a plain `{path}` or field tag still shows the stored value, use `{= path}` for the computed one); a browser check with the user's sheet; a fresh review of the cascading commits; add both to the PR description. Then reword the WIP commit's message in the PR body (squash-merged, so no rewrite needed).
- **Also on #71 since review:** `96cc2d3` keeps a field's input in place when the reset/edit button shows (checked in the browser: 8px drop before, none after).
- **Pathfinder 2e test data** (user `lucyawrey`, system `pf2e-test`, upload script was in a scratchpad, gone): the example sheet only has inputs for attributes, AC, HP and quantities; the user may want a fuller one. Step 8's "what formulas couldn't express" report isn't written.
- **Waiting on the user:** delete the empty branch `sheet-path-hardening`; checking and merging #71 after cascading lands.
- **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
