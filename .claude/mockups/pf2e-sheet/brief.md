# PF2e demo character sheet: brief

For the Pathfinder 2e demo system ([plan](../../plans/pf2e-demo.md)). A demo sheet, not the final official one, but it sets the direction for it and tests **sheet density**.

## Requirements

- Shows a level-1 Cleric and a level-1 Rogue (the demo characters) with real PF2e Remaster structure: ancestry, heritage, background, class, and level; six attribute modifiers; AC, HP, and Perception; Fortitude, Reflex, and Will; 16 skills plus Lore; Strikes; class DC; feats by type; inventory with Bulk; and, for the Cleric, spellcasting.
- What it holds and roughly how it's grouped follow Paizo's Remaster Player Core sheet. The look is our own, in the site's language (Folio palette, Cormorant display headings, Nunito Sans body). Pathbuilder is a reference for function only, never for layout.
- Every block is tagged with the Sheet tag that builds it (`data-tag`, `data-attrs`). Styling uses only `--st-*` tokens and `sheet-*` hooks. What the Sheet system can't do yet is marked `data-gap`.
- Desktop and phone widths both work.

## Toggles

- **Density:** compact (the proposal: a built-in density setting for the whole sheet) or roomy (today's site-form spacing).
- **Layout:** columns (everything on one page, like a paper sheet) or tabs (an always-visible summary plus tabs for Skills, Strikes, Feats, Spells, and Inventory).
- **Character:** Cleric or Rogue. The Spells section appears only for the Cleric.

## Content

The characters are invented for the mockup. Rules names (feats, spells, items) are ORC Remaster ones, used only as placeholders until the import script loads the real content.

## Review notes (user, 2026-10-05)

First draft: "a very good start but it def needs a lot of work still." Ideas from the agent, recorded at the user's request; the user hasn't picked among them beyond deciding #1 first.

1. **Play vs. edit.** The user decided: a play mode and an edit mode, with build choices made through pickers in edit mode. Builder flows should be supported later, so nothing should block them. Still open: how this fits the existing Edit and Autosave switches (`ContentDetail.vue`, `Renderer.vue`'s `editMode`). The design (agreed by the user):
   - **The Edit switch stays as it is**, and Edit off becomes "play". In play, the tags a sheet marks with a new `live` attribute (Tracker, Checkbox, Toggle, Number, and the conditions Tags) stay editable for viewers who can edit, and a change saves at once whatever the Autosave setting. Everything else shows as values, as today.
   - **Formulas can see the mode** (e.g. `{editing}`), so a sheet can show empty choice slots and pickers only while editing.
   - **Default mode (user's decision):** keep the default as it is. Character sheets still start with Edit Fields and Autosave on (`shared/sheet/generate.ts:28`), since simple sheets are played in edit mode. Only advanced sheets like the PF2e one turn it off and use play mode with `live` tags.
   - **Builder flows later** are another way to fill the same fields (a sequence of steps over the same schema and pickers), not a third mode in the renderer, so they don't change this design.
2. **Actions:** action glyphs (◆ ◆◆ ◆◆◆ ↺ ◇) on Strikes, spells, and feats, and an Actions & Reactions list (Nimble Dodge, Heal at 1–3 actions, Raise a Shield).
3. **How numbers are built:** each modifier expands to its parts (attribute + proficiency + item + status/circumstance penalties), maybe with `RowDetails`; it also sets up conditions with effects.
4. **Missing content (vs. the Paizo sheet):** Initiative; senses, languages, size, traits; weapon and armor proficiencies; shield (Hardness, HP, BT); resistances and weaknesses; coins, worn/held, invested (10); the Cleric's deity (domains, favored weapon, sanctification, edicts and anathema); class features (racket, doctrine); notes and biography; dying, wounded, and doomed as real trackers.
5. **Builder functionality (Pathbuilder as a function reference only):** empty feat slots for coming levels; where attribute boosts came from; references open a preview of the linked content (spell, feat, item text).
6. **Visual hierarchy:** AC, HP, and Perception/Initiative stand out more than saves; untrained skills dimmed; two-column skills on desktop; a motif of our own (e.g. folio tab section labels) so it feels like the site, not a generic form.

## Mockup v2 scope (user, 2026-10-05)

- **Play/Edit toggle:** play shows `live` tags (HP, hero points, slots, font, conditions, dying/wounded/doomed) as editable; edit shows pickers and empty choice slots (`{editing}`).
- **Include ideas 2, 3, 4, and 6:** actions, number breakdowns, the missing content, and hierarchy plus a motif of our own.
- **Builder hints:** previews of linked content in both modes, and empty feat slots for coming levels in edit only. Boost tracking waits for the builder flow.
- **Layout:** a balance between columns and tabs, not one or the other. For example, the always-needed things (attributes, defenses, Strikes, skills) are laid out on the page, and the long lists (feats, spells, inventory, biography) go in tabs. Drop the Columns/Tabs toggle.
- **Density:** keep the Compact/Roomy toggle.

## Mockup v2 review (user, 2026-10-05)

Rendered in Chrome at 1400px and 390px (no console errors, no sideways scroll), then decided:

- **Header:** doctrine (Cleric) and racket (Rogue) get a labeled chip like ancestry and class. Rows with nothing in them (Senses) are hidden in play and shown as an empty slot in edit.
- **Defenses:** AC, HP, and Perception stay big boxes. Fortitude, Reflex, and Will become one smaller Saves box with three rows. On a phone: AC and Perception side by side, HP full width, Saves one row.
- **Strikes on a phone:** no column headers; each Strike is two lines (action glyph, name, hit and MAP; then damage and traits).
- **Skills:** untrained skills dimmed (the U badge stays, so it isn't color alone); both columns share one row grid; Lore last.
- **Class tab:** a new first tab with class features by level, the deity for a Cleric (domains, favored weapon, sanctification, edicts and anathema, font), and the racket for a Rogue. The Feats tab holds only feats and empty slots.
- **Proficiencies:** two labeled rows, Attacks (unarmed, simple, martial, advanced) and Defenses (unarmored, light, medium, heavy), each with its rank badge, plus class DC in the same block.

## Next for the mockup (user, 2026-10-05)

- v3 changes after review: the tabs are full width below the columns, with a fixed height so switching tabs doesn't move the page; the contrast table opens from a Contrast button in the bar.
- **Layout toggle (added after v3):** Tabs right (default: Strikes and Actions side by side, then skills and proficiencies on the left and the tabs on the right, filling that column's height) or Tabs below (the v3 layout). Phones stack both the same way.
- Icons: action glyphs stay text (◆ ↺ ◇) until the user draws them (agents don't draw art); other icons from game-icons.net (see "Game icons in sheets", PR #91).

## Mockup v4 (user, 2026-10-05)

- Strikes and Actions & Reactions sit side by side in one full-width row, in both layouts, with equal heights and roomier rows.
- Attribute boxes are all the same size and larger. The key attribute gets a "Key" tag on its top border and a doubled outline, so its box keeps the same size as the others.
- Perception is a normal-size box, no longer a hero number.
- Level, Hero Points, Speed, and Size form one strip of equal cells, with labels on one line and values on one line.
- The user iterates on the mockup until they say it's done.
- **Initiative (user's decision):** a "rolls with" picker (Perception by default, or any skill), stored on the character and live in play, plus initiative-only bonuses; the number is that roll plus the bonuses (`switch`/`get` in a formula). It sits as its own row at the top of the Skills section. Later, an exploration activity field could set the picker (Avoid Notice → Stealth) on top of this.
- **Perception moves to Skills (user, replaces the v2 "big box" decision):** Perception and Initiative are the first two rows of the Skills section, above a heavier rule. Defenses are AC, HP, and Saves; on a phone, HP full width, then AC and Saves side by side.
- **HP box (user):** a fuller HP box (damage/heal input, a stacked death track, resistances inside) was tried and rejected: "old version of hp was better". The original layout stays, with the max HP ("/ 17") and the Temp input larger; the small "max 17" label is gone since the max is now readable.
- **Damage/Heal (user):** an amount input with Damage and Heal buttons on the HP line, between the current/max HP and Temp. Damage comes off temp HP first; Heal stops at the max. Needs a tag for a button that changes a field (gap).
- **Header strip on desktop (user):** the Level / Hero Points / Speed / Size strip is centered vertically beside the whole header (name, chips, and the traits line, which no longer runs under it), with more padding and slightly larger values. Phones are unchanged.
- **Class chips (user):** Class and its subclass (Doctrine, Racket) always sit on the same line; they wrap together.
- **Build choices more prominent (user):** Ancestry, Heritage, Background, Class, and the subclass are small cards (label above a larger value) instead of pills; in edit mode the Change button sits under the value.
- **Strikes and Actions grow together (user):** each panel grows with its rows, and the shorter one always stretches to the taller one's height (desktop; on a phone they stack and size separately). Edit mode has "+ Add strike" and "+ Add action" to try it.
- **Game icons (user asked to try them, 2026-10-05):** two new toggles. *Action glyphs:* Text (◆ ↺ ◇, works today), Game icons (game-icons.net has no action glyphs; the closest are `diamonds`, the card suit, repeated per action, `anticlockwise-rotation` for a reaction, and an outlined `diamonds` for a free action), or Own SVG (agent-drawn; dropped, since agents don't draw art). Inline glyphs in rows need an inline icon tag (gap). *Section icons:* game-icons on section labels and tabs (`cowled`, `checked-shield`, `crossed-swords`, `sprint`, `skills`, `upgrade`, `star-medal`, `stars-stack`, `spell-book`, `knapsack`, `quill-ink`), which `Section` and `Tab` `icon` support today.
- **Action glyphs back to text (user):** ◆ ↺ ◇ as text, as before (now with spoken labels); the game-icons and own-SVG glyph toggle is gone. Section and tab icons stay, centered inline with their labels.
- **Icon choices:** `icons.html` in this folder shows 6–7 game-icons candidates per section label and tab, drawn as the sheet draws them; the user picks one per label.
- **Larger action glyphs (user):** the text glyphs are about 1.45× the row text in Strikes, Actions, and Feats, and 1.2× inline in Spells.
- **Icon picker in the mockup (user):** a small picker under the sheet (shown while Icons is on) with the same candidates as `icons.html`; clicking one changes that label's icon on the sheet at once, and a "Picks:" line lists the current choices to copy. Picks aren't saved across reloads.
- **No "Character" label (user):** the header panel has no folio-tab label (and no icon); the name heads it.
- **Attributes & Defenses icon (user):** an icon must cover both attributes and defenses, or there's none. It defaults to none ("—" in the picker); the candidates are heart-armor, spartan, knight-banner, barbarian, ninja-heroic-stance, black-knight-helm, muscular-torso, strong-man, body-balance, chest-armor, and vitruvian-man.
- **Icons chosen (user):** Attributes & Defenses none, Strikes `crossed-swords`, Actions & Reactions `hand`, Skills `skills`, Proficiencies `diploma`; tabs Class `medal`, Feats `stars-stack`, Spells `spell-book`, Inventory `swap-bag`, Biography `quill-ink` (all `i-game-icons-…`). These are the mockup's defaults; the picker was removed once they were chosen.
