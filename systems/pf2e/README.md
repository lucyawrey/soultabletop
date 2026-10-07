# Pathfinder Second Edition

The official Pathfinder 2e system as files: its content types, and later its imported content and character sheet. This folder holds content only; the code that writes or loads it lives in `scripts/`. Everything is loaded into the app through the API, never by hand, so the system can be rebuilt after a database reset. The plan for the demo slice is in `.claude/plans/pf2e-demo.md` on the `docs` branch.

## Content types

`scripts/pf2e/build-types.mjs` writes the schemas in `content-types/`, one JSON file per type:

```bash
node scripts/pf2e/build-types.mjs
```

Edit the script, not the JSON files. The script is temporary: system definitions are meant to end up as plain files loaded by shared CLI tools (the authoring CLI in `TODO.md`), and then the JSON files become the source and the script goes. In the files, a `content` field's `contentTypeId` is the target type's readable ID (for example `pf2e-feat`). The loader creates the types in dependency order and swaps those for the real IDs.

| Type | Holds |
|---|---|
| `pf2e-ancestry`, `pf2e-heritage`, `pf2e-background` | Build choices: HP, size, speed, boosts, languages, trained skills |
| `pf2e-class`, `pf2e-class-feature` | A class's HP, key attributes, starting ranks, feature list, and feat levels; its features (doctrines and rackets are features too) |
| `pf2e-feat`, `pf2e-action`, `pf2e-spell`, `pf2e-deity`, `pf2e-item` | Rules content the character links to |
| `pf2e-character` | The player character (category `playerCharacter`) |

The character follows how Foundry's pf2e system stores one: it keeps the build choices and the play state (level, XP, attribute modifiers, proficiency ranks, HP, conditions, hero and focus points, spell slots, coins, biography), and links to its ancestry, class, feats, spells, and items instead of copying them. Ranks are stored on the character, since they grow with level. Every rules type ends with traits, rarity, rules text, and source.

## Sources and licenses

The schemas are designed from the data in the [Foundry VTT pf2e system](https://github.com/foundryvtt/pf2e) (its packs of ancestries, classes, feats, spells, items, and iconic characters). Its code is licensed under the Apache License 2.0; the game system information in it is Paizo's, licensed under the ORC License (Remaster) and the Open Game License 1.0a (earlier books). Only ORC-licensed Remaster content is imported.
