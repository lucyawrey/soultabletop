# Sheet System — Design

## Context
TODO.md's top item: sheets store `markup` + `cssStyles` (`server/database/schema.ts` `sheet` table) but they are only
displayed as raw text, and content is edited as a raw JSON textarea (`app/components/ContentDetail.vue`). Goal: sheet
markup renders content as Nuxt UI character/content sheets, in view and edit mode.

Decisions so far:
- Syntax: HTML-like component tags from a fixed allowlist, rendered by Nuxt UI components.
- Sheets both view and edit content data (JSON editor kept as "Advanced").
- CSS: kept, sanitized + scoped under the sheet root.
- Computed values: yes, but a later phase (safe expression language, never `eval`).
- A viewer who can read content but not its selected sheet gets the **generated** sheet (section 4).
- Add `vitest` (for parser, validator, CSS sanitizer).
- Remove `localType` from `ContentFieldSchema` (`schema.ts:118`, `content-validation.ts:25`). While there, validate
  content type `schema` bodies against the `ContentFieldSchema` shape — `api-schemas.ts:58` currently accepts any object.

Sections: 1. markup language + parser → 2. tag catalog → 3. validation against schema → 4. generated sheets →
5. renderer/view+edit → 6. CSS → 7. editor page → 8. implementation phases.

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
- Interpolation: `{path}` in text and in attribute values → field value (path lookup only, no expressions until the
  formulas phase). Missing value → empty. Literal braces: `\{` `\}`, literal backslash `\\`. (decided)
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
interface SheetAttr    { name: string; value: TextPart[] | true; loc: Loc }
interface SheetText    { type: "text"; parts: TextPart[]; loc: Loc }
type TextPart = string | { path: string; loc: Loc };
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
list; required; default), allowed children, and which schema field types it may bind to. Numeric/text attrs accept
`{path}` interpolation (e.g. `max="{hpMax}"`). Every tag also accepts `class` (names matching `[a-z][a-z0-9-]*`) and
renders a fixed hook class `sheet-<tag>`.

### Layout
| Tag | Attrs | Children | Renders |
|---|---|---|---|
| `Sheet` | — | any | root wrapper; optional (implicit if omitted) |
| `Section` | `title`, `description`, `icon`, `span` | any | `UCard` with header |
| `Grid` | `cols` (1–12, default 2), `gap` (sm/md/lg) | any | CSS grid, 1 column on mobile |
| `Stack` | `direction` (row/column), `gap`, `align`, `wrap` | any | flex container |
| `Tabs` / `Tab` | Tab: `label` (req), `icon` | Tabs: only `Tab` | `UTabs` |
| `Divider` | `label` | none | `USeparator` |
| `Heading` | `level` (1–4) | text | h2–h5 |
| `Note` | — | text | muted paragraph |
| `Callout` | `color`, `icon`, `title` | text | `UAlert` |
| `Badge` | `color` | text | `UBadge` |
| `Collapsible` | `title` (req), `subtitle`, `icon`, `open` | any | `UCollapsible`: clickable header, children shown on expand (e.g. one per `List` item) |

`Section` also accepts `collapsible` and `collapsed`. `Table` accepts a `RowDetails` child (any content) rendered
in `UTable`'s expandable rows.

### Fields
Common attrs: `field` (req), `label` (default: humanized last path segment, `hitPoints` → "Hit Points"), `hint`.
View mode renders formatted values, edit mode renders the input.

