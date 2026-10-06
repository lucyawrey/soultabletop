# Sheet System — Design

## Context
TODO.md's top item: sheets store `markup` + `cssStyles` (`server/database/schema.ts` `sheet` table) but they are only
displayed as raw text, and content is edited as a raw JSON textarea (`app/components/ContentDetail.vue`). Goal: sheet
markup renders content as Nuxt UI character/content sheets, in view and edit mode.

Decisions so far:
- Syntax: HTML-like component tags from a fixed allowlist, rendered by Nuxt UI components.
- Sheets both view and edit content data (JSON editor kept as "Advanced").
- CSS: kept, sanitized + scoped under the sheet root.
- Computed values: formulas, a small expression language of our own (never `eval` or JavaScript), computed when a
  sheet is shown and **never stored** (see "Formulas"). Values computed at the schema level, which the API could
  return, may come later.
- A viewer who can read content but not its selected sheet gets the **generated** sheet (section 4).
- Add `vitest` (for parser, validator, CSS sanitizer).
- Remove `localType` from `ContentFieldSchema` (`schema.ts:118`, `content-validation.ts:25`). While there, validate
  content type `schema` bodies against the `ContentFieldSchema` shape — `api-schemas.ts:58` currently accepts any object.

Sections: 1. markup language + parser → 2. tag catalog → 3. validation against schema → 4. generated sheets →
5. renderer/view+edit → 6. CSS → 7. editor page → 8. implementation phases → Formulas.

---

## 1. Markup language & parser

### Pipeline (all in `shared/sheet/`, used by server and client)
1. `parseSheetMarkup(source) → { nodes, diagnostics }` (top-level nodes; `<Sheet>` is optional) — syntax only, knows nothing about tags. Error-recovering: collects all
   errors with line/column instead of stopping at the first.
2. `validate(nodes, registry, contentTypeSchema) → { tree, diagnostics }` — checks tags/attrs/children/field bindings,
   coerces attribute strings to typed props, outputs a normalized tree the renderer consumes.
3. Renderer only ever sees the validated tree. Only `markup` source is stored; parse+validate runs on save (reject on
   errors) and on load (cheap; cache later if needed).

### Syntax
- Elements: `<Section title="Abilities">…</Section>`, self-closing `<Number field="str" />`.
- Tag names: PascalCase canonical (`Section`); matched case-insensitively so `<section>` works. (decided)
- Attributes: `name="value"` or `name='value'`; bare `name` = boolean true. No unquoted values. Duplicate attr = error.
- Text: allowed directly inside layout tags; renders as a paragraph. Whitespace collapsed like HTML. (decided)
- Formulas: every `{…}` in text and in attribute values is a formula (see "Formulas"); `{hp}` is the formula `hp`, and
  shows what the `hp` field displays, computed value included (decided 2026-10-04: there is no separate `{path}`
  lookup, and `{= expr}` is gone). A missing value is empty. After an unescaped `{`, the parser jumps to the
  matching `}`, skipping quoted text, so `{a <b}` isn't read as a tag and `{concat('}', x)}` works; in attribute
  values the formula still ends at the attribute's closing quote. `{}` is an error, and so is `{= …}`. Literal
  braces: `\{` `\}`, literal backslash `\\`. The attributes `formula` and `show` are bare formulas: the parser
  doesn't look for `{…}` or entities in them, and the validator parses each as one expression (inside them, text
  goes in single quotes).
- Comments: `<!-- … -->`.
- Entities: `&lt; &gt; &amp; &quot; &apos;` and numeric `&#123;` / `&#x7B;`.
- No raw HTML, no `on*`/event attrs, no `style` attr, no URLs (internal `Ref` links only). Everything renders as text
  through Vue, so there is no HTML injection path.

### Field paths
- Dotted: `field="stats.str"`, numeric segments allowed (`attacks.0.name`).
- Inside `<List field="inventory">`, paths are relative to the current item; a leading `/` means root
  (`/name`). Same rule for `{…}` interpolation. Nested Lists: relative to the innermost item. (decided)

### AST (parser output)
```ts
type Loc = { start: { line: number; column: number; offset: number }; end: { … } };
type SheetNode = SheetElement | SheetText;
interface SheetElement { type: "element"; tag: string; attrs: SheetAttr[]; children: SheetNode[]; selfClosing: boolean; loc: Loc }
interface SheetAttr    { name: string; value: TextPart[] | true; loc: Loc; raw?: string; valueLoc?: Loc }
interface SheetText    { type: "text"; parts: TextPart[]; loc: Loc }
type TextPart = string | { path: string; loc: Loc } | { formula: string; loc: Loc; bodyStart: Position; ast? };
interface SheetDiagnostic { severity: "error" | "warning"; message: string; loc: Loc; code: string }
```

### Error recovery
- Mismatched close tag: if it matches an open ancestor, auto-close the tags in between (one "unclosed <X>" error each);
  otherwise report "unexpected </X>" and ignore it.
- EOF with open tags → "unclosed <X>" pointing at the open tag.
- Bad attribute syntax → error, skip to next `>`/whitespace, keep going.
- Unterminated comment/string/`{` → error at its start.

### Limits (enforced by parser)
- Source ≤ 100 KB, nesting depth ≤ 32, ≤ 5,000 nodes → error beyond.

### Implementation
- Hand-written scanner + recursive-descent parser, ~200–300 lines, no dependency: `shared/sheet/parser.ts`
  (decided over XML libraries / `htmlparser2`: our syntax isn't valid XML — valueless attrs, case-insensitive tags;
  strict XML parsers stop at the first error and lenient ones never report errors; interpolation/escapes/limits
  would need our own pass anyway; no DTD/entity-expansion surface).
- Tests: `shared/sheet/parser.test.ts` (vitest) — valid trees, every error kind with exact line/col, recovery keeps
  later valid nodes, entity/escape/interpolation handling, limits.

---

## 2. Tag catalog

Registry: `shared/sheet/registry.ts`. Each entry declares attrs (type: text | number | boolean | enum | fieldPath |
list | formula | condition | name; required; default), allowed children, and which schema field types it may bind to.
Number attrs read when rendering (`Tracker` `max`; `Number` `min`, `max`, `step`) accept one
`{formula}` (e.g. `max="{hpMax}"`); the others (`cols`, `span`, `level`) take plain numbers. Text attrs accept both
mixed with text.
Every tag also accepts `class` (names matching `[a-z][a-z0-9-]*`), `show` (conditional display; not on `Column`), and
`live`, `locked`, and `display` (section 5; `Tab` and `RowDetails` accept only `class` and `show`; `Define` accepts
none), and renders a fixed hook class `sheet-<tag>`. Field tags also render fixed hooks inside: `sheet-field-label` on the visible label (for `Number variant="stat"` the small label under the number; not rendered with `hideLabel` or in `Column` cells) and `sheet-field-value` on a wrapper around the value or input. Sheet CSS targets these instead of `:first-child` or component classes.

