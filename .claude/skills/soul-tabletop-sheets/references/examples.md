# Worked examples

Each example is a content type schema (`json`), Sheet markup (`xml`, saved as `.stts`), and Sheet CSS (`css`).
All three compile with no errors against that schema (checked with `compileSheet` and `processSheetCss`; see
`checking.md`).

Examples 1 to 3 use a made-up rules system and store every number; example 4 is Pathfinder 2e and computes them with
formulas. Swap in the real field names from your content type's schema.
Example 1 also needs a second content type, `class`, described under it.

## 1. Player character sheet

Schema of the character content type. `class` is a `content` field pointing at a "Class" content type with
`hitDie` (number) and `primaryAbility` (string). `class-type` (the `contentTypeId` in the schema below) is a placeholder: in a real schema it is the UUID of that content type, and the `types` map in `schemas.json` (see `checking.md`) must use the same key.

```json
{
  "level": { "type": "number", "required": true },
  "class": { "type": "content", "contentTypeId": "class-type", "allow": "reference" },
  "background": { "type": "string" },
  "inspiration": { "type": "boolean" },
  "ac": { "type": "number", "label": "Armor Class" },
  "speed": { "type": "number" },
  "hp": {
    "type": "struct",
    "entries": {
      "current": { "type": "number", "required": true },
      "max": { "type": "number", "required": true }
    }
  },
  "abilities": {
    "type": "struct",
    "entries": {
      "str": { "type": "number", "label": "Strength" },
      "dex": { "type": "number", "label": "Dexterity" },
      "con": { "type": "number", "label": "Constitution" },
      "int": { "type": "number", "label": "Intelligence" },
      "wis": { "type": "number", "label": "Wisdom" },
      "cha": { "type": "number", "label": "Charisma" }
    }
  },
  "attacks": {
    "type": "array",
    "itemType": {
      "type": "struct",
      "entries": {
        "name": { "type": "string" },
        "bonus": { "type": "number" },
        "damage": { "type": "string" }
      }
    }
  },
  "languages": { "type": "array", "itemType": { "type": "string" } },
  "notes": { "type": "string", "label": "Notes" }
}
```

Markup. `display="box"` makes non-editable fields look like their inputs (a character sheet that looks the same in
view and edit mode); `live` keeps hit points editable in play; `locked` on the abilities makes each score need a
click on its pencil button first.

```xml
<Sheet display="box">
  <!-- Header: the class is a content field, so class.hitDie reads the referenced class -->
  <Stack direction="row" gap="md" wrap align="center">
    <Heading level="1">{/name}</Heading>
    <Badge>Level {level}</Badge>
    <Badge color="neutral">{class.name}</Badge>
  </Stack>

  <Grid cols="4">
    <Number field="ac" variant="stat" />
    <Number field="speed" variant="stat" />
    <Number field="class.hitDie" variant="stat" label="Hit Die" />
    <Checkbox field="inspiration" live />
  </Grid>

  <Section title="Hit Points" icon="i-lucide-heart">
    <Tracker field="hp.current" max="{hp.max}" live label="Current" />
    <Number field="hp.max" label="Maximum" />
  </Section>

  <Tabs>
    <Tab label="Abilities" icon="i-lucide-dumbbell">
      <Grid cols="3" locked>
        <Number field="abilities.str" variant="stat" />
        <Number field="abilities.dex" variant="stat" />
        <Number field="abilities.con" variant="stat" />
        <Number field="abilities.int" variant="stat" />
        <Number field="abilities.wis" variant="stat" />
        <Number field="abilities.cha" variant="stat" />
      </Grid>
    </Tab>

    <Tab label="Combat">
      <Table field="attacks">
        <Column field="name" />
        <Column field="bonus" width="xs" />
        <Column field="damage" />
      </Table>
    </Tab>

    <Tab label="Details">
      <Text field="background" />
      <Tags field="languages" />
      <Markdown field="notes" />
    </Tab>
  </Tabs>
</Sheet>
```

