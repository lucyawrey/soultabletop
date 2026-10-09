# Dice rolls: frozen mockup spec

How a sheet roll looks: the result toast, the Recent rolls drawer, the dice, and rollable values. Frozen 2026-10-06 from [mockup.html](mockup.html) v1.15 (archived unchanged) as [frozen.html](frozen.html). Requirements and every review decision with its reason: [brief.md](brief.md), "Decided during review". Behavior (actions, steps, entries, follow-ups): [plan](../../plans/sheet-actions.md).

The frozen page keeps two view controls: **Roll target** (Die icon or Underline, which a sheet chooses) and **Viewer** (Owner or Read-only), plus the Contrast table. The **Test rolls** section (multi-die rolls and the die shapes strip) is mockup-only, a reference for the dice, not part of any sheet.

## Chosen options

- **Result look: Dice card.** A card with a header band (action, roll label, time, close button), the dice and the total on one row ("[15] + 7 = 22"), the expression as written below it ("d20 + 7"), and a footer with the follow-up buttons. The dice tumble in and the total settles after them.
- **Die shapes: simple outlined shapes**, drawn as inline SVG (not game-icons).
- **Recent rolls: a slide-over drawer** from a Rolls button in the content page's header.
- **Toasts: bottom right** (the app toaster's position; not a roll-only setting).
- **Entries: compact, with Details.** The toast is always compact. Drawer entries show the total, the expression, the dice, and the follow-ups; a Details button expands one entry in place.
- **Roll target: the sheet's choice** between a die button beside the value and the value itself as the button. Hover was dropped.

## Decided after the mockup (not shown in it)

- **Rolls use Nuxt UI's toaster** (`useToast`), not the mockup's own toast element: one toast with the fixed id `"roll"` and `duration: Infinity`, so it stays until the next roll replaces it (`toast.add` with the same id merges) or the user closes it. Other toasts keep the default 5 s. The Dice card goes in as the toast's content (`title`/`description` accept a VNode). Watch for: the toaster's max of 5 drops the oldest toast, which could be the roll toast; Nuxt UI may pulse a replaced toast on top of the roll's animation.
- **The toast close button is more prominent, site-wide**: outlined (`color="neutral" variant="outline"`), 28px, ink-colored ×. Set through the toast theme in `app.config.ts` if it allows button props there; otherwise through a shared wrapper. Check while building.
- **A follow-up with only `Set` steps** gives a toast with Undo, the same as a Button with Sets; the follow-up is marked used.

## Known issues in the frozen page

- The toast is a hand-built element (`#toasts`), not Nuxt UI's toaster, so stacking with other toasts isn't shown.
- Old code for the looks and options that weren't chosen (Number, Dice, Card; game-icons; panel and stack; top center) is still in the script, unreachable. The archived `mockup.html` shows them.

## Tokens

Sheet tokens as in the [PF2e frozen sheet](../pf2e-sheet/spec.md) (`--st-*`, mapped from `app/assets/css/main.css`); site pieces use Nuxt UI classes (`bg-default`, `ring-accented`, `text-muted`, `bg-elevated`).

| Use | Token |
| --- | --- |
| Die outline, follow-up buttons, roll-target underline and die button | `--st-primary` (9.79:1 on panel) |
| Die face number | `--st-ink` |
| Critical face: fill, number | `--st-primary`, `--st-on-primary` (9.79:1) |
| Fumble face: dashed outline, number, tint | `--ui-error` (6.36:1), fill `color-mix(--ui-error 8%, --st-panel)` |
| Dropped die: outline, fill, number | `--st-border-strong` (3.85:1), `--st-panel-muted`, `--st-ink-muted` (5.48:1), struck through |
| Card header band, borders | `--st-panel-muted`, `--st-border` |
| Totals | `--st-font-display`, `lining-nums tabular-nums` (Cormorant's default old-style digits read "16" as "I 6") |

## Measurements

From the frozen page's CSS.

- **Toast:** 380px wide (`min(380px, 100vw − 16px)`), 16px from the bottom and right (8px on phones, full width less 16px); a 176px-tall attack card. Rounded like other toasts; the header band follows the corners.
- **Card:** header band 8px 40px 8px 12px padding (room for the close button), 13px text, action bold, roll label muted, time 11.5px muted. Body 10px 12px 8px; dice row gap 8px. Expression line 0 12px 8px. Footer 8px 12px 10px with a top border.
- **Total:** 44px display font, preceded by a muted "=" at 20px, right after the last die.
- **Close button:** 28×28px, 6px from the top and right, 1px `--st-border-strong` border, 6px radius, 20px ×.
- **Dice:** 40px in the toast (30px when a roll has more than six dice), 24px in drawer entries. Face number 0.36 × size, weight 800; faces of 10 or more at 0.86 of that. Outline stroke 2px, rounded joins, non-scaling.
- **Shapes** (100×100 box): d2 circle r 44; d4 triangle 50,5 96,88 4,88; d6 square 9,9 82×82; d8 diamond 50,2 98,50 50,98 2,50; d10 kite 50,1 99,38 50,99 1,38; d12 pentagon 50,1 99,36 81,97 19,97 1,36; d20 hexagon 50,2 94,26 94,74 50,98 6,74 6,26. Number nudges: d4 down 20%, d10 up 10%, d12 down 8%.
- **Groups:** one term's dice 3px apart; when the roll has more than one die, a 10.5px bold muted caption below ("2d6", "4d6 · keep highest 3", "2d20 · keep higher"). Kept dice first, dropped last.
- **Follow-up buttons:** pills, 12px bold, 2px 9px padding, 1px `--st-primary` border; used: dashed border and a ✓ before the label.
- **"Natural 20" / "Natural 1" badge:** 10.5px bold uppercase, 1px 6px; natural 20 filled primary, natural 1 outlined. Only when exactly one d20 is kept.
- **Drawer:** 400px wide (full width on phones), over a 35% backdrop. Header 10px 12px: "Recent rolls" in the display font at 20px, Clear (text link), close ×. Entries 8px 10px padding, 1px dividers; a follow-up's entry has a 3px left rule and a "↳ from …" line. Entry total 26px display font, expression beside it, dice row below, then the follow-ups and Details (12px muted, › rotating when open).
- **Roll targets:** die button 22×22px, 5px radius, 17px icon (`i-game-icons-rolling-dices`), 4px after the value; on hover it fills with primary. Underline: the value in primary with a 2px primary underline (MAP steps: 1px dashed).

## States

- **Animation:** dice tumble in for 0.85s, 60ms apart; the total is hidden until they land (0.75s) and then scales in (0.35s). Skipped under `prefers-reduced-motion`.
- **Replaced:** a new roll replaces the toast's content and plays again.
- **Read-only viewer:** rolls work; follow-ups with a `Set` (Reroll) aren't shown; live sheet fields are disabled.
- **`show` and label formulas are live:** "Reroll (2 left)" counts down, and Reroll disappears at 0 hero points, on every entry.
- **Empty drawer:** "No rolls yet." Clear empties it and closes the toast.
- **Phone (390px):** no sideways scroll; the toast spans the width at the bottom; the drawer is full width.
- **Announced:** each roll goes to an `aria-live` region: "Rapier, Attack: 22 (d20 + 7, rolled 15 + 7, natural 15)." Dice are `role="img"` with labels ("d20: 20, critical", "d6: 2, dropped"); a used follow-up says "(used)".

## Implementation map

| Mockup element (`data-impl`) | Build |
| --- | --- |
| `RollToast` | `useToast().add({ id: "roll", duration: Infinity, … })` with the card as its content |
| `RollCard (compact)` | new `RollCard.vue`: header band, dice row with total, expression, follow-ups |
| `RollEntry` | new `RollEntry.vue`: one drawer entry, with Details |
| die (`.die`) | new `RollDie.vue`: the outlines above as data, inline SVG, face number on top; props for sides, face, kept, and critical/fumble |
| Recent rolls drawer | `USlideover side="right"` + new `RecentRolls.vue` |
| Rolls button | `UButton color="neutral" variant="outline" icon="i-game-icons-rolling-dices"` in `ContentDetail`'s header |
| Toast close button | the toast theme in `app.config.ts` (site-wide) |
| Roll target: die button / underline | the Sheet renderer, on a value tag with steps (see the plan's open markup details for how a sheet picks) |

## Gaps

What the Sheet system can't do yet (`data-gap` marks): the `Roll` and `FollowUp` tags; roll steps on value tags; `crit`/`fumble` on `Roll`; `{…}` formulas in a follow-up's label. All are part of the "Sheet dice buttons" item in `TODO.md`.

## How to compare

Screenshot `frozen.html` and the built page at 1400×1000 and 390×844 with `.claude/scripts/compare-mockup.mjs`, after the same clicks: a Rapier attack, then Critical from the toast, then the drawer open with one entry's Details expanded. Compare the toast and the drawer, not the sheet slice around them.
