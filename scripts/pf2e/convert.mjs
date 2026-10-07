// Converts the demo slice of the Foundry VTT pf2e data into our content files
// in systems/pf2e/content/<type>/<readable-id>.json. Foundry is only a data
// source: each item is mapped onto our content types, and nothing of
// Foundry's structure (IDs, field names, item shapes) is kept.
//   node scripts/pf2e/convert.mjs [path to the foundryvtt/pf2e checkout]
// The checkout defaults to ~/Developer/foundry-pf2e. scripts/pf2e/slice.json
// lists the pack files to convert. Only ORC-licensed Remaster items are
// converted. References to items outside the slice are left empty, with a
// warning. Temporary, like build-types.mjs: once the authoring CLI exists,
// the files it writes are the source.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const foundry = process.argv[2] ?? join(homedir(), "Developer", "foundry-pf2e");
const packs = join(foundry, "packs", "pf2e");
const outDir = new URL("../../systems/pf2e/content/", import.meta.url);
const slice = JSON.parse(readFileSync(new URL("slice.json", import.meta.url), "utf8"));

// Our readable ID prefix per content type, so names can't collide across
// types (readable IDs are unique per owner across all content).
const prefixes = {
  "pf2e-ancestry": "ancestry",
  "pf2e-heritage": "heritage",
  "pf2e-background": "background",
  "pf2e-class": "class",
  "pf2e-class-feature": "feature",
  "pf2e-feat": "feat",
  "pf2e-action": "action",
  "pf2e-spell": "spell",
  "pf2e-deity": "deity",
  "pf2e-item": "item",
};

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const warnings = [];
const warn = (message) => warnings.push(message);

// Every slice item, read once: its name gives its readable ID, which is how
// other items reference it.
const items = [];
for (const [type, files] of Object.entries(slice)) {
  if (type === "comment") continue;
  for (const file of files) {
    const source = JSON.parse(readFileSync(join(packs, file), "utf8"));
    const publication = source.system.publication ?? {};
    if (publication.license !== "ORC" || !publication.remaster) {
      warn(`${file}: skipped, not ORC Remaster (${publication.license})`);
      continue;
    }
    items.push({ type, file, source, readableId: `${prefixes[type]}-${slugify(source.name)}` });
  }
}
// Look up an item in the slice by type and name (Foundry references name
// their target, by UUID or by name), giving its readable ID.
const byName = new Map(items.map((item) => [`${item.type}:${item.source.name.toLowerCase()}`, item.readableId]));
function refByName(type, name, from) {
  if (!name) return undefined;
  const found = byName.get(`${type}:${name.toLowerCase()}`);
  if (!found) warn(`${from}: ${type} "${name}" is not in the slice; left empty`);
  return found;
}
// A Foundry UUID ends with the target's name or ID; names are what we match.
const uuidName = (uuid) => (uuid ? uuid.split(".").at(-1) : undefined);

// Foundry's rules text is HTML with inline codes; ours is Markdown.
const glyphs = { 1: "◆", 2: "◆◆", 3: "◆◆◆", r: "↺", f: "◇" };
function markdown(html) {
  if (!html) return undefined;
  let text = html
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/@UUID\[([^\]]*)\]/g, (_, uuid) => uuidName(uuid))
    .replace(/@Damage\[((?:[^[\]]|\[[^\]]*\])*)\](?:\{([^}]*)\})?/g, (_, inner, label) =>
      label ?? inner.replace(/[()]/g, "").replace(/\[([^\]]*)\]/g, " $1").replace(/,/g, ", "),
    )
    .replace(/@Check\[([^\]]*)\](?:\{([^}]*)\})?/g, (_, inner, label) => {
      if (label) return label;
      const [stat, ...rest] = inner.split("|");
      const dc = rest.find((part) => part.startsWith("dc:"))?.slice(3);
      const name = stat.replace(/^type:/, "");
      const titled = name.charAt(0).toUpperCase() + name.slice(1);
      return dc && /^\d+$/.test(dc) ? `DC ${dc} ${titled}` : `${titled} check`;
    })
    .replace(/@Template\[([^\]]*)\](?:\{([^}]*)\})?/g, (_, inner, label) => {
      if (label) return label;
      const [shape, ...rest] = inner.replace(/^type:/, "").split("|");
      const distance = rest.find((part) => part.startsWith("distance:"))?.slice(9);
      return distance ? `${distance}-foot ${shape}` : shape;
    })
    .replace(/@Localize\[[^\]]*\]/g, "")
    .replace(/\[\[\/[a-z]+ ([^\]]*)\]\](?:\{([^}]*)\})?/g, (_, roll, label) => label ?? roll.replace(/[#{].*$/, "").trim())
    .replace(/<span class="action-glyph">([^<]*)<\/span>/g, (_, code) => glyphs[code.trim().toLowerCase()] ?? code)
    .replace(/<hr\s*\/?>/g, "\n\n---\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<(strong|b)>(.*?)<\/\1>/g, "**$2**")
    .replace(/<(em|i)>(.*?)<\/\1>/g, "*$2*")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, "\n\n**$1**\n\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/(p|ul|ol|table|tr)>/g, "\n\n")
    .replace(/<\/t[dh]>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || undefined;
}

const values = (field) => field?.value ?? [];
const nonEmpty = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)));
const boosts = (field) =>
  Object.values(field ?? {})
    .map((boost) => boost.value ?? [])
    .filter((choices) => choices.length)
    .map((choices) => ({ choices }));
