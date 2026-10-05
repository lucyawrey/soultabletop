// Writes the PF2e demo content type files in content-types/. A `content`
// field's `contentTypeId` holds the target type's readable ID here; the import
// script swaps in the real UUID. Run: node .claude/pf2e/build-types.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const choice = (type, values) => ({
  type,
  options: values.map(([value, label]) => (label ? { value, label } : { value })),
});
const str = (label, extra = {}) => ({ type: "string", label, ...extra });
const num = (label, extra = {}) => ({ type: "number", label, ...extra });
const list = (label, itemType) => ({ type: "array", label, itemType });
const ref = (label, contentTypeId) => ({ type: "content", label, contentTypeId, allow: "reference" });

const attributes = [["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"], ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]];
const attribute = (label) => ({ ...choice("string", attributes), label });
const rank = (label) => ({ ...choice("number", [[0, "Untrained"], [1, "Trained"], [2, "Expert"], [3, "Master"], [4, "Legendary"]]), label, default: 0 });
const skills = ["acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy", "intimidation", "medicine", "nature", "occultism", "performance", "religion", "society", "stealth", "survival", "thievery"];
const skill = (label) => ({ ...choice("string", skills.map((s) => [s, s[0].toUpperCase() + s.slice(1)])), label });
const actions = (label) => ({
  ...choice("string", [["passive", "Passive"], ["1", "One action"], ["2", "Two actions"], ["3", "Three actions"], ["free", "Free action"], ["reaction", "Reaction"]]),
  label,
});
const rarity = { ...choice("string", [["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"], ["unique", "Unique"]]), label: "Rarity", default: "common" };

// Every imported type ends with these: traits, rarity, rules text, and where
// it came from (shown in the system's credits).
const common = {
  traits: list("Traits", { type: "string" }),
  rarity,
  description: str("Description", { description: "Rules text, in Markdown." }),
  source: str("Source", { description: "The book it was published in." }),
};