| Tag | Extra attrs | Binds | Edit input |
|---|---|---|---|
| `Text` | `multiline`, `placeholder` | string | `UInput` / `UTextarea` |
| `Number` | `min`, `max`, `step`, `variant` (input/stat) | number | `UInputNumber`; `stat` = big centered number + small label (no separate `Stat` tag — decided) |
| `Checkbox` / `Toggle` | — | boolean | `UCheckbox` / `USwitch` |
| `Select` | `options` (comma list, req) | string | `USelect` |
| `Tags` | — | array of string | `UInputTags` |
| `Tracker` | `max` (req), `style` (bar/pips) | number | `UProgress` or pip boxes |
| `Ref` | — | resourceLink / `content` | link to the resource; edit: picker (see "Content fields"; for `resourceLink`, a picker of readable resources of the field's `kind`, or of a chosen kind) |
| `Value` | `format` | any | read-only in both modes |
| `Field` | — | any | picks input from schema type (decided); generated sheets mostly use this. `scalar`: input with a type switch (string / number / boolean / null); free-form `object`: inline JSON editor (CodeMirror) |
| `Markdown` | — | string | view: safe Markdown subset (no raw HTML); edit: `UEditor` in Markdown mode (decided) |
| `Image` | `alt`, `size` | string (image URL) | view: `<img referrerpolicy="no-referrer">`; edit: URL input (decided) |

Image URLs: https only. The schema has no image type, so this is enforced where the tag is used: `Image` renders only
https URLs, and its edit input validates client-side. Uploads later, same field shape.

Label resolution: `label` attr → schema field `label` → humanized field name. `hint` falls back to schema
`description`. (decided: `ContentFieldSchema` entries gain optional `label` and `description`.)

### Content fields: references and local data (decided)
- Schema type `{ type: "content", contentTypeId, allow: "ref" | "local" | "both", required }` replaces the old
  `contentType` type (whose validator wrongly required the value to equal the content type id).
- Value is a **string** = id of an existing content of that content type (reference), or an **object** = local data
  validated against that content type's schema, including its own `name`. `allow` restricts which forms are accepted.
- Paths continue through it into that content type's schema: `class.hitDie`, `class.name`, `item.weight`. Works in
  arrays: `inventory: [{ item: content(Item), qty: number }]` → `item.weight` next to `qty`.
- Referenced values are **live and read-only** through the sheet; local values are editable. Edit mode shows a
  searchable picker of readable content of that type (for `ref`/`both`), a "Custom" option creating a local object
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
| `List` | `field` (array), `layout` (stack/grid), `cols`, `addLabel` | template for one item | edit mode: add/remove/reorder; `field="."` = the item itself (arrays of primitives) |
| `Table` / `Column` | Table: `field`; Column: `field`, `label`, `width` | Table: only `Column` | `UTable`; cell input picked from schema type |

---

## 3. Validation against the ContentType schema

`validate()` in `shared/sheet/validate.ts`. Errors block sheet save; warnings are shown in the editor only.

Structural (errors): unknown tag; unknown attr; missing required attr; attr value not coercible (e.g. `cols="abc"`,
enum out of range); child not allowed (e.g. non-`Tab` in `Tabs`, children in `Divider`).

Field paths — resolved through the schema, following `List` scopes (relative to innermost item, `/` = root, `.` =
the item):
| Case | Strict schema | Non-strict schema |
|---|---|---|
| Path not in schema | error | warning (data may hold extra keys) |
| Tag can't bind that field type (e.g. `Number` on a string) | error | error |
| Field is `scalar` | binds `Field`, `Value`, `Column`; no paths below it | same |
| Path goes into a free-form `object` | warning (not checked; shows whatever the data holds) | same |
| `List`/`Table` on a non-array | error | error |
| Relative path inside a `List` of primitives (other than `.`) | error | error |
| `{path}` interpolation not in schema | error | warning |
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
- Array of strings → `Tags`; other primitive arrays → `List field="."`.
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
- `Markdown` renders as plain pre-wrapped text until phase 6 adds `UEditor`.

`ContentDetail.vue`:
- Replaces the Data card with `<SheetRenderer>`. The header's former Edit button is now **Settings** (so it isn't
  confused with the Edit switch); its modal keeps Name, Slug, Visibility, the saved sheet, and the raw JSON editor.
- The draft lives in `app/composables/useContentDraft.ts` (compares with sorted keys, since `content.data` is jsonb).
  Editing controls are `sheet/FieldInput.vue`; List/Table add/remove/reorder use `useSheetListEditing` and
  `sheet/ListAdd.vue`; `sheet/ContentPicker.vue` picks referenced content.

Edit + Autosave switches (decided):
- Header shows two switches when `canEdit`: **Edit** and **Autosave**. Their initial state comes from the sheet;
  toggling is per page view (not persisted).
- New `sheet` columns: `defaultEditMode boolean not null default false`, `defaultAutosave boolean not null default
  false`, editable in the sheet form/editor and accepted on sheet create/update.
- Generated sheets take defaults from the content type's `contentCategory`: `playerCharacter` → both on;
  `nonPlayerCharacter` → edit off, autosave on; `general`/`page` → both off.
- Edit on, Autosave off: draft copy, Save/Cancel buttons, unsaved-changes guard on navigation.
- Edit on, Autosave on: each change saves after ~800 ms of inactivity; status indicator (Saving… / Saved / Error).
  A validation error keeps the draft and shows the message; the next change retries.
- Edit off: read-only view (the Autosave switch only presets how editing behaves once turned on), except `live` fields.
- One draft model for all modes: whenever the draft differs from the saved data and autosave is off, a
  Save/Discard bar is shown (covers `live` edits made in view mode).

Per-field attributes (decided), boolean, allowed on any field tag and on `List`/`Table`:
- `live` — editable even with Edit off (for users with `canEdit`). Saves via autosave if on, else via the Save bar.
- `locked` — read-only even with Edit on until the user clicks the field's small pencil button, which unlocks that
  field for the rest of the page view.
- They compose: a field is editable when `canEdit && (editMode || live)`; if `locked`, it additionally needs its
  unlock click. `live locked` = editable in view mode after unlocking.
