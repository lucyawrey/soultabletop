# UI redesign plan

Planned with the user on 2026-10-02. Built by the main agent, one PR at a time, with no parallel subagents on UI work. Each PR goes on its own branch off an up-to-date `main` and merges through a PR the user reviews.

Visual reference: `.claude/plans/ui-directions.html` (also the artifact https://claude.ai/artifact/L13k29RioJAPhFtZZrRBX8). The chosen direction is **D · Folio**, the `.app[data-dir="folio"]` token block. Keep the page and all four directions; it is the reference when the theme changes later.

## Decisions (settled with the user)

- **Look:** tabletop-flavored, direction D Folio: a lightly warm page with white panels, plum primary, gilt accent, Cormorant Garamond for display, Nunito Sans for body text, medium corners (8px).
- **One light theme.** Remove light/dark mode everywhere.
- **Solid variants:** solid buttons and outline inputs (Nuxt UI's defaults), not the soft variants from the first attempt.
- **Accessibility:** every text pair is at least 4.5:1. Control outlines (inputs, search, radios, toggles, outline buttons) are at least 3:1 against what's behind them (WCAG 1.4.11), so they use a separate strong border token, and the faint border token is for dividers only. State never depends on color alone. Every interactive element has a visible focus ring. Icon buttons are at least 32px. The display face is used only at 22px and up.
- **Shell:** left sidebar, grouped **Play** (Campaigns, Characters, Content) and **Build** (Sheets, Types, Systems, Groups), with the system picker at the top and the user at the bottom. On phones it becomes a drawer.
- **Current nav item:** **Solid**: a primary-filled pill with on-primary text and bold weight. The user rejected a left-edge bar; Outlined and Dot were the other options. Pressed toggles use the same solid fill.
- **Lists:** each list page has a default view, and a table/cards toggle in its toolbar switches it. The defaults: cards for Characters and Campaigns; a table for Sheets, Types, Systems, Content, and Groups.
- **Full pass:** theme, shell, list pattern, detail pattern.
- **Bundled from `TODO.md`:** empty-state next steps (the structural part of "Onboarding for new users") and "Print content". The category filter pattern stays separate (it depends on server-side list filters).
- **Sheet CSS gets a small, documented, stable set of theme tokens** whose names don't change when the theme does. `var(--ui-*)` keeps working but is no longer the documented way.
- **Sheet CSS's `.dark` scoping exception is removed:** `.dark` becomes an ordinary class inside the sheet.
- **Sheet CSS may use `@media print`**, scoped like the rest. `@media` is already allowed (`shared/sheet/css.ts`), so this is documentation plus a test.

## Token design

Three layers, each defined once:

1. **Palette** (`app/assets/css/main.css`, `@theme static`): two Tailwind color scales, `--color-plum-50…950` (primary) and `--color-folio-50…950` (warm neutral), plus `--color-gilt-*` for the accent. Nuxt UI needs full 50–950 scales for `primary` and `neutral`. Build them around D's hexes (`#6b2d4e` primary, `#765a14` accent, `#f6f1e7` page, `#251f2a` ink) so the semantic tokens below land on exact D values.
2. **Semantic tokens** (`:root` in `main.css`): Nuxt UI's own variables, set to D's roles. `app/app.config.ts` sets `colors.primary: "plum"`, `colors.neutral: "folio"`, and `secondary`/`warning`/`error` as needed. Mapping, with names from Nuxt UI 4.11:

   | D token | Nuxt UI variable | Value |
   |---|---|---|
   | page (`--bg`) | `--ui-bg` | `#f6f1e7` |
   | panel (`--surface`) | `--ui-bg-elevated`, or a card override (decide in PR 1; cards and tables currently use `bg-default`) | `#fffdf8` |
   | `--surface-2` | `--ui-bg-muted` / `--ui-bg-accented` | `#efe7d8` |
   | `--line` (dividers) | `--ui-border`, `--ui-border-muted` | `#ddd2bf` |
   | `--line-strong` (controls) | `--ui-border-accented` (outline inputs use `ring-accented`, confirmed in Nuxt UI 4.11) | `#8a7f72` |
   | `--fg` | `--ui-text-highlighted`, `--ui-text` | `#251f2a` |
   | `--muted` | `--ui-text-muted`, `--ui-text-toned` | `#625869` |
   | (none) | `--ui-text-dimmed` | must still pass 4.5:1 where used for text; check |
   | `--primary` | `--ui-primary` | `#6b2d4e` |
   | `--on-primary` | `--ui-text-inverted` / solid button text | `#fdf6f9` |
   | `--radius` | `--ui-radius` | 8px |

   Nuxt UI's per-color variables (`--ui-primary` etc.) are normally picked from the scale by shade. Set them explicitly in `:root` so they're exact.
3. **Sheet tokens** (the stable contract for Sheet CSS), defined in `main.css` as aliases of layer 2, e.g. `--st-page`, `--st-panel`, `--st-panel-muted`, `--st-ink`, `--st-ink-muted`, `--st-primary`, `--st-on-primary`, `--st-accent`, `--st-border`, `--st-border-strong`, `--st-radius`, `--st-font-body`, `--st-font-display`. Final names are settled in PR 1 and documented in `docs/theme.md` and `docs/sheet-system.md`. Renaming one later breaks user sheets, so the set stays small, and new tokens are added rather than old ones renamed.

Fonts: load Cormorant Garamond (600, 700) and Nunito Sans (400, 600, 700) through `@nuxt/fonts` (`nuxt.config.ts` already loads the Sheet fonts there; check whether `shared/sheet/fonts.ts` already lists either). Set `--font-sans` to Nunito Sans and add `--font-display` with a Tailwind utility (`font-display`) for headings.

## Docs for changing the theme later (part of PR 1)

- **`docs/theme.md`** (new, technical docs): the three layers above and where each lives; the token table with each token's role; the Sheet token contract and its no-rename rule; how Nuxt UI picks up the colors (`app.config.ts`, scales, explicit `--ui-*` overrides); the accessibility rules; the contrast test and how to run it; and a step-by-step "changing the palette" checklist (edit the scales and semantic values, run the test, check the pages listed in the QA section, update the directions page if the reference changes).
- **Contrast test** `shared/theme.test.ts` (vitest, runs in `pnpm check`): it reads `app/assets/css/main.css`, extracts the semantic token values, resolves `var()` aliases, and checks the same pairs as the directions page (text 4.5:1, control outlines and focus 3:1). A theme change that breaks contrast then fails CI, and the colors stay defined only in `main.css`.
- **`CLAUDE.md`:** a short "Theme" bullet under Conventions: one light theme, tokens and rules in `docs/theme.md`, use semantic Nuxt UI classes (`text-muted`, `bg-elevated`, `border-accented`) rather than raw palette colors, display font only for headings at 22px and up, and the contrast test.
- **`docs/sheet-system.md`:** replace "Authors can use Nuxt UI tokens" with the Sheet token list; remove the `.dark` rules (CSS scoping section and phase list); add `@media print` to what's allowed, with an example.
- **Sheets skill** (`.claude/skills/soul-tabletop-sheets/`: `SKILL.md`, `references/css.md`, `references/examples.md`): same changes, since they mention `--ui-*` and `.dark`.

## PRs

**Split changed (user, 2026-10-02):** PR 3 and PR 4 below ship as one PR (`ui-lists-and-details`), built in that order as separate commits (list pattern, then detail pattern) so review can go commit by commit. PR 5 stays separate. Three PRs in total: shell (#61), lists and details, polish.

### PR 1 · Theme foundation (`ui-theme-foundation`)

- The palette, semantic, and Sheet tokens; fonts; `app.config.ts` colors and any component defaults (focus ring, `--line-strong` on outline buttons, solid primary fill for the active state of `UNavigationMenu` and `UTabs`).
- Remove dark mode: `ui: { colorMode: false }` in `nuxt.config.ts` (supported by Nuxt UI 4.11); `UColorModeButton` in `app/app.vue`; the theme items in `app/components/UserMenu.vue`; the `.dark` autofill rule in `main.css` (replace it with a light autofill fix if browsers tint autofilled inputs); Scalar's `darkMode: true`.
- Remove Sheet CSS's `.dark` exception: `shared/sheet/css.ts` (lines around 111, 150–161, 178, 355), `shared/sheet/css.test.ts` (the `.dark` cases become ordinary-class cases), and the hint in `app/pages/sheets/[id]/edit.vue` (around line 768).
- Check `CodeEditor.client.vue` (its colors come from Nuxt UI tokens): syntax colors must pass 4.5:1 on the new editor background.
- Add a test that `@media print` in Sheet CSS stays allowed and scoped.
- The docs listed above, plus the contrast test.
- Verification: `pnpm check`, `pnpm check:templates`, and a browser pass (screenshots of `/`, a list page, a detail page, the sheet editor, and a rendered sheet, before and after).

PR 1 is #60 (opened 2026-10-02).

### Before PR 2 · Landing and dashboard design (mockups, no code)

The user asked for these to be designed before the shell is built (2026-10-02). The directions page now has **Landing** and **Dashboard** views in Folio, each with two options:

- **Landing (signed-out `/`)**, built from the team's copy in `content/copy.yml`. Option 1: the current split, heading and intro beside the sign-in / create-account card, restyled. Option 2: heading and intro with Create account / Sign in buttons beside an example character sheet; the buttons swap the example for the same form. Both have a "Browse public systems and sheets" link. Signed-out navigation: a **top bar** (logo, public sections, system picker, Sign in) or the sidebar without Campaigns and Groups and with Sign in at the bottom.
- **Dashboard (signed-in `/`).** Option 1: three panels (Campaigns, Characters, Content) of recent items, like today. Option 2: a "Continue" card for the most recently edited item, character cards, then Campaigns (with the user's GM/Player role) and Content (with type and system). Option 2 needs more from `GET /api/dashboard` (system and content type names, campaign role). Both have New Character / New Campaign buttons in the header. **New user** state: a team copy placeholder plus start cards (Make a character, Start a campaign, Find a system, Build your own). That's the bundled empty-state item; the explanations are team copy.

**Decided with the user (2026-10-02):**

- **Landing: option 1** (the split: heading and intro beside the sign-in / create-account card), using the team copy.
  - **Changed from the mockup (user, 2026-10-02):** on large screens the hero and the card stay together as one block, centered horizontally and vertically, instead of sitting at the top and spreading to the page's edges.
- **Signed-out navigation: the sidebar**, with one **Browse** group (Content, Characters, Sheets, Types, Systems) instead of Play and Build, which appear only when signed in. Sign in sits at the bottom of the sidebar, except on the landing page, which already has the form. List page eyebrows name the sidebar group, so they read Browse when signed out.
- **Dashboard: option 2, refined.** The Continue card for the most recently edited item, then **Campaigns, Characters, and Content as matching card rows** (one shared card design: initial or image, name, a detail line; GM/Player and system for campaigns, content type and system for characters and content), each with View all. Needs `GET /api/dashboard` to return the system and content type names and the campaign role.
- **New users get a first-visit heading:** a new copy key (e.g. `dashboard.newHeading`, in `content/copy.yml`, `shared/yaml.d.ts`, and `shared/copy.test.ts`) with a team placeholder, shown while the user has nothing yet, plus the welcome text placeholder and the start cards.

These go into PR 2 (signed-out sidebar, landing page) and PR 4 (dashboard and its API fields).

### PR 2 · Sidebar shell (`ui-sidebar-shell`)

- `app/app.vue`: Nuxt UI's `UDashboardGroup` + `UDashboardSidebar` (collapsible, a drawer on mobile) with a vertical `UNavigationMenu` in two groups, Play and Build, with icons; `SystemSelector` at the top; `UserMenu` (or "Sign in" when logged out) in the footer. Logged-out visitors see only the public items, as today. Remove `UHeader`/`UFooter`; move the copyright line into the sidebar footer or drop it (ask).
- The signed-out `/` (the sign-in form) may skip the sidebar; decide while building and show the user.
- The sheet editor (`/sheets/[id]/edit`) needs the width: start with the sidebar collapsed there.
- Each page sets its own content width (today every page repeats `mx-auto w-full max-w-(--ui-container) p-4 py-8`); add a `PageContainer` component, or a layout, and use it.
- Print: `@media print` in `main.css` hides the sidebar, drawer, and page actions.
- Verification: desktop and phone widths, keyboard navigation through the sidebar, logged in and logged out, no hydration warnings in the console.

### PR 3 · List pattern (`ui-list-pattern`)

- Shared components: `PageHeader` (eyebrow, title, actions), a list toolbar inside `ResourceList` (My/Find tabs, search, and the table/cards toggle; leave room for the future filter row from the "List filters" TODO item). The toggle is a compact icon group at the end of the search box's line, never on a line of its own: the search box shrinks to make room, and at narrow widths the tabs wrap above the search line rather than the toggle wrapping below it (user's note, 2026-10-02). `ResourceCards` (a card grid whose card shows name, readable ID, Source and Visibility badges, kind-specific details, and an actions menu).
- View choice: `useListView(pageKey, defaultView)` stored in a **cookie** (`useCookie`), not `localStorage`, so server rendering uses the right view and there's no hydration mismatch; one cookie per list page.
- Restyle `UTable` through `app.config.ts` (header row on `--surface-2`, uppercase small labels, row hover) rather than per page.
- Convert all seven list pages (`campaigns`, `characters`, `content`, `groups`, `sheets`, `systems`, `types`). While there, consider moving each page's create, edit, and delete modals into shared components; today every list page repeats about 150 lines of them. Do that only if it keeps the PR reviewable; otherwise it becomes its own chore.
- Empty states (bundled): `ResourceListEmpty` gets a next-step action (e.g. "New System", or for Find "Clear search"). The text stays functional; any explanatory copy gets team placeholders (`// Copy: written by the team`).

### PR 4 · Detail pattern (`ui-detail-pattern`)

- `DetailHeader`: back link, eyebrow with the kind, display-font title, a meta row (`ReadableIdBadge`, `VisibilityBadge`, `SourceBadge`), and actions (Edit as outline, Delete as an outline danger button). Main panels in a column, and an "About" facts panel on the side (owner, ID, visibility, updated), stacking on phones.
- Convert the detail pages: `systems`, `types`, `sheets/[id]` (index), `campaigns`, `groups`, `ContentDetail.vue` (content and characters), plus `profile.vue` and the logged-in dashboard on `/`.
- Next steps on fresh resources (bundled): e.g. a system with no content types shows "Add a Content Type"; a content type with no sheet offers "New Sheet". Team copy placeholders where explanation is needed.
- Print (bundled): a Print button on `ContentDetail.vue` calling `window.print()`; print styles show just the rendered sheet. Delete the "Print content" TODO item when this merges.

### PR 5 · Polish and QA (`ui-polish`)

- An automated accessibility pass: run axe-core through Playwright on the main pages, logged in and out, and fix what it finds.
- Skeletons and loading states in the new layouts; modal and dropdown styling; toasts.
- Screenshots of every page at desktop and phone widths for the user's review.
- To compare with the mockup, screenshot `.claude/plans/ui-directions.html` with Playwright (`file://` URL; click `[data-v="list"|"detail"|"form"|"landing"|"dashboard"]`, `button[data-v="2"]` for option 2, `[data-v="new"]` for the new-user dashboard) at 1238×641.

## TODO.md changes as PRs land

- PR 1: in "Sheet system follow-ups", drop "editor dark mode" / "dark-mode syntax colors"; in Before launch's manual QA item, drop "light and dark mode".
- PR 4: delete "Print content". In "Onboarding for new users", note that the empty-state and next-step structure is done and the explanations and welcome text are still waiting on the team.
- Last PR: delete "Redesign the UI to be warmer and more inviting".

## Risks and checks

- **Existing sheets** use `--ui-*` variables and Nuxt UI utility classes in `app/components/sheet/` (`text-muted`, `text-dimmed`, `text-primary`, `border-default`, …). They change color with the theme; check rendered sheets (including the user's local D&D 2024 test sheet, if they share it) in PR 1. `text-dimmed` appears 11 times there: make sure it passes 4.5:1 or replace it.
- **Cormorant Garamond** has a small x-height and thin strokes: headings only, at 22px and up, and never for labels or table text.
- **Plum vs. red:** some colorblind viewers see the primary and error colors as close. Delete always keeps its label and icon.
- **The old attempt** in `../soultabletop-worktrees/ui-theme` belongs to the user to keep or delete. Don't reuse the `ui-theme` name for these branches.
