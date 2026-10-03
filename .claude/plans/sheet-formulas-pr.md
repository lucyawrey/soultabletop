Sheet formulas: computed values in Sheet markup, never stored. A small expression language of our own (no `eval`, no JavaScript) with reusable definitions, overridable computed defaults, conditional display, editor support, and docs, plus the path hardening the engine needs. Built from `.claude/plans/sheet-formulas-build.md`; one commit per step, so it reads well commit by commit.

**Tier B** (changes `shared/`, the database-facing validation, and a rule file).

## What's in it

- **Path hardening (commit 1).** Before this, `setSheetValue(data, ["__proto__", "x"], 1)` wrote onto `Object.prototype` in the editing user's browser, and paths like `constructor` read inherited objects. Reproduced with failing tests first, then fixed. `__proto__`, `constructor`, and `prototype` can't be path segments or field keys anywhere: the schema builder, the server's key check on save, free-form object data, and the TypeBox pattern. Reads use own properties only, and a strict schema no longer accepts a `constructor` key in data.
- **Engine (commit 2):** `shared/sheet/formula.ts` (lexer, Pratt parser, types, limits), `formula-functions.ts` (built-ins as data), `formula-eval.ts` (errors are values, step budget, never throws), `formula-check.ts` (static types through the schema). Path resolution moved to `shared/sheet/scope.ts` (re-exported from `runtime.ts`), so the runtime and the evaluator don't import each other.
- **Markup (commit 3):**
  - Syntax: `formula="…"` on Value/Column/Tracker (read-only) and Number/Text/Checkbox (override: the computed value is the placeholder, and a "Use automatic value" button clears the manual value), `{= …}` in text and attributes, and `<Define>`.
  - Validation: positions are exact, also inside multi-line attributes.
  - Rendering: a failed formula shows "—", plus a warning icon for people who can edit the sheet.
- **`show` (commit 4):** on every tag but Column. It hides Tabs (the selection moves to the first visible one) and RowDetails per row. A failing `show` shows the tag.
- **Editor (commit 5):** completion inside formulas (paths, built-ins with signatures, this sheet's definitions, a Define's own parameters), distinct colors for built-ins, definitions, and parameters, and a Formulas section in the reference panel.
- **Docs (commit 6):**
  - `docs/sheet-system.md`: a new Formulas section, plus updates to §1–3, §5, and §8.
  - The Sheets skill, including the full Pathfinder 2e example.
  - The content GET's OpenAPI description now says computed values aren't part of `data`.
  - **Rule-file change:** the Sheet bullet in `.claude/CLAUDE.md` now names the formula files and says formulas are computed at render time, never stored.
- **Tests (commits 7–8):** 628 tests in `shared/sheet` (was 383 across the whole suite before):
  - parser, evaluator, and checker case tables;
  - a seeded fuzz test (random token soup never throws, finishes within the budget, and round-trips print → parse);
  - the Pathfinder 2e example compiles cleanly and evaluates to hand-checked numbers.

## Deviations from the plan

1. **TypeBox key pattern:** `fieldKeySchema` has the reserved-key pattern, but `Type.Record` doesn't enforce key patterns unless `additionalProperties: false` is set, and setting it would turn every bad key into a generic "Request validation failed". So the server's existing `assertFieldKeys` (run on every schema save) rejects reserved keys with a clear message. A test pins down that the TypeBox schema alone doesn't.
2. **New diagnostic codes:** `formula-dice` for dice and `duplicate-definition`, alongside the plan's list.
3. **`show` needs a boolean.** `show="{field}"` must point at a boolean field (or one of unknown type); anything else gets a hint to compare it in a formula.
4. **Pathfinder 2e example tweaks:**
   - The Speed badge uses `armor.strength > attributes.str`, not `<`. The spike found that lang-xml reads `<` inside text as a tag even with spaces around it, so the docs recommend `&lt;` or turning the comparison around. Attribute values are fine.
   - The Spells tab tests `length(spellcasting.tradition) > 0`, not `!= null`, because a cleared text field holds `""`. The docs say so.