- Also allowed on layout tags, where they are inherited by every field inside; a descendant opts out with
  `live="false"` / `locked="false"`.

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
- `.dark` at the start of a selector stays outside the prefix (`.dark .x` → `.dark [data-sheet] .x`) so sheets can
  follow Nuxt UI's color mode.
- Keyframe names are prefixed per sheet so they can't clash with the app's or other sheets'.
- Rejected: `@import`, `@font-face`, `@namespace`, `url()`, `image-set()`, `expression()`, `-moz-binding`,
  `behavior`. Allowed: `@media`, `@supports`, `@container`, `@layer`, `@keyframes`, CSS variables, `!important`.
- Authors can use Nuxt UI tokens (`var(--ui-primary)`, `var(--ui-text-muted)`, …) to match the app theme.
- Also rejected: other file-loading functions (`image()`, `cross-fade()`, `element()`, `paint()`), CSS escapes are
  decoded before checking, and `<` in the output is escaped (`\3c `) so CSS can't close its `<style>` element in SSR.
  Nested rules (CSS nesting) are left relative to their parent.
- Implementation: `shared/sheet/css.ts` (`processSheetCss`); the content GET returns the chosen sheet's CSS scoped;
  a sheet picked in "View with" is scoped in the browser (the module is imported on demand). The renderer injects it
  with `useHead` and marks its root with `data-sheet`, `isolate`, and `contain: paint`.

- `:root`, `html`, `body` are rewritten to the sheet root itself (decided), so `:root { --accent: red }` works.
- Selector rule (security boundary): every selector's subject must be inside the sheet. So `:root`/`html`/`body` may
  only start a selector (not inside `:not()`/`:is()`/`:has()`/…), nothing may follow them with `~`/`+`, top-level
  selectors can't start with `~`/`+`, nested rules can't use `&` inside pseudo-class functions, and rules nested in a
  root-targeting rule (`:root { … }`, `.dark { … }`) can't use `& ~`/`& +` or a leading `~`/`+`. Violations are errors
  (the rule is dropped). The same checks run on save (no scope ID) and when scoping. Don't loosen these without
  re-checking that nothing can style the app outside the sheet; tests in `shared/sheet/css.test.ts`.
- Fonts (decided): curated, self-hosted list. `@nuxt/fonts` (already installed by `@nuxt/ui`) only scans the app's
  own CSS at build time, so the sheet fonts are declared in `nuxt.config.ts` `fonts.families` with `global: true`.
  The list lives in `shared/sheet/fonts.ts` (also used by the editor's reference panel); a `font-family` naming an
  unlisted font is a warning, not an error. Starting set chosen at implementation time (a few display/serif fonts).

---

## 7. Sheet editor page

Route `app/pages/sheets/[id]/edit.vue` (`middleware: "auth"`; redirects to `/sheets/[id]` when `!canEdit`). The sheet
detail page moved to `sheets/[id]/index.vue` so the editor is a sibling route, not a child. The detail page's and the
list's Edit go here; the edit modals are gone. The list's create modal only asks for name, slug, visibility,
content type, and default, then opens the editor: a sheet created without markup starts with the generated markup
(this is the "Copy to new Sheet" path). `GET /api/sheet/[id]` includes `schemas` and `contentCategory`.

Layout (side by side ≥ lg; below that an Editor/Preview tab switch):
- Left: tabs **Markup** | **CSS** | **Settings** (Name, Slug, Visibility, Default sheet, Default edit mode, Default
  autosave), then a diagnostics list (errors + warnings, click → jump to line).
- Right: live preview via the real `SheetRenderer` with its Edit/Autosave switches (preview edits never save), plus a
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
6. **Edit mode** — draft model, Edit/Autosave switches, Save/Discard bar, autosave, `live`/`locked`, 409 handling,
   Markdown (`UEditor`) and Image fields, content-field picker / Custom / "Make custom copy"; content Edit modal keeps slug/visibility/sheet/raw JSON.
7. **Scoped CSS + fonts** — `shared/sheet/css.ts` + tests (every rejected construct, prefixing, `.dark`, `:root`,
   keyframes); sheet save validation; curated fonts in `nuxt.config.ts`.
8. **Sheet editor page** — `app/pages/sheets/[id]/edit.vue`, CodeMirror, preview, reference slide-over, "Copy to new
   Sheet" from generated.
9. **Later** — formulas (safe expression parser), image uploads, dice rolls.

Also update `CLAUDE.md` (sheet system section, `shared/` code, `pnpm test`) and remove the TODO.md item once done.

## Verification
- `pnpm test` (vitest) for `shared/sheet/*`; `pnpm typecheck && pnpm lint`; compile changed templates with
  `@vue/compiler-sfc`; manual check in the dev server once rendering exists.
