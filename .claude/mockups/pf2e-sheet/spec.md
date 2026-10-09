# PF2e demo sheet: frozen mockup spec

The approved character sheet for the Pathfinder 2e demo system ([plan](../../plans/pf2e-demo.md), [brief](brief.md)). Approved by the user on 2026-10-06 ("done for now"), frozen the same day.

- **[frozen.html](frozen.html)**: the reference. The mockup locked to the chosen options (Layout: Tabs right; Icons: on), with those two option controls removed. The view controls stay: Play/Edit, Compact/Roomy (the proposed density setting), Cleric/Rogue, and Contrast. It changes only to fix the page itself, never to follow the built sheet.
- **[mockup.html](mockup.html)**: the archived original with every option, unchanged.
- **[icons.html](icons.html)**: the icon candidates the user chose from (see "Icons").
- **[brief.md](brief.md)**: the requirements and every review decision, in order. This spec collects the outcome; the brief keeps the reasons.

Where the built sheet differs from `frozen.html` and the difference isn't under "Decided after the mockup", it's drift: fix the sheet, or record the new decision here.

What changed from `mockup.html` besides the locked options: the CSS of rejected options was removed (the Tabs below layout and its two-column skills grid, the segmented item-state toggle, the old feat cards), and the `data-attrs` were corrected to the Sheet system's real syntax (`Grid cols`, `Number format="signed"`, bare formulas in `formula` and `show`, `if()` instead of `?:`, no `rows`/`item` attributes, which don't exist). Two changes by the user at the freeze (2026-10-06). Lore skills can be added: in edit, each Lore row's name is a dashed input with a × to remove it, and "+ Add lore" adds a trained Int row and focuses its name (the mockup had one fixed Lore row; the brief had more Lore rows "left for later"). And Spell DC and spell attack now work like Class DC, with a spellcasting rank badge (a picker in edit) and breakdown popovers; the mockup had them as plain numbers fixed at trained.

## Chosen options

| Control | Choice |
|---|---|
| Layout | Tabs right: Strikes and Actions & Reactions side by side; below them Skills and Proficiencies on the left, the tabs on the right |
| Section icons | On (the picks under "Icons") |
| Action glyphs | Text: ◆ ◆◆ ◆◆◆ ↺ ◇, with spoken labels |
| Density | Compact for this sheet; Roomy stays as the proposed setting's other value |
| Mode | Play by default for this sheet (Edit Fields off); edit shows pickers and empty slots |

## Decided after the mockup (not shown in it)