```css
:root {
  --sheet-accent: var(--st-primary);
}

.sheet-heading {
  font-family: "Cinzel", serif;
  color: var(--sheet-accent);
}

.sheet-section {
  border-left: 4px solid var(--sheet-accent);
}

.sheet-number {
  font-variant-numeric: tabular-nums;
}

@media print {
  .sheet-section {
    border-left-color: var(--st-ink-muted);
  }
}

@media (max-width: 640px) {
  .sheet-badge {
    font-size: 0.75rem;
  }
}
```

## 2. NPC stat block

Read-mostly (`Markdown` fields use `hideLabel` so the schema label, here "Text", does not repeat above each one): `display` is left at its default (text), and everything is `Value`, so nothing is an input.

```json
{
  "size": { "type": "string" },
  "creatureType": { "type": "string" },
  "cr": { "type": "string", "label": "Challenge" },
  "ac": { "type": "number", "label": "Armor Class" },
  "hp": { "type": "number", "label": "Hit Points" },
  "speed": { "type": "string" },
  "abilities": {
    "type": "struct",
    "entries": {
      "str": { "type": "number" },
      "dex": { "type": "number" },
      "con": { "type": "number" },
      "int": { "type": "number" },
      "wis": { "type": "number" },
      "cha": { "type": "number" }
    }
  },
  "traits": {
    "type": "array",
    "itemType": {
      "type": "struct",
      "entries": {
        "name": { "type": "string" },
        "text": { "type": "string" }
      }
    }
  },
  "actions": {
    "type": "array",
    "itemType": {
      "type": "struct",
      "entries": {
        "name": { "type": "string" },
        "text": { "type": "string" },
        "attackBonus": { "type": "number" }
      }
    }
  }
}
```

```xml
<Sheet class="statblock">
  <Heading level="2">{/name}</Heading>
  <Note>{size} {creatureType}</Note>
  <Divider />

  <Stack gap="sm">
    <Value field="ac" />
    <Value field="hp" />
    <Value field="speed" />
    <Value field="cr" />
  </Stack>
  <Divider />

  <Grid cols="6" gap="sm">
    <Value field="abilities.str" label="STR" />
    <Value field="abilities.dex" label="DEX" />
    <Value field="abilities.con" label="CON" />
    <Value field="abilities.int" label="INT" />
    <Value field="abilities.wis" label="WIS" />
    <Value field="abilities.cha" label="CHA" />
  </Grid>
  <Divider />

  <List field="traits">
    <Heading level="4">{name}</Heading>
    <Markdown field="text" hideLabel />
  </List>

  <Heading level="3">Actions</Heading>
  <List field="actions">
    <Collapsible title="{name}" subtitle="+{attackBonus} to hit" open>
      <Markdown field="text" hideLabel />
    </Collapsible>
  </List>
</Sheet>
```

```css
.statblock {
  background: color-mix(in oklab, var(--st-primary) 6%, var(--st-panel));
  border: 2px solid var(--st-primary);
  padding: 1rem;
  font-family: "Crimson Pro", serif;
}

.statblock .sheet-heading {
  font-family: "IM Fell English", serif;
  color: var(--st-primary);
}

.statblock .sheet-divider {
  opacity: 0.6;
}
```

## 3. Spell or item card

A compact card. Shows a `Callout` filled from a field with `{path}`, and `List field="."` over an array of strings.

```json
{
  "level": { "type": "number", "required": true },
  "school": { "type": "string" },
  "castingTime": { "type": "string" },
  "range": { "type": "string" },
  "duration": { "type": "string" },
  "concentration": { "type": "boolean" },
  "classes": { "type": "array", "itemType": { "type": "string" } },
  "description": { "type": "string" },
  "higherLevels": { "type": "string", "label": "At Higher Levels" }
}
```

