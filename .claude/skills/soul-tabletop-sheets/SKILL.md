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
- Every sheet is one `<Sheet>` root (required, #96); only `<Define>`s may sit beside it. Sheets are compact by default (small inputs, labels, and gaps, like a character sheet); `<Sheet density="roomy">` uses the site's roomier form spacing instead (`density="compact"` is still valid).
- Attributes: `name="value"` or `name='value'`. A bare `name` means true (booleans only). Unquoted values are an error. A duplicate attribute is an error. Attribute names are `[A-Za-z_][A-Za-z0-9_-]*`.
- Text goes directly inside layout tags and renders as a paragraph; whitespace collapses like HTML. `<Grid>`, `<Section>`, etc. accept text; `Heading`, `Note`, `Callout`, `Badge` accept only text; `Divider` and field tags accept nothing.
- Formulas: every `{…}` in text and in text attribute values is a formula (see "Paths, formulas, and features"); `{hp}` shows what the `hp` field displays, computed value included. A missing value is empty. Booleans show Yes/No; numbers are plain; arrays are comma-joined; a reference to other Content shows its name. `{}` and `{= …}` are errors, and so is a formula that gives a struct, object, or list.
- `formula="expr"` on some field tags, and `show="expr"`, are bare formulas, without braces.
- Escapes: `\{` `\}` `\\` for literal braces and backslash. Entities `&lt; &gt; &amp; &quot; &apos;` and numeric `&#123;` / `&#x7B;`. A bare `<` in text is an error (write `&lt;`).
- Comments: `<!-- ... -->` (an unterminated comment is an error).
- Limits: 100,000 characters, 32 levels of nesting, 5,000 nodes. CSS: 50,000 characters.
- Some attributes take a `{formula}` instead of a literal: `Tracker`'s `max` and `mark` and `Number`'s `min`, `max`, and `step` accept exactly one `{formula}` (e.g. `max="{hp.max}"`, `max="{hp.base + level * 2}"`); other number attributes (`cols`, `span`, `level`) take plain numbers only; text attributes accept both mixed with text; enum, boolean, icon, class, list, and field attributes cannot use `{...}`.
- No raw HTML, `style`, `on*` events, or URLs. Icons are Iconify names from Lucide (`i-lucide-sword`) or game-icons.net (`i-game-icons-crossed-swords`); no other icon sets. Images are `https` URLs held in a string field.

## Tags

The full list of attributes and children is in `references/tags.md` (verified against the registry). Summary:

- Layout: `Sheet`, `Section` (card; `title`, `description`, `icon`, `span`, `collapsible`, `collapsed`), `Grid` (`cols` 1-12, `gap`), `Stack` (`direction`, `gap`, `align`, `wrap`), `Tabs` (only `Tab` children) and `Tab` (`label` required), `Divider`, `Heading` (`level` 1-4), `Note`, `Callout`, `Badge`, `Collapsible` (`title` required).
- Fields (need `field`, or `formula` where allowed; optional `label`, `hideLabel`, `hint`): `Field` (input chosen from the schema type), `Text`, `Number`, `Checkbox`, `Toggle`, `Select` (the field's schema options, else its own `options` list), `Tags`, `Tracker` (`max` optional), `Ref`, `Value` (never editable), `Markdown`, `Image`.
- Repeaters: `List` (repeats its children per array item, or per entry of a struct whose entries are alike), `Table` (only `Column` and `RowDetails` children; `Column` takes `field` or `formula`, and `format`, and may hold `Part` and `Button` children).
- Breakdowns: `Part` (`label`, `formula`, `show` only) inside `Value`, `Column`, or `Number`. See "Paths, formulas, and features".
- Buttons and rolls: `Button` (`label` required, `icon`, `amount`, `toast`; step children), and the steps `Set` (`field`, `formula`, both required), `Roll` (`formula` required, `name`, `label`, `crit`, `fumble`), and `FollowUp` (`label` required; step children). Steps also go directly in `Value`, `Number`, and `Column`. See "Paths, formulas, and features".
- Definitions: `Define` (`name`, `params`, `formula`; top level or directly inside `Sheet`; renders nothing).
- Every tag also takes `class`, `show`, `live`, `locked`, `display`, except `Tab` and `RowDetails` (their parents render them), which take only `class` and `show`; `Column` takes no `show`; `Button` takes `class`, `show`, and `live` only; `Define`, `Set`, and `Part` (only `show`) take none.

Rendering notes: `Number variant="stat"` shows a big number with its label small. `format="signed"` (on `Number` and `Value`) shows `+2` for positives; an editable `Number` input shows the sign too, while the saved value stays a plain number. `Tracker style="pips"` shows boxes instead of a bar; a `Tracker` without `max` (or at 0) shows just its value. `Checkbox style="dot"` shows a filled or empty circle with no Yes/No text. On phones, `Table` rows stack their cells with labels. `Ref` shows a link to the referenced resource or Content.

## Paths, formulas, and features

The details are in `docs/sheet-system.md`; grep for the section you need and read only it (the file is long). The essentials:

- **Paths** ("Field paths", "Content fields"): dotted (`stats.str`, `attacks.0.name`); inside `List`/`Table` rows paths are relative to the row, `/` starts at the top level, `.` is the row itself. Every path must exist in the schema (strict types: error). Paths continue through `content` fields (`class.hitDie`, at most 3 hops), read-only there. Built-in `name` always exists.
- **Formulas** ("Formulas"): `formula="…"` on `Value`, `Column`, `Tracker` (read-only) and `Number`, `Text`, `Checkbox`, `Field` (overrides with `field`); `{…}` in text and text attributes; `show="…"` hides a tag. No `=`, `&&`, `||`, `?:`; use `and`, `or`, `if(c, a, b)`; text in single quotes inside attributes. Built-ins are listed in `shared/sheet/formula-functions.ts`. Reusable formulas: `<Define name params formula>`.
- **`live`, `locked`, `display`** (section 5, "Per-field attributes" and "Display of non-editable fields"): `live` keeps a field editable (and saving at once) with Edit off, for things changed in play; `locked` needs a pencil click first; `display="box"` shows non-editable fields as disabled inputs (character sheets), `text` as plain values (stat blocks, cards).
- **Breakdowns** ("Breakdowns"): `<Part label formula>` children on `Value`, `Column`, or `Number` (with a formula) list a number's parts in a popover; without a formula a `Value`/`Column` shows their sum.
- **Buttons** ("Buttons"): `<Button label>` with `<Set field formula>` children changes fields when clicked (damage, rests, item moves); steps run in order, `amount` adds a number box, `*` in a Set's field changes every item, `toast` adds a toast with Undo (off by default), `live` makes it usable with Edit off.
- **Rolls** ("Rolls"): `<Roll formula="d20 + value()" crit="face == 20" fumble="face == 1">` inside a `Value`, `Number`, or `Column` makes the value roll when clicked (or inside a `Button`); `<FollowUp label>` after it offers more steps on the result (damage, crit damage, a reroll that spends a resource). Dice only in a Roll's formula; `dice(field)` rolls dice written in a text field; `name="hit"` lets later steps read `hit.total`, `hit.natural`, `hit.crit`. `<Sheet rolls="button">` puts a die button beside every rollable value.
- **Reference previews** ("Reference previews"): `preview` on `Ref`, `Value`, or `Column` makes the value show the content it comes from (`spell.name` → the spell): expanded below it by default (spells, feats), or `preview="card"` as a floating card (minor things like a background). Shows the tag's own `<Preview>` child if any, else the `<Preview>` beside `<Sheet>` in that content type's default sheet, else a view generated from the schema (paths relative to that content; read-only).
- **Density** ("Tag catalog", `Sheet`): sheets are compact by default; `<Sheet density="roomy">` for form spacing.

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

- Formulas can't roll dice or write data (only `Roll` steps roll and `Set` steps write, when clicked), and computed values aren't saved or returned by the API.
- `{…}` is always a formula, never a bare lookup: a field named like a keyword (`and`, `true`) or dice (`d6`) is reached as `{/and}`, `{/d6}`.
- Dice buttons are planned in TODO.md, not available.

## Known doc drift

`docs/sheet-system.md` disagrees with the code in a few places; follow the code: `Grid`/`Stack` `gap` also accepts `none`; `Table` also allows `RowDetails` children; the doc says `Markdown` renders as plain text until a later phase, but it now renders with the editor's Markdown view.
