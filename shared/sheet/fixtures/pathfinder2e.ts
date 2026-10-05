// The Pathfinder 2e (Remaster) example from docs/sheet-system.md and the
// Sheets skill: a character content type, an item type, and a sheet using
// every formula feature. Tests check that it compiles cleanly; keep the docs'
// copies in sync with it.

import type { ContentTypeSchema } from "../../content-schema";
import type { SheetSchemas } from "../validate";

const rank = { type: "string" } as const;
const ranked = { type: "struct", entries: { rank } } as const;

export const pathfinder2eCharacter: ContentTypeSchema = {
  level: { type: "number", required: true },
  keyAttribute: { type: "string", label: "Key Attribute" },
  attributes: {
    type: "struct",
    entries: {
      str: { type: "number" },
      dex: { type: "number" },
      con: { type: "number" },
      int: { type: "number" },
      wis: { type: "number" },
      cha: { type: "number" },
    },
  },
  perceptionRank: rank,
  classDcRank: rank,
  saves: { type: "struct", entries: { fortitude: ranked, reflex: ranked, will: ranked } },
  skills: { type: "struct", entries: { athletics: ranked, stealth: ranked } },
  armor: {
    type: "struct",
    entries: {
      rank,
      dexCap: { type: "number" },
      itemBonus: { type: "number" },
      strength: { type: "number" },
    },
  },
  ac: { type: "number", label: "AC" },
  speed: { type: "number" },
  hp: {
    type: "struct",
    entries: {
      current: { type: "number" },
      ancestry: { type: "number" },
      classPerLevel: { type: "number" },
      bonus: { type: "number" },
    },
  },
  spellcasting: {
    type: "struct",
    entries: { tradition: { type: "string" }, attribute: { type: "string" }, rank },
  },
  inventory: {
    type: "array",
    itemType: {
      type: "struct",
      entries: {
        item: { type: "content", contentTypeId: "pf2e-item", allow: "both" },
        qty: { type: "number" },
      },
    },
  },
};

export const pathfinder2eItem: ContentTypeSchema = {
  // Light bulk is 0.1, so ten L items make 1 Bulk.
  bulk: { type: "number" },
};

export const pathfinder2eSchemas: SheetSchemas = {
  root: { hasStrictSchema: true, schema: pathfinder2eCharacter },
  types: { "pf2e-item": { hasStrictSchema: true, schema: pathfinder2eItem } },
};

export const pathfinder2eMarkup = `<Sheet>
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
    <Badge>Speed {speed - if(armor.strength != null and armor.strength > attributes.str, 5, 0)} ft</Badge>
  </Grid>

  <Tracker field="hp.current" label="Hit Points" live
           max="{hp.ancestry + (hp.classPerLevel + attributes.con) * level + coalesce(hp.bonus, 0)}" />

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
    <Tab label="Spells" show="length(spellcasting.tradition) > 0">
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
      <Note show="sum(inventory, qty * coalesce(item.bulk, 0)) > 5 + attributes.str">Encumbered</Note>
    </Tab>
  </Tabs>
</Sheet>
`;
