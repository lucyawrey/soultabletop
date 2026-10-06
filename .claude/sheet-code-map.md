# Sheet system code map

Where each part of the Sheet system lives, so you can grep for the function and read only those lines. The design is in [docs/sheet-system.md](../docs/sheet-system.md); this file only says where the code is. Several of these files are large (validate.ts is about 1,400 lines), so don't read them whole.

## Shared (`shared/sheet/`, used by server and browser)

| File | What's there |
|---|---|
| `registry.ts` | Every tag: `tagList` (attrs, children, parents, binds, `formula` kind), `commonAttrs`, `commonAttrsFor`, `AttrType` kinds. Adding a tag or attribute starts here. |
| `parser.ts` | Markup → nodes (`parseSheetMarkup`), paths (`parseSheetPath`, `isValidSheetPath`), text with `{…}` parts, limits. |
| `validate.ts` | `Validator`: `element()` (per-tag rules: field/formula/parts/buttons checks, binding, choices, overrides), `setElement()` (a Button's `<Set>`), `attributes()`/`attributeValue()` (each attr kind), `resolvePath`/`step` (paths against the schema), `compileFormula`, `collectDefinitions`. Entry points `compileSheet`, `validateSheet`. |
| `formula.ts` | Formula lexer and Pratt parser (`parseFormula`), AST and value types, `formulaLimits`. |
| `formula-functions.ts` | Built-in functions as data; add a function here. |
| `formula-check.ts` | Static type checks of a formula (`checkFormula`). |
| `formula-eval.ts` | Evaluator (`evaluateFormula`, `callFormulaDefinition`). |
| `runtime.ts` | Rendering-time logic, framework-free: `evaluateSheetFormula`, `sheetCondition` (`show`), `sheetOverride`, text interpolation, `setSheetValue`, `defaultSheetValue`, `sheetButtonWrites` (Buttons), `sheetBreakdown` (Parts). Unit-test new runtime logic here. |
| `scope.ts` | Path resolution against data and refs (`resolveSheetPath`), `itemScopes`/`entryScopes` for List and Table rows. |
| `generate.ts` | Generated sheets from a schema. |
| `editor.ts` | Sheet editor helpers: field paths for autocomplete, sample data, where formulas are in markup. |
| `css.ts` | Sheet CSS scoping and checks. |
| `*.test.ts` | Tests per file; `buttons.test.ts` and `breakdown.test.ts` cover Buttons and Parts end to end (compile, then runtime). |

## Browser (`app/`)

| File | What's there |
|---|---|
| `components/sheet/Renderer.vue` | Compiles markup, provides the sheet context (`provideSheetContext`), density, cached definitions. |
| `composables/useSheet.ts` | The context and helpers every sheet component uses: `useSheet()` (resolve, evaluate, text, condition, breakdown), flags (`provideSheetFlags`, `useSheetFlags`, `useSheetEditable`), Button amount box, `sheetFieldDisplay`. |
| `components/sheet/Node.vue`, `Nodes.vue` | One node → its component (field tags → `Field.vue`); `Nodes` groups adjacent `amount` Buttons. |
| `components/sheet/Field.vue` | Every field tag's view: value, input (`FieldInput.vue`), box display, overrides, breakdown triggers. |
| `components/sheet/FieldInput.vue` | Edit inputs by display type. |
| `components/sheet/Table.vue`, `List.vue` | Repeaters; Table hides Button-only columns from non-editors. |
| `components/sheet/Button.vue`, `ButtonGroup.vue`, `ColumnButtons.vue` | Buttons, the shared amount box, a Column's buttons. |
| `components/sheet/Breakdown.vue` | The breakdown popover. |
| `components/ContentDetail.vue`, `composables/useContentDraft.ts` | The content page around the sheet: Edit/Autosave switches, draft, saving (`live` edits save on their own). |
| `pages/sheets/[id]/edit.vue` | The Sheet editor (markup, CSS, preview, reference panel grouped by tag category). |

## Docs to update with a Sheet feature

`docs/sheet-system.md` (the design; one section per feature). The sheets skill only gets a row in `references/tags.md` for a new tag and, for a new feature, one bullet in SKILL.md's "Paths, formulas, and features" pointing to the doc's section.
