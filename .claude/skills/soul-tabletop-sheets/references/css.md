# Sheet CSS reference

Source of truth: `shared/sheet/css.ts` (`processSheetCss`), `shared/sheet/fonts.ts`, `shared/sheet/css.test.ts`.

## How scoping works

On save the CSS is only checked. When served, every selector is rewritten to start with the Sheet root,
`[data-sheet="<sheetId>"]`, and that root gets `isolation: isolate` and `contain: paint` (so even `position: fixed`
stays inside the Sheet). You write ordinary selectors:

| You write | Output |
|---|---|
| `.sheet-section { }` | `[data-sheet="id"] .sheet-section { }` |
| `:root { --accent: teal }` (also `html`, `body`) | `[data-sheet="id"] { --accent: teal }` |
| `@media print { .x { } }` | `@media print { [data-sheet="id"] .x { } }` |
| `@keyframes spin { }` and `animation: spin 1s` | both renamed `spin-<id>` |
| nested `.x { .y { } &:hover { } }` | nesting stays relative to its parent |

Verified: these outputs come from running `processSheetCss` on those inputs.

## Hook classes

Every tag's root element has `sheet-<tag>` in lowercase: `sheet-sheet`, `sheet-section`, `sheet-grid`, `sheet-stack`,
`sheet-tabs`, `sheet-tab`, `sheet-divider`, `sheet-heading`, `sheet-note`, `sheet-callout`, `sheet-badge`,
`sheet-collapsible`, `sheet-list`, `sheet-table`, `sheet-rowdetails`, and one per field tag (`sheet-field`,
`sheet-text`, `sheet-number`, `sheet-checkbox`, `sheet-toggle`, `sheet-select`, `sheet-tags`, `sheet-tracker`,
`sheet-ref`, `sheet-value`, `sheet-markdown`, `sheet-image`, `sheet-column`). Also `sheet-list-item` (each List item),
`sheet-text` on plain text paragraphs (the same class as the `Text` tag, so scope with a parent when it matters),
`sheet-invalid` (placeholder for a broken tag, shown to editors only), and `sheet-root` on the outermost element.
Each `Column` cell has `sheet-column`. The `class` attribute adds your own classes on the same element.

Inside every field tag (`Text`, `Number`, `Value`, `Column` cells, ...) two more hooks are fixed: `sheet-field-label` (the visible label above the value, or under it for `Number variant="stat"`; absent with `hideLabel` and in `Column` cells) and `sheet-field-value` (a wrapper around the value or input). Use them instead of `div:first-child` or Nuxt UI/Tailwind classes, e.g. `.sheet-number .sheet-field-label { text-transform: uppercase; }`. Hint text has no hook.

Inner parts of Nuxt UI components have no stable hooks: style what the hooks and `class` attributes reach, use
variables (the `--st-*` theme tokens), and avoid selectors that depend on Nuxt UI's internal markup.

## Theme tokens

The site has one light theme. These tokens follow it, and their names are stable (the editor's reference panel lists
them, from `shared/sheet/theme-tokens.ts`; the values and rules are in `docs/theme.md`):

| Token | Use |
|---|---|
| `--st-page` | page background behind panels |
| `--st-panel`, `--st-panel-muted` | panel background, shaded panel (table headers) |
| `--st-ink`, `--st-ink-muted` | main text, secondary text |
| `--st-primary`, `--st-on-primary` | primary color, text on it |
| `--st-accent` | accent color |
| `--st-border`, `--st-border-strong` | dividers, outlines that must stand out |
| `--st-radius` | corner radius of buttons and inputs |
| `--st-font-body`, `--st-font-display` | body font, display font (large headings only) |

Nuxt UI's `--ui-*` variables still work, but their names can change with Nuxt UI upgrades. `.dark` is an ordinary
class (there is no dark mode).

## Fonts

Self-hosted and usable by name in `font-family`: Cinzel (classical capitals, titles), Uncial Antiqua (medieval
uncial), IM Fell English (old printed book), Crimson Pro (readable book serif), Special Elite (typewriter),
Orbitron (futuristic). Generic families (`serif`, `sans-serif`, `monospace`, `system-ui`, ...), `var(...)`, and the keywords `inherit`, `initial`, `unset`, `revert`, `revert-layer` are fine. Any other family gives a warning (`css-font`), not an error. `@font-face` is rejected.

## Rejected (error; the rule or declaration is dropped)

| Construct | Code |
|---|---|
| `@import`, `@font-face`, `@namespace`, `@page`, and any at-rule other than `@media`, `@supports`, `@container`, `@layer`, `@keyframes` (or `@-webkit-keyframes`) | `css-at-rule` |
| `behavior`, `-moz-binding` properties | `css-property` |
| `url()`, `image-set()`, `-webkit-image-set()`, `image()`, `cross-fade()`, `element()`, `paint()`, `expression()` in any value (CSS escapes are decoded first) | `css-function` |
| A selector that could style anything outside the Sheet: `:root`/`html`/`body` anywhere but the start of a selector (including inside `:not()`, `:is()`, `:has()`), `~` or `+` after the root, a selector starting with `~` or `+`, `&` inside a pseudo-class function, `& ~` / `& +` or a leading `~` / `+` in a rule nested in a `:root` rule | `css-selector` |
| Syntax errors | `css-syntax` |
| More than 50,000 characters | `css-too-long` |

`<` is escaped in the output, so `content: "<b>"` is harmless text.

## Author tips

- Define your palette once in `:root` and use `var(--...)` everywhere.
- Layout comes from tags (`Grid`, `Stack`); use CSS for color, type, borders, spacing, and small-screen tweaks with `@media`.
- Target your own `class` names for one-off styles and `sheet-*` hooks for tag-wide styles.
