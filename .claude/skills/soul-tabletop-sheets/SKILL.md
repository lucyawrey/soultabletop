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
- `shared/sheet/parser.ts` (syntax), `shared/sheet/validate.ts` (tags, attributes, field paths), `shared/sheet/css.ts` and `shared/sheet/fonts.ts` (CSS).
- `docs/sheet-system.md` (design; parts can be stale, see "Known doc drift" below), `shared/sheet/*.test.ts` (exact behavior), `app/components/sheet/` (rendering).

## Workflow

1. Get the content type's schema (see "Reading the schema"). Every field path in the markup must exist in it.
2. Write the markup using only the fields the schema has. Prefer starting from the generated layout for the schema (`generateSheetMarkup` in `shared/sheet/generate.ts`, also the editor's "Insert generated markup") and then restyle.
3. Write CSS only if the user wants styling beyond the Nuxt UI defaults.
4. Run the check in `references/checking.md` and fix until there are no errors (warnings need a look too).
5. Deliver the files (`<readableId>.stts`, `<readableId>.css`) and say the user should upload them in the editor, whose Problems list shows the same diagnostics.

## Markup syntax

- Tags are HTML-like: `<Section title="Abilities">...</Section>` or self-closing `<Number field="hp" />`. Names are PascalCase; matching is case-insensitive.
- The `<Sheet>` root is optional (top level only). Any number of top-level nodes is fine.
- Attributes: `name="value"` or `name='value'`. A bare `name` means true (booleans only). Unquoted values are an error. A duplicate attribute is an error. Attribute names are `[A-Za-z_][A-Za-z0-9_-]*`.
- Text goes directly inside layout tags and renders as a paragraph; whitespace collapses like HTML. `<Grid>`, `<Section>`, etc. accept text; `Heading`, `Note`, `Callout`, `Badge` accept only text; `Divider` and field tags accept nothing.
- Interpolation: `{path}` in text and in text attribute values inserts a field's value (a path lookup, no expressions or math). A missing value is empty. Booleans show Yes/No; numbers are plain; arrays are comma-joined; a reference to other Content shows its name. `{}` and invalid paths are errors; interpolating a struct/object only warns.
- Escapes: `\{` `\}` `\\` for literal braces and backslash. Entities `&lt; &gt; &amp; &quot; &apos;` and numeric `&#123;` / `&#x7B;`. A bare `<` in text is an error (write `&lt;`).
- Comments: `<!-- ... -->` (an unterminated comment is an error).
- Limits: 100,000 characters, 32 levels of nesting, 5,000 nodes. CSS: 50,000 characters.
- Some attributes take `{path}` instead of a literal: number attributes accept exactly one `{path}` (e.g. `max="{hp.max}"`), text attributes accept interpolation mixed with text; enum, boolean, icon, class, list, and field attributes cannot use `{...}`.
- No raw HTML, `style`, `on*` events, or URLs. Icons are Iconify names like `i-lucide-sword`. Images are `https` URLs held in a string field.

## Tags

The full list of attributes and children is in `references/tags.md` (verified against the registry). Summary:

- Layout: `Sheet`, `Section` (card; `title`, `description`, `icon`, `span`, `collapsible`, `collapsed`), `Grid` (`cols` 1-12, `gap`), `Stack` (`direction`, `gap`, `align`, `wrap`), `Tabs` (only `Tab` children) and `Tab` (`label` required), `Divider`, `Heading` (`level` 1-4), `Note`, `Callout`, `Badge`, `Collapsible` (`title` required).
- Fields (all need `field`; optional `label`, `hint`): `Field` (input chosen from the schema type), `Text`, `Number`, `Checkbox`, `Toggle`, `Select` (`options` required), `Tags`, `Tracker` (`max` required), `Ref`, `Value` (never editable), `Markdown`, `Image`.
- Repeaters: `List` (repeats its children per array item), `Table` (only `Column` and `RowDetails` children).
- Every tag also takes `class`, `live`, `locked`, `display`.

Rendering notes: `Number variant="stat"` shows a big number with its label small. `Value format="signed"` shows `+2` for positives. `Tracker style="pips"` shows boxes instead of a bar. `Ref` shows a link to the referenced resource or Content.

## Field paths

- Dotted: `stats.strength`, `attacks.0.name` (numeric segments index arrays). Keys are identifiers (`[A-Za-z_][A-Za-z0-9_]*`).
- Built-in `name`: every content type has a `name` string (the Content's name). `<Text field="name" />` and `{/name}` always work.
- Inside `<List field="items">` and `<Table field="items">`, paths are relative to the current item. A leading `/` means the top level: `{/name}`, `field="/hp.max"`. Nested lists are relative to the innermost item. `field="."` is the item itself (arrays of strings or other primitives): `<List field="languages"><Badge>{.}</Badge></List>`; `<Text field="." />` in a list of strings works too.
- `List` needs an array; `Table` needs an array of structs (or content/object items). `Table` on a string array is an error (use `Tags` or `List field="."`). A struct cannot be bound by a field tag: wrap its fields in a `Section` or `Grid` and bind each field (`hp.current`).
- `content` fields: a path continues into the referenced content type's schema: `class.name`, `class.hitDie`, `class.subclass.feature.name`. At most 3 content fields may be crossed; a fourth is an error. Values reached through a reference are read-only. In an array of structs holding a content field (`inventory: [{ item: content, qty }]`), `item.weight` sits next to `qty` inside the List.
- Free-form `object` fields: `<Field field="o" />` edits them as JSON; paths below them (`o.foo.bar`) only warn and show whatever the data holds.
- `scalar` fields bind `Field`, `Value`, `Column` only.
- Which tag binds which field type: `Text`, `Select`, `Markdown`, `Image` bind string; `Number`, `Tracker` bind number; `Checkbox`, `Toggle` bind boolean; `Tags` binds an array of strings; `Ref` binds resourceLink and content; `Value` binds anything; `Field` binds string, number, boolean, scalar, object, resourceLink, content, and arrays of strings; `Column` binds string, number, boolean, scalar, resourceLink, content.
- Unknown paths: error when the content type has a strict schema, warning when not (`hasStrictSchema`). `{path}` follows the same rule.
- Labels: `label` attribute, else the schema field's `label`, else the humanized name (`hitPoints` becomes "Hit Points"). `hint` falls back to the schema description. `label=""` does NOT hide the label (it falls back to the schema label); there is no way to hide one yet (see TODO.md).

## `live`, `locked`, `display`

Boolean (`live`, `locked`) or enum (`display`) attributes on any tag; on layout tags they apply to every field inside, and a descendant opts out with `live="false"` / `locked="false"` / another `display`.

- `live`: the field stays editable with the Edit switch off (for users who can edit the Content). Use it for things changed in play: hit points, spell slots, inspiration.
- `locked`: read-only even in Edit mode until the user clicks the field's pencil button. Use it for things that rarely change: ability scores, level.
- They compose: editable when the user can edit and (Edit is on, or `live`), and if `locked`, after the unlock click. `live locked` = editable in view mode after unlocking.
- `display="text"` shows non-editable fields as plain values (stat blocks, spell cards); `display="box"` shows their input, disabled, so the sheet looks the same in edit and view mode (character sheets). It defaults to the Sheet's "Non-editable fields" setting (new sheets: `box` for player characters, `text` otherwise). `Value` and `Image` look the same in both.

## CSS

Details and tables are in `references/css.md`. Essentials:

- Every selector is scoped to the Sheet automatically: write `.sheet-section { ... }`, never worry about affecting the app.
- Hook classes: every tag's root element has `sheet-<tag>` in lowercase (`sheet-section`, `sheet-grid`, `sheet-number`, `sheet-text`, `sheet-tabs`, `sheet-tab`, ...); List items also have `sheet-list-item`; plain text paragraphs have `sheet-text`; broken tags `sheet-invalid`. Add your own with the `class` attribute (names: lowercase letters, digits, hyphens, starting with a letter). Column has no element of its own, so it has no hook.
- `:root`, `html`, and `body` mean the Sheet's own root element (only at the start of a selector), so `:root { --accent: teal }` defines variables for the Sheet. A leading `.dark` targets dark mode: `.dark .sheet-section { ... }`.
- Use Nuxt UI tokens so the Sheet follows the theme: `var(--ui-primary)`, `--ui-text`, `--ui-text-muted`, `--ui-text-highlighted`, `--ui-bg`, `--ui-bg-elevated`, `--ui-border`, `--ui-radius`.
- Fonts: only these load, by name in `font-family`: Cinzel, Uncial Antiqua, IM Fell English, Crimson Pro, Special Elite, Orbitron (plus generic families). Another name is a warning: it shows only if the viewer has it installed. There is no `@font-face`.
- Rejected (errors, the rule or declaration is dropped): `url()`, `image-set()`, `image()`, `cross-fade()`, `element()`, `paint()`, `expression()`, `@import`, `@font-face`, `@namespace`, `@page`, any at-rule other than `@media`, `@supports`, `@container`, `@layer`, `@keyframes`; `behavior`, `-moz-binding`; selectors that could reach outside the Sheet (`:root`/`html`/`body` inside `:not()`/`:is()`/`:has()` or after other selectors, `~`/`+` next to the root, a leading `~`/`+`, `&` inside pseudo-class functions).
- Allowed: CSS variables, `!important`, nesting, media/container/supports/layer queries, keyframes (names get a per-Sheet suffix automatically), `position: fixed` (it stays inside the Sheet).
- No images by URL: use gradients, borders, shadows, or emoji.

## Reading the schema

A content type's `schema` is a JSON object mapping field keys to field definitions, in display order. To get it:

- The content type's page (`/types/[id]`, JSON view), or `GET /api/content-type/[id]` (the `schema` and `hasStrictSchema` fields). Sheet pages and the editor's Reference panel list the valid field paths with their types.
- Field definition: `{ "type": ..., "required"?, "label"?, "description"? }` plus, by type: `array` has `itemType` (a field definition); `struct` has `entries` (a schema: exactly those fields); `object` is free-form; `resourceLink` has optional `kind` (`system`, `campaign`, `contentType`, `sheet`, `content`); `content` has `contentTypeId` and `allow` (`reference`, `local`, `both`); `string`, `number`, `boolean`, `scalar` have nothing extra. Source: `shared/content-schema.ts`.
- Turn it into paths: top-level key `hp` of type `struct` with `current` and `max` gives `hp.current` and `hp.max`; an `array` of `struct` gives a `List`/`Table` on the array and item-relative paths (`name`, `bonus`); an `array` of `string` gives `Tags` or `List field="."`; a `content` field `class` adds `class.name` and every field of that type as `class.<key>` (fetch that content type's schema too).
- Pick the tag by type: string is `Text` (`multiline` for long text, `Markdown` for formatted text, `Select` for a fixed set of options, `Image` for an image URL); number is `Number` (or `Tracker` with a `max` for a current-out-of-maximum value); boolean is `Checkbox` or `Toggle`; `resourceLink` and `content` are `Ref`; string arrays are `Tags`; arrays of structs are `Table` (short primitive columns) or `List` (nested layout); read-only display is `Value`.
- Choose `Select` `options` yourself: the schema cannot list allowed choices yet (TODO.md), so saved data is not checked against them.
- Do not invent fields. If the schema lacks a field the user wants, say so; changing a schema is a content type edit (and it can break existing sheets: the app asks to confirm).

## Checking your work

`references/checking.md` has a script that compiles markup with `compileSheet` and CSS with `processSheetCss` against a schema file and prints the diagnostics; run it with vitest through the project's zsh/nvm wrapper. The Sheet editor's Problems list shows the same diagnostics. Treat every error as blocking (a Sheet with errors cannot be saved) and read each warning.

## Worked examples

`references/examples.md`: a player character sheet (tabs, tracker, live/locked, table, content reference), an NPC stat block, and a spell card, each with its schema, markup, and CSS. They compile without errors against their schemas.

## Known limits

- No formulas or computed values yet: ability modifiers, bonuses, and DCs must be stored fields. Do not write expressions inside `{...}`.
- Dice buttons, hiding a field's label, choice fields in schemas, and iterating a struct's entries in a `List`/`Table` are all planned in TODO.md, not available.

## Known doc drift

`docs/sheet-system.md` disagrees with the code in a few places; follow the code: `Grid`/`Stack` `gap` also accepts `none`; `Table` also allows `RowDetails` children; the doc says `Markdown` renders as plain text until a later phase, but it now renders with the editor's Markdown view; the doc says every tag renders a `sheet-<tag>` hook class, but `Column` renders no element of its own, so it has none.
