# Sheet formulas: build plan

**Status:** waiting for the user's approval (written 2026-10-02). Once approved, a **fresh session** builds all of it in one go from this file, without stopping for questions: every decision is made below. Where something unexpected comes up, take the option closest to this plan's intent, note it in the PR description under "Deviations", and keep going; stop only if a step would break a hard rule in `CLAUDE.md`.

**Read first:** `.claude/CLAUDE.md` (all of it), `docs/sheet-system.md`, `shared/sheet/*.ts`, `app/composables/useSheet.ts`, `app/components/sheet/{Node,Field,FieldInput,Table,List,Tabs}.vue`, `app/components/CodeEditor.client.vue`, the formula parts of `app/pages/sheets/[id]/edit.vue`, `server/utils/sheet-schemas.ts`, and the Sheets skill (`.claude/skills/soul-tabletop-sheets/`). Background only (this file wins where they differ): `.claude/plans/sheet-formulas.md` (the original design with its reasoning) and `sheet-formulas-sandboxed-js.md` (why not JavaScript).

**What ships:** formulas in Sheet markup, computed when a sheet is shown and never stored. Three ways to write them, reusable definitions, overridable computed defaults, conditional display, editor support, and docs. Plus the path hardening the engine needs first. No database, API shape, or schema changes (except rejecting three reserved key names, step 0).

---

## How the result looks

```xml
<Sheet>
  <Define name="pb" formula="ceil(level / 4) + 1" />
  <Define name="mod" params="score" formula="floor((score - 10) / 2)" />
  <Define name="skill" params="score, training"
          formula="mod(score) + switch(training, 'proficient', 1, 'expertise', 2, 0) * pb()" />
  <Define name="castMod" formula="mod(get(abilities, spellcasting.ability))" />

  <Grid cols="6">
    <Number formula="mod(abilities.str)" label="STR" format="signed" variant="stat" />
    …
  </Grid>
  <Number field="ac" formula="10 + mod(abilities.dex)" label="AC" variant="stat" />
  <Value formula="skill(abilities.dex, skills.stealth.training)" label="Stealth" format="signed" />
  <Badge>Initiative {= signed(mod(abilities.dex))}</Badge>
  <Tracker field="hp.current" max="{= hp.max + coalesce(hp.temp, 0)}" />

  <Tab label="Spells" show="{= spellcasting.ability != null}">
    <Number formula="8 + pb() + castMod()" label="Spell Save DC" variant="stat" />
  </Tab>

  <Table field="inventory">
    <Column field="item" />
    <Column field="qty" />
    <Column formula="qty * coalesce(item.weight, 0)" label="Weight" />
  </Table>
  <Value formula="sum(inventory, qty * coalesce(item.weight, 0))" label="Carried" />
</Sheet>
```

---

## Delivery

