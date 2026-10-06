# Dice rolls: brief

For sheet actions with `Roll` steps ([plan](../../plans/sheet-actions.md)). It decides how a roll looks: the result, the toast, the Recent rolls list, and how a rollable value looks on the sheet.

## Requirements

- Shown on a slice of the frozen PF2e sheet ([frozen.html](../pf2e-sheet/frozen.html)), Rogue only (Tessaly Quill): a short header (name, hero points), the Saves box, Strikes, and Skills with Perception and Initiative. Same tokens, density (compact), and section look as the frozen sheet.
- What rolls:
  - **Strikes:** the hit modifier and each MAP step (`d20 + 7`, `d20 + 2`, `d20 − 3`; agile `−4`/`−8`). Each attack entry offers the follow-ups **Damage**, **Damage + sneak**, and **Critical**. PF2e crits also happen when the attack beats AC by 10, so Critical is always offered; a natural 20 is marked on the entry instead of `show` hiding it.
  - **Skills, Perception, Initiative, saves:** `d20 + mod`. Each check entry offers **Reroll (hero point)**, a follow-up with a `Set` (hero points − 1) and then a `Roll`, so it shows a follow-up that writes. It needs edit rights and a hero point.
  - **Fortune:** a live toggle on the sheet; while it's on, checks roll `2d20kh1`, so the entry shows a kept and a dropped die.
  - Damage follows the Thief racket (Dex to finesse melee damage): Rapier `1d6 + 4`, sneak attack `+ 1d6`, critical doubles the damage and adds the deadly die (`2 × (1d6 + 4) + 1d8`).
- Each entry holds what the plan lists: action and roll labels, the expression with values filled in, each die (sides, face, kept or dropped), total, natural, source (character, sheet, action), who rolled, when, and its follow-ups. A follow-up's entry says which entry it came from.
- Every rollable block is tagged with its tag and attributes (`data-tag`, `data-attrs`) and a sketch of its steps (`data-steps`); `Roll` and `FollowUp` don't exist yet, so they're marked `data-gap`.
- Accessibility: results are announced (an `aria-live` region), state isn't shown by color alone (dropped dice are struck through and labeled), visible focus, a Contrast button with the live table. The animations are skipped under `prefers-reduced-motion`.
- Desktop and phone widths both work.

## Toggles

