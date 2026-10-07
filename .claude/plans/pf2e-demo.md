# Pathfinder 2e demo system: plan

The plan for the "Pathfinder 2e demo system" item in `TODO.md` (Next up). It's a demo slice, not the official sheet, but it's a head start on it. It comes after the database reset, except for step 1.

## Decisions (user, 2026-10-05)

- **Start from `pf2e-test`.** Export the old system's schemas and sheet through the API *before the reset*, then port them to the current formula syntax (the export still uses `{= }` and braced `show`).
- **Quick mockup first**, in `.claude/mockups/pf2e-sheet/`, approved before the sheet is built (process: `.claude/ui-mockups.md`).
- **Tiny content slice**, enough for two pre-built characters: 2 classes (Cleric and Rogue), 3 ancestries, 3 backgrounds, about 15 feats, 15 spells, and 25 items. Only ORC Remaster items from the Foundry data, loaded by an import script.
- **References, not text.** The character links to its ancestry, background, class, feats, spells, and items as references to the imported content, and formulas read values from them (HP, key ability, item bonus, damage dice) where today's features allow. Anything they can't do goes into "Sheet features found missing" in `TODO.md`.
- **Owner:** the `soul` group owns demo systems, so they're Official.
- **Classes:** Cleric and Rogue. Rogue is new compared with the old Fighter and Cleric test characters, so its parts (sneak attack, racket, skill-heavy proficiencies) aren't in the `pf2e-test` export.
- **Home: `systems/pf2e/` on `main`** (user, 2026-10-07: keep the work for the future full PF2e system). The system's sources live in a top-level folder, merged through PRs like code: content type schemas (and the script that builds them), the sheet's `.stts` and `.css`, the import script, and a README with sources and licenses. The full system grows in the same place; Cairn gets `systems/cairn/`. The legacy export and the mockups stay in `.claude/`. This replaces "keep a copy in `.claude/`" below and in `TODO.md`.
- **Order** (user, 2026-10-07): types, then import, then sheet, each its own PR and review. First finish the character type and check all the types against the API; then the import script creates the Official system and its types and loads the slice; then the sheet is built against the imported content.

## References and how to use them

- **Paizo's official Remaster Player Core character sheet** (https://downloads.paizo.com/RemasterPlayerCoreCharacterSheet.pdf): the safe reference for *what* a sheet holds and roughly how it's grouped. Our layout and look must still be our own and feel like part of the site.
- **Pathbuilder 2e** (https://pathbuilder2e.com): the standard PF2e builder. Use it only as a reference for *functionality* (what a builder does, what a player expects), plus a nudge toward our own layout ideas. Never copy its content, wording, or layout. Most of what it does is out of scope for now, but keep it in mind.
- **Foundry pf2e data** (`~/Developer/foundry-pf2e`): field shapes for the content types, and the source the import script reads (ORC + `remaster` items only). Agents read it to design; they don't hand-write content from it.

## Density

The biggest weakness of our sheets so far is that they're much less dense than other character sheets and builders. That's because the Sheet tags render with the site's form styling, which is roomy. That's fine for the site, but too roomy for a sheet. The goal is that a sheet can use the site's visual language and still be dense, *without* the author writing lots of custom CSS. An author can still pick the site's roomy form look if they want it.

Direction (to confirm in the mockup step): a built-in density setting for the whole sheet, with roomy (today's site forms) and compact (tight inputs, small labels, smaller gaps, inline label and value pairs, narrow number boxes). It's driven by `--st-*` tokens and the tags' own sizes, so a sheet opts in with one attribute and custom CSS stays optional. The PF2e demo sheet uses compact. The mockup should show the same section in both densities, so we can judge it before building it in the Sheet system.

## Steps

1. **Before the reset:** export `pf2e-test` (content type schemas, sheet markup and CSS, and the two test characters' data) through the API into `.claude/pf2e/legacy/`.
2. **Content types:** design character, ancestry, background, class, feat, spell, and item from the Foundry data. Drafted in `.claude/pf2e/content-types/` (without the character); they move to `systems/pf2e/` with the character type added.
3. **Mockup:** the character sheet in compact density, plus a roomy comparison of one section. Get it approved. Done: approved and frozen 2026-10-06 ([frozen.html](../mockups/pf2e-sheet/frozen.html), [spec.md](../mockups/pf2e-sheet/spec.md)).
4. **Density in the Sheet system,** if the mockup confirms it: its own small PR, with `docs/sheet-system.md` updated.
5. **Import script** (`systems/pf2e/import.mjs`): reads the Foundry packs, keeps the ORC Remaster items in the slice, maps them to our content types, and posts them through the API with `SOUL_TABLETOP_API_KEY`. It can be rerun after a reset.
6. **Character sheet:** port the `pf2e-test` sheet onto the new schema and the approved mockup. Use references and formulas, and check it with the `soul-tabletop-sheets` skill.
7. **System page:** the description credits the Foundry pf2e data and states the ORC license notice. The credits text is technical; anything promotional is team copy. Build the two demo characters through the UI or API with the user.
