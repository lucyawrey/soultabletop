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

The character keeps the build choices and the play state (level, XP, attribute modifiers, proficiency ranks, HP, conditions, hero and focus points, spell slots, coins, biography), and links to its ancestry, class, feats, spells, and items instead of copying them. Ranks are stored on the character, since they grow with level. Every rules type ends with traits, rarity, rules text, and source.

## Content

`content/<type>/<readable-id>.json` holds one resource each: `{ name, readableId, data }`. Readable IDs start with the type (`feat-shield-block`, `spell-heal`), so names can't collide across types. A reference to other content holds its readable ID. `system.json` names the system, its owner (the `soul` group, so it's Official), and its visibility.

`scripts/pf2e/convert.mjs` writes these files from a local checkout of the Foundry pf2e data; it only reads that checkout and never clones or updates it. `scripts/pf2e/slice.json` lists what's converted: the demo slice, built around the iconics Kyra (cleric) and Merisiel (rogue) at 1st level. Only ORC-licensed Remaster items are converted, and their rules text becomes Markdown.

```bash
node scripts/pf2e/convert.mjs ~/Developer/foundry-pf2e
```

Like the type builder, the converter is temporary: the files are the system, and they're edited directly once the authoring CLI exists.

## Loading

`scripts/load-system.mjs` loads the folder into the app through the API with a read-write `SOUL_TABLETOP_API_KEY` (a site admin's key, to create resources for the `soul` group). It creates what's missing and updates what exists, matched by owner and readable ID, so it can be rerun:

```bash
node --env-file=.env.local scripts/load-system.mjs systems/pf2e --url http://localhost:3000
```

## Sources and licenses

The schemas are our own design. The [Foundry VTT pf2e system](https://github.com/foundryvtt/pf2e) is a data source: its packs are where the imported content comes from, and they were read to learn what each type needs to hold, but its data model isn't followed. Its code is licensed under the Apache License 2.0; the game system information in it is Paizo's, licensed under the ORC License (Remaster) and the Open Game License 1.0a (earlier books). Only ORC-licensed Remaster content is imported.
