# Worked examples

Each example is a content type schema (`json`), Sheet markup (`xml`, saved as `.stts`), and Sheet CSS (`css`).
All three compile with no errors against that schema (checked with `compileSheet` and `processSheetCss`; see
`checking.md`).

The examples use a made-up rules system: swap in the real field names from your content type's schema.
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