const types = {
  "pf2e-ancestry": {
    name: "Ancestry",
    schema: {
      hp: num("Hit Points", { required: true }),
      size: { ...choice("string", [["tiny", "Tiny"], ["sm", "Small"], ["med", "Medium"], ["lg", "Large"]]), label: "Size", default: "med" },
      speed: num("Speed", { default: 25 }),
      boosts: list("Attribute Boosts", { type: "struct", entries: { choices: list("Choices", attribute("Attribute")) } }),
      flaws: list("Attribute Flaws", attribute("Attribute")),
      languages: list("Languages", { type: "string" }),
      additionalLanguages: num("Additional Languages", { default: 0 }),
      vision: { ...choice("string", [["normal", "Normal"], ["low-light-vision", "Low-Light Vision"], ["darkvision", "Darkvision"]]), label: "Vision", default: "normal" },
      ...common,
    },
  },
  "pf2e-heritage": {
    name: "Heritage",
    schema: {
      ancestry: { ...ref("Ancestry", "pf2e-ancestry"), description: "Empty for a versatile heritage, which any ancestry can take." },
      ...common,
    },
  },
  "pf2e-background": {
    name: "Background",
    schema: {
      boosts: list("Attribute Boosts", { type: "struct", entries: { choices: list("Choices", attribute("Attribute")) } }),
      trainedSkills: list("Trained Skills", skill("Skill")),
      trainedLore: str("Trained Lore"),
      skillFeat: ref("Skill Feat", "pf2e-feat"),
      ...common,
    },
  },
  "pf2e-class-feature": {
    name: "Class Feature",
    schema: {
      level: num("Level", { default: 1 }),
      actions: { ...actions("Actions"), default: "passive" },
      ...common,
    },
  },
  "pf2e-class": {
    name: "Class",
    schema: {
      hp: num("Hit Points per Level", { required: true }),
      keyAttributes: list("Key Attribute Options", attribute("Attribute")),
      perception: rank("Perception"),
      saves: { type: "struct", label: "Saving Throws", entries: { fortitude: rank("Fortitude"), reflex: rank("Reflex"), will: rank("Will") } },
      trainedSkills: list("Trained Skills", skill("Skill")),
      additionalSkills: num("Additional Trained Skills", { default: 0 }),
      attacks: {
        type: "struct",
        label: "Attacks",
        entries: { unarmed: rank("Unarmed"), simple: rank("Simple Weapons"), martial: rank("Martial Weapons"), advanced: rank("Advanced Weapons"), other: str("Other") },
      },
      defenses: {
        type: "struct",
        label: "Defenses",
        entries: { unarmored: rank("Unarmored"), light: rank("Light Armor"), medium: rank("Medium Armor"), heavy: rank("Heavy Armor") },
      },
      classDc: rank("Class DC"),
      spellcasting: rank("Spellcasting"),
      features: list("Class Features", { type: "struct", entries: { level: num("Level", { required: true }), feature: ref("Feature", "pf2e-class-feature") } }),
      ancestryFeatLevels: list("Ancestry Feat Levels", { type: "number" }),
      classFeatLevels: list("Class Feat Levels", { type: "number" }),
      generalFeatLevels: list("General Feat Levels", { type: "number" }),
      skillFeatLevels: list("Skill Feat Levels", { type: "number" }),
      skillIncreaseLevels: list("Skill Increase Levels", { type: "number" }),
      ...common,
    },
  },
  "pf2e-feat": {
    name: "Feat",
    schema: {
      level: num("Level", { default: 1 }),
      category: {
        ...choice("string", [["ancestry", "Ancestry"], ["class", "Class"], ["general", "General"], ["skill", "Skill"], ["bonus", "Bonus"]]),
        label: "Category",
        required: true,
      },
      actions: { ...actions("Actions"), default: "passive" },
      prerequisites: list("Prerequisites", { type: "string" }),
      ...common,
    },
  },
  "pf2e-spell": {
    name: "Spell",
    schema: {
      rank: num("Rank", { required: true, description: "0 for a cantrip." }),
      kind: { ...choice("string", [["spell", "Spell"], ["cantrip", "Cantrip"], ["focus", "Focus"], ["ritual", "Ritual"]]), label: "Kind", default: "spell" },
      traditions: list("Traditions", choice("string", [["arcane", "Arcane"], ["divine", "Divine"], ["occult", "Occult"], ["primal", "Primal"]])),
      cast: str("Cast", { description: "Actions (1, 2, 3, 1 to 3, reaction, free) or a time such as 10 minutes." }),
      range: str("Range"),
      area: str("Area"),
      targets: str("Targets"),
      defense: str("Defense", { description: "For example basic Reflex, or AC." }),
      duration: str("Duration"),
      damage: str("Damage", { description: "Dice and type, for example 2d4 fire." }),
      heightened: str("Heightened", { description: "For example +1: 1d8, in Markdown." }),
      ...common,
    },
  },
  "pf2e-deity": {
    name: "Deity",
    schema: {
      category: { ...choice("string", [["deity", "Deity"], ["pantheon", "Pantheon"], ["philosophy", "Philosophy"]]), label: "Category", default: "deity" },
      font: list("Divine Font", choice("string", [["heal", "Heal"], ["harm", "Harm"]])),
      sanctification: str("Sanctification", { description: "For example can choose holy." }),
      attributes: list("Divine Attributes", attribute("Attribute")),
      skill: skill("Divine Skill"),
      favoredWeapon: str("Favored Weapon"),
      domains: list("Domains", { type: "string" }),
      alternateDomains: list("Alternate Domains", { type: "string" }),
      clericSpells: list("Cleric Spells", { type: "struct", entries: { rank: num("Rank", { required: true }), spell: ref("Spell", "pf2e-spell") } }),
      edicts: str("Edicts"),
      anathema: str("Anathema"),
      ...common,
    },
  },
  "pf2e-item": {
    name: "Item",
    schema: {
      kind: {
        ...choice("string", [["weapon", "Weapon"], ["armor", "Armor"], ["shield", "Shield"], ["consumable", "Consumable"], ["gear", "Gear"], ["container", "Container"], ["ammo", "Ammunition"], ["treasure", "Treasure"]]),
        label: "Kind",
        required: true,
      },
      level: num("Level", { default: 0 }),
      price: num("Price (cp)", { description: "In copper pieces: 1 gp is 100 cp." }),
      bulk: num("Bulk", { description: "0.1 is light (L), 0 is negligible." }),
      usage: str("Usage", { description: "For example held in one hand, worn." }),
      weapon: {
        type: "struct",
        label: "Weapon",
        entries: {
          category: { ...choice("string", [["unarmed", "Unarmed"], ["simple", "Simple"], ["martial", "Martial"], ["advanced", "Advanced"]]), label: "Category" },
          group: str("Group"),
          damageDice: num("Damage Dice", { default: 1 }),
          damageDie: { ...choice("string", [["d4"], ["d6"], ["d8"], ["d10"], ["d12"]]), label: "Damage Die" },
          damageType: { ...choice("string", [["bludgeoning", "Bludgeoning"], ["piercing", "Piercing"], ["slashing", "Slashing"]]), label: "Damage Type" },
          range: num("Range Increment", { description: "In feet; empty for melee." }),
          reload: str("Reload"),
          hands: str("Hands", { description: "1, 1+, or 2." }),
        },
      },
      armor: {
        type: "struct",
        label: "Armor",
        entries: {
          category: { ...choice("string", [["unarmored", "Unarmored"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]]), label: "Category" },
          group: str("Group"),
          acBonus: num("AC Bonus"),
          dexCap: num("Dex Cap"),
          checkPenalty: num("Check Penalty"),
          speedPenalty: num("Speed Penalty"),
          strength: num("Strength", { description: "The Strength modifier that removes the check penalty." }),
        },
      },
      shield: {
        type: "struct",
        label: "Shield",
        entries: { acBonus: num("AC Bonus"), hardness: num("Hardness"), hp: num("Hit Points"), brokenThreshold: num("Broken Threshold") },
      },
      container: {
        type: "struct",
        label: "Container",
        entries: { capacity: num("Capacity (Bulk)"), ignored: num("Bulk Ignored") },
      },
      ...common,
    },
  },
};

mkdirSync(new URL("content-types/", import.meta.url), { recursive: true });
for (const [readableId, { name, schema }] of Object.entries(types)) {
  const file = { readableId, name, contentCategory: "general", hasStrictSchema: true, schema };
  writeFileSync(new URL(`content-types/${readableId}.json`, import.meta.url), JSON.stringify(file, null, 2) + "\n");
}
console.log(Object.keys(types).join(" "));