5. **Step budget: one sheet-wide budget instead of a lower per-formula one.** Measured on this Mac:

   | Case | Result |
   |---|---|
   | 2,000 formulas, each summing 500 rows with a nested sum | 1.95 s |
   | Same, with the per-formula limit lowered to 2,000 steps | still 327 ms, and a single sum over 500 rows (~14,000 steps) would break |
   | 200 formulas inside a 500-row List | 7 s |

   So `formulaLimits.maxSheetSteps` (2,000,000) is split between a sheet's formulas (`ValidationResult.stepBudget`), and the renderer divides it again by the item counts of the Lists and Tables around a formula. That's deterministic (markup and data only), so the server and the browser agree.

   | After the change | Result |
   |---|---|
   | 2,000 formulas | 178 ms (each formula runs out of steps and shows "—") |
   | Lists | bounded the same way |
   | One heavy formula | keeps the full 20,000 steps |

6. **Reactivity fix found in the browser.** Reading data with `Object.hasOwn` alone isn't tracked by Vue, so an override's first manual value didn't show. Reads now go through the property first (`ownProperty` in `scope.ts`), with a test that records proxy reads.

## From review

A fresh reviewer (Opus, clean context) found these; all fixed in the last commit, with tests. A second review of that commit was started and stopped (not needed for merge per the user).

- **Lists bypassed the step budget:** `count`, `sum`, `min`, `max`, and `join` over a huge list cost time proportional to its length whatever the budget. Now every list item costs a step, a list longer than the steps left fails at once, and `join` stops at the text limit.
- **An unclosed `{=` made parsing quadratic** (20,000 of them took a second, on the server) and swallowed the tags after it. The search for its `}` now stops after 1,000 characters and at a closing tag.
- **`{…}` in layout numbers rendered broken tags:** `level="{= 2}"` gave an invalid tag name. Only the number attributes read when rendering (Tracker `max`; Number `min`, `max`, `step`) take `{…}` or `{= …}` now. No existing sheet in the shared database used them elsewhere.
- **Smaller fixes:**
  - Definitions with a taken or bad name still get their formula checked.
  - Dice-like names (`d6`) are rejected for definitions and parameters.
  - Overrides on required fields get a warning, because going back to the computed value clears the field, and a required field can't be saved empty.
  - A quote that cuts `title="{= …"…"}"` short gets a hint.
- **Not fixed here (older than this branch):** a free-form path ending in `.length` can write to an array's length through `setSheetValue`.

## Database check (step 0)

Read-only scan of the shared database for reserved keys: 0 of 8 content type schemas, 0 of 14 content records, 0 of 9 sheets' markup. Nothing to migrate.

## Verification

- `pnpm check` (typecheck, lint, test) and `pnpm check:templates` pass.
- **Browser** (dev server from the worktree, Playwright with throwaway smoke users; every test resource was deleted afterwards, checked in the database). 30 checks on the character page and 8 in the editor pass:
  - **Live updates:** changing Level or Dex updates Perception, AC, saves, Class DC, and the HP maximum without a reload.
  - **`display="box"`:** formula-only fields show as disabled inputs.
  - **Overrides:** the placeholder is the computed value; typing a value overrides it, and the reset button goes back to automatic, for Number and Checkbox. Text shows the computed value as its placeholder.
  - **`show`:** hides the Spells tab and brings it back, and the selection moves to the first visible tab when the selected one hides.
  - **Errors:** a division by zero shows the warning icon to the owner and only "—" to a second smoke user with read access.
  - **Editor:** the Problems list jumps to the right column inside `formula="…"`; completion offers `floor` (signature and description) and `prof` ("this sheet"); built-ins, definitions, and parameters get three distinct colors.
  - **Console:** no console errors and no hydration warnings on the character page, for owner and viewer. The editor page logs a Vite warning about Node's `path` module, from postcss (Sheet CSS), unrelated to this branch.
- **Screenshots** of the test sheet at 1280 px and 390 px: one column on phones, no horizontal scroll. (Text only; images can't be attached from here.)
- **Render times:**

  | Page | Time | Notes |
  |---|---|---|
  | Pathological sheet (1,000 formulas, 500-row Table with a formula column, List with nested sums) | 4–5 s SSR | dev and production builds |
  | Same structure with plain fields instead of formulas | 3–4 s | dev and production builds |
  | The small Pathfinder 2e character page (production build) | 2–3 s | mostly database time from this machine |
  | A content type page with no sheet | 2.3 s | for comparison |

  Server-Timing reported database time for both pathological variants, which is why the formula overhead is hard to isolate there. Formula cost on realistic sheets is negligible.

## Notes for review

- During the browser check, the content picker in an editable Table cell showed a raw content ID. This branch doesn't touch the picker; not checked on `main`.
- Step 8 (the Pathfinder 2e test sheet uploaded with an API key) comes after this PR and needs you.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