### Layout
| Tag | Attrs | Children | Renders |
|---|---|---|---|
| `Sheet` | `density` (roomy/compact, default roomy) | any | root wrapper; optional (implicit if omitted); top level only |
| `Section` | `title`, `description`, `icon`, `span` | any | `UCard` with header (the title is an h2, like `Heading level="1"`) |
| `Grid` | `cols` (1–12, default 2), `gap` (none/sm/md/lg) | any | CSS grid, 1 column on mobile |
| `Stack` | `direction` (row/column), `gap`, `align`, `wrap` | any | flex container |
| `Tabs` / `Tab` | Tab: `label` (req), `icon` | Tabs: only `Tab` | `UTabs` |
| `Divider` | `label` | none | `USeparator` |
| `Heading` | `level` (1–4) | text | h2–h5 |
| `Note` | — | text | muted paragraph |
| `Callout` | `color`, `icon`, `title` | text | `UAlert` |
| `Badge` | `color` | text | `UBadge` |
| `Collapsible` | `title` (req), `subtitle`, `icon`, `open` | any | `UCollapsible`: clickable header, children shown on expand (e.g. one per `List` item) |

`density` (decided 2026-10-06, from the [PF2e sheet mockup](../.claude/mockups/pf2e-sheet/spec.md)): `roomy` is the
site's form spacing; `compact` is for dense character sheets, with no custom CSS: the smallest inputs (Nuxt UI size
`xs`), small uppercase field labels, smaller stats, tighter Section padding and Table cells, and every gap one step
tighter (`Grid`/`Stack` `gap="md"` is `gap-2`; `sheetGapCompact` in `app/utils/sheet-layout.ts`). The sheet root
carries `data-density="compact"` (or `roomy`) for Sheet CSS. Components read it through `useSheetCompact()`.

`Section` also accepts `collapsible` and `collapsed`. `Table` accepts a `RowDetails` child (any content) rendered
in `UTable`'s expandable rows.