- **Result look:** rolling number (the total counts through random values and settles), tumbling dice (die shapes tumble and land on their faces, then the total), or result card (a card with the dice and the sum laid out).
- **Recent rolls:** a slide-over drawer opened from a Rolls button, a side panel beside the sheet (a drawer on phones), or a stack that grows under the toast.
- **Toast position:** bottom right or top center.
- **Roll target:** how a rollable value looks. *Die icon:* the value opens its breakdown as today and a small die beside it rolls (the plan's leaning for a value with `preview`). *Underline:* the value itself rolls, and the breakdown is shown in the entry. *Hover:* the value looks plain until hovered or focused, then shows the die and rolls on click.
- **Entry detail:** compact (total and expression) or expanded (each die, kept or dropped, natural, source).
- **Viewer (view control, kept after freezing):** Owner or Read-only. Read-only can still roll (roll-only actions are open to any viewer) but gets no Reroll (hero point), since it writes.

## Content

Tessaly Quill, level-1 Elf Rogue (Thief), from the frozen sheet: Dex +4, trained strikes (+7), Fortitude +4, Reflex +9, Will +6, Perception +6 (expert), Initiative with Stealth (+6, with the leather armor's −1). Rapier, Shortbow, Dagger (agile). The roller is shown as "you".

## Decided during review (user, 2026-10-06)

- **Rolls use Nuxt UI's toaster**, not a toast of their own, so they stack with the app's other toasts (sheet Button undo and errors, load and save errors) instead of overlapping them. One roll toast at a time: added with a fixed id (`"roll"`) and `duration: Infinity`, so it stays until the next roll replaces it or the user closes it; other toasts keep the default 5 s. The Toast position option becomes the app toaster's position. Watch for: the toaster's max of 5 drops the oldest toast, which could be the roll toast; and Nuxt UI may pulse a replaced toast on top of the roll's own animation.
- **A more prominent toast close button, site-wide** (Nuxt UI's toast `close` slot in `app.config.ts`): an outlined button (`color="neutral" variant="outline"`, 28px, ink-colored ×) instead of the faint link-style ×. Shown in the mockup since v1.1.
- **Picked:** CSS shapes (not game-icons), Recent rolls in a slide-over drawer, toasts at the bottom right.
- **Result look:** a middle ground between Dice and Card (user). Mockup v1.2 adds it as **Dice card**: the card's header band and footer, with the dice tumbling in on one row and the total beside them, and the expression below. It's the default; Number, Dice, and Card stay for comparison until it's approved.
- **Roll target is up to the sheet** (user): Die icon and Underline both stay; a sheet chooses (how is settled with the markup details). The rule for the default: a value that also opens a breakdown or preview gets a die button beside it, and otherwise the value itself rolls (as the MAP steps do). Hover is dropped.
- **Entry detail: compact, expand on click** (user). The toast is always compact. Drawer entries show the total, expression, dice, and follow-ups, plus a Details button that expands one entry in place (modifier breakdown, natural, damage type, earlier rolls, source, who and when). Mockup v1.3 replaces the Entry detail toggle with it.
- **Expression as written only** (user: "d20 + 6 = 1 + 6" didn't read naturally): entries show the expression as written ("d20 + 6"); the dice row shows the faces and the sum, so the filled-in sum isn't repeated as text. Screen readers still hear it ("7 (d20 + 6, rolled 1 + 6)"). Mockup v1.4.
- **Dice card approved** (user: "dice card is good"), with two fixes in v1.5: the header band follows the toast's rounded corners, and the total follows the dice directly ("[1] + 6 = 7") instead of sitting at the far right, which was hard to read.
- **Rolls with several dice** (user asked to test them; v1.6 to v1.8 add a mockup-only Test rolls section: striking rapier 2d6 + 4 and its crit, 6d6, 10d6, 3d8 + 2d6 + 5, 4d6 keep highest 3, one of every die). Found and fixed: each term's dice sit together on a soft band, captioned in words when the roll has more than one die ("2d6", "4d6 · keep highest 3", "2d20 · keep higher"), which also tells a d8 from a d10; dropped dice go last in their group, struck through with a muted outline, with no separate "Dropped" label; the total follows the last die in the same row; and dice shrink from 40px to 30px when a roll has more than six.
- **Matching dice, no group bands** (user, v1.9: the CSS shapes didn't match each other, the d6 looked soft and heavy, and the bands around grouped dice were busy). Dice are now small inline-SVG outlines (a triangle, a square, a diamond, a kite, a pentagon, and a hexagon) with one 2px stroke and rounded joins for every shape; clip-path insets made diagonal edges thinner than straight ones. Grouped dice sit 3px apart with their caption and no band.
- **Die shapes strip** (user asked to see them side by side; v1.10): the Test rolls section ends with every die, a natural 20, a natural 1, and a dropped die. Only a natural 20 fills its die (v1.11); a natural 1 keeps the normal outline and is marked by its badge on the entry.
- **Critical and fumble faces on any die, opt-in per roll** (user: "all dice should support the natural 20/1 look (optionally) for systems that crit on different values"; v1.12). A roll lists the faces to mark, e.g. `crit="20" fumble="1"` on PF2e's d20 rolls or `crit="6"` on a d6 pool (`max` for each die's highest face); unmarked rolls (damage) show plain dice. A critical face fills its die; a fumble face gets a dashed outline in the error color over a faint tint, with its number in the error color (dashes, so not color alone). The "Natural 20"/"Natural 1" badge stays for a single kept d20. The strip shows every shape plain, critical, fumble, and dropped; the test rolls add a 5d6 pool. Also v1.12: the d10 and d12 are drawn as large as the others, and two-digit faces are slightly smaller so they fit.
- **d6 corners** (v1.13): the square had its own corner radius, so it looked rounder than the other shapes; now it has only the round joins every die shares.
- **Die art exception and inline SVG** (user, 2026-10-06): agents don't make art, but the user allowed these simple die outlines. They're built as inline SVG in one Vue component holding the outlines as data (not `.svg` files): the states restyle fill, stroke, and dashes with the theme's tokens, the face number sits on top in the app's font, and the even stroke needs `vector-effect: non-scaling-stroke`, none of which work through `<img>` or icon masks. The component is the one place to swap in team art later.
- **A coin** (user, v1.14): `d2` is a circle, in the strip and as a Coin test roll. Its faces show 1 and 2 like any die.
