# Sheet actions and dice rolls

Decided with the user on 2026-10-06. The "Sheet dice buttons" item in `TODO.md` (Next up); the PF2e mockup marks a Strike's attack modifier as a roll button ([spec](../mockups/pf2e-sheet/spec.md), "Gaps", 10).

## Decisions

- **A roll is a click action with a formula expression**, not a formula: formulas stay pure (computed at render, never stored), and dice are allowed only in roll steps. The expression is the formula language plus dice, so paths, `<Define>`s, and functions work.
- **No reactive event system** ("when X changes, do Y"): hidden writes, loops, and ordering problems. Actions run only on a click. Revisit only if a real sheet needs triggers.
- **Actions are generalized** (user): a click runs an ordered list of step tags. Steps in v1: `Set` (exists) and `Roll` (new). Later steps (posting to the campaign log, messages, applying to a target) are new tags in the same slot.
- **Child tags only**, like `Set` (#93 decided against a `set="…"` attribute): `<Roll formula="…" />`, no `roll` attribute.
- **Where steps go:** a `<Button>`, and directly in a value tag (`Value`, `Number`, `Column`, ...), which makes the shown value the click target (user: "values generally have child ordered events like buttons").
- **Mix and match, in order** (user): `Roll` and `Set` in any order and number; steps run top to bottom, and each sees the rolls and writes before it. This changes today's Buttons, where every `Set` reads the data from before the click: a Button whose `Set` reads a field an earlier `Set` wrote behaves differently. The documented Damage button (`hp.temp` then `hp.value` reading `hp.temp`) must swap its two `Set`s; check `docs/sheet-system.md`, the sheets skill, `buttons.test.ts`, and saved sheets.
- **`preview` and steps on one value** (user leaning, agent recommended): clicking the value opens the preview; a small icon beside it runs the steps.
- **Dice syntax v1** (user): `NdM` (`2d6 + str`, `d20`), dice held in a text field (`damage` = "2d8"), and keep highest/lowest (`2d20kh1`, `2d20kl1`).
- **Roll-only actions are open to any viewer** (user): a roll writes nothing, so anyone who can see the sheet can roll from it. Actions with a `Set` keep today's rule (only viewers who can edit; `live` with Edit off).
- **Mockup** (user): show all three looks for the result, a rolling number, tumbling die glyphs, and a result card, for the user to pick.

- **A named `Roll` gives later steps a record** (user): `hit.total` (the result), `hit.dice` (the kept dice's faces, a list), `hit.natural` (the face when exactly one die is kept, as in `d20 + x` or `2d20kh1`; otherwise empty). `hit` alone where a number is needed is a checker error suggesting `hit.total`.
- **Every roll produces one self-contained entry** (user), what a campaign log or chat stores later: the action's and roll's labels, the expression with values filled in (`d20 + 7`), each die (sides, face, kept or dropped), total and natural, the source (content, sheet, which action), who rolled, when, the named rolls so far, and its follow-ups. v1's toast and Recent rolls list show entries; campaign logs later store them unchanged.
- **`<FollowUp label="…">`** (user; not `Then`, which reads as running at once, nor `Offer`): steps offered as a button on the roll's entry, run when clicked (Roll20's "roll damage" after an attack).
  - What it reads (user): earlier rolls are stored on the entry, so `hit.natural` works when clicked later; sheet data is read at the click, from the content as it is then (no snapshot of the character).
  - Always offered, since the sheet doesn't know the target's AC; `show` hides one that doesn't apply (`show="hit.natural == 20"` on crit damage) (user). Far future: play mode may roll directly against another character's AC; not designed for now (user).
  - Holds any steps, including `Set`s and more `FollowUp`s (user); one with a `Set` needs the same edit rights as any action that writes.
  - v1: follow-up buttons on each entry in the Recent rolls list and on the toast while it's open (user).
- **Server-ready rolling** (user): the dice engine and action evaluation live in `shared/` with the random source passed in. v1 rolls in the browser (`crypto.getRandomValues`); the campaign log later sends the action to the server, which rolls with the same code. Markup and entries don't change.

- **Dice are inline SVG in one custom component** (user, 2026-10-06, for the build): a Vue component (e.g. `RollDie.vue`) holds the die outlines (d2 circle to d20 hexagon) as data and draws the face on top; states (critical, fumble, dropped) restyle it with theme tokens. Not `.svg` files. The outlines are agent-drawn, an exception the user approved; team art can replace them in that component. Details in the [dice mockup brief](../mockups/dice-rolls/brief.md).

## Open

- Who can click a follow-up in a shared campaign log (the roller, the GM, anyone), and whether it runs for someone who can't read the sheet: decide with campaign logs.
- The mockup of the result looks, then the markup details while building (attribute lists, where `Roll`/`FollowUp` may appear, error codes).
- Marking critical and fumble faces (user, 2026-10-06: opt-in per roll, any die, for systems that crit on other values): the mockup uses `crit="20" fumble="1"` on `Roll` (face lists, `max` for a die's highest face); settle the attribute names, ranges (`19-20`), and per-die-size forms with the markup details. How a roll target looks (die button or underline) is also the sheet's choice; settle how it's chosen there too.