- **Strikes: take parts from the dice mockup** (user, 2026-10-06: "it looks good"). When the sheet is built, consider the Strikes section of [the dice mockup](../dice-rolls/mockup.html) (v1.14): traits on their own muted line under the weapon name, the hit modifier with its roll button and the MAP steps as smaller rollable numbers in one cell, and the damage with "+1d6 sneak" beside it; on a phone, the hit cell moves beside the name and the damage below. The user's word was "aspects", so which parts to take is decided while building.
- **Initiative doesn't offer Lore** (user, 2026-10-07: "it's okay"). The "rolls with" picker offers Perception and the 16 skills, the options of the schema's `initiative.roll`; Lore rows are a list, so they can't be choices.
- **Review of the built sheet** (user, 2026-10-07):
  - Spells are grouped as Spells and Cantrips, with the slots in their own group, not one group per rank.
  - Edit mode keeps the play layout: rows stay in their grids, with pickers and inputs in the cells (not form rows); it needn't match play exactly.
  - Rank option labels in the schema are the letters U/T/E/M/L, so edit's rank selects are badge-sized.
  - Rollable values keep the roll system's die button beside them.
  - Still to build: resist/weak/immune (schema fields; changing the schema is fine), the Bulk meter's encumbered mark (a Tracker feature), empty "Choose … feat" rows for coming levels, and Strike roll titles from the weapon's name (rows titled by a referenced content's name).
  - Second look (user, 2026-10-07): every panel, the tab panel and selected tab included, has the strong border (`--st-border-strong`); the tabs run as tall as the Skills and Proficiencies column and sit flush on their panel; the Level box and its value are centered.
  - Third look (user, 2026-10-08): the decisions above and the "agent, approved" list below stand. The Bulk meter shows how full the character is (a filled bar). Resist / weak / immune: set aside for now; Attributes & Defenses stay compact and shouldn't change size much (a full-width row was tried and dropped). Edit mode should look like the mockup: every "agent, unconfirmed" choice was reverted to `frozen.html` unless the Sheet system can't do it (listed below), then gone over with the user. Fields the mockup has no edit control for (armor and shield, a Strike's attribute, item bonus, and notes, an action's notes) are small inline controls no taller than the play row; rows remove with a ×, with no reorder buttons; armor and shield are picked in the Inventory tab's strip, so the AC box doesn't change in edit.
  - After the third look (user, 2026-10-08): the sheet is close enough to `frozen.html`; from now on it's improved on its own terms, not measured against the mockup (the mockup stays a reference where the user points to it). View mode first, one area per batch, then edit mode. Reverted: the level strip beside the name (the header's old layout is back) and muted roll dice. Decided in view mode: the attributes end flush with the Raise Shield button, which keeps one width ("◆ Raise Shield" / "◆ Shield Raised"); a raised shield shows as "· +2 shield" after the armor in the AC box; the shield line is the shield's name (opens its card), HP, and "/ max (broken threshold)", no Hardness; Conditions come first, then IWR (one label for resist / weak / immune), as one flow of chips that wraps like text, the shield info never moving; IWR entries are chips under Resist / Weak / Immune; Traits, Senses, Other speeds, and Languages are chips; chips and their "+ Add" are one size (20px); temp HP draws over the HP bar from the left in the contrast color (`--st-contrast`, steel blue, #109); the level box is centered against the whole header; trait chips, regular-weight damage, muted MAP steps, small action notes; every list's preview expands as a full-width panel under its row, the whole name cell opens it, and expanding moves nothing; the header's build cards, shield, racket, and deity keep card previews.
  - View mode, area by area (user, 2026-10-09; each waits for the user's approval): header rows sit flush on their lists. Skills: Initiative's select fits its label; Initiative has a bonus field (edit mode) that its breakdown always lists, even at 0; Perception and Initiative look like skill rows (name and modifier sizes) and keep the divider under Initiative; skill rows use fixed columns so attribute, rank, and modifier line up, with the rank-to-modifier gap close to the attribute-to-rank gap; Lore continues the skill list with no divider of its own. Proficiencies: labels on their first line of badges, badges in an aligned two-column grid, each name on its badge's baseline. Tabs: every row is a 30px list row with regular-weight values (Deity, Biography); Class features get a Level · Feature header; a feat's action icon sits right before its name; feat type chips look like the Strikes trait chips; variable action costs read "◆ to ◆◆◆"; every group bar has the same space above (12px) and below (4px); Divine Font's pips sit beside its count; empty coins show 0; Move buttons fit a 30px row; the Inv column shows only for items with the `invested` trait and drops out when none have it; an empty portrait's "No image" is muted. Spell slot, Divine Font, and focus pips show what's left (the data stores `left`, not `used`): filled pips are available, using one empties it, and Daily preparations refills them. The Class and Spells tabs' first line is their main information: labels 11.5px, values 16px bold, rank badges unchanged. Approved by the user (2026-10-09): the Spells tab as it stands and that first line; its data model is a later rework (`TODO.md`, "PF2e spellcasting").

## Differences from frozen.html that remain

Where the built sheet (draft PR #108, as of 2026-10-07) still differs from `frozen.html` on purpose, and who chose it. "User" is a decision above; "agent, approved" was proposed by the agent and accepted by the user; "agent, unconfirmed" is the agent's choice, not yet reviewed: confirm it or fix it. Anything not listed is drift.

**Decided by the user**
- Every panel has the strong border; in the mockup the section panels had the light one.
- The tabs run as tall as the Skills and Proficiencies column (the mockup gave the panel a fixed 640px minimum).
- Edit mode keeps the play layout with inputs in the row cells (the direction); the details are the agent's (below).
- Rank option labels are U/T/E/M/L in the schema.
- Initiative doesn't offer Lore.
- Strikes take parts from the dice mockup (which parts was left to the agent; below).

**Agent, approved by the user**
- Spells grouped as Spells and Cantrips, with a Spell slots group ("Rank 1", pips, "1 of 2 left"), not one group per rank.
- A die button beside every rollable value (the roll system's default).
- Resist / weak / immune, the Bulk mark, open feat slots, and Strike roll titles were gaps the user chose to build; how each looks is the agent's (below), except Resist / weak / immune and the Bulk fill, which the user decided (third look, above).

**Agent, unconfirmed** (after the third look's rework, 2026-10-08; go over these with the user)
- Edit controls are the app's own restyled through Sheet CSS: inputs and selects get dashed edges and no fill; pickers draw as the underlined name with a small ▾; rank selects are invisible over the badge.
- Strikes in edit: the attribute select and item bonus input sit in the hit cell (the MAP steps hide); a 64px notes input follows the traits.
- Actions in edit: a "Feat" picker shows inline while no action is chosen.
- Inventory in edit: quantity input, item picker, and an Invested checkbox in each grouped row; the move buttons stay; one "+ Add item" after the groups (new items are worn, the schema's default). Armor and shield pickers follow the coins.
- Spells in edit: the strip's tradition, casting, and attribute are small selects; slots, Divine Font uses, and focus points are small inputs in their rows and bands.
- Senses, Languages, Conditions, and Immune edit as the app's tag input, dashed, not chips plus a "+ Add" pill.
- Open feat slots follow the feats (after "+ Add feat") as rows with a "Choose … feat" pill, not interleaved by level; the pill doesn't open a picker ("+ Add feat" adds).
- The portrait edits as a URL input, not the mockup's dashed "No portrait" box.
- Signed values show 0 without a sign (the Sheet system's `signed` format); the mockup showed "+0". Changing it is a Sheet system change.
- The header's build cards wrap to a second row when the page is narrower than the mockup's 1180px (the app's page is 1112px wide in a 1400px window).
- The Skills aside ("armor −1 on Str/Dex skills") shows only when the penalty applies.
- Class tab: the Racket group has no Benefits row (the racket opens a preview card instead); class features show only what the class data holds (level 1 for both classes), so no coming levels appear muted yet; the class's other weapon proficiencies ("Rapier, sap, shortbow, …") aren't shown.
- Biography follows the character schema's fields, not the mockup's list (which had Ethnicity, Nationality, Birthplace, Beliefs, Likes, Dislikes, Catchphrases).
- Reference previews and breakdowns are the Sheet system's (a card under the value; a popover), not the mockup's bottom-right card. Decided for the system when those features were built, not for this sheet.
- Section labels are placed by styling Nuxt UI's card header element; Roomy density hasn't been looked at.

## Known issues in the frozen page

- Phone, Roomy, Edit: the six attribute inputs in one row are too narrow for their signed values at full size ("+4" clips). The built sheet shouldn't copy this: on a phone in roomy density the attributes should fit (for example 3 per row). The user said edit "doesn't need to be perfect", so the page wasn't changed.

## Tokens

The sheet uses only the `--st-*` Sheet tokens, mapped as `app/assets/css/main.css` maps them (see `docs/theme.md`), plus `--ui-error` for the dying/wounded/doomed pips and the Broken and Encumbered tags. No colors of its own.

Density tokens (the proposed `<Sheet density="…">`; private to the mockup, the built version names them in `docs/sheet-system.md`):

| Token | Compact | Roomy | Used for |
|---|---|---|---|
| `--d-gap` | 6px | 16px | gaps between blocks and columns |
| `--d-pad` | 8px | 16px | panel padding |
| `--d-h` | 24px | 36px | input and row height |
| `--d-fs` | 13px | 15px | body text |
| `--d-lfs` | 10.5px | 12.5px | labels, chips, small text |
| `--d-big` | 22px | 28px | box values (saves, attributes ×1.2, header strip ×1.15 on desktop) |
| `--d-hero` | 30px | 38px | AC and current HP |
| `--d-h2` | 15px | 19px | section labels and tab labels |

Fonts: section labels, tabs, the name, and the Perception/Initiative row labels in the display font (`--st-font-display`); everything else in the body font.

## Layout and measurements

From `frozen.html`'s CSS. Phones are below 901px.

**Page**
- Sheet max 1180px wide, centered; block gap `--d-gap + 10px` vertically (room for the folio-tab labels), `--d-gap` horizontally.
- Panels: `--st-panel`, 1px `--st-border`, radius `--st-radius`, padding `--d-pad + 6px` top, `--d-pad` elsewhere.
- **Motif:** each section's label sits on the panel's top edge like a folio tab: display font `--d-h2`, padding 3px 10px 4px, 1px `--st-border-strong` with the bottom border in the panel color, top corners `--st-radius × .8`, raised 55% of its height. An optional aside (MAP note, armor penalty) sits on the top edge at the right, `--d-lfs` bold muted.
- Labels (`sheet-field-label`): `--d-lfs`, bold, uppercase, 0.04em tracking, muted.

**Header** (no folio label; the name heads it)
- Name: display font, `--d-big × 1.35`.
- Build cards (Ancestry, Heritage, Background, Class, subclass Doctrine/Racket): label above a `--d-fs + 3px` underlined link value; 1px `--st-border-strong`, radius `--st-radius × .8`, padding 3px 12px 4px, `--st-panel-muted`; 6px 8px gaps. Class and subclass are one group that wraps together.
- Strip (Level, XP, Hero Points, Speed, Size): equal cells divided by 1px `--st-border`, on `--st-panel-muted`; labels on one line, values on one line, at `--d-big` (phone) or `--d-big × 1.15` (desktop). Desktop: in a second column, centered vertically beside the name, cards, and facts; cell padding `--d-pad × .9` × `--d-pad + 14px`. Phone: full width under the cards, cells shrink equally. Hero point pips 17px (19px desktop).
- Facts line (`--d-lfs`): Traits as chips, Senses and Other speeds (hidden when empty in play; "+ Add" in edit), Languages (plain list in play; chips with × and a "+ Add" select in edit).

**Attributes & Defenses** (no icon)
- Desktop: attributes (3 × 76px columns, equal rows, 6px gap) beside defenses. Phone: 6 attributes in one row, then defenses.
- Attribute box: label over a signed value at `--d-big × 1.2`. The key attribute: a "Key" tag (9.5px uppercase, primary fill) centered on the top border and a doubled 1px primary outline, so the box keeps its size.
- Defenses grid `.9fr 2fr 1.2fr`: AC, HP, Saves. Phone: HP full width, then AC and Saves (`1fr 1.3fr`).
- AC: 1px primary outline, value at `--d-hero`, armor name under it; "+2 shield" in primary when the shield is raised.
- HP: current HP input at `--d-hero` (58px wide) and "/ max" at `--d-hero × .7` muted; then an amount input (48px) with Damage and Heal buttons (`--d-lfs` uppercase); then Temp (48px input at `--d-big`) pushed right. A 6px meter. Dying (4 round pips), Wounded and Doomed (3 square pips), in `--ui-error`.
- Saves: one box, three rows (name, value at `--d-big × .8`, rank badge in a 24px column).
- Strip under the defenses: the ◆ Raise Shield toggle (height `--d-h + 4px`, primary outline; pressed: filled, "Shield Raised", keeps its width), shield name and Hardness, shield HP input with "/ max · BT", a Broken tag at or below BT; Resist / weak / immune; Conditions with "+ Add". Characters without a shield have no toggle.

**Strikes and Actions & Reactions**
- One row, `1.5fr 1fr`, equal heights (the shorter panel stretches); stacked on a phone.
- Rows: min height `--d-h + 6px`, 1px `--st-border` dividers, names `--d-fs + 1px` underlined (they open the reference preview).
- Strikes columns `30px 1.1fr 118px 1fr 1.6fr`: glyph, weapon, hit with MAP (MAP in `--d-lfs` muted; agile −4/−8), damage (plus "+1d6 sneak" for the Rogue), trait chips. Phone: no header; two lines per Strike (glyph, name, hit and MAP; then damage and traits).
- Actions columns `76px 1fr auto`: glyph, name, muted note.
- Edit: "+ Add strike", "+ Add action" pick buttons.

**Skills and Proficiencies** (left column, `minmax(300px, 1fr)`)
- Perception, then Initiative (a "rolls with" select, Perception or any skill), labels in the display font at `--d-h2`, values at `--d-big × .8`; a 2px `--st-border-strong` rule under them.
- Skill rows `1fr 30px 46px 42px`: name, attribute (muted), rank badge, modifier. Untrained: name and modifier muted and regular weight (the U badge stays). Lore rows last, after a divider: any number of them, each with its own name and rank, always Int; edit adds and removes them (above).
- Proficiencies: two labeled rows, Attacks and Defenses, each a wrap of rank badge + name.

**Tabs** (right column, `1.75fr`; phone: below, full width)
- Class, Feats, Spells (Cleric only), Inventory, Biography. Tab labels in the display font at `--d-h2` with their icon; selected tab joins the panel.
- Panel: padding `--d-pad × 1.5`, min height 640px on desktop (so switching tabs doesn't move the page), none on a phone.
- Every tab uses the Strikes row style, with group headers as tinted bands (`--st-panel-muted`, radius 4px, `--d-lfs` uppercase).
- **Class:** a strip (class, Class DC with rank, key attribute), class features by level (coming levels muted), then Deity (Cleric) or Racket (Rogue) as label/value rows (`130px 1fr`).
- **Feats:** one list by level (`40px 40px 1fr 90px`: level or "bg", glyph, name, type chip); edit adds "Choose … feat" rows for coming levels in order.
- **Spells:** a strip (tradition and "prepared", Spell DC with its spellcasting rank, spell attack, both with breakdowns, and a Daily preparations button); rows `22px 64px minmax(120px,1fr) 110px 90px 1.4fr` (cast mark, actions, name, range, defense, effect) grouped as Rank 1 (slots and how many left), Divine Font (tracker), Cantrips (heightened rank), Focus spells and Innate spells (shown when present; "+ Add" in edit). Phone: two lines per spell.
- **Inventory:** a strip (Bulk as a decimal, a 90×7px meter with a mark at 5 + Str and its end at 10 + Str, "encumbered over N · limit M" or an Encumbered tag; Invested / 10; coins as 44px inputs); rows `36px 1fr 44px 170px 30px` (qty, item, Bulk with "L" for light, move badges, invested ✓) grouped Held, Worn, Stowed. Move badges are pills naming the state they move to (Hold, Wear, Stow; each row shows the two it isn't in), with no action cost (user, 2026-10-09). Phone: `24px 1fr 30px 150px`, Invested hidden.
- **Biography:** a 140px 3:4 portrait beside Details, Personality, and Relationships (label/value rows, auto-fit columns min 320px), then Notes. Phone: portrait above, max 160px.

## States

- **Play vs. edit:** play shows values; `live` fields (HP, temp HP, hero points, XP, dying/wounded/doomed, shield raised and shield HP, conditions, initiative roll, spell slots, Divine Font, focus points, item state, coins) stay editable. Edit: inputs keep the size of the values they replace, with dashed edges; rank badges become dashed selects that look like the badges; build cards and the deity/racket are their own picker (dashed edge and ▾). Controls that look like their play values get a soft ring (2px, primary at 22%, 2px offset); focus shows the full ring.
- **Breakdowns:** clicking a number with a dotted underline (AC, saves, skills, Perception, Initiative, Strikes, Class DC, Spell DC, spell attack) opens a popover under it (11.5px, max 360px); click again, click elsewhere, or Escape closes it. Nothing moves.
- **Reference preview:** clicking an underlined name opens a card at the bottom right (340px) with the referenced content's rules text.
- **Pips:** clicking a pip sets the value to it; clicking the highest filled pip lowers it by one.
- **Empty:** rows with nothing (Senses, Other speeds, focus and innate spells) are hidden in play and an empty "+ Add" slot in edit. Biography fields show "—".
- **Phone:** covered above per section. Everything stacks in one column; no sideways scroll at 390px.
- **Accessibility:** the Contrast button shows the live contrast table (text 4.5:1, outlines and error 3:1); state is never color alone (rank letters, the U badge on untrained skills, "Shield Raised" text, the Encumbered and Broken tags); action glyphs have spoken labels.

## Icons

All `i-game-icons-…` on `Section` and `Tab` `icon`: Strikes `crossed-swords`, Actions & Reactions `hand`, Skills `skills`, Proficiencies `diploma`; tabs Class `medal`, Feats `stars-stack`, Spells `spell-book`, Inventory `swap-bag`, Biography `quill-ink`. Attributes & Defenses has none. Icons are primary-colored, `.95em`, centered inline with the label.

## Tag map

Each block in `frozen.html` carries `data-tag` and `data-attrs` (inspect the page for the full set). The main ones:

| Block | Tag and attributes |
|---|---|
| Sheet | `Sheet density="compact"` (gap) |
| Panels | `Section title="…" icon="i-game-icons-…"` |
| Name | `Text field="name"` |
| Build cards | `Ref field="ancestry"` (and heritage, background, class, subclass) |
| Level, XP | `Number field="level"`, `Number field="xp" live` |
| Hero points | `Tracker field="heroPoints" max="3" style="pips" live` |
| Speed | `Value formula="ancestry.speed"` |
| Languages | `Field field="languages"` (an array of choices) |
| Senses, Other speeds, empty spell groups | `Section show="editing or senses"` (gap: `editing`) |
| Attributes | `Grid cols="3"` of `Number field="attributes.str" format="signed"` |
| AC | `Value formula="10 + min(dex, armor.dexCap) + prof(armor.rank) + armor.ac + if(shieldRaised, shield.ac, 0)"` |
| HP | `Tracker field="hp" max="{ancestry.hp + (class.hp + con) * level}" live` |
| Damage / Heal, Daily preparations, item moves | a button that changes a field (gap) |
| Saves | `Table field="saves"` (struct rows) with `Value formula="con + prof(saves.fortitude)"` |
| Raise Shield | `Toggle field="shieldRaised" live` |
| Shield HP | `Tracker field="shield.hp" max="{shield.maxHp}" live` |
| Conditions | `Tags field="conditions" live` |
| Strikes | `Table field="strikes"`; names are `Ref` |
| Actions | `List field="actions"`; names are `Ref` |
| Perception | `Value formula="wis + prof(perception)"` |
| Initiative | `Select field="initiative.roll" live` and `Value formula="switch(initiative.roll, 'perception', perception, get(skills, initiative.roll)) + initiative.bonus"` |
| Skills | `Table field="skills"` (struct rows) |
| Lore | `Table field="lore"` (an array of name and rank; edit adds and removes rows, which arrays support today) |
| Proficiencies | `Grid cols="2"` |
| Tabs | `Tabs` / `Tab label="…" icon="…"` |
| Class DC | `Value formula="10 + key + prof(classDC)"` |
| Spell DC, spell attack | `Value formula="10 + wis + prof(spellcasting)"`, `Value formula="wis + prof(spellcasting)"`; the rank is a field like `classDC` |
| Class features | `List field="class.features"` (gap: read from the referenced class) |
| Deity, Racket | `Section title="Deity"` with `Ref field="deity"` |
| Feats | `List field="feats"`; empty slots `Section show="editing"` |
| Spells | `Table field="spells"`; cast marks `Checkbox … live`; Divine Font and focus `Tracker … live` |
| Bulk | `Tracker formula="bulk" max="{10 + str}"` (gap: a tracker over a computed value, with a threshold mark) |
| Coins | `Number field="coins.gp" live` |
| Inventory | `Table field="inventory"` |
| Portrait, Notes | `Image field="portrait"`, `Markdown field="notes"` |
| Reference preview | `Ref … preview` (gap) |

## Gaps

What the Sheet system can't do yet (marked `data-gap` in the page). Each is in `TODO.md` under "Sheet features found missing" (Phase 1).

1. ~~`density` on `<Sheet>` (compact/roomy).~~ Built in #92.
2. ~~`live`: fields editable in play mode, saved at once.~~ `live` already existed; saving at once was built in #92.
3. ~~`editing` visible to formulas.~~ Built in #92 as the function `editing()`: write `show="editing() or length(senses) > 0"`, not the page's `show="editing or senses"`.
4. ~~A button that changes a field (Damage/Heal, Daily preparations, item moves).~~ Built in #93: `<Button>` with `<Set>` children (see `docs/sheet-system.md`, "Buttons"); compact became the default density in #94.
5. ~~Breakdown popovers on `Value` and boxes (AC, saves, skills, Strikes).~~ Built in #95: `<Part>` children (see `docs/sheet-system.md`, "Breakdowns").
6. Reference previews (the rules text of a linked spell, feat, item, or class feature).
7. A list read from a referenced resource (class features from the class).
8. Strikes reading hit and damage from the inventory item.
9. Conditions that change the numbers.
10. Roll buttons (the "Sheet dice buttons" item).
11. A tracker over a computed value with a threshold mark (Bulk).

## How to compare

Screenshot `frozen.html` and the built sheet with `.claude/scripts/compare-mockup.mjs` at 1400px and 390px, in play and edit, for both characters, in compact density. The frozen page's sheet is 1180px max, like the built one should be, so positions can be compared directly.
