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

## Markup (decided 2026-10-06)

The user decided the four marked (user); the rest are the agent's calls, open to change while building.

```
<Value label="Stealth" formula="dex + prof(skills.stealth)">
  <Part label="Dex" formula="dex" />
  <Part label="{rankName(skills.stealth)}" formula="prof(skills.stealth)" />
  <Roll label="Check" formula="if(fortune, 2d20kh1, d20) + value()" crit="face == 20" fumble="face == 1" />
  <FollowUp label="Reroll ({heroPoints} left)" show="heroPoints > 0">
    <Set field="heroPoints" formula="heroPoints - 1" />
    <Roll label="Reroll" formula="if(fortune, 2d20kh1, d20) + value()" crit="face == 20" fumble="face == 1" />
  </FollowUp>
</Value>
<Table field="strikes">
  <Column field="name" />
  <Column label="Hit" formula="dex + prof(rank) + item" format="signed">
    <Roll name="hit" label="Attack" formula="d20 + value()" crit="face == 20" fumble="face == 1" />
    <FollowUp label="Damage"><Roll formula="dice(damage)" /></FollowUp>
    <FollowUp label="Critical"><Roll formula="2 * dice(damage) + dice(deadly)" /></FollowUp>
  </Column>
</Table>
```

- **Steps:** `Roll`, `Set`, and `FollowUp`, directly inside a `Button`, a `Value`, a `Number`, a `Column`, or a `FollowUp`, in any order; they run top to bottom and each sees the writes and named rolls before it. This replaces today's rule that a Button's `Set`s all read the data from before the click: the documented Damage button swaps its two `Set`s (update `docs/sheet-system.md`, the sheets skill, `buttons.test.ts`, and check saved sheets). A tag holding steps is an **action**.
- **`Roll`:** `formula` (required: the formula language plus dice), `name` (optional; makes a record later steps read), `label` (text with `{…}`; default "Roll"), `crit` and `fumble`, and `show` (skips the step). No other common attributes.
  - **Dice** (`NdM`, `dM`, `kh`/`kl`) only in a `Roll`'s `formula`; anywhere else it's an error. A text field holding dice ("2d8") is rolled with `dice(field)`, which parses the text at the click; text that isn't dice fails the roll with a toast. (Agent's call: an explicit function, so a text field is never read as dice by accident.)
  - **`crit` and `fumble` are conditions** (user): formulas run once per kept die, with `face` and `sides` as parameters (like `amount`): `crit="face == 20"`, `crit="face >= weapon.critRange"`, `crit="face == sides"`. A die marked by both counts as critical. The entry's badge reads "Natural N" when exactly one die is kept and it's marked.
  - **Records:** `hit.total`, `hit.dice` (kept faces, a list), `hit.natural` (the face when exactly one die is kept), and (agent's addition) `hit.crit` and `hit.fumble` (true when any kept die is marked), so `show="hit.crit"` works. Names are identifiers, unique within an action and its follow-ups, and shadow paths of the same name (reach those with `/`).
- **`value()`** (user): in steps inside a `Value`, `Number`, or `Column`, the value that tag shows (a `Number`'s typed value or formula; a `Column`'s value for that row). Elsewhere it's an error.
- **One entry per `Roll`** (user). Its title is the action's name (a Button's `label`, a value's `label`, or in a `Table` or `List` row, the row's label as previews use it) and the Roll's `label` ("Rapier · Attack").
- **`FollowUp`:** `label` (required, text with `{…}`, read live) and `show` (read live); holds steps, at least one. It belongs to the entry of the last `Roll` before it in its action; one with no `Roll` before it is an error. A follow-up with a `Set` needs edit rights; one with only `Set` steps gives a toast with Undo; a used one stays clickable and is marked used.
- **Who can use an action:** one whose steps (outside follow-ups) are only `Roll`s works for anyone who can see the sheet, in any mode; one with a `Set` follows today's Button rules (edit rights; Edit on, or `live`).
- **Roll target** (user): the rule decides by default (a value that also opens a breakdown or preview gets a die button beside it; otherwise the value is the button), and `<Sheet rolls="button">` puts a die button on every rollable value. Hook classes: `sheet-roll-trigger` on the die button or the value's button.
- **A value with steps** shows as text (it's a button); a `Number` shown as an input gets the die button beside it, like its Σ button.
- **Limits** (agent's call): at most 100 dice per Roll, 2 to 1000 sides, follow-ups nested at most 3 deep.
- **Error codes** (agent's call): `dice-outside-roll`, `step-misplaced` (a step outside the tags above), `step-in-preview` (like `button-in-preview`), `follow-up-without-roll`, `follow-up-empty`, `value-outside-value`, `roll-name-duplicate`, `roll-record-as-number` (warning-level message suggesting `hit.total`), `roll-limit` (dice or sides out of range).

## Open

- Who can click a follow-up in a shared campaign log (the roller, the GM, anyone), and whether it runs for someone who can't read the sheet: decide with campaign logs.
- Undo for an action that both rolls and writes (a Button with `Roll` and `Set` steps): on the roll toast, or a second toast. Decide while building.