```xml
<Section class="spell-card" title="{/name}" description="Level {level} {school}">
  <Grid cols="3" gap="sm">
    <Value field="castingTime" />
    <Value field="range" />
    <Value field="duration" />
  </Grid>
  <Checkbox field="concentration" />
  <Divider label="Effect" />
  <Markdown field="description" hideLabel />
  <Callout color="warning" icon="i-lucide-arrow-up" title="Higher levels">{higherLevels}</Callout>
  <Divider label="Classes" />
  <Stack direction="row" wrap gap="sm">
    <List field="classes" layout="grid" cols="4">
      <Badge color="neutral">{.}</Badge>
    </List>
  </Stack>
</Section>
```

```css
.spell-card {
  max-width: 28rem;
  margin-inline: auto;
}

.spell-card .sheet-callout {
  font-size: 0.875rem;
}

@media print {
  .spell-card {
    box-shadow: 0 0 0 1px var(--st-border-strong);
  }
}
```

## 4. Pathfinder 2e character sheet (formulas)

A Pathfinder 2e (Remaster) character whose derived numbers are all formulas: attribute modifiers are stored
directly, proficiency is level + 2/4/6/8 by rank (untrained adds nothing), and `<Define>`s keep that rule in one place.
It shows an override (`ac`: computed, but a player can type a value and reset it), a computed `Tracker` maximum, a
`show` on a tab, per-item sums over an inventory, and a formula column. Ranks are stored as text (`untrained`,
`trained`, `expert`, `master`, `legendary`). `pf2e-item` is a placeholder for the Item content type's UUID. The copy
the tests compile is `shared/sheet/fixtures/pathfinder2e.ts`; keep this one in sync with it.

Character schema:

```json
{
  "level": {
    "type": "number",
    "required": true
  },
  "keyAttribute": {
    "type": "string",
    "label": "Key Attribute"
  },
  "attributes": {
    "type": "struct",
    "entries": {
      "str": {
        "type": "number"
      },
      "dex": {
        "type": "number"
      },
      "con": {
        "type": "number"
      },
      "int": {
        "type": "number"
      },
      "wis": {
        "type": "number"
      },
      "cha": {
        "type": "number"
      }
    }
  },
  "perceptionRank": {
    "type": "string"
  },
  "classDcRank": {
    "type": "string"
  },
  "saves": {
    "type": "struct",
    "entries": {
      "fortitude": {
        "type": "struct",
        "entries": {
          "rank": {
            "type": "string"
          }
        }
      },
      "reflex": {
        "type": "struct",
        "entries": {
          "rank": {
            "type": "string"
          }
        }
      },
      "will": {
        "type": "struct",
        "entries": {
          "rank": {
            "type": "string"
          }
        }
      }
    }
  },
  "skills": {
    "type": "struct",
    "entries": {
      "athletics": {
        "type": "struct",
        "entries": {
          "rank": {
            "type": "string"
          }
        }
      },
      "stealth": {
        "type": "struct",
        "entries": {
          "rank": {
            "type": "string"
          }
        }
      }
    }
  },
  "armor": {
    "type": "struct",
    "entries": {
      "rank": {
        "type": "string"
      },
      "dexCap": {
        "type": "number"
      },
      "itemBonus": {
        "type": "number"
      },
      "strength": {
        "type": "number"
      }
    }
  },
  "ac": {
    "type": "number",
    "label": "AC"
  },
  "speed": {
    "type": "number"
  },
  "hp": {
    "type": "struct",
    "entries": {
      "current": {
        "type": "number"
      },
      "ancestry": {
        "type": "number"
      },
      "classPerLevel": {
        "type": "number"
      },
      "bonus": {
        "type": "number"
      }
    }
  },
  "spellcasting": {
    "type": "struct",
    "entries": {
      "tradition": {
        "type": "string"
      },
      "attribute": {
        "type": "string"
      },
      "rank": {
        "type": "string"
      }
    }
  },
  "inventory": {
    "type": "array",
    "itemType": {
      "type": "struct",
      "entries": {
        "item": {
          "type": "content",
          "contentTypeId": "pf2e-item",
          "allow": "both"
        },
        "qty": {
          "type": "number"
        }
      }
    }
  }
}
```

