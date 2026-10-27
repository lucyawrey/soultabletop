// Writes the Cairn content type files in systems/cairn/content-types/. A
// `content` field's `contentTypeId` holds the target type's readable ID there;
// the loader swaps in the real UUID. Run: node scripts/cairn/build-types.mjs
// Temporary: once the authoring CLI exists, the JSON files are the source.
import { mkdirSync, writeFileSync } from "node:fs";

const choice = (type, values) => ({
  type,
  options: values.map(([value, label]) => (label ? { value, label } : { value })),
});
const str = (label, extra = {}) => ({ type: "string", label, ...extra });
const num = (label, extra = {}) => ({ type: "number", label, ...extra });
const bool = (label, extra = {}) => ({ type: "boolean", label, ...extra });
const list = (label, itemType) => ({ type: "array", label, itemType });
const struct = (label, entries) => ({ type: "struct", label, entries });
const ref = (label, contentTypeId) => ({ type: "content", label, contentTypeId, allow: "both" });

// Slots an item takes: petty items take none, bulky items two.
const slots = { ...choice("number", [[0, "Petty"], [1, "1 slot"], [2, "Bulky"]]), label: "Slots", default: 1 };
// A d6 table a background asks the player to roll on. Rows with an item give
// its name; the rest are only a result.
const rollTable = struct("Table", {
  question: str("Question", { required: true }),
  rows: list("Rows", { type: "struct", entries: { item: str("Item"), result: str("Result", { description: "In Markdown." }) } }),
});

// Every imported type ends with its rules text and where it came from (shown
// in the system's credits).
const common = {
  description: str("Description", { description: "Rules text, in Markdown." }),
  source: str("Source", { description: "The book it was published in." }),
};

const types = {
  "cairn-item": {
    name: "Item",
    schema: {
      kind: {
        ...choice("string", [["weapon", "Weapon"], ["armor", "Armor"], ["gear", "Gear"], ["transport", "Transport"], ["relic", "Relic"]]),
        label: "Kind",
        default: "gear",
      },
      damage: str("Damage", { description: "Dice, such as d8 or d6+d6." }),
      armor: num("Armor", { description: "Armor it gives." }),
      slots,
      uses: num("Uses"),
      charges: num("Charges"),
      recharge: str("Recharge", { description: "What restores a relic's charges." }),
      capacity: num("Capacity", { description: "Extra slots a transport carries." }),
      cost: num("Cost", { description: "In gold pieces." }),
      ...common,
    },
  },
  "cairn-spellbook": {
    name: "Spellbook",
    schema: {
      effect: str("Effect", { required: true }),
      book: str("Book", { description: "What the book itself is like." }),
      ...common,
    },
  },
  "cairn-background": {
    name: "Background",
    schema: {
      intro: str("Intro"),
      names: list("Names", { type: "string" }),
      startingGear: list("Starting Gear", { type: "string" }),
      tables: list("Tables", rollTable),
      ...common,
    },
  },
  "cairn-monster": {
    name: "Monster",
    contentCategory: "nonPlayerCharacter",
    schema: {
      hp: num("Hit Protection", { required: true }),
      armor: num("Armor", { default: 0 }),
      str: num("Strength", { required: true }),
      dex: num("Dexterity", { required: true }),
      wil: num("Willpower", { required: true }),
      attacks: list("Attacks", {
        type: "struct",
        entries: {
          name: str("Name", { required: true }),
          damage: str("Damage"),
          blast: bool("Blast", { default: false }),
          notes: str("Notes"),
        },
      }),
      detachment: bool("Detachment", { default: false }),
      ...common,
    },
  },
  "cairn-character": {
    name: "Character",
    contentCategory: "playerCharacter",
    schema: {
      background: ref("Background", "cairn-background"),
      age: num("Age"),
      str: num("Strength", { default: 10 }),
      strMax: num("Max Strength", { default: 10 }),
      dex: num("Dexterity", { default: 10 }),
      dexMax: num("Max Dexterity", { default: 10 }),
      wil: num("Willpower", { default: 10 }),
      wilMax: num("Max Willpower", { default: 10 }),
      hp: num("Hit Protection", { default: 1 }),
      hpMax: num("Max Hit Protection", { default: 1 }),
      deprived: bool("Deprived", { default: false }),
      fatigue: num("Fatigue", { description: "Each Fatigue fills an inventory slot.", default: 0 }),
      gold: num("Gold", { default: 0 }),
      inventory: list("Inventory", {
        type: "struct",
        entries: {
          item: ref("Item", "cairn-item"),
          uses: num("Uses Left"),
          equipped: bool("Equipped", { default: false }),
          notes: str("Notes"),
        },
      }),
      spellbooks: list("Spellbooks", { ...ref("Spellbook", "cairn-spellbook"), label: "Spellbook" }),
      traits: struct("Traits", {
        physique: str("Physique"),
        skin: str("Skin"),
        hair: str("Hair"),
        face: str("Face"),
        speech: str("Speech"),
        clothing: str("Clothing"),
        virtue: str("Virtue"),
        vice: str("Vice"),
      }),
      bond: str("Bond"),
      omen: str("Omen"),
      scars: list("Scars", { type: "string" }),
      notes: str("Notes"),
    },
  },
};

const outDir = new URL("../../systems/cairn/content-types/", import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const [readableId, { name, contentCategory = "general", schema }] of Object.entries(types)) {
  const file = { readableId, name, contentCategory, hasStrictSchema: true, schema };
  writeFileSync(new URL(`${readableId}.json`, outDir), JSON.stringify(file, null, 2) + "\n");
}
console.log(Object.keys(types).join(" "));