const actionsOf = (system) => {
  const type = system.actionType?.value;
  if (type === "action") return String(system.actions?.value ?? 1);
  return type ?? "passive";
};
const priceCp = (price) => {
  const value = price?.value ?? {};
  const cp = (value.pp ?? 0) * 1000 + (value.gp ?? 0) * 100 + (value.sp ?? 0) * 10 + (value.cp ?? 0);
  return cp || undefined;
};
const bulkOf = (bulk) => (bulk ? bulk.value : undefined);
// Foundry's slugs ("deadly-d8", "held-in-one-hand") become readable text
// ("Deadly d8", "Held in one hand").
const titled = (text) => {
  if (!text) return undefined;
  const words = String(text).replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Shared by every rules type: traits, rarity, rules text, and source book.
const common = (source) =>
  nonEmpty({
    traits: values(source.system.traits).map(titled),
    rarity: source.system.traits?.rarity ?? "common",
    description: markdown(source.system.description?.value),
    source: source.system.publication?.title,
  });

const converters = {
  "pf2e-ancestry": ({ system: s }) => ({
    hp: s.hp,
    size: s.size,
    speed: s.speed,
    boosts: boosts(s.boosts),
    flaws: boosts(s.flaws).flatMap((boost) => boost.choices),
    languages: values(s.languages).map(titled),
    additionalLanguages: s.additionalLanguages?.count ?? 0,
    vision: s.vision,
  }),
  "pf2e-heritage": ({ system: s }, from) => ({ ancestry: refByName("pf2e-ancestry", s.ancestry?.name, from) }),
  "pf2e-background": ({ system: s }, from) => ({
    boosts: boosts(s.boosts),
    trainedSkills: values(s.trainedSkills),
    trainedLore: (s.trainedSkills?.lore ?? [])[0],
    skillFeat: refByName("pf2e-feat", Object.values(s.items ?? {})[0]?.name, from),
  }),
  "pf2e-class": ({ system: s }, from) => ({
    hp: s.hp,
    keyAttributes: values(s.keyAbility),
    perception: s.perception,
    saves: s.savingThrows,
    trainedSkills: values(s.trainedSkills),
    additionalSkills: s.trainedSkills?.additional ?? 0,
    attacks: nonEmpty({ unarmed: s.attacks?.unarmed, simple: s.attacks?.simple, martial: s.attacks?.martial, advanced: s.attacks?.advanced, other: s.attacks?.other?.name }),
    defenses: s.defenses,
    // Every class starts trained in its class DC; Foundry's data leaves it out.
    classDc: 1,
    spellcasting: s.spellcasting,
    // Only the features in the slice; the rest are left out for now.
    features: Object.values(s.items ?? {})
      .sort((a, b) => a.level - b.level)
      .filter((feature) => byName.has(`pf2e-class-feature:${feature.name.toLowerCase()}`))
      .map((feature) => ({ level: feature.level, feature: refByName("pf2e-class-feature", feature.name, from) })),
    ancestryFeatLevels: values(s.ancestryFeatLevels),
    classFeatLevels: values(s.classFeatLevels),
    generalFeatLevels: values(s.generalFeatLevels),
    skillFeatLevels: values(s.skillFeatLevels),
    skillIncreaseLevels: values(s.skillIncreaseLevels),
  }),
  "pf2e-class-feature": ({ system: s }) => ({ level: s.level?.value ?? 1, actions: actionsOf(s) }),
  "pf2e-feat": ({ system: s }) => ({
    level: s.level?.value ?? 1,
    category: s.category,
    actions: actionsOf(s),
    prerequisites: values(s.prerequisites).map((prerequisite) => prerequisite.value),
  }),
  "pf2e-action": ({ system: s }) => ({ actions: actionsOf(s), category: s.category ?? undefined }),
  "pf2e-spell": ({ system: s }) => {
    const traits = values(s.traits);
    const kind = traits.includes("cantrip") ? "cantrip" : traits.includes("focus") ? "focus" : s.ritual ? "ritual" : "spell";
    const save = s.defense?.save;
    const damage = Object.values(s.damage ?? {})[0];
    return {
      rank: kind === "cantrip" ? 0 : (s.level?.value ?? 1),
      kind,
      traditions: s.traits?.traditions ?? [],
      cast: s.time?.value,
      range: s.range?.value,
      area: s.area ? `${s.area.value}-foot ${s.area.type}` : undefined,
      targets: s.target?.value,
      defense: save ? `${save.basic ? "basic " : ""}${titled(save.statistic)}` : s.defense?.passive ? titled(s.defense.passive.statistic) : undefined,
      duration: s.duration?.value ? `${s.duration.sustained ? "sustained, " : ""}${s.duration.value}` : undefined,
      damage: damage ? `${damage.formula} ${damage.type ?? ""}`.trim() : undefined,
    };
  },
  "pf2e-deity": ({ system: s }, from) => ({
    category: s.category,
    font: s.font ?? [],
    sanctification: s.sanctification?.what?.length ? `${s.sanctification.modal === "must" ? "Must choose" : "Can choose"} ${s.sanctification.what.join(" or ")}` : undefined,
    attributes: s.attribute ?? [],
    skill: (s.skill ?? [])[0],
    favoredWeapon: titled((s.weapons ?? [])[0]),
    domains: s.domains?.primary ?? [],
    alternateDomains: s.domains?.alternate ?? [],
    clericSpells: Object.entries(s.spells ?? {})
      .map(([rank, uuid]) => ({ rank: Number(rank), spell: refByName("pf2e-spell", uuidName(uuid), from) }))
      .filter((entry) => entry.spell),
  }),
  "pf2e-item": ({ type, system: s }) => {
    const kinds = { weapon: "weapon", armor: "armor", shield: "shield", consumable: "consumable", equipment: "gear", backpack: "container", ammo: "ammo", treasure: "treasure" };
    return {
      kind: kinds[type] ?? "gear",
      level: s.level?.value ?? 0,
      price: priceCp(s.price),
      bulk: bulkOf(s.bulk),
      usage: titled(s.usage?.value),
      weapon:
        type === "weapon"
          ? nonEmpty({
              category: s.category,
              group: titled(s.group),
              damageDice: s.damage?.dice,
              damageDie: s.damage?.die,
              damageType: s.damage?.damageType,
              range: s.range ?? undefined,
              reload: s.reload?.value ?? undefined,
            })
          : undefined,
      armor:
        type === "armor"
          ? nonEmpty({ category: s.category, group: titled(s.group), acBonus: s.acBonus, dexCap: s.dexCap, checkPenalty: s.checkPenalty, speedPenalty: s.speedPenalty, strength: s.strength })
          : undefined,
      shield: type === "shield" ? { acBonus: s.acBonus, hardness: s.hardness, hp: s.hp?.max, brokenThreshold: Math.floor((s.hp?.max ?? 0) / 2) } : undefined,
      container: type === "backpack" ? nonEmpty({ capacity: s.bulk?.capacity, ignored: s.bulk?.ignored }) : undefined,
    };
  },
};


rmSync(outDir, { recursive: true, force: true });
for (const item of items) {
  const convert = converters[item.type];
  const from = item.file;
  const own = item.type === "pf2e-item" ? convert({ type: item.source.type, system: item.source.system }, from) : convert(item.source, from);
  const data = nonEmpty({ ...own, ...common(item.source) });
  const dir = new URL(`${item.type}/`, outDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`${item.readableId}.json`, dir), JSON.stringify({ name: item.source.name, readableId: item.readableId, data }, null, 2) + "\n");
}
console.log(`${items.length} files written to systems/pf2e/content/`);
for (const message of warnings) console.warn(`warning: ${message}`);