`icon` takes an Iconify name from the two bundled sets only: Lucide (`i-lucide-sword`) and game-icons.net
(`i-game-icons-crossed-swords`, CC BY 3.0, credited on `/credits`); any other set is an `invalid-attribute` error
(`SHEET_ICON_COLLECTIONS` in `shared/sheet/validate.ts`). The app serves icons only from its own bundle
(`icon` in `nuxt.config.ts`, no fallback to Iconify's public API), so a sheet never makes browsers fetch from a
third party.

### Fields
Common attrs: `field`, `label` (default: humanized last path segment, `hitPoints` → "Hit Points"), `hideLabel` (boolean), `hint`.
View mode renders formatted values, edit mode renders the input.

`field` is required unless the tag has a `formula` (decided):
- **Read-only formula tags**: `Value`, `Column`, `Tracker` take `field` or `formula`, not both. With `formula` the
  tag shows the computed value and is never editable (a `Tracker` formula is its current value; its `max` can be a
  `{formula}` too). Its label is the `label` attribute, else empty.
- **Override tags**: `Number`, `Text`, `Checkbox` (and `Field`, see below) take `field`, `formula`, or both. With both, the field holds an
  optional manual value that wins over the computed one; absent, `null`, or (for `Text`) `""` means automatic. While
  automatic, the input shows the computed value as its placeholder (a `Checkbox` shows the computed state), typing
  stores a manual value, and a small "Use automatic value" button (`i-lucide-rotate-ccw`) beside the label removes it
  (the key is deleted, so strict schemas stay valid). With `formula` alone they are read-only like `Value`.
- **Cascading computed values**: an override at the top level (not inside a `List` or `Table` row) also stands in for
  its field in other formulas: a formula reading that path while nothing is stored there gets the computed value, so
  `<Number field="hp" formula="maxHp" />` follows `<Number field="maxHp" formula="…" />` until either is typed in.
  An override inside a hidden region (`show`) still counts. Fields that compute each other give an error value
  (`formula-cycle`), and chains deeper than the call depth limit give `too-deep`. `{hp}` text shows the computed value too, while field
  tags show the stored one. A field may carry the same formula (spacing and
  parentheses aside) on several tags; a different one is an error (`computed-field-conflict`).
- **`Field` with a formula**: `Field` takes `formula` (with `field`, required) on a `string`, `number`, or `boolean`
  schema field only, and then acts exactly like `Text`, `Number`, or `Checkbox` (override, reset button, cascading);
  any other schema type is an error (`invalid-attribute`), and `Field` with
  `formula` alone is a `missing-attribute` error (use `Value`).
- Every other field tag (`Select`, `Tags`, `Toggle`, `Ref`, `Markdown`, `Image`) takes no `formula`.
  `Image` never will: a formula could build a URL that sends data the viewer can read to another site.

| Tag | Extra attrs | Binds | Edit input |
|---|---|---|---|
| `Text` | `multiline`, `placeholder` | string | `UInput` / `UTextarea` |
| `Number` | `min`, `max`, `step`, `format` (plain/signed), `variant` (input/stat) | number | `UInputNumber` (`signed` uses `signDisplay: "exceptZero"` so the input shows "+3" and still stores a number); `stat` = big centered number + small label (no separate `Stat` tag — decided) |
| `Checkbox` / `Toggle` | Checkbox: `style` (check/dot) | boolean | `UCheckbox` / `USwitch`; `style="dot"` is a filled or empty circle in every mode, with no Yes/No text (e.g. proficiency marks) |
| `Select` | `options` (comma list; only for a text field without schema options) | string, or number with schema options | `USelect` of the field's options (labels shown, values stored) |
| `Tags` | — | array of string (not of choices) | `UInputTags` |
| `Tracker` | `max` (optional, at least 0), `style` (bar/pips) | number | `UProgress` or pip boxes; without a `max`, or when it is 0, just the value (a number input when editing), with no "/ max" |
| `Ref` | — | resourceLink / `content` | link to the resource; edit: picker (see "Content fields"; for `resourceLink`, a picker of readable resources of the field's `kind`, or of a chosen kind) |
| `Value` | `format`, `formula` | any | read-only in both modes |
| `Field` | — | string, number, boolean, scalar, object, resourceLink, content, array of string or of choices (not a struct or an array of objects) | picks input from schema type (decided): a field with options gets a `USelect`, an array of choices a multiple `USelectMenu`; generated sheets mostly use this. `scalar`: input with a type switch (string / number / boolean / null); free-form `object`: inline JSON editor (CodeMirror) |
| `Markdown` | — | string | view: safe Markdown subset (no raw HTML); edit: `UEditor` in Markdown mode (decided) |
| `Image` | `alt`, `size` | string (image URL) | view: `<img referrerpolicy="no-referrer">`; edit: URL input (decided) |

Image URLs: https only. The schema has no image type, so this is enforced where the tag is used: `Image` renders only
https URLs, and its edit input validates client-side. Uploads later, same field shape.

Label resolution: `label` attr → schema field `label` → humanized field name. `hint` falls back to schema
`description`. (decided: `ContentFieldSchema` entries gain optional `label` and `description`.)

Hiding a label (decided): `hideLabel` on any field tag or `Column`. The label is not shown (a Column's header is left empty) but still names the input for screen readers. An explicit `label=""` is not used for this: it stays "no label given" and falls back to the schema label, so the two are not confused. `List` and `Table` already show no label unless `label` is given.

### Choice fields (decided 2026-10-04)
- A `string` or `number` schema field may have `options: [{ value, label? }]` (1–200, values unique and of the
  field's type, labels 1–100 characters, defaulting to the value as text). It stays a string or number everywhere
  else (formula types, binding, formatting); `fieldOptions`, `choiceLabel`, and `fieldOptionsError` are in
  `shared/content-schema.ts`. Number options let ranks be stored as `0`–`4` and shown as Untrained…Legendary.
- Content save rejects a value that isn't listed, whatever the strictness; absent means no choice, and `""` is only
  valid if listed. A required choice field starts at its first option (`defaultContentData`, new List items, sample
  data). Changing options never touches saved data: an unlisted stored value shows as it is, and a `Select` lists it
  as "… (not an option)" until it's changed.
- `Select` without `options` uses the schema's options; with `options` on a field that has schema options it's a
  warning (`options-ignored`) and the schema's list wins, so adding options never breaks a sheet. On a field without
  schema options the attribute works as before (and is required). `Field`, `Column`, and generated sheets show a
  `Select` for a field with options.
- Free inputs (`Text`, `Number`, `Tracker`, `Markdown`, `Image`, `Tags`) on a field with options, or on an array of
  them, are an error (`wrong-field-type`); so is `Field` with a `formula` on one (`invalid-attribute`). Formula-only
  tags are unaffected.
- Labels, not values, show wherever a choice field is shown as text: view mode, `display="text"`, `Value` and
  `Column` bound by `field`, and a `{…}` that is just a path to the field (`{rank}` → "Expert"). Any other formula
  sees the stored value (`{rank + 0}` → `2`), and a formula's result is never relabeled.
- The schema builder shows an **Options** checkbox on string and number fields (and array items), with value and
  label rows reordered by dragging (`app/components/schema/Options.vue`).

### Default values (decided 2026-10-05)
- `string`, `number`, `boolean`, `scalar`, and `array` fields (and array item types) may have a `default`: a value of
  the field (one of a choice field's options), or for an array a list of starting items, at most 100
  (`MAX_DEFAULT_ITEMS`). Struct items in an array default must have their required entries and no others. Defaults
  can't hold `object`, `content`, or `resourceLink` values, and those types can't have one. Checked on schema save
  (`fieldDefaultError` in `shared/content-schema.ts`) and in the builder.
- **Stored on create**, never a fallback when reading: a copy goes into new Content created without data
  (`defaultContentData`, required or not; an optional struct is created when its entries have defaults, unless a
required `resourceLink` or `content` entry without a default would be left empty and fail the next save), into a new List
  item or field (`defaultSheetValue`; a struct item gets its entries' defaults), and into the editor preview's sample
  data. Changing a default never touches saved data, and a cleared field stays cleared. A default wins over a required
  field's empty value or first option.
- The schema builder shows a **Default** input (`app/components/schema/Default.vue`): text, a number, a select for
  boolean and choice fields, and JSON for `scalar` and `array`; empty means none.

### Content fields: references and local data (decided)
- Schema type `{ type: "content", contentTypeId, allow: "reference" | "local" | "both", required }` replaces the old
  `contentType` type (whose validator wrongly required the value to equal the content type id).
- Value is a **string** = id of an existing content of that content type (reference), or an **object** = local data
  validated against that content type's schema, including its own `name`. `allow` restricts which forms are accepted.
- Paths continue through it into that content type's schema: `class.hitDie`, `class.name`, `item.weight`. Works in
  arrays: `inventory: [{ item: content(Item), qty: number }]` → `item.weight` next to `qty`.
- Referenced values are **live and read-only** through the sheet; local values are editable. Edit mode shows a
  searchable picker of readable content of that type (for `reference`/`both`), a "Custom" option creating a local object
  (for `local`/`both`), and "Make custom copy" turning a reference into local data.
- Depth: paths may cross up to **3** content fields (`class.subclass.feature.name`); deeper is a validation error.
- Loading: `GET /api/content/[id]` walks the data, batch-loads referenced content one level at a time (≤ 3 queries),
  skips cycles, caps at 300 refs, drops any the viewer can't read, and returns
  `refs: { [id]: { name, contentTypeId, data } }`. Unreadable or missing refs render as "Restricted"/"Missing".
- Validation: content save checks each referenced id exists, has the right content type, and is readable by the
  saving user; it validates local objects
  against the referenced schema (recursing up to depth 3; cycles in content type schemas stop there).
  The sheet validator loads the referenced content type schemas (server: batch query; client: sent with the content
  GET / editor page as `schemas: { [contentTypeId]: schema }`).
- Content list API gains `?contentTypeId=` filtering for the picker.

### Built-in `name` field (decided)
- Every content type implicitly has a required string field `name`, bound to the content's `resource.name` rather than
  `content.data`. No other resource/content column is exposed this way.
- Renderer root scope is `{ ...data, name: resource.name }`; on save the `name` key is split out and sent as the PATCH
  `name` (same request), the rest as `data`.
- Content type schemas may not define a `name` key (rejected on content type create/update).
- If content create/update `data` contains a `name` key, it is moved to the resource name and removed from `data`
  (an explicit body `name` wins if both are sent). Existing test rows: same move in a migration. (decided)
- The validator treats `name` as a known string field, so `<Text field="name" />` / `{/name}` always work.

### Repeaters
| Tag | Attrs | Children | Notes |
|---|---|---|---|
| `List` | `field` (array, or struct of alike entries), `layout` (stack/grid), `cols`, `addLabel` | template for one item | edit mode: add/remove/reorder (arrays only); `field="."` = the item itself (arrays of primitives, or a struct's single-value entries) |
| `Table` / `Column` | Table: `field` (array of objects, or struct of alike structs); Column: `field` or `formula`, `label`, `format` (plain/signed), `width` | Table: only `Column` and `RowDetails` | `UTable`; cell input picked from schema type; a formula column is computed per row. On phones (below the `sm` breakpoint) each row stacks its cells, with the column labels above them |

Repeating over a struct's entries (decided 2026-10-04): `List` and `Table` also take a `struct`, for fixed sets like
skills and saves. Its rows are the schema's entries in schema order, not the data's keys, so every entry shows even
with nothing stored, and editing a cell writes into it (creating the objects on the way); there are no add, remove,
or reorder controls (`addLabel` is a `flag-no-effect` warning). The entries must all be alike: the same type and
fields (labels, descriptions, and `required` may differ), each a struct (`Table` needs this) or a single value
(`string`, `number`, `boolean`, `scalar`; only `List`). `structRows` in `validate.ts` decides this, and validated
`List`/`Table` nodes carry the rows as `entries`; relative paths are checked against the first entry, which stands for
all. Free-form objects and non-strict extra keys are never repeated over. In a struct row, `field="."` is labeled by
its entry (`<List field="attributes"><Number field="." /></List>` shows "Str", "Dex", …, from the schema labels). Each
row knows its key and label for `itemKey()` and `itemLabel()` (see "Formulas"; `SheetScope.item`, `entryScopes` in
`scope.ts`).

### Definitions and conditional display
- `<Define name="prof" params="rank" formula="…" />`: a reusable formula, called as `prof(x)` (one without
  parameters as `pb()`) from any formula in the sheet. Only at the top level or directly inside `<Sheet>`; order
  doesn't matter; renders nothing. See "Formulas".
- `show="expr"`, a bare formula like `formula=` (`show="hp > 0"`, `show="hasShield"`; no braces): `true` shows the tag, `false` or nothing hides it and
  everything in it, in every mode; the data is never cleared. It is evaluated in the tag's scope (a `List` or `Table`
  row inside one). Hidden tabs leave the tab list (if the selected one hides, the first visible one is selected; with
  none visible, `Tabs` renders nothing); a `RowDetails` hidden for a row takes away that row's expand button. Not on
  `Column` ("use show on the Table, or a formula in the column"). A `show` formula that fails **shows** the tag, so
  a typo never hides content. Hidden tags are still fully validated.

---

## 3. Validation against the ContentType schema

`validate()` in `shared/sheet/validate.ts`. Errors block sheet save; warnings are shown in the editor only.

Schema-related warnings (the three "warning" rows marked \* below: a path or `{…}` formula path not in a non-strict schema, and a path into a free-form `object`) are hidden unless
the Sheet's own content type has `showSheetWarnings` on (`content_type.show_sheet_warnings`, default off; the switch
is shown only while Strict schema is off). Referenced content types' flags are not consulted. Errors, and other warnings
(e.g. a content type that could not be loaded), are never affected, and the "break existing sheets" check on content type
edits counts errors only. Switching a content type from strict to non-strict turns the option on unless the request sets
it (server: `resolveShowSheetWarnings` in `shared/content-schema.ts`; the form pre-sets it).

Structural (errors): unknown tag; unknown attr; missing required attr; attr value not coercible (e.g. `cols="abc"`,
enum out of range); child not allowed (e.g. non-`Tab` in `Tabs`, children in `Divider`).

Formulas (errors unless noted; codes in parentheses):
| Case | Result |
|---|---|
| Syntax error, with its exact line and column inside the attribute or `{ }` | error (`formula-syntax`) |
| Unknown function, wrong number of arguments | error (`formula-unknown-function`, `formula-arity`) |
| Operator or argument type that can never work (`name + 1` on a text field) | error (`formula-type`) |
| Result doesn't fit the tag (`Number`/`Tracker`: number, `Text`: text, `Checkbox`: true/false, `Column`: a single value, `show`: true/false/nothing, number attrs: number; any tag: a list or group of fields) or, for overrides, the field | error (`formula-result-type`) |
| Neither `field` nor `formula` on a field tag; both on a tag that doesn't override | error |
| `live`/`locked` on a field tag with a formula and no field | warning (`flag-no-effect`) |
| Dice (`2d6`, `roll(…)`) | error (`formula-dice`) |
| `<Define>`: duplicate name; a built-in or reserved name; invalid params; a cycle (every definition in it) | error (`duplicate-definition`, `formula-reserved-name`, `invalid-attribute`, `formula-cycle`) |
| `<Define>` named like a built-in added after v1 | warning (`formula-shadows-builtin`); the definition wins in that sheet |
| `<Define>` name or parameter that looks like dice (`d6`) | error (`formula-reserved-name`, `invalid-attribute`) |
| Two top-level overrides of the same field with different formulas | error (`computed-field-conflict`) |
| An override (`field` and `formula`) on a required field | warning (`override-required`): going back to the computed value clears the field, which can't be saved |
| An unclosed `{` (no `}` within 1,000 characters or before a closing tag) | error (`unterminated-formula`) |
| Over a limit (see "Formulas") | error (`formula-too-large`) |
| Paths in formulas | the same rules as `field` paths above (strictness, free-form objects, `content-too-deep`, `showSheetWarnings`) |

The checker only reports what can never work: a `scalar` field, a path the schema doesn't know, or a free-form
`object` path has an unknown type and passes. Messages are deterministic, since the "break existing sheets" check
compares them (`newSheetErrors` in `validate.ts`).

Field paths — resolved through the schema, following `List` scopes (relative to innermost item, `/` = root, `.` =
the item):
| Case | Strict schema | Non-strict schema |
|---|---|---|
| Path not in schema | error | warning\* (data may hold extra keys) |
| Tag can't bind that field type (e.g. `Number` on a string) | error | error |
| Free input on a field with options (e.g. `Text` on a choice field) | error | error |
| `Select` with its own `options` on a field with schema options | warning (`options-ignored`; the schema wins) | same |
| Field is `scalar` | binds `Field`, `Value`, `Column`; no paths below it | same |
| Path goes into a free-form `object` | warning\* (not checked; shows whatever the data holds) | same |
| `List`/`Table` on a non-array (a struct whose entries aren't alike; `Table` on a struct of single values) | error | error |
| Relative path inside a `List` of primitives (other than `.`) | error | error |
| `{…}` formula path not in schema | error | warning\* |
| Path crosses > 3 `content` fields | error | error |
| Path continues into a `content` field | resolved against the referenced content type's schema (its strictness applies) | same |

Render time (data can drift from the schema, e.g. non-strict types or older rows): a missing value renders empty,
a wrong-typed value renders as read-only text. Neither throws.

Schema edits that break sheets (decided): content type PATCH validates every sheet of that type against the new schema.
If any gain errors and the body lacks `confirmBrokenSheets: true`, return 409 with the affected sheets (id, name,
first errors); the UI lists them with links and asks to confirm, then resends with the flag.

Sheets with errors still render (decided): each broken node becomes a placeholder ("Unknown field `hp`") for users
with edit access to the sheet, and is omitted for everyone else; valid nodes render normally.

---

## 4. Generated sheets

Generator: `generateSheetMarkup(schema)` in `shared/sheet/generate.ts`, a pure function (unit-tested) producing
ordinary markup, so it goes through the same parse/validate/render path as authored sheets:
- Top-level simple fields → one "Details" `Section` with `<Grid cols="2">`, starting with `<Text field="name" />`
  (the page header already shows the name, so no heading), then a `<Field>` per field.
- `struct` field → its own `Section` titled by label, recursing. Free-form `object` → a `Section` with a `<Field>` (JSON editor).
- Array of objects → `Table` when all item fields are primitive, else `List` with a nested layout.
- Struct of alike structs whose fields are all primitive (skills, each with a rank) → a `Table` over its entries, with
  an `itemLabel()` column first.
- Array of strings → `Tags` (of choices → `Field`, a multiple select); other primitive arrays → `List field="."`.
  A field with options gets a `Field`, which shows a `Select`.
- `resourceLink` → `Ref`. `content` field → a `Section` (arrays: a `List` of `Collapsible`s titled `{x.name}`)
  showing the referenced content type's primitive fields, one level deep, plus the ref/custom picker in edit mode.
- Order = schema key order. `content_type.schema` is `jsonb`, which does not preserve key order, so it becomes
  `json` (decided): Drizzle `json("schema")` + migration `ALTER COLUMN "schema" SET DATA TYPE json USING "schema"::json`
  (existing rows keep their already-scrambled order; test data only).

Storage (decided): **computed, never stored.** No sheet row, no sync code.
- Resolution for a content: if `content.sheetId` is set → that sheet if the viewer can read it, else generated.
  If unset → the content type's default sheet if readable, else generated.
- Visibility: available wherever the content is readable, which is always at least the content type's visibility.
- Shown as "Generated (from schema)" in sheet pickers; `sheetId: null` + no default = generated.
- "Copy to new Sheet" on the content type/sheet pages creates a normal sheet prefilled with the generated markup.
- Cost: one schema walk + normal parse/validate (sub-millisecond); no extra DB query since the content GET already
  loads the content type. If profiling ever shows a need, memoize per (sheet or contentType id, updatedAt).

---

## 5. Renderer, view & edit

API: `GET /api/content/[id]` adds `sheet: { id | null, name, markup, css, source: "selected" | "default" |
"generated" }` and `schema` (the ContentType schema, needed for `Field` and validation). Resolution per section 4.

Components (`app/components/sheet/`):
- `SheetRenderer.vue` — props: `markup`, `css`, `schema`, `modelValue` (data incl. `name`), `mode` (view/edit),
  `canEditSheet`. Runs parse+validate (computed), renders the tree, emits `update:modelValue`.
- `SheetNode.vue` — recursive; looks up the registry entry, renders the matching `Sheet*` component.
- One component per layout tag (`sheet/Section.vue`, …); all field tags share `sheet/Field.vue`, which picks the
  display from the tag (or the schema type for `Field`/`Column`). Components read values through `useSheet()`
  (`app/composables/useSheet.ts`); `List` rows and `Table` rows re-provide the scope via `sheet/Scope.vue`.
- Path resolution and formatting are framework-free in `shared/sheet/runtime.ts` (unit-tested). A string where
  fields are expected is a reference: it is looked up in `refs` and everything under it is read-only.
- `Markdown` renders with the editor's Markdown view (`UEditor`, `content-type="markdown"`) in both modes.

`ContentDetail.vue`:
- Replaces the Data card with `<SheetRenderer>`. The header's former Edit button is now **Settings** (so it isn't
  confused with the Edit Fields switch); its modal keeps Name, ID, Visibility, the saved sheet, and the raw JSON editor.
- The draft lives in `app/composables/useContentDraft.ts` (compares with sorted keys, since `content.data` is jsonb).
  Editing controls are `sheet/FieldInput.vue`; List/Table add/remove/reorder use `useSheetListEditing` and
  `sheet/ListAdd.vue`; `sheet/ContentPicker.vue` picks referenced content.

Edit + Autosave switches (decided):
- Header shows two switches when `canEdit`: **Edit** and **Autosave**. Their initial state comes from the sheet;
  toggling is per page view (not persisted).
- New `sheet` columns: `defaultEditMode boolean not null default false`, `defaultAutosave boolean not null default
  false`, editable in the sheet form/editor and accepted on sheet create/update.
- Generated sheets take defaults from the content type's `contentCategory`: `playerCharacter` → both on;
  `nonPlayerCharacter` → edit off, autosave on; `general`/`page` → both off. (Also `defaultDisplay`, below.)
- Edit on, Autosave off: draft copy, Save/Cancel buttons, unsaved-changes guard on navigation.
- Edit on, Autosave on: each change saves after ~800 ms of inactivity; status indicator (Saving… / Saved / Error).
  A validation error keeps the draft and shows the message; the next change retries.
- Edit off: read-only view (the Autosave switch only presets how editing behaves once turned on), except `live` fields,
  which save after the autosave pause whatever the Autosave setting (decided 2026-10-06: things changed in play, like
  HP, shouldn't need a Save click). Turning Edit off doesn't save unsaved edits; a live change saves the whole draft.
- One draft model for all modes: whenever the draft differs from the saved data and autosave is off, a
  Save/Discard bar is shown (covers `live` edits made in view mode).

Per-field attributes (decided), boolean, allowed on any field tag and on `List`/`Table`:
- `live` — editable even with Edit off (for users with `canEdit`). With Edit off, a change saves on its own after the
  autosave pause, with or without Autosave (`liveEdits` in `useContentDraft`); with Edit on it follows Autosave.
- `locked` — read-only even with Edit on until the user clicks the field's small pencil button, which unlocks that
  field for the rest of the page view.
- They compose: a field is editable when `canEdit && (editMode || live)`; if `locked`, it additionally needs its
  unlock click. `live locked` = editable in view mode after unlocking.
- Also allowed on layout tags, where they are inherited by every field inside; a descendant opts out with
  `live="false"` / `locked="false"`. Not on `Tab` and `RowDetails` (decided): their parents render them, so the
  attributes would do nothing and the validator reports them as unknown (`noFlagAttrs` in the registry). Put them on
  `Tabs`, `Table`, or a tag inside the panel.

Formula fields (decided): a formula is computed on every render from the current data (the draft while editing), so
editing a field updates everything computed from it without a reload. Formula-only fields are never editable;
`display="box"` shows them as their disabled input. Overrides behave as in section 2. A formula that fails shows "—"
to everyone, and to people who can edit the sheet also a small warning icon whose tooltip is the message.

Display of non-editable fields (decided): `display="text" | "box"`, allowed on any tag except `Tab` and `RowDetails`, and inherited like `live`/`locked`.
- `text` shows the plain value (good for stat blocks like a spell); `box` shows the field's edit control, disabled, so a
  sheet looks the same with Edit on and off (good for character sheets). It applies wherever a field isn't editable:
  Edit off, `locked` fields before their unlock click, viewers without edit access, and values reached through references.
- Not every field has a useful disabled control: `Value` and `Image` keep their normal view in `box`, and `Ref` /
  `content` / `resourceLink` fields show their link inside an input-style box so it stays clickable.
- The starting value comes from the sheet: new `sheet` column `defaultDisplay` (`sheet_display` enum, `text` | `box`,
  default `text`), accepted on sheet create/update and set in the editor's Settings as "Non-editable fields". New
  sheets and generated sheets take it from the content category: `playerCharacter` → `box`, everything else → `text`.
- Rendering: `SheetRenderer`'s `defaultDisplay` prop seeds the inherited flags (`provideSheetFlags` in `useSheet.ts`);
  `sheet/Field.vue` renders `sheet/FieldInput.vue` with `disabled` for boxed fields.

Concurrent edits (decided): content PATCH accepts `expectedUpdatedAt`; if `resource.updatedAt` differs → 409. UI
offers Reload (discard mine) or Overwrite (resend without the check). Autosave pauses on 409 until resolved, and
updates its `expectedUpdatedAt` from each successful response.

Viewer sheet switching (decided): a dropdown lists the generated sheet + every readable sheet of the content type;
the choice is local to that page view. Only editors change the saved `sheetId` (Edit modal).

---

## 6. Scoped CSS

`shared/sheet/css.ts`, using `postcss` + `postcss-selector-parser` (new dependencies; pure JS, so the editor preview
runs the exact same code in the browser, lazy-loaded there).

- On sheet save: parse; errors (with line/col) reject the save. Source ≤ 50 KB. Stored as authored.
- On serve (content GET / editor preview): every selector is prefixed with `[data-sheet="<sheetId>"]`; the sheet root
  element gets `data-sheet`, `isolation: isolate` and `contain: paint`. `contain: paint` also makes the root the
  containing block for `position: fixed`, so no position rules are needed — nothing can draw outside the sheet.
- The site has one light theme, so there is no color mode to follow: `.dark` is an ordinary class inside the sheet.
- `@media print { … }` is allowed and scoped like everything else, so sheets can adjust their printed page.
- Keyframe names are prefixed per sheet so they can't clash with the app's or other sheets'.
- Rejected: `@import`, `@font-face`, `@namespace`, `url()`, `image-set()`, `expression()`, `-moz-binding`,
  `behavior`. Allowed: `@media`, `@supports`, `@container`, `@layer`, `@keyframes`, CSS variables, `!important`.
- Authors match the site with its theme tokens (`var(--st-ink)`, `var(--st-primary)`, `var(--st-panel)`, …), listed in
  `shared/sheet/theme-tokens.ts` and documented in `docs/theme.md`. Their names are a stable contract: they're never
  renamed or removed when the theme changes. Nuxt UI's `--ui-*` variables also work but aren't part of that contract.
- Also rejected: other file-loading functions (`image()`, `cross-fade()`, `element()`, `paint()`), CSS escapes are
  decoded before checking, and `<` in the output is escaped (`\3c `) so CSS can't close its `<style>` element in SSR.
  Nested rules (CSS nesting) are left relative to their parent.
- Implementation: `shared/sheet/css.ts` (`processSheetCss`); the content GET returns the chosen sheet's CSS scoped;
  a sheet picked in "View with" is loaded with `GET /api/sheet/[id]`, whose `css` is scoped by the server too (the sheet list leaves out `markup` and `cssStyles`). The renderer injects it
  with `useHead` and marks its root with `data-sheet`, `isolate`, and `contain: paint`.

- `:root`, `html`, `body` are rewritten to the sheet root itself (decided), so `:root { --accent: red }` works.
- Selector rule (security boundary): every selector's subject must be inside the sheet. So `:root`/`html`/`body` may
  only start a selector (not inside `:not()`/`:is()`/`:has()`/…), nothing may follow them with `~`/`+`, top-level
  selectors can't start with `~`/`+`, nested rules can't use `&` inside pseudo-class functions, and rules nested in a
  root-targeting rule (`:root { … }`) can't use `& ~`/`& +` or a leading `~`/`+`. Violations are errors
  (the rule is dropped). The same checks run on save (no scope ID) and when scoping. Don't loosen these without
  re-checking that nothing can style the app outside the sheet; tests in `shared/sheet/css.test.ts`.
- Fonts (decided): curated, self-hosted list. Sheets may use every font on the site: the app's own (Nunito Sans,
  Cormorant Garamond, JetBrains Mono) and the extra sheet fonts. `@nuxt/fonts` (already installed by `@nuxt/ui`) only
  scans the app's own CSS at build time, so all of them are declared in `nuxt.config.ts` `fonts.families` with
  `global: true`. The list, with weights, lives in `shared/fonts.ts` (also used by the editor's reference panel); the
  font table with designers and licenses is in `docs/theme.md`. A `font-family` naming an unlisted font is a warning,
  not an error.

---

## 7. Sheet editor page

Route `app/pages/sheets/[id]/edit.vue` (`middleware: "auth"`; redirects to `/sheets/[id]` when `!canEdit`; also served at
`/sheets/<owner>/<readableId>/edit`, see "Addressing resources" in the README). The sheet
detail page moved to `sheets/[id]/index.vue` so the editor is a sibling route, not a child. The detail page's and the
list's Edit go here; the edit modals are gone. The list's create modal only asks for name, readable ID, visibility,
content type, and default, then opens the editor: a sheet created without markup starts with the generated markup
(this is the "Copy to new Sheet" path). `GET /api/sheet/[id]` includes `schemas`, `contentCategory`, and the scoped
`css`. The detail page previews the sheet with `SheetRenderer` against `sampleSheetData` (broken-tag placeholders for
editors, an Edit Fields switch whose changes never save), with the markup and CSS in tabs beside the preview (a read-only `CodeEditor`, for the same syntax colors).

Layout (side by side ≥ lg; below that an Editor/Preview tab switch):
- Left: tabs **Markup** | **CSS** | **Settings** (Name, ID, Visibility, Default sheet, Start with Edit Fields on, Default
  autosave, Non-editable fields), then a diagnostics list (errors + warnings, click → jump to line).
- The Markup and CSS tabs have **Upload** and **Download** buttons, and a file dropped on either editor loads into it.
  Files are read in the browser (`shared/sheet/files.ts`), never stored on the server: markup accepts `.stts` (Soul Tabletop Sheet),
  `.xml`, `.html`, `.htm`, `.txt`; CSS accepts `.css`, `.txt`; both are capped at the save limits (100,000 / 50,000
  characters) and rejected if they aren't text. A loaded file replaces the editor's content as an unsaved change (undo
  restores it), so it's checked and previewed before saving. Download saves the editor's current content as
  `<readableId>.stts` or `<readableId>.css`.
- Right: live preview via the real `SheetRenderer` with its Edit Fields/Autosave switches (preview edits never save), plus a
  data picker: **Sample data** (generated from the schema: labels as text, 10 for numbers, 2 items per array) or any
  readable content of this content type.
- Parse/validate/CSS-scope run client-side, debounced ~200 ms, with the same `shared/sheet` code the server uses.
- Toolbar: Save (Ctrl/Cmd+S), "Insert generated markup" (replaces markup after confirmation), unsaved-changes guard.
- Reference slide-over: every tag with its attrs (generated from the registry), the content type's field paths with
  types (click to insert `field="…"`), the font list, and the Nuxt UI CSS tokens.

Code editor (decided): **CodeMirror 6**, client-only, loaded only on this page. Markup via `@codemirror/lang-xml`
with its element/attribute spec generated from the registry, plus a completion source for field paths from the
schema; CSS via `@codemirror/lang-css`; `@codemirror/lint` shows our diagnostics inline. Themed with Nuxt UI tokens.
Wrapped in `app/components/CodeEditor.client.vue`. Field-path completion inside `field="…"` and `{…}`; List
item paths are offered by their tail (`name` for `attacks[].name`). Schema-derived helpers (field paths, sample
preview data) are in `shared/sheet/editor.ts`. Syntax colors use CodeMirror's default (light) highlight style.

---

## 8. Implementation phases

Each phase ends with `pnpm test && pnpm typecheck && pnpm lint`, template compilation of changed `.vue` files via
`@vue/compiler-sfc`, and a manual dev-server check; one commit per phase.

1. **Groundwork**
   - Add `vitest` (`pnpm test`, `vitest.config.ts` covering `shared/**/*.test.ts`).
   - `ContentFieldSchema`: remove `localType`; replace `contentType` with `content` (`contentTypeId`, `allow`);
     add optional `label`, `description`. Update `server/utils/content-validation.ts` accordingly (ref existence,
     type and readability; local objects against the referenced schema, depth ≤ 3) — it becomes async since it
     loads referenced schemas/content. Move the type to
     `shared/content-schema.ts` (re-exported from `server/database/schema.ts`) so client code can use it.
   - TypeBox schema for `ContentFieldSchema` in `server/utils/api-schemas.ts`, replacing the any-object `schema` in
     `contentTypeCreateSchema`/`contentTypePatchSchema`; reject a top-level `name` key.
   - `content_type.schema` jsonb → json; `sheet` gets `default_edit_mode`, `default_autosave`. Migration also moves
     any `data.name` into `resource.name` for existing content. Read the generated migration before applying.
   - Content create/PATCH: move `data.name` to the resource name; PATCH accepts `expectedUpdatedAt` (409 on mismatch).
2. **Parser** — `shared/sheet/parser.ts` + tests.
3. **Registry + validator** — `shared/sheet/registry.ts`, `validate.ts` + tests. Sheet create/PATCH reject markup
   errors (400 with diagnostics); content type PATCH returns 409 listing sheets it would break unless
   `confirmBrokenSheets: true`.
4. **Generator** — `shared/sheet/generate.ts` + tests (generated markup must validate cleanly against its schema).
5. **Renderer, view mode** — `app/components/sheet/*`; `GET /api/content/[id]` returns resolved sheet, schema,
   referenced schemas and `refs`; `?contentTypeId=` filter on `GET /api/content`;
   `ContentDetail.vue` renders it; viewer sheet switcher.
6. **Edit mode** — draft model, Edit Fields/Autosave switches, Save/Discard bar, autosave, `live`/`locked`, 409 handling,
   Markdown (`UEditor`) and Image fields, content-field picker / Custom / "Make custom copy"; content Edit modal keeps readable ID/visibility/sheet/raw JSON.
7. **Scoped CSS + fonts** — `shared/sheet/css.ts` + tests (every rejected construct, prefixing, `:root`,
   keyframes); sheet save validation; curated fonts in `nuxt.config.ts`.
8. **Sheet editor page** — `app/pages/sheets/[id]/edit.vue`, CodeMirror, preview, reference slide-over, "Copy to new
   Sheet" from generated.
9. **Formulas and conditional display** — done (see "Formulas"). **Later**: image uploads, dice rolls,
   schema-level computed fields.

Also update `.claude/data-model.md` (Sheet system bullets, `shared/` code) and `CLAUDE.md` (`pnpm test`) and remove the TODO.md item once done.

## Formulas

Formulas compute values when a sheet is shown; they are **never stored** (decided): not in `content.data`, not in API
responses. Values computed at the schema level, which the API could return, may come later. The language is our own
(no JavaScript, no `eval`; see `.claude/plans/sheet-formulas-sandboxed-js.md` for why not sandboxed JS).

Code (framework-free, in `shared/sheet/`): `formula.ts` (lexer, Pratt parser, AST, value and static types,
`formulaLimits`), `formula-functions.ts` (the built-in functions as data), `formula-eval.ts` (evaluator),
`formula-check.ts` (static checks; paths are resolved by the validator through the schema). The validator compiles
every formula once; the renderer evaluates the compiled trees (`evaluateSheetFormula` in `runtime.ts`).

### Where formulas go
- `formula="expr"` on `Value`, `Column`, `Tracker` (read-only) and `Number`, `Text`, `Checkbox`, `Field` (override), and as
  the body of `<Define>`. Raw text: no braces, no `{…}`; text inside it in single quotes.
- `show="expr"`: a bare formula, like `formula=`.
- `{expr}` in text, in text attributes (`title="HP {hp.max}"`), and in the number attributes read when rendering
  (`Tracker max`, `Number min`/`max`/`step`). In text, write `&lt;` for `<` (or turn the comparison around): our parser accepts a bare `<`
  there, but the editor's XML highlighting reads it as a tag.

### Grammar
Precedence, low to high: `or`; `and`; `==` `!=`; `<` `<=` `>` `>=` (can't be chained: `a < b < c` is an error);
`+` `-`; `*` `/` `%`; unary `-` and `not`; then values: numbers (`12`, `1.5`; no leading dot), text in `'…'` or `"…"`
(escapes `\'` `\"` `\\`), `true`, `false`, `null`, paths, calls `name(args)`, parentheses. `=`, `&&`, `||`, `!`, and
`?:` are errors that suggest the right form. Entities `&lt; &gt; &amp; &quot; &apos;` are decoded.

Paths are field paths as elsewhere: `stats.str`, `attacks.0.name`; `.` is the current item, `.name` an explicit
relative path, `/name` the top level. `/` before a value starts a path from the top; after a value it divides.
Reserved words (`and`, `or`, `not`, `true`, `false`, `null`): a field with one of these names is reached as `/and` or
`.and`. Field names that read as dice (`d6`, `d20`, also as a path's first segment) are likewise reached as `/d6`.
A path written right after a call's `)`, with no space, reads a field of the call's result:
`first(weapons, equipped).bonus`, `at(attacks, 0).name` (decided: paths on call results rather than only `get`). It
follows references like any path, and reaches computed fields (overrides) like any path, since the items `filter`,
`sort`, `first`, and `at` pass on keep where they came from; the validator checks it against the schema when the call's result is items of a
known list (`filter`, `sort`, `first`, `at`), so `first(inventory).item.weight` is checked like `.item.weight` in a
`List` row of `inventory`. Indexes aren't allowed there (`first(x).0` is an error that points to `at`).
`__proto__`, `constructor`, and `prototype` are never valid path segments or field keys.

Calls have no sigil (decided): `word(` is always a call, a bare word always a path, except inside a `<Define>`, where a
parameter's name is the parameter (`/name` still reaches the field). Built-in names are reserved: a `<Define>` can't
use one. Built-ins added after v1 (so far `list`, `itemKey`, `itemLabel`, `map`, `filter`, `sort`, `first`, `at`, `editing`) go in `formulaLaterBuiltins`; a sheet's definition with such a name keeps working
(it wins in that sheet, with a warning).

### Functions (v1)
| Group | Functions |
|---|---|
| Math | `floor`, `ceil`, `trunc`, `abs`, `round(x, digits?)` (halves away from zero), `clamp(x, low, high)` |
| Min/max | `min(…)`, `max(…)`: numbers, or one list of numbers; empty values skipped; nothing if none |
| Lists | `sum(list)`, `sum(list, expr)`, `count(list)`, `count(list, cond)`, `any(list, cond)`, `all(list, cond)`, `length(x)`, `list(a, b, …)` (builds a list from separate values: `join(list(speed, flySpeed), ", ")`, `max(list(a, b))`; empty values stay in it and `join`, `sum`, `min`, and `max` skip them; single values only) |
| Nulls | `coalesce(a, b, …)`: the first value that isn't empty (errors aren't skipped) |
| Text | `concat(…)`, `join(list, separator)` (skips nothing and empty text `""`), `signed(n)` ("+3", "0", "-1") |
| Conversion | `number(x)` (parses text; nothing if it isn't a number), `text(x)` |
| Logic | `if(cond, then, else)`, `switch(value, case1, result1, …, default?)`; only the chosen branch is computed |
| Lookup | `get(record, key)`: own keys only (reserved keys give nothing); text is followed as a reference, like a path |
| List items | `map(list, expr)` (the list of `expr` for each item; each a single value, empty ones kept), `filter(list, cond)` (the items that make `cond` true, in order), `sort(list, expr?, descending?)` (the items in order of `expr`, or of the items themselves; `sort(list, ., true)` sorts high to low), `first(list, cond?)` (the first item, or the first that makes `cond` true; nothing if none), `at(list, n)` (the item at index `n` from 0, `-1` the last; nothing out of range) |
| Mode | `editing()`: true while the sheet is being edited (Edit on, for a viewer who can edit the content), else false. For parts shown only while editing, like empty choice slots: `show="editing() or length(senses) > 0"` (decided 2026-10-06; a function, so it can't clash with a field named `editing`) |
| Rows | `itemKey()`: the current row's entry key in a struct (`'acrobatics'`), or its index in an array (from 0); `itemLabel()`: a struct entry's schema label, else its humanized key, and nothing in an array row. Only in a `List` or `Table` row or inside a per-item function (else `formula-no-item`; a `<Define>` body is checked at the top level, so pass them in as arguments) |

In `sum(list, expr)` and the others, `expr` is evaluated once per item, scoped to the item like inside a `List`
(relative paths are the item's, `/` the top level); these can nest two levels. Every function that takes a list
(`sum`, `count`, `any`, `all`, `map`, `filter`, `sort`, `first`, `at`) also takes a path to a struct whose entries are
alike, repeating over its schema entries like a struct `Table` (`count(skills, rank > 0)`, `sum(attributes)`); the
evaluator doesn't know the schema, so the validator puts the entries on the path node (`entries`). `filter` and `sort`
give back an array, so `itemKey()` over their result is the index in it. Per-row constants, like each skill's
attribute, come from a definition: `<Define name="skillAttr" params="s" formula="switch(s, 'acrobatics', 'dex', …)" />`
called as `skillAttr(itemKey())`. `roll`, `dice`, `adv`, `dis`, and
dice like `2d6` are reserved for dice rolls (an error now). Left out on purpose: regular expressions, dates,
randomness, locale formatting. The editor's reference panel lists every function from the table in
`formula-functions.ts`.

Combined: `join(map(filter(feats, level <= 5), name), ', ')` lists the names of the feats up to level 5;
`first(sort(weapons, bonus, true)).name` names the best weapon. `sort` compares numbers by value and text by character
code ignoring case (no locale, so the server and the browser agree); empty values go last in both directions, ties keep
the list's order, and mixing numbers and text is an error. To compare against the row outside a per-item expression
(inside `count(spells, …)`, paths and `itemKey()` are the spell's), pass the row's value to a definition, whose body
runs at the top level: `<Define name="knownAt" params="r" formula="count(spells, rank == r)" />`, then in a `Table`
over the slots, whose rows have `rank` and `max`, `<Column formula="concat(knownAt(rank), ' / ', text(max))" />`.

### Values, types, and nothing
Values are numbers (always finite), text, true/false, and nothing (`null`); lists and groups of fields only come from
paths and the list functions (`list(…)`, `map`, `filter`, `sort`, and the items `first` and `at` pick) and feed other
functions, paths on call results, or definitions, and are an error as a final result. No implicit conversion: arithmetic and ordering take numbers (`+` doesn't join text; use `concat`), `==`
compares type and value, `if`/`and`/`or`/`not` take true/false with nothing counting as false. A missing value (absent
key, unloaded reference, a path through a non-object) is nothing; arithmetic or ordering with nothing gives nothing
(shown empty); aggregates skip nothing; `sum` and `count` of an empty list are 0. A text field that was cleared holds `""`, not
nothing, so test text with `length(x) > 0` (false for both) rather than `x != null`. Numbers show without floating-point
noise (`toPrecision(12)`) and without locale formatting, so server and browser render the same text.

### Errors
Errors are values (`FormulaError { code, message }`): type mismatches, division by zero, results too large, an
exhausted step budget, text too long, dice. They pass through operators and calls; the evaluator never throws (an
unexpected exception becomes an "internal" error). A failed formula shows "—" to everyone, plus a warning icon with the
message for people who can edit the sheet; a failed `show` shows the tag. Statically broken formulas block saving, as
any error does.

### Definitions
`<Define name="…" params="a, b" formula="…" />`: at most 8 parameters (identifiers, no duplicates, no reserved words).
Bodies are checked against the top level with parameters of any type, and run against the top level when called, so a
definition doesn't depend on where it's called from (pass item values as arguments). Definitions without parameters
are computed once per render (a Vue `computed` each); those with parameters run at each call. A cycle (`a() → b() →
a()`) is an error on every definition in it, and calling a broken definition gives an error value.

### Limits (`formulaLimits`)
1,000 characters and 200 nodes per expression; nesting depth 32; 32 arguments per call; 200 `<Define>`s and 2,000
formulas per sheet; per-item functions nested 2 levels; definitions calling each other 16 levels deep; text results of
10,000 characters.

Steps (every node visit and every list item counts, also for `min`, `max`, `join`, and the list functions; `first`
stops at its first match; the items of `list(…)` are node visits and at most 32, like any call's
arguments, and a list longer than the steps left fails at once; definitions share their caller's budget): one evaluation may take
at most 20,000, and a whole sheet about 2,000,000 (`maxSheetSteps`), shared evenly. The validator gives each formula
`min(20,000, 2,000,000 / the sheet's formula count)` (`stepBudget`), and the renderer divides that again by the item
counts of the Lists and Table rows around it, since a formula inside a List runs once per item. Both depend only on
the markup and the data, so the server and the browser get the same results (no hydration mismatches). A formula out
of steps shows "—" with "This formula takes too many steps to compute". Measured (2026-10-02, Mac, vitest): about
70 ns a step; the worst case of 2,000 formulas each summing 500 rows with a nested sum took 1.95 s before the sheet
budget and 178 ms after it, and 200 formulas in a 500-row List took 7 s before the per-item division. Whole pages that
large are slow to render anyway (about 3 to 5 s for 2,000 tags with no formulas, in dev and production builds, much of
it database time from this machine), so the budget keeps formulas from adding to that rather than making big sheets
fast.

### Security
Formulas read only the data the viewer already has (the content and its loaded references) and produce text, numbers,
and true/false that render through Vue as text. They can't write data, make requests, or build URLs: no tag that loads
or links a URL takes a formula (`Image` never will). Paths and `get` read own properties only, and reserved keys are
rejected everywhere.

## Verification
- `pnpm test` (vitest) for `shared/sheet/*`; `pnpm typecheck && pnpm lint`; compile changed templates with
  `@vue/compiler-sfc`; manual check in the dev server once rendering exists.
