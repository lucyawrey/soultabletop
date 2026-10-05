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

1. **Play vs. edit.** The user decided: a play mode and an edit mode, with build choices made through pickers in edit mode. Builder flows should be supported later, so nothing should block them. Still open: how this fits the existing Edit and Autosave switches (`ContentDetail.vue`, `Renderer.vue`'s `editMode`). The agent's proposal, not yet agreed:
   - **The Edit switch stays as it is**, and Edit off becomes "play". In play, the tags a sheet marks with a new `live` attribute (Tracker, Checkbox, Toggle, Number, and the conditions Tags) stay editable for viewers who can edit, and a change saves at once whatever the Autosave setting. Everything else shows as values, as today.
   - **Formulas can see the mode** (e.g. `{editing}`), so a sheet can show empty choice slots and pickers only while editing.
   - **Default mode:** no global change is needed. Sheets already have `defaultEditMode` (default off) and `defaultAutosave`; under this design, off means play. The PF2e sheet opens in play. Maybe: generated sheets mark trackers and checkboxes `live` automatically (decide when building).
   - **Builder flows later** are another way to fill the same fields (a sequence of steps over the same schema and pickers), not a third mode in the renderer, so they don't change this design.
2. **Actions:** action glyphs (◆ ◆◆ ◆◆◆ ↺ ◇) on Strikes, spells, and feats, and an Actions & Reactions list (Nimble Dodge, Heal at 1–3 actions, Raise a Shield).
3. **How numbers are built:** each modifier expands to its parts (attribute + proficiency + item + status/circumstance penalties), maybe with `RowDetails`; it also sets up conditions with effects.
4. **Missing content (vs. the Paizo sheet):** Initiative; senses, languages, size, traits; weapon and armor proficiencies; shield (Hardness, HP, BT); resistances and weaknesses; coins, worn/held, invested (10); the Cleric's deity (domains, favored weapon, sanctification, edicts and anathema); class features (racket, doctrine); notes and biography; dying, wounded, and doomed as real trackers.
5. **Builder functionality (Pathbuilder as a function reference only):** empty feat slots for coming levels; where attribute boosts came from; references open a preview of the linked content (spell, feat, item text).
6. **Visual hierarchy:** AC, HP, and Perception/Initiative stand out more than saves; untrained skills dimmed; two-column skills on desktop; a motif of our own (e.g. folio tab section labels) so it feels like the site, not a generic form.
