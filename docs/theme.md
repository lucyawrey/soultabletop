# Site theme

Soul Tabletop has one light theme, called "Folio": a lightly warm page with near-white panels, plum as the primary color, gilt as the accent, Nunito Sans for text, and Cormorant Garamond for large headings. There is no dark mode. Sheet designers get one consistent theme to design against.

The look was chosen from four mockups. They live in `.claude/mockups/ui-redesign/mockup.html`, an interactive page with a live contrast table; open it in a browser. Folio is direction D there. `frozen.html` beside it is the approved design locked to the chosen options, and `spec.md` lists its decisions and measurements; use them as the reference when checking the site or changing the theme.

## Where things live

| What | Where |
|---|---|
| Colors, fonts, radius, Sheet tokens | `app/assets/css/main.css` (the only place colors are defined) |
| Which palette is primary, secondary, neutral; component overrides | `app/app.config.ts` |
| Fonts and their weights | `shared/fonts.ts` (loaded by `fonts` in `nuxt.config.ts`; the table under Fonts) |
| Dark mode off | `ui.colorMode: false` in `nuxt.config.ts`; Scalar's `forceDarkModeState: "light"` |
| Sheet token names and descriptions | `shared/sheet/theme-tokens.ts` (shown in the sheet editor's reference panel) |
| Contrast and token checks | `shared/theme.test.ts` (runs with `pnpm test` and `pnpm check`) |

## Three layers

`main.css` defines the theme in three layers. Each layer refers only to the one above it.

1. **Palettes** (`@theme static`): three Tailwind color scales, 50 to 950. `plum` is primary, `gilt` is secondary (the accent), and `folio` is the warm neutral. `app.config.ts` assigns them by name (`colors: { primary: "plum", secondary: "gilt", neutral: "folio" }`). Nuxt UI then builds `--ui-color-primary-50…950` and the `primary-*` utilities from them. The scales also give Tailwind classes such as `bg-plum-100`, but prefer the semantic classes below.
2. **Semantic tokens** (`:root`): Nuxt UI's own variables, set to the theme's roles. They are unlayered, so they win over Nuxt UI's defaults, which sit in `@layer theme`. Components and pages use them through Nuxt UI's semantic classes (`text-muted`, `bg-elevated`, `border-accented`, `text-primary`), never raw hex values.
3. **Sheet tokens** (`--st-*`, also in `:root`): aliases of layer 2 that Sheet CSS may use. Their names are a public contract (see below).

### Semantic tokens

| Variable | Role | Value |
|---|---|---|
| `--st-page` | page background (`body`) | folio-100 `#f6f1e7` |
| `--ui-bg` | panels: cards, inputs, menus, modals, the sidebar | folio-50 `#fffdf8` |
| `--ui-bg-muted` | faint fill (same as the page) | folio-100 |
| `--ui-bg-elevated` | shaded panel: table headers, gutters, hover | folio-200 `#efe7d8` |
| `--ui-bg-accented` | stronger hover or selected fill | `#e6dccb` |
| `--ui-bg-inverted` | dark fill (tooltips, neutral solid buttons) | folio-900 |
| `--ui-text-highlighted` | headings and main text | folio-900 `#251f2a` |
| `--ui-text` | body text | folio-800 |
| `--ui-text-toned` | slightly softer text | folio-700 |
| `--ui-text-muted` | secondary text, hints, labels | folio-600 `#625869` |
| `--ui-text-dimmed` | least prominent text (placeholders, gutters); still 4.5:1 | `#6b6170` |
| `--ui-text-inverted` | text on solid colors | folio-50 |
| `--ui-border`, `--ui-border-muted` | **dividers only** | folio-300, folio-200 |
| `--ui-border-accented` | **outlines of controls** (inputs, outline buttons, toggles); 3:1 | folio-500 `#8a7f72` |
| `--ui-primary` | primary actions, links, current nav item, focus rings | plum-700 `#6b2d4e` |
| `--ui-secondary` | accent | gilt-700 `#765a14` |
| `--ui-primary-soft`, `--ui-secondary-soft` | soft chip fills behind primary and accent text (ours, not Nuxt UI's) | plum-100 `#f1dfe7`, gilt-100 `#f2e7c9` |
| `--ui-success`, `--ui-info`, `--ui-warning`, `--ui-error` | status | `#166534`, `#1d4ed8`, `#92400e`, `#b91c1c` |
| `--ui-radius` | base radius; `rounded-md` (buttons, inputs) is 1.5×, `rounded-lg` (cards) 2× | `0.3125rem` |

Nuxt UI normally picks `--ui-primary` and the others from shade 500 of the scale. Here they are set explicitly, so the values are exact and contrast is under our control.

### Fonts

- `--font-sans` is Nunito Sans for everything by default.
- `--font-display` is Cormorant Garamond; use it with the `font-display` utility. It has thin strokes and a small x-height, so use it only for headings at 22px and up, never for labels, table text, or small headings. `h1` uses it by default: list page titles are 34px, detail titles 40px (32px on phones), and panel titles 22px.
- `--font-mono` is JetBrains Mono, for readable IDs and code (the `font-mono` utility).

Every font on the site, the app's three and the extra ones for sheets, is listed with its weights in `shared/fonts.ts`. `nuxt.config.ts` registers that list with `@nuxt/fonts`, which downloads the files from Google Fonts at build time and serves them from this app, so visitors' browsers never contact Google; a weight is downloaded only when a page uses it. Sheet CSS may use any of these fonts by name in `font-family`, and the sheet editor's Reference panel lists them. Add a weight to the list before using it, or the browser fakes it. A new font needs a row below (`shared/fonts.test.ts` checks), with its license confirmed in the [google/fonts](https://github.com/google/fonts) repository.

| Font | Used for | Weights | Designer | License |
|---|---|---|---|---|
| Nunito Sans | App body text (`--font-sans`) | 400, 600, 700 | Vernon Adams, Jacques Le Bailly, Manvel Shmavonyan, Alexei Vanyashin | SIL Open Font License 1.1 |
| Cormorant Garamond | App headings (`--font-display`) | 400, 600, 700 | Christian Thalmann | SIL Open Font License 1.1 |
| JetBrains Mono | App IDs and code (`--font-mono`) | 400, 500, 700 | JetBrains, Philipp Nurullin, Konstantin Bulenkov | SIL Open Font License 1.1 |
| Cinzel | Sheets: classical capitals, for titles | 400, 700 | Natanael Gama | SIL Open Font License 1.1 |
| Uncial Antiqua | Sheets: medieval uncial script | 400 | Astigmatic | SIL Open Font License 1.1 |
| IM Fell English | Sheets: old printed book | 400 | Igino Marini | SIL Open Font License 1.1 |
| Crimson Pro | Sheets: readable book serif | 400, 700 | Jacques Le Bailly | SIL Open Font License 1.1 |
| Special Elite | Sheets: typewriter | 400 | Astigmatic | Apache License 2.0 |
| Orbitron | Sheets: futuristic, for sci-fi | 400, 700 | Matt McInerney | SIL Open Font License 1.1 |

### Component defaults and shared pieces

The visual reference is `.claude/mockups/ui-redesign/frozen.html` (direction D, Folio). `app/app.config.ts` sets Nuxt UI's defaults to match it, so pages don't repeat the classes:

- **Buttons:** semibold; `md` is 14px with 9px by 14px padding and 16px icons; solid buttons have a 2px inset shadow at the bottom. Outline buttons in a color (Delete) sit on the panel with a border of that color mixed 60% into `--ui-border-accented`, since Nuxt UI's 50% tint is under 3:1 on the page.
- **Form fields:** semibold labels and size `lg` by default, which makes inputs, selects, and textareas 40px tall with 15px text. Dense places (Sheet fields, the schema builder) set `size="md"` on their `UFormField`. `VisibilityField` styles its own cards: the chosen one a panel outlined in primary, the other on the page tone.
- **Navigation menu:** 15px rows, small uppercase group labels, no separators between groups; the current item is the solid primary pill.
- **Tabs, `variant="link"`:** the underline tabs used for My / Find and the sheet page. The underline is drawn from the active tab (`::before`), not Nuxt UI's sliding indicator, which only exists after hydration and jumped on load.
- **Tables:** a bordered panel with a header row on the shaded surface (`bg-elevated`) of small uppercase labels, and a light hover.
- **Modals:** a display-font title over a divider, and a footer on the page tone.
- **Text links** (a link in a line of text, like a system name or "Create one."): `text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary`. The underline is always there, since plum on muted text is under 3:1 and color alone can't mark a link. Names that head a row or card (bold, `text-highlighted`, `hover:text-primary hover:underline`) stand on their own and don't need it.

Shared components carry the rest: `PageContainer` (page width and padding), `PageHeader` (eyebrow, title, line, actions), `DetailHeader` (back link, eyebrow, 40px title, badges, actions, ornament rule), `DetailPanel` (a bordered panel with a 22px title and actions), `AboutPanel` (facts with dashed separators), `ResourceList` (tabs, search, view toggle, count, pages), `ResourceCards`, `ResourceActionsMenu`, `ListViewToggle`, `RecentCard`, the loading placeholders (`TableSkeleton` for rows, `CardSkeleton` for resource cards or dashboard card rows; a list's empty state picks the one matching its view), and the chips. Table columns without a visible header (row actions) get a screen-reader-only one from `actionsColumn` (`app/utils/table-columns.ts`). Every pill outside Sheets is a `LabelChip` (bold 12px on a rounded fill; tones `primary` for Official, `primarySoft` for Default and Admin, `accent` for Public, `neutral` for Community, categories, and roles, `outline` for Limited, `error`), which `SourceBadge` and `VisibilityBadge` wrap; `UBadge`'s 10% tints don't match the theme's soft fills, so only Sheet badges use it. The soft fills are `--ui-primary-soft` and `--ui-secondary-soft` (ours, not Nuxt UI's; checked by the contrast test). `ReadableIdBadge` is the monospace ID chip; lists, cards, and detail headers show the full address, `owner/id` (`resourceAddress` in `app/utils/owner-label.ts`), and the About panel the plain ID. Where Nuxt UI's theme can't produce the look, write the classes in the component (as `ListViewToggle` does).

## Accessibility rules

These are the rules `shared/theme.test.ts` checks against `main.css`:

- **Text is at least 4.5:1** (WCAG AA) on every surface it can sit on: every text token on the panel, the page, and the shaded surfaces; colored text (`text-primary`, `text-error`, …) on the panel and the page; light text on every solid color; and colored text on its own 10% tint (Nuxt UI's soft and subtle variants).
- **Control outlines, focus rings, and selected states are at least 3:1** against what's behind them (WCAG 1.4.11). That's why `--ui-border` (dividers, about 1.4:1) and `--ui-border-accented` (controls) are separate.

The test can't see these, so keep them by hand:

- **State never depends on color alone.** The current nav item and pressed toggles are a solid primary fill with bold text, not just a tint.
- **Focus is always visible.** `main.css` makes every `:focus-visible` outline full primary with a 2px gap (Nuxt UI draws them at 25% opacity). Inputs use a primary ring instead.
- **Solid buttons darken on hover** (`app.config.ts`, 15% black) instead of fading to 75% opacity, which would drop their text below 4.5:1.
- **Targets:** icon-only buttons are at least 32px.
- **Primary vs. error:** some colorblind viewers see plum and red as close. Destructive actions always keep their label or icon.

## Sheet tokens (stable contract)

Sheet CSS (`docs/sheet-system.md`, section 6) can match the site with these tokens, for example `color: var(--st-ink)`:

| Token | Use |
|---|---|
| `--st-page` | page background behind panels |
| `--st-panel`, `--st-panel-muted` | panel background, shaded panel |
| `--st-ink`, `--st-ink-muted` | main text, secondary text |
| `--st-primary`, `--st-on-primary` | primary color, text on it |
| `--st-accent` | accent color |
| `--st-border`, `--st-border-strong` | dividers, outlines that must stand out |
| `--st-radius` | corner radius of buttons and inputs |
| `--st-font-body`, `--st-font-display` | body font, display font |

Published sheets refer to these names, so **never rename or remove one**; when the theme changes, change what they point at. To add a token, define it in `main.css` and add it to `shared/sheet/theme-tokens.ts` (the test checks that every listed token is defined). Nuxt UI's `--ui-*` variables also work in Sheet CSS, but they aren't part of the contract and can change with Nuxt UI upgrades.

## Changing the theme

1. Adjust the palettes and semantic tokens in `app/assets/css/main.css`. Keep colors as `#rrggbb` hex values or `var()` aliases of them, since the test reads only those. To use another palette name, rename it in `app.config.ts` too.
2. Run `.claude/scripts/agent-run.sh pnpm vitest run shared/theme.test.ts`. Each failure names the pair and its ratio.
3. Check the app in a browser: a list page, a detail page, a form in a modal, the sheet editor (its colors come from `--ui-*` tokens, in `CodeEditor.client.vue`), and a rendered sheet that uses `--st-*` tokens.
4. If the direction itself changed, make a new mockup for it (see `.claude/ui-mockups.md`) rather than editing the frozen one, and point this file at it.
5. Fonts: change `--font-sans` / `--font-display` in `main.css` and the font list in `shared/fonts.ts` (with weights), plus its row in the font table above. Keep the old fonts in the list if published sheets may use them.