Item schema (`pf2e-item`; light bulk is stored as 0.1, so `floor` turns ten L items into 1 Bulk):

```json
{
  "bulk": {
    "type": "number"
  }
}
```

Markup:

```xml
<Sheet>
  <Define name="prof" params="rank"
          formula="if(rank == 'untrained' or rank == null, 0, level + switch(rank, 'trained', 2, 'expert', 4, 'master', 6, 'legendary', 8, 0))" />
  <Define name="check" params="attr, rank" formula="get(attributes, attr) + prof(rank)" />
  <Define name="classDc" formula="10 + get(attributes, keyAttribute) + prof(classDcRank)" />

  <Section title="{name}" description="Level {level}">
    <Grid cols="6">
      <Number field="attributes.str" label="Str" format="signed" variant="stat" />
      <Number field="attributes.dex" label="Dex" format="signed" variant="stat" />
      <Number field="attributes.con" label="Con" format="signed" variant="stat" />
      <Number field="attributes.int" label="Int" format="signed" variant="stat" />
      <Number field="attributes.wis" label="Wis" format="signed" variant="stat" />
      <Number field="attributes.cha" label="Cha" format="signed" variant="stat" />
    </Grid>
  </Section>

  <Grid cols="4">
    <Number field="ac" label="AC" variant="stat"
            formula="10 + min(attributes.dex, coalesce(armor.dexCap, 99)) + prof(armor.rank) + coalesce(armor.itemBonus, 0)" />
    <Value formula="check('wis', perceptionRank)" label="Perception" format="signed" />
    <Number formula="classDc()" label="Class DC" variant="stat" />
    <Badge>Speed {= speed - if(armor.strength != null and armor.strength > attributes.str, 5, 0)} ft</Badge>
  </Grid>

  <Tracker field="hp.current" label="Hit Points" live
           max="{= hp.ancestry + (hp.classPerLevel + attributes.con) * level + coalesce(hp.bonus, 0)}" />

  <Tabs>
    <Tab label="Saves and Skills">
      <Grid cols="3">
        <Value formula="check('con', saves.fortitude.rank)" label="Fortitude" format="signed" />
        <Value formula="check('dex', saves.reflex.rank)" label="Reflex" format="signed" />
        <Value formula="check('wis', saves.will.rank)" label="Will" format="signed" />
        <Value formula="check('str', skills.athletics.rank)" label="Athletics" format="signed" />
        <Value formula="check('dex', skills.stealth.rank)" label="Stealth" format="signed" />
      </Grid>
    </Tab>
    <Tab label="Spells" show="{= spellcasting.tradition != null}">
      <Number formula="10 + get(attributes, spellcasting.attribute) + prof(spellcasting.rank)" label="Spell DC" variant="stat" />
      <Value formula="get(attributes, spellcasting.attribute) + prof(spellcasting.rank)" label="Spell Attack" format="signed" />
    </Tab>
    <Tab label="Inventory">
      <Table field="inventory">
        <Column field="item" />
        <Column field="qty" />
        <Column formula="qty * coalesce(item.bulk, 0)" label="Bulk" />
      </Table>
      <Value formula="floor(sum(inventory, qty * coalesce(item.bulk, 0)))" label="Bulk Carried" />
      <Note show="{= sum(inventory, qty * coalesce(item.bulk, 0)) > 5 + attributes.str}">Encumbered</Note>
    </Tab>
  </Tabs>
</Sheet>
```

Notes:
- `prof(rank)` is called with a value, so it works from anywhere: definitions run against the top level, and `level`
  inside it is the character's level.
- `get(attributes, keyAttribute)` reads the attribute a text field names (`'dex'`); `check('wis', perceptionRank)`
  passes the name in.
- The Speed badge is written as `armor.strength > attributes.str` rather than with `<`, which in text would break the
  editor's colors.
- No CSS: the default look is enough here.
