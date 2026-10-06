---
name: soul-tabletop-sheets
description: Write and check Soul Tabletop Sheets, this app's own character-sheet and stat-block format, an HTML-like markup (.stts files with tags such as Section, Grid, Number, Table, List) plus scoped Sheet CSS. Use when the user asks for a Soul Tabletop sheet, character sheet, NPC stat block, spell or item card, or Sheet markup or CSS for this app. Not for other character-sheet systems (D&D Beyond, Roll20, Foundry, ...), plain HTML/CSS, or PDF/spreadsheet character sheets.
---

# Soul Tabletop Sheets

A Sheet is a Soul Tabletop resource that says how one content type's Content is laid out and edited. It has two
files: **markup** (an HTML-like language with a fixed set of tags, not real HTML) and optional **CSS** (sanitized and
scoped to the Sheet). It is not Roll20, Foundry, D&D Beyond, or plain HTML; do not use `<div>`, `style=`, scripts, or
URLs.

Authors currently paste the result into the Sheet editor (`/sheets/[id]/edit`) themselves: the Markup and CSS tabs
have Upload buttons and accept drag and drop (markup `.stts`, `.xml`, `.html`, `.htm`, `.txt`; CSS `.css`, `.txt`).
So produce files, tell the user which is which, and check them before handing them over.

## Sources of truth

Read these when in doubt; this skill is a summary and the code wins if they disagree.

- `shared/sheet/registry.ts`: every tag, attribute, enum value, allowed children and parents, and what each tag can bind to.
- `shared/sheet/parser.ts` (syntax), `shared/sheet/validate.ts` (tags, attributes, field paths, formula checks), `shared/sheet/css.ts` and `shared/fonts.ts` (CSS).
- `shared/sheet/formula.ts` (formula grammar and limits), `shared/sheet/formula-functions.ts` (every built-in function with its signature and description).
- `docs/sheet-system.md` (design; parts can be stale, see "Known doc drift" below), `shared/sheet/*.test.ts` (exact behavior), `app/components/sheet/` (rendering).

## Workflow