- **One branch, `sheet-formulas`, in its own worktree** off `origin/main` (`../soultabletop-worktrees/sheet-formulas`; copy `.env.local` in, never move it), **one commit per step below**, so the user can review commit by commit. One PR, **Tier B** (it changes `shared/`), opened after every step is done and verified. Never push without the user's approval (see "Git workflow"): commit locally, then ask once at the end, after the secrets check.
- The branch `sheet-path-hardening` and its worktree (`../soultabletop-worktrees/sheet-path-hardening`, created 2026-10-02, no commits) are superseded: remove the worktree and delete the branch first.
- Model: Opus for steps 1–4 (the engine is the security boundary); the session may use Sonnet subagents for the docs step if it wants, never in parallel on the same files.
- Review: before opening the PR, start one fresh reviewer subagent (Opus, clean context: the PR diff and "what it's meant to do" from this file's summary, not the session's notes) and fix what it finds (one round; a second only if a fix touches the evaluator's limits or path access).
- Then update `TODO.md` (the "Sheet formulas" item → In progress with the branch and PR) and `.claude/HANDOFF.md` on `docs`, and tell the user the PR is ready, with the preview URL.

Verification for every step: the step's tests, `scripts/agent-run.sh pnpm check` at the end of each step, and `pnpm check:templates` after any `.vue` change. Browser checks in step 7.

---

## Step 0: path hardening

The bug (from reading the code; reproduce it first): `isValidSheetPath` accepts `__proto__`/`constructor`/`prototype`, `resolveSheetPath` reads `container[segment]` without an own-key check, and `setSheetValue` walks `__proto__` into `Object.prototype` and writes there (in the editing user's browser).

1. **Failing tests first** in `shared/sheet/runtime.test.ts`: `setSheetValue({}, ["__proto__", "polluted"], 1)` must not set `({} as any).polluted` (clean up in `finally` if it does); `resolve("constructor")` and `resolve("stats.__proto__")` must give `{ value: undefined, … }`, not inherited objects. Run them and see them fail, then fix.
2. `shared/content-schema.ts`: export `RESERVED_KEYS = ["__proto__", "constructor", "prototype"]` and `isReservedKey(key)`. Field keys must not be reserved: `fieldKeyPattern` stays the identifier pattern; add the reserved check wherever it's used (`shared/schema-builder.ts` key errors: "That name is reserved; choose another key"; `server/utils/content-validation.ts` free-form object keys) and in the TypeBox mirror (`fieldKeySchema` in `server/utils/api-schemas.ts`: pattern `^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_][A-Za-z0-9_]*$`; check `Type.Record` keys honor it with a test).
3. `shared/sheet/parser.ts`: `isValidSheetPath` rejects any segment that is reserved (keep the regex, add a segment check). The `invalid-path` message for this case: `"<path>" uses a reserved name (__proto__, constructor, prototype)`.
4. `shared/sheet/runtime.ts`: `resolveSheetPath` reads records with `Object.hasOwn(container, segment) ? container[segment] : undefined`; `refRecord` stays. `setSheetValue` returns without writing if any string key is reserved, and only follows own properties while walking.
5. Before committing, check the shared database for existing use (read-only query with `node --env-file=.env.local` and `pg` via `createRequire`): content type schemas (`content_type.schema`, any depth of `entries`) and content data (`content.data`, any depth) with a reserved key, and sheet markup containing `__proto__`, `constructor`, or `prototype` inside `{…}` or `field="…"`. Report counts in the PR description. Test data only, so nothing needs migrating; just note it.
6. Tests: parser `isValidSheetPath` rejects the three as any segment; schema-builder and content-validation reject reserved keys; the TypeBox schema rejects them.

## Step 1: the formula engine (framework-free, unused by the app)

New files in `shared/sheet/`, no dependencies, no `eval`/`new Function`, nothing from Vue or Nuxt:

| File | Contents |
|---|---|
| `formula.ts` | lexer, Pratt parser, AST, `formulaLimits` |
| `formula-functions.ts` | the built-in function table as data |
| `formula-eval.ts` | evaluator |
| `formula-check.ts` | static type inference, through a host callback |

**Grammar** (precedence low → high): `or`; `and`; `==` `!=`; `<` `<=` `>` `>=` (non-associative); `+` `-`; `*` `/` `%`; unary `-` and `not`; primary. No ternary, no `&&`/`||`.

**Primary:** number literals (digits, optional fraction, no leading `.`); strings in `'…'` or `"…"` with `\'`, `\"`, `\\` escapes; `true`, `false`, `null`; paths (`isValidSheetPath` form: `.` is the current item, leading `/` the root; in prefix position `/` followed by an identifier starts a root path, in infix position it divides); calls `name(args)` (a dotted path followed by `(` is a syntax error); parentheses; dice tokens `\d*d\d+` (`1d20`, `d6`), lexed as `dice { count, sides }` so `2d6` never reads as `2` then `d6`.

**Reserved words:** `and`, `or`, `not`, `true`, `false`, `null` (a field with one of these names is reached as `/and` or `.and`).

**Names and calls (user decision):** there is no sigil. `word(` is always a call; a bare word is always a data path, except inside a `<Define>` body, where a parameter name is the parameter (`/score` still reaches the field). A definition without parameters is called `pb()`. Built-in names are reserved (see step 2 for the rule and the warning for later additions).

**AST:** `number | string | boolean | null | path { path: SheetPath, text } | param { name } | unary { op, operand } | binary { op, left, right } | call { name, args } | dice { count, sides }`; every node has a `loc`. Calls are resolved (built-in vs definition) by the checker, not the parser.

**Built-in functions (v1):**

| Group | Functions | Notes |
|---|---|---|
| Math | `floor`, `ceil`, `round(x, digits?)`, `trunc`, `abs`, `clamp(x, lo, hi)` | `round` rounds half away from zero |
| Min/max | `min(...)`, `max(...)` | numbers, or one array argument |
| Aggregates | `sum(list)`, `sum(list, expr)`, `count(list)`, `count(list, cond)`, `any(list, cond)`, `all(list, cond)` | `expr`/`cond` is evaluated per item, scoped to the item like a `List` (relative paths are the item's, `/` the root) |
| Size | `length(x)` | string or array |
| Nulls | `coalesce(a, b, …)` | the first non-null; doesn't swallow errors |
| Text | `concat(...)`, `join(list, sep)`, `signed(n)` | `signed`: "+3", "0", "-1" |
| Conversion | `number(x)`, `text(x)` | `number` parses a string |
| Logic | `if(cond, then, else)`, `switch(value, k1, v1, …, default)` | lazy |
| Lookup | `get(record, key)` | user decision: own keys only (`Object.hasOwn`); reserved keys give null; a string record is followed through `refs` like a path; result type `any` |

The table entry per function: name, min/max arity, which arguments are per-item scoped, lazy flag, static result type (or a function of argument types), implementation, one-line description and signature for the editor.

**Reserved, not implemented:** `roll`, `dice`, `adv`, `dis` (errors: "dice rolls aren't available yet"). Not included on purpose: regular expressions, dates, randomness, locale formatting.

**Values and types:** runtime values are finite numbers, strings, booleans, null; arrays and records only as path results fed to aggregates, `length`, `get`, `join`, `min`/`max`. A final result that is an array or record is an error. No implicit coercion: arithmetic and ordering take numbers only (`+` doesn't join strings; use `concat`); `==`/`!=` compare type and value; `if`/`and`/`or`/`not` take booleans, null counts as false. Missing values (absent key, unavailable reference, a path through a non-object) are null; arithmetic with null gives null (shown empty); aggregates skip nulls; `sum([])` and `count([])` are 0; `min`/`max` of nothing is null.

**Errors are values:** `FormulaError { code, message }` for type mismatches, division by zero, non-finite results, exhausted budget, too-long strings, and dice outside a roll. They propagate through operators and calls. The evaluator catches any internal exception and returns `FormulaError("internal")`. Messages are deterministic (they feed `findSheetsBrokenBy`'s diff).

**Numbers on display:** non-integers go through `Number(x.toPrecision(12))` (no 0.1+0.2 noise), then `String()`: no locale formatting, so SSR and hydration match.

**Limits (`formulaLimits`):** expression 1,000 characters; 200 AST nodes; nesting depth 32; 32 arguments per call; 200 `<Define>` per sheet; 2,000 formula sites per sheet; per-item aggregate nesting 2 levels; 20,000 evaluation steps per evaluation (every node visit and aggregate item counts); definition call depth 16; string results 10,000 characters. Step 7 measures a pathological sheet in SSR and lowers the step budget if a worst-case page render takes over 200 ms.

**Signatures:**
- `parseFormula(source, start: Position): { ast?: FormulaNode; diagnostics: SheetDiagnostic[] }`: the lexer tracks line/column from `start` (multi-line attribute values map correctly) and decodes `&lt; &gt; &amp; &quot; &apos;` itself, so positions stay exact.
- `evaluateFormula(ast, env): FormulaValue` with `env = { root: SheetScope; scope: SheetScope; refs: SheetRefs; params?: Record<string, FormulaValue>; call(name, args): FormulaValue; budget: { steps: number } }`. Paths resolve with `resolveSheetPath` (so refs, `unavailable`, and the depth rule match everything else). It reads plain values (the caller passes Vue's reactive data; reading it is fine and gives tracking, but the engine never imports Vue).
- `checkFormula(ast, host)`: generic over the host's scope type: `host.resolve(path, scope, loc) → { type: FormulaType; scope?: S }`, `host.itemScope(scope) → S`, `host.definition(name) → { params: string[]; type: FormulaType } | undefined`. Types: `number`, `string`, `boolean`, `null`, `array<T>`, `record`, `any`, unions. `scalar` fields are `number|string|boolean|null`; unknown, non-strict, and `object` paths are `any`, never a type error.

**Tests** (`formula.test.ts`, `formula-eval.test.ts`, `formula-check.test.ts`): every operator, precedence and associativity; `/` root vs divide; `.` paths, calls, params, reserved words, dice tokens, escapes; each syntax error's exact line/column, including multi-line and entity-decoded text; every limit; a case table per function; null propagation, empty lists, division by zero, non-finite, budget exhaustion, string caps; `get` with own keys, inherited keys, and reserved keys; paths through `refs`, including unavailable; per-item scoping; a seeded fuzz with an in-repo PRNG (no dependency): random token soup never throws and always finishes within the budget, and print-then-parse gives the same AST.

## Step 2: formulas in markup

**Parser (`parser.ts`):**
- `TextPart` gains `{ formula: string; loc: Loc; bodyStart: Position }` for `{= expr}`, in text and in attribute values. The existing `{path}` behaves exactly as today.
- After an unescaped `{=`, scanning jumps to the matching `}`, skipping quoted strings, both in `parts()` and in `text()` (so `{= a <b}` isn't read as a tag and `{= concat('}', x)}` works). Only `{=` changes; old markup parses byte for byte the same (tests).
- `SheetAttr` gains `valueLoc` (start/end of the value without quotes) and `raw` (the source text of the value).
- An attribute named `formula` is raw text: the parser doesn't run `parts()` on it (no `{…}` or entity handling, no diagnostics); the validator lexes `raw` from `valueLoc.start`. Inside `formula="…"` a string can't contain `"`; the syntax-error message suggests `'…'`.

**Registry (`registry.ts`):**
- New attribute kind `{ kind: "formula" }` (raw expression) and `{ kind: "condition" }` (for `show`, below).
- `fieldAttrs.field` is no longer `required`; `TagSpec` gains `formula?: "readOnly" | "override"`. `readOnly`: `Value`, `Column`, `Tracker`. `override`: `Number`, `Text`, `Checkbox`. Others (`Image`, `Ref`, `Markdown`, `Select`, `Tags`, `Toggle`, `Field`, `List`, `Table`) take no `formula`; `Image` never may (a formula could build a URL that leaks data the viewer can read).
- `Column` gains `format` (plain/signed).
- New tag `Define`: category `"definition"`, attributes `name` (identifier, required), `params` (comma list of identifiers, at most 8, no duplicates, none reserved), `formula` (required). Only at the top level or directly inside `<Sheet>`. `Node.vue` renders nothing for it.

**Validator (`validate.ts`):**
- First pass collects all `Define`s (hoisted; order doesn't matter): duplicate names are errors; a name that is a v1 built-in or reserved (`formulaReservedNames`: the v1 table, `roll`, `dice`, `adv`, `dis`, reserved words) is an error; a name that is a built-in added after v1 (`formulaLaterBuiltins`, empty now) is a warning `formula-shadows-builtin` ("<name> is now a built-in function; this sheet's definition is used. Rename it to use the built-in.") and the definition wins in that sheet. Bodies are checked with parameters typed `any`, against the root scope. Cycles: DFS over calls between definitions; every definition in a cycle gets `formula-cycle` naming it (`a() → b() → a()`).
- Tag rules: neither `field` nor `formula` → error; both on a tag that isn't `override` → error; `live`/`locked` written on a `readOnly` formula tag → warning `flag-no-effect`.
- Paths in formulas go through the existing `resolve()`/`step()` with a loc inside the formula, so strictness, free-form objects, `content-too-deep`, and `showSheetWarnings` apply unchanged. Only path warnings count as schema warnings.
- Result type must fit: `Number` and `Tracker` number; `Text` string; `Checkbox` boolean; `Column` a scalar; `Value` anything; number attributes number; `{= }` in text anything scalar; `show` boolean or null. For `override` tags the result also has to fit the field's schema type. Mismatch: `formula-result-type`.
- Store compiled formulas on the validated tree: `ValidatedElement.formula?: { ast, type }`, formula text parts carry `ast`, number attributes may be a compiled formula (`AttrValue` gains it). `ValidationResult` gains `definitions` (name → params, type, AST) for the renderer and editor.
- Diagnostic codes: `formula-syntax`, `formula-unknown-function`, `formula-arity`, `formula-cycle`, `formula-too-large`, `formula-type`, `formula-result-type`, `formula-reserved-name`, `formula-shadows-builtin`, plus `flag-no-effect`. A dice token anywhere is an error ("dice rolls aren't available here yet").
- Server: `assertValidSheetMarkup` already rejects errors; check that formula errors block a save and that `findSheetsBrokenBy` lists a sheet a schema change newly breaks (`abilities.str` number → string breaks `mod(abilities.str)`), with a test.

**Rendering:**
- `Renderer.vue`: one `computed` per definition without parameters, reachable through `SheetContext`; definitions with parameters are evaluated inline at each call. `useSheet()` gains `evaluate(ast)` using the current scope; `text()` and `number()` handle formula parts and compiled number attributes.
- `Field.vue`: no longer assumes `binding!`. Formula-only: `resolved = { value: evaluate(formula), path: null }`, so `useSheetEditable` already makes it read-only; `display="box"` still shows the disabled input. Label: `label` attribute, else empty.
- **Override (user decision):** the field holds an optional manual value; absent, `null`, or (for `Text`) `""` means automatic. Shown value: the stored value if present, else the computed one. Editing edits the field; the computed value is the input's placeholder (`FieldInput` gets a `placeholder` fallback prop; for `Checkbox`, the box shows the computed state while automatic). When a stored value exists and the field is editable, a small ghost button (`i-lucide-rotate-ccw`, `aria-label="Use automatic value"`) next to the label removes it (`context.update(path, undefined)` → `setSheetValue` deletes or sets undefined; make sure the key is removed so strict schemas stay valid). This is what makes `Checkbox` overrides workable. `live`/`locked`/`display` apply to the field part as today.
- `Table.vue`: column headers fall back to `label` without a binding; formula columns render per row (row scope) and honor `format`.
- **Errors (decision 7):** a `FormulaError` renders "—" for everyone; when `context.showInvalid` (people who can edit the sheet) it also shows a small warning icon whose `title` is the message (text parts: "—" plus the icon). Never throw from a component.

## Step 3: conditional display (`show`)

- A common attribute on every tag (including `noFlagAttrs` tags such as `Tab` and `RowDetails`), except `Column` (error: "use show on the Table, or a formula in the column"). Its value is exactly one `{= expr}` or one `{path}`; anything else is an error. The result must be boolean or null.
- Evaluated in the tag's scope (inside a `List`/`Table` row, the row). `false` or `null` hides the tag and everything in it, in every mode; data is never cleared.
- `Node.vue`: wrap in `v-if`. `Tabs.vue`: hidden tabs leave the tab list; if the selected tab becomes hidden, select the first visible one; if all are hidden, render nothing. `RowDetails`: evaluated per row; a hidden one means that row has no expand button.
- A `show` formula that errors **shows** the tag (an author never loses content to a typo), with the editor-only warning icon.
- Hidden tags still validate fully.

## Step 4: editor support

- **Completion** (`CodeEditor.client.vue`, `fieldPathSource`): detect formula context with `syntaxTree(state).resolveInner(pos, -1)` (an `AttributeValue` of `formula`, or an unclosed `{=` before the cursor in text or any attribute value). Offer paths (reuse the List-item tail logic), built-ins with signature and description from `formula-functions.ts`, and the sheet's definitions with their params (a new `formulaDefinitions` prop fed from the last compile's `definitions` in `edit.vue`).
- **Colors (user request):** built-in function names, the sheet's own definitions, and parameters get distinct highlighting. A `ViewPlugin` decorates formula ranges using our lexer (ranges found from the syntax tree, or from the last compile's formula locations; pick whichever is simpler and correct after edits). Classes `cm-formula-builtin`, `cm-formula-define`, `cm-formula-param`, colored with existing theme roles (follow `docs/theme.md`; no raw hex in components; reuse how the editor theme is already colored, and check contrast with the editor's background).
- **Spike first:** check how `@codemirror/lang-xml` treats `{= a <b}` in text and `<` inside attribute values. If it breaks highlighting, the docs say to put spaces around `<` (our parser accepts both); don't fork the grammar.
- **Reference slide-over:** a "Formulas" section generated from the function table: operators, functions, `Define` and calls, `show`, overrides, limits.
- Problems list and lint positions already work through line/column once formula diagnostics carry exact locs.

## Step 5: docs and skill

- `docs/sheet-system.md`: §1 syntax (`{= expr}`, the raw `formula` attribute) and AST; §2 `formula` on field tags (which tags, read-only vs override), `Define`, `show`, `Column format`; a new "Formulas" section (grammar, functions, types and nulls, errors and who sees them, limits, scoping, calls without sigil and reserved names, `get`, dice reservation, the no-URL-output rule); §3 the new validation rows; §5 how formula fields, overrides, and `show` behave in view and edit mode; §8 phase 9: formulas and conditional display done. Record the decisions: render time only, never stored, schema-level computed fields maybe later.
- Sheets skill: `SKILL.md` (interpolation, a Formulas section, binding rules), `references/tags.md` (`formula`, `Define`, `show`, `Column format`), `references/examples.md` (the D&D example above, full), `references/checking.md` ("formula path warnings follow the same rules; the check doesn't evaluate formulas"). These are agent files, but they document this feature's code, so they ship in this PR.
- `CLAUDE.md`'s Sheet bullet: name the formula files in `shared/sheet/` and add "Formulas are computed at render time, never stored (see docs/sheet-system.md)". This is a rule-file change: say so in the PR.
- OpenAPI: one sentence in `server/api/content/[id].get.ts`'s description: values computed by a sheet's formulas aren't part of `data`.

## Step 6: tests across the app

- `parser.test.ts`: `{=` scanning past `<` and `}` in strings; old `{path}` unchanged; `valueLoc`/`raw`; `formula` attributes raw.
- `validate.test.ts`: types over strict, non-strict, `scalar`, `object`, `content`; result type per tag; overrides; cycles, arity, unknown functions, reserved names, later-built-in warning, params hiding paths only in their definition; `Define` placement; `show` rules; diagnostic positions inside attributes and `{= }`; the D&D example compiles with no diagnostics against a matching schema.
- `runtime.test.ts`: formula parts in `interpolateSheetText`; compiled number attributes; override fallback; `get`.
- `generate.test.ts`: generated sheets still validate clean.

## Step 7: verify in the browser and measure

- Dev server from the worktree on a spare port (3005): `scripts/agent-run.sh pnpm nuxt dev --dotenv /Users/lucy/Developer/games/soultabletop/.env.local --port 3005` (adjust the path on the other machine). Check `lsof` first; never kill a server you didn't start; stop yours at the end.
- Playwright from the scratchpad (`channel: "chrome"` on the Mac; the cached headless shell on CachyOS) with `withSmokeUser`: create a content type (a small D&D-like schema), a sheet using every feature above, and content, through the API; delete them before the callback ends (the helper deletes only the user).
- Check: edit mode, change STR → modifier, skills, saves, DC update without reload; `display="box"` shows computed values as disabled inputs; override: placeholder shows the computed value, typing overrides, the reset button returns to automatic (Number and Checkbox); `show` hides the Spells tab and brings it back; a division-by-zero formula shows the warning to the owner and "—" to a second smoke user given read access; the sheet editor's Problems list jumps to the right column inside `formula="…"`; completion offers `floor` and `mod`, colored differently; no console errors and **no hydration warnings** (SSR determinism).
- Measure: a pathological sheet (the limits' worst case: 2,000 sites, a 500-row list, nested aggregates) rendered by the dev server (SSR) and in the browser. If a page render is over 200 ms, lower `formulaLimits` steps and record the numbers in the PR.
- Screenshots of the converted sections at desktop and phone width go in the PR description (as text descriptions if images can't be attached).

## Step 8 (after the PR, needs the user): convert the D&D 2024 test sheet

Not part of the PR. The test sheet's files are on the user's CachyOS machine (the database copies were changed on purpose while testing the UI; don't use them). On that machine, after the PR's preview works: rewrite the hand-typed modifiers, skills, saves, passive Perception, spell DC/attack, and initiative with formulas, use `show` for the Spells tab and empty spell levels, and upload with a one-time script in the scratchpad (not committed): a user API key from the user (`x-api-key` header, read from an env var they set, never printed), `PATCH` the sheet's markup by owner and readable ID (`/api/sheet/<owner>/<readableId>`), and the content type schema if it needs choice values. Report what formulas couldn't express: that list feeds the "Sheet features found missing" and "Class and level driven sheet data" items in `TODO.md`.

---

## Out of scope

Schema-level computed fields (values in the API), dice buttons and rolls, choice fields and schema defaults, tables over fixed rows, content pickers, class/level automation, sandboxed JavaScript. All are in `TODO.md`.

## Kickoff line for the fresh session

"Read /Users/lucy/Developer/games/soultabletop/.claude/plans/sheet-formulas-build.md (on the docs branch) and build it as written, following .claude/CLAUDE.md."
