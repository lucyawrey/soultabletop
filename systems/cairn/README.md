# Cairn Second Edition

The official Cairn system as files: its content types and its converted content. This folder holds content only; the code that writes or loads it lives in `scripts/`. It follows the same layout as `systems/pf2e/` (see its README for the file formats and the loader).

> **TODO(team): license and attribution notice.** Cairn's text is licensed [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The files in `content/` are adapted from it and stay under that license, unlike the rest of this repository.

## Content types

`scripts/cairn/build-types.mjs` writes the schemas in `content-types/`:

```bash
node scripts/cairn/build-types.mjs
```

| Type | Holds |
|---|---|
| `cairn-item` | Weapons, armor, gear, transport, and relics: damage, Armor, slots (petty 0, bulky 2), uses, charges and recharge, carrying capacity, cost |
| `cairn-spellbook` | A spell's effect, and what the book itself is like |
| `cairn-background` | Intro, names, starting gear (as text), and its d6 tables |
| `cairn-monster` | Hit Protection, Armor, STR, DEX, WIL, attacks, and whether it's a detachment (category `nonPlayerCharacter`) |
| `cairn-character` | The player character (category `playerCharacter`): background, attributes and their maximums, Hit Protection, Fatigue, Deprived, gold, inventory, spellbooks, traits, bond, omen, scars |

Armor and filled slots aren't stored on the character; a sheet computes them from the inventory.

## Content

`scripts/cairn/convert.mjs` writes `content/<type>/<readable-id>.json` from a local checkout of the [Cairn site's source](https://github.com/yochaigal/cairn) (`second-edition/`): the Marketplace and the Reliquary as items, the Spellbooks table, the backgrounds, and the Bestiary. It only reads that checkout and never clones or updates it. Readable IDs start with `cairn-` and the type, so they can't collide with other systems owned by the same group.

```bash
node scripts/cairn/convert.mjs ~/Developer/cairn
```

Each weapon row of the Marketplace names several weapons that share a profile (for example "Dagger, Cudgel, Sickle, Staff"); each becomes its own item. Services, hirelings, and passage aren't items and are skipped.

## Loading

```bash
node --env-file=.env.local scripts/load-system.mjs systems/cairn --url http://localhost:3000
```
