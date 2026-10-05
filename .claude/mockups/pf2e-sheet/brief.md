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
