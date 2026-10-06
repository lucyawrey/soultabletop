# UI redesign: frozen mockup spec

The approved site design from the 2026-10-02 planning session (plan: [ui-redesign.md](../../plans/ui-redesign.md), built in #60, #61, #64, #65). Frozen 2026-10-05.

- **[frozen.html](frozen.html)**: the reference. The mockup locked to the chosen options, with the Page and Dashboard user controls kept. It changes only to fix the page itself (its script, its own text); never to follow the site.
- **[mockup.html](mockup.html)**: the archived original with every direction and option, unchanged from the planning session (it was `.claude/plans/ui-directions.html`, also published as https://claude.ai/artifact/L13k29RioJAPhFtZZrRBX8 from another account).

Where the site differs from `frozen.html` and the difference isn't listed under "Decided after the mockup", it's drift: fix the site, or record the new decision here.

## Chosen options

| Control | Choice |
|---|---|
| Direction | D · Folio (`.app[data-dir="folio"]`) |
| Navigation | Sidebar, grouped Play and Build (signed out: one Browse group) |
| Current item | Solid: primary fill, on-primary text, bold |
| Landing | Option 1: heading and intro beside the sign-in / create-account card |
| Dashboard | Option 2: Continue card, then card rows for Campaigns, Characters, Content |

## Decided after the mockup (not shown in it)

- **Landing:** on large screens the hero and the card stay together as one block, centered horizontally and vertically (user, 2026-10-02).
- **Landing:** the signed-out sidebar shows on the landing page too, without a Sign in button there (as the mockup shows; confirmed in the #64 review).
- **New-user dashboard:** a first-visit heading from team copy (`dashboard.newHeading`) plus the welcome placeholder and start cards.
- **Lists:** default view per page: cards for Characters and Campaigns, a table for the rest.
- **Detail pages:** the resource's system under the heading, and the Source badge in the meta row (#88).

## Tokens (Folio)

The colors now live in `app/assets/css/main.css` (see `docs/theme.md`); the mockup's values are the source they were built from.

| Mockup token | Value | Role |
|---|---|---|
| `--bg` | `#f6f1e7` | page |
| `--surface` | `#fffdf8` | panels, cards, inputs |
| `--surface-2` | `#efe7d8` | table header, chips, segmented controls |
| `--line` | `#ddd2bf` | dividers only |
| `--line-strong` | `#8a7f72` | control outlines (3:1) |
| `--fg` | `#251f2a` | text |
| `--muted` | `#625869` | secondary text |
| `--primary` / `--primary-hover` | `#6b2d4e` / `#57233f` | plum |
| `--on-primary` | `#fdf6f9` | text on primary |
| `--primary-soft` | `#f1dfe7` | soft primary fill |
| `--accent` / `--accent-soft` | `#765a14` / `#f2e7c9` | gilt |
| `--danger` | `#a3271f` | delete, errors |
| `--radius` | 8px | controls and panels (dialogs, auth card, Continue card: 12px) |
| fonts | Cormorant Garamond 700 (display), Nunito Sans (body), JetBrains Mono (IDs) | |

## Measurements

From the mockup's CSS, desktop width (the frame is 1238×641). Phone (below 860px) changes are noted.

**Shell**
- Sidebar 232px wide, padding 18px 14px, gap 18px between blocks, a right border `--line`.
- Group label: 11px, uppercase, 0.1em tracking, bold, muted, padding 0 10px 4px.
- Nav item: padding 6px 10px, radius 8px, weight 500 (current: 700), 8px icon gap.
- System picker: `--line-strong` border, padding 6px 10px, 14px text.
- Footer: avatar 32px, name 14px, username 12px muted, a top border, padding 10px.
- Main area: padding 28px 28px 40px, gap 20px (phone: 20px 16px 32px).

**Page header and lists**
- Eyebrow 12px uppercase, 0.1em tracking, bold, muted, 4px above the title.
- List page title 34px (phone 28px), line height 1.05.
- Ornament rule: a 1px `--line` on each side of the gilt ornament.
- Buttons: 14px semibold, padding 9px 14px; primary has an inset bottom shadow; ghost icon buttons at least 32×32.
- Tabs: 6px 2px 9px padding, semibold, 2px primary underline when selected, 18px apart.
- Search: `--line-strong` border, padding 8px 10px, 14px, up to 320px; on the same line as the view toggle (34px buttons in a 2px-padded group).
- Badges: 12px bold, padding 3px 8px, pill. Official solid primary, Community `--surface-2`, Public gilt soft, Limited dashed outline.
- Readable ID: 12px mono, `--surface-2`, padding 3px 7px, radius 4px.
- Table: header 12px uppercase 0.08em bold muted on `--surface-2`, padding 10px 16px; cells 12px 16px; row hover a 40% primary-soft tint; name bold with the `owner/id` under it in 12px mono.
- Cards: min 250px columns, gap 14px, padding 16px, gap 10px; title 22px display; footer 13px muted with a top border.

**Detail pages**
- Title 40px (phone 32px); meta row 14px with 8px gaps.
- Main column plus a 280px About panel, gap 20px; stacked on phones.
- Panel header padding 14px 18px, title 22px display; list rows 12px 18px.
- About facts: 14px, 9px rows with dashed dividers, label muted, value semibold right-aligned.

**Dialogs and forms**
- Dialog up to 460px, radius 12px; header 16px 20px with a 24px display title; body 18px 20px with 14px gaps; footer on the page color.
- Field label 14px semibold, required mark in danger color; hint 13px muted; input 15px, padding 9px 11px, `--line-strong` border.
- Visibility as two radio cards (min 150px), the chosen one with a primary border and ring.

**Landing and dashboard**
- Landing: hero and card in a 1.15fr / 400px grid, gap 48px, max 1020px; title clamp(36px, 5vw, 54px); intro 18px muted; auth card padding 24px, title 30px.
- Dashboard: title 38px; Continue card padding 20px 22px with a 32px title; section titles 24px display; item cards min 200px with a 42px initial circle.

## Comparing the site with it

Screenshot `frozen.html` with Playwright (`file://` URL) at 1238×641, clicking `[data-ctl="page"] [data-v="list"|"detail"|"form"|"landing"|"dashboard"]` and `[data-ctl="dash"] [data-v="new"]`, and the matching site pages at the same size. Look at the pairs side by side.