1. Get the content type's schema (see "Reading the schema"). Every field path in the markup must exist in it.
2. Write the markup using only the fields the schema has. Prefer starting from the generated layout for the schema (`generateSheetMarkup` in `shared/sheet/generate.ts`, also the editor's "Insert generated markup") and then restyle.
3. Write CSS only if the user wants styling beyond the Nuxt UI defaults.
4. Run the check in `references/checking.md` and fix until there are no errors (warnings need a look too).
5. Deliver the files (`<readableId>.stts`, `<readableId>.css`) and say the user should upload them in the editor, whose Problems list shows the same diagnostics.

## Markup syntax

- Tags are HTML-like: `<Section title="Abilities">...</Section>` or self-closing `<Number field="hp" />`. Names are PascalCase; matching is case-insensitive.
- The `<Sheet>` root is optional (top level only). Any number of top-level nodes is fine. Sheets are compact by default (small inputs, labels, and gaps, like a character sheet); `<Sheet density="roomy">` uses the site's roomier form spacing instead (`density="compact"` is still valid).
- Attributes: `name="value"` or `name='value'`. A bare `name` means true (booleans only). Unquoted values are an error. A duplicate attribute is an error. Attribute names are `[A-Za-z_][A-Za-z0-9_-]*`.
- Text goes directly inside layout tags and renders as a paragraph; whitespace collapses like HTML. `<Grid>`, `<Section>`, etc. accept text; `Heading`, `Note`, `Callout`, `Badge` accept only text; `Divider` and field tags accept nothing.
- Formulas: every `{…}` in text and in text attribute values is a formula (see "Formulas" below); `{hp}` shows what the `hp` field displays, computed value included. A missing value is empty. Booleans show Yes/No; numbers are plain; arrays are comma-joined; a reference to other Content shows its name. `{}` and `{= …}` are errors, and so is a formula that gives a struct, object, or list.
- `formula="expr"` on some field tags, and `show="expr"`, are bare formulas, without braces.
- Escapes: `\{` `\}` `\\` for literal braces and backslash. Entities `&lt; &gt; &amp; &quot; &apos;` and numeric `&#123;` / `&#x7B;`. A bare `<` in text is an error (write `&lt;`).
- Comments: `<!-- ... -->` (an unterminated comment is an error).
- Limits: 100,000 characters, 32 levels of nesting, 5,000 nodes. CSS: 50,000 characters.
- Some attributes take a `{formula}` instead of a literal: `Tracker`'s `max` and `Number`'s `min`, `max`, and `step` accept exactly one `{formula}` (e.g. `max="{hp.max}"`, `max="{hp.base + level * 2}"`); other number attributes (`cols`, `span`, `level`) take plain numbers only; text attributes accept both mixed with text; enum, boolean, icon, class, list, and field attributes cannot use `{...}`.
- No raw HTML, `style`, `on*` events, or URLs. Icons are Iconify names from Lucide (`i-lucide-sword`) or game-icons.net (`i-game-icons-crossed-swords`); no other icon sets. Images are `https` URLs held in a string field.

## Tags

The full list of attributes and children is in `references/tags.md` (verified against the registry). Summary:

- Layout: `Sheet`, `Section` (card; `title`, `description`, `icon`, `span`, `collapsible`, `collapsed`), `Grid` (`cols` 1-12, `gap`), `Stack` (`direction`, `gap`, `align`, `wrap`), `Tabs` (only `Tab` children) and `Tab` (`label` required), `Divider`, `Heading` (`level` 1-4), `Note`, `Callout`, `Badge`, `Collapsible` (`title` required).
- Fields (need `field`, or `formula` where allowed; optional `label`, `hideLabel`, `hint`): `Field` (input chosen from the schema type), `Text`, `Number`, `Checkbox`, `Toggle`, `Select` (the field's schema options, else its own `options` list), `Tags`, `Tracker` (`max` optional), `Ref`, `Value` (never editable), `Markdown`, `Image`.
- Repeaters: `List` (repeats its children per array item, or per entry of a struct whose entries are alike), `Table` (only `Column` and `RowDetails` children; `Column` takes `field` or `formula`, and `format`).
- Buttons: `Button` (`label` required, `icon`, `amount`, `toast`; only `Set` children) and `Set` (`field`, `formula`, both required). See "Buttons" below.
- Definitions: `Define` (`name`, `params`, `formula`; top level or directly inside `Sheet`; renders nothing).
- Every tag also takes `class`, `show`, `live`, `locked`, `display`, except `Tab` and `RowDetails` (their parents render them), which take only `class` and `show`; `Column` takes no `show`; `Button` takes `class`, `show`, and `live` only; `Define` and `Set` take none.

Rendering notes: `Number variant="stat"` shows a big number with its label small. `format="signed"` (on `Number` and `Value`) shows `+2` for positives; an editable `Number` input shows the sign too, while the saved value stays a plain number. `Tracker style="pips"` shows boxes instead of a bar; a `Tracker` without `max` (or at 0) shows just its value. `Checkbox style="dot"` shows a filled or empty circle with no Yes/No text. On phones, `Table` rows stack their cells with labels. `Ref` shows a link to the referenced resource or Content.

## Field paths

- Dotted: `stats.strength`, `attacks.0.name` (numeric segments index arrays). Keys are identifiers (`[A-Za-z_][A-Za-z0-9_]*`).
- Built-in `name`: every content type has a `name` string (the Content's name). `<Text field="name" />` and `{/name}` always work.
- Inside `<List field="items">` and `<Table field="items">`, paths are relative to the current item. A leading `/` means the top level: `{/name}`, `field="/hp.max"`. Nested lists are relative to the innermost item. `field="."` is the item itself (arrays of strings or other primitives): `<List field="languages"><Badge>{.}</Badge></List>`; `<Text field="." />` in a list of strings works too.
- `List` needs an array, or a struct whose entries are all alike (same type and fields; labels may differ) and each a struct or a single value; `Table` needs an array of structs (or content/object items), or a struct of alike structs. `Table` on a string array is an error (use `Tags` or `List field="."`). A struct cannot be bound by a field tag: wrap its fields in a `Section` or `Grid` and bind each field (`hp.current`), or repeat over its entries.
- Fixed sets (skills, saves, attributes) stored as a struct of alike entries: `<Table field="skills"><Column formula="itemLabel()" label="Skill" /><Column field="rank" /></Table>`, or `<List field="attributes" layout="grid" cols="6"><Number field="." variant="stat" /></List>` (each `.` is labeled by its entry). Rows come from the schema, so every entry shows even with no data, and there are no add/remove controls. `itemKey()` is the row's entry key (`'acrobatics'`; the index in an array row) and `itemLabel()` its label; per-row constants come from a definition such as `skillAttr(itemKey())` with `switch`.
- `content` fields: a path continues into the referenced content type's schema: `class.name`, `class.hitDie`, `class.subclass.feature.name`. At most 3 content fields may be crossed; a fourth is an error. Values reached through a reference are read-only. In an array of structs holding a content field (`inventory: [{ item: content, qty }]`), `item.weight` sits next to `qty` inside the List.
- Free-form `object` fields: `<Field field="o" />` edits them as JSON; paths below them (`o.foo.bar`) only warn (when `showSheetWarnings` is on) and show whatever the data holds.
- `scalar` fields bind `Field`, `Value`, `Column` only.
- Which tag binds which field type: `Text`, `Select`, `Markdown`, `Image` bind string; `Number`, `Tracker` bind number (`Select` too, when the number field has options); `Checkbox`, `Toggle` bind boolean; `Tags` binds an array of strings; `Ref` binds resourceLink and content; `Value` binds anything; `Field` binds string, number, boolean, scalar, object, resourceLink, content, and arrays of strings or of choices; `Column` binds string, number, boolean, scalar, resourceLink, content.
- Unknown paths: error when the content type has a strict schema, warning when not (`hasStrictSchema`), and the warning only shows if the sheet's content type has `showSheetWarnings` on (off by default). `{path}` follows the same rule.
- Labels: `label` attribute, else the schema field's `label`, else the humanized name (`hitPoints` becomes "Hit Points"). `hint` falls back to the schema description. `label=""` does NOT hide the label (it falls back to the schema label); add `hideLabel` (on any field tag or `Column`) to hide it. A hidden label still names the input for screen readers.

## Formulas

Computed when the sheet is shown, never saved. Full rules: `docs/sheet-system.md`, "Formulas".

- Where: `formula="…"` on `Value`, `Column`, `Tracker` (read-only, instead of `field`) and on `Number`, `Text`, `Checkbox`, and `Field` (on a string, number, or boolean field; alone it's read-only; with `field` too, the field holds an optional manual value that wins, and a reset button goes back to the computed one; use this for values a player may need to override, like AC). A top-level override also feeds other formulas: reading its path with nothing stored gives the computed value (cycles give an error), and `{path}` text shows it too, but a field tag still shows only the stored value. Give a field one formula, even if several tags show it. `{…}` in text, text attributes, `Tracker max` and `Number min`/`max`/`step`, and a bare formula in `show`. `Field` on any other field type, and every other tag, takes no `formula`, and `Image` never will.
- Syntax: `+ - * / %`, `== != < <= > >=` (not chained), `and or not`, parentheses, numbers, text in quotes (`'expert'`; inside `formula="…"` always single quotes), `true false null`, paths (`stats.str`, `/level` from the top inside a List, `.` the item), calls `name(args)`, and a path right after a call's `)` reading a field of its result (`first(weapons, equipped).bonus`; no index there, use `at`). No `=`, `&&`, `||`, `!`, `?:`. In text formulas write `&lt;` for `<` (or flip the comparison to `>`): a bare `<` parses but breaks the editor's colors.
- Built-ins: `floor ceil trunc abs round(x, digits?) clamp(x, lo, hi) min max sum(list[, expr]) count(list[, cond]) any(list, cond) all(list, cond) length list(a, b, …) map(list, expr) filter(list, cond) sort(list, expr?, descending?) first(list, cond?) at(list, n) itemKey() itemLabel() editing() coalesce concat join(list, sep) signed number text if(cond, then, else) switch(value, k1, v1, …, default?) get(record, key)`. In `sum(list, expr)` and friends, `expr` is per item: paths are the item's, `/` the top level. `list(a, b)` builds a list from separate values (`join(list(speed, fly), ", ")`, `max(list(a, b))`; `join` skips empty ones, both nothing and `""`, so does `sum`/`min`/`max` for nothing). `get(attributes, attr)` picks a field by name (own keys only). `map` gives a list of one value per item (`join(map(feats, name), ', ')`), `filter` the items that pass, `sort` the items in order (numbers by value, text ignoring case, empty last; `sort(list, ., true)` high to low), `first` the first item (or first match) and `at` the item at an index from 0 (`-1` the last); both give nothing when there is none. `itemKey()` and `itemLabel()` work only in a `List`/`Table` row or inside a per-item function (not in a `<Define>` body: pass them in). Every list function also repeats over a struct of alike entries: `count(skills, rank > 0)`, `first(skills, rank > 0)`. Inside a per-item expression, paths are the item's; to compare against the outer row, pass it to a definition: `<Define name="knownAt" params="r" formula="count(spells, rank == r)" />` and `knownAt(rank)` in a Column of a Table over slots.
- Types: no implicit conversion (`+` adds numbers only; `concat` joins text). Empty values pass through arithmetic and show empty; `coalesce(x, 0)` gives a default. `if`, `and`, `or` treat empty as false. A cleared text field holds `""`, so test text with `length(x) > 0`, not `x != null`. A list or group of fields can't be a final value.
- Definitions: `<Define name="prof" params="rank" formula="…" />` at the top level, called as `prof(x)`; one without parameters is called `pb()`. Inside its formula, a parameter name is the parameter; `/name` reaches the field. Names of built-ins are reserved. No cycles.
- `show="expr"` (a bare formula like `show="hp > 0"` or `show="hasShield"`, no braces): hides the tag (and all inside) when false or empty. Works on `Tab` (hidden tabs leave the list) and `RowDetails` (per row). A `show` formula that fails shows the tag.
- Errors: a formula that can never work (unknown field, `name + 1` on text, wrong arity, a result the tag can't show) is an error and blocks saving; a runtime failure (division by zero) shows "—", with a warning icon for sheet editors.
- Cost: a sheet's formulas share a step budget (split between them, and between the items of a List), so a formula that sums a long list inside a long List can run out and show "—". Prefer one total outside the List (or a `<Define>` without parameters, computed once) to the same sum in every row.
- Not available: dice (`2d6`, `roll`), dates, regex, writing data (use a `Button`). Store a value in a field when players should type it; compute it when it follows from other fields.

## `live`, `locked`, `display`

Boolean (`live`, `locked`) or enum (`display`) attributes on any tag except `Tab` and `RowDetails` (put them on `Tabs`, `Table`, or a tag inside the panel instead); on layout tags they apply to every field inside, and a descendant opts out with `live="false"` / `locked="false"` / another `display`.

- `live`: the field stays editable with the Edit switch off (for users who can edit the Content), and a change there saves on its own, even with Autosave off. Use it for things changed in play: hit points, spell slots, inspiration. `editing()` in a formula is true while Edit is on (`show="editing()"` for parts only shown while editing, like empty slots).
- `locked`: read-only even in Edit mode until the user clicks the field's pencil button. Use it for things that rarely change: ability scores, level.
- They compose: editable when the user can edit and (Edit is on, or `live`), and if `locked`, after the unlock click. `live locked` = editable in view mode after unlocking.
- `display="text"` shows non-editable fields as plain values (stat blocks, spell cards); `display="box"` shows their input, disabled, so the sheet looks the same in edit and view mode (character sheets). It defaults to the Sheet's "Non-editable fields" setting (new sheets: `box` for player characters, `text` otherwise). `Value` and `Image` look the same in both.

## Buttons

A `Button` changes fields when clicked, one `Set` per field. Use it for actions in play: damage and healing, a rest or daily preparations that refill things, moving an item between held, worn, and stowed.

```
<Button label="Damage" amount live>
  <Set field="hp.temp" formula="max(0, hp.temp - amount)" />
  <Set field="hp.value" formula="max(0, hp.value - max(0, amount - hp.temp))" />
</Button>
<Button label="Heal" amount live>
  <Set field="hp.value" formula="min(hp.value + amount, hpMax)" />
</Button>
<Button label="Daily preparations" icon="i-lucide-sunrise" live toast>
  <Set field="spells.*.cast" formula="false" />
  <Set field="slots.*.left" formula="max" />
</Button>
<Table field="inventory">
  <Column field="name" />
  <Column label="Move" live>
    <Button label="Wear" show="state == 'Held'"><Set field="state" formula="'Worn'" /></Button>
    <Button label="Stow" show="state != 'Stowed'"><Set field="state" formula="'Stowed'" /></Button>
  </Column>
</Table>
```

- Every `Set` reads the data from before the click (so Damage above uses the old `hp.temp` in both), then all write together. A formula that fails, or a result the field can't hold (wrong type, not an option, nothing for a required field), writes nothing. A result of nothing (`null`) removes the value of an optional field. `locked` doesn't stop a Button.
- `field` must be one text, number, true/false, or scalar field. One `*` changes every item of an array or every entry of a struct of alike entries; then the formula runs per item, with paths relative to the item (`formula="max"` reads that slot's `max`). Without `*`, paths are relative to the Button's row (inside a `List`/`Table`) or the top level.
- A literal written to a choice field must be one of its options (`'Worn'`).
- `amount` shows a number box; adjacent Buttons with `amount` share one box. `amount` in their formulas is the number typed (`/amount` reaches a field named so). Without `amount` on the Button, `amount` is an ordinary path.
- Only viewers who can edit the content see Buttons. They work with Edit on; with Edit off only if `live` (put `live` on the Button, or on a Section or Column around it). A click saves like a `live` field change. `toast` adds a toast with Undo after the click; leave it off for quick, frequent actions (damage, item moves) and use it for large ones (daily preparations, a rest). Errors always show a toast.
- In a `Table`, put Buttons in a `Column` that has no `field` or `formula`: each row gets its own.

## CSS

Details and tables are in `references/css.md`. Essentials:

- Every selector is scoped to the Sheet automatically: write `.sheet-section { ... }`, never worry about affecting the app.
- Hook classes: every tag's root element has `sheet-<tag>` in lowercase (`sheet-section`, `sheet-grid`, `sheet-number`, `sheet-text`, `sheet-tabs`, `sheet-tab`, ...); List items also have `sheet-list-item`; plain text paragraphs have `sheet-text`; inside field tags, `sheet-field-label` is the visible label and `sheet-field-value` the value or input (see references/css.md); broken tags `sheet-invalid`. Add your own with the `class` attribute (names: lowercase letters, digits, hyphens, starting with a letter).
- `:root`, `html`, and `body` mean the Sheet's own root element (only at the start of a selector), so `:root { --accent: teal }` defines variables for the Sheet. `@media print { ... }` styles the printed page. The site has one light theme (no dark mode).
- Use the site's theme tokens so the Sheet matches the site: `var(--st-ink)`, `--st-ink-muted`, `--st-primary`, `--st-on-primary`, `--st-accent`, `--st-panel`, `--st-panel-muted`, `--st-page`, `--st-border`, `--st-border-strong`, `--st-radius`, `--st-font-body`, `--st-font-display` (list in `shared/sheet/theme-tokens.ts`). Their names are stable; prefer them to Nuxt UI's `--ui-*` variables.
- Fonts: only the site's fonts load, by name in `font-family`: the app's Nunito Sans, Cormorant Garamond, and JetBrains Mono, and Cinzel, Uncial Antiqua, IM Fell English, Crimson Pro, Special Elite, Orbitron (plus generic families; weights in `shared/fonts.ts`). Another name is a warning: it shows only if the viewer has it installed. There is no `@font-face`.
- Rejected (errors, the rule or declaration is dropped): `url()`, `image-set()`, `image()`, `cross-fade()`, `element()`, `paint()`, `expression()`, `@import`, `@font-face`, `@namespace`, `@page`, any at-rule other than `@media`, `@supports`, `@container`, `@layer`, `@keyframes`; `behavior`, `-moz-binding`; selectors that could reach outside the Sheet (`:root`/`html`/`body` inside `:not()`/`:is()`/`:has()` or after other selectors, `~`/`+` next to the root, a leading `~`/`+`, `&` inside pseudo-class functions).
- Allowed: CSS variables, `!important`, nesting, media/container/supports/layer queries, keyframes (names get a per-Sheet suffix automatically), `position: fixed` (it stays inside the Sheet).
- No images by URL: use gradients, borders, shadows, or emoji.

## Reading the schema

A content type's `schema` is a JSON object mapping field keys to field definitions, in display order. To get it:

- The content type's page (`/types/[id]`, JSON view), or `GET /api/content-type/[id]` (the `schema` and `hasStrictSchema` fields). Sheet pages and the editor's Reference panel list the valid field paths with their types.
- Field definition: `{ "type": ..., "required"?, "label"?, "description"? }` plus, by type: `array` has `itemType` (a field definition); `struct` has `entries` (a schema: exactly those fields); `object` is free-form; `resourceLink` has optional `kind` (`system`, `campaign`, `contentType`, `sheet`, `content`); `content` has `contentTypeId` and `allow` (`reference`, `local`, `both`); `string` and `number` may have `options` (`[{ "value": …, "label"?: … }]`, values of the field's type), which makes a choice field; `string`, `number`, `boolean`, `scalar`, and `array` may have a `default` (the starting value of new content and new List items; for an array, a list of starting items). Source: `shared/content-schema.ts`.
- Turn it into paths: top-level key `hp` of type `struct` with `current` and `max` gives `hp.current` and `hp.max`; an `array` of `struct` gives a `List`/`Table` on the array and item-relative paths (`name`, `bonus`); an `array` of `string` gives `Tags` or `List field="."`; a `content` field `class` adds `class.name` and every field of that type as `class.<key>` (fetch that content type's schema too).
- Pick the tag by type: string is `Text` (`multiline` for long text, `Markdown` for formatted text, `Select` for a fixed set of options, `Image` for an image URL); number is `Number` (or `Tracker` with a `max` for a current-out-of-maximum value); boolean is `Checkbox` or `Toggle`; `resourceLink` and `content` are `Ref`; string arrays are `Tags`; arrays of structs are `Table` (short primitive columns) or `List` (nested layout); read-only display is `Value`.
- Choice fields (a `string` or `number` with `options` in the schema): use `Select` without `options`, `Field`, `Column`, or `Value`; they show each option's label, and only listed values save. `Text`, `Number`, `Tracker`, `Markdown`, `Image`, and `Tags` on one are errors. Formulas see the stored value (`rank * 2` on number options), while `{rank}` alone shows the label. On a text field without schema options, give `Select` its own `options` list (saved data isn't checked against it); suggest adding options to the schema instead when the user can edit it.
- Do not invent fields. If the schema lacks a field the user wants, say so; changing a schema is a content type edit (and it can break existing sheets: the app asks to confirm).

## Checking your work

`references/checking.md` has a script that compiles markup with `compileSheet` and CSS with `processSheetCss` against a schema file and prints the diagnostics; run it with vitest through `.claude/scripts/agent-run.sh`. The Sheet editor's Problems list shows the same diagnostics. Treat every error as blocking (a Sheet with errors cannot be saved) and read each warning.

## Worked examples

`references/examples.md`: a player character sheet (tabs, tracker, live/locked, table, content reference), an NPC stat block, a spell card, and a Pathfinder 2e character sheet built on formulas (definitions, overrides, `show`, per-item sums), each with its schema and markup (and CSS for the first three). They compile without errors against their schemas.

## Known limits

- Formulas can't roll dice or write data (only a `Button`'s `Set`s write, when clicked), and computed values aren't saved or returned by the API.
- `{…}` is always a formula, never a bare lookup: a field named like a keyword (`and`, `true`) or dice (`d6`) is reached as `{/and}`, `{/d6}`.
- Dice buttons are planned in TODO.md, not available.

## Known doc drift

`docs/sheet-system.md` disagrees with the code in a few places; follow the code: `Grid`/`Stack` `gap` also accepts `none`; `Table` also allows `RowDetails` children; the doc says `Markdown` renders as plain text until a later phase, but it now renders with the editor's Markdown view.
