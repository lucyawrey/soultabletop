// Two PF2e test characters (Kyra, cleric; Merisiel, rogue) owned by the API
// key's user, for checking the PF2e character sheet. Needs the Official
// `soul/pf2e` system loaded (scripts/load-system.mjs on its branch).
//   node --env-file=.env.local .claude/pf2e/test-characters.mjs [--url http://localhost:3005] [delete]
// Without `delete` it creates them, or resets them to this data; `delete`
// removes them. Not demo content: the demo characters are built with the user.
const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const base = `${(urlIndex >= 0 ? args[urlIndex + 1] : "http://localhost:3000").replace(/\/$/, "")}/api`;
const key = process.env.SOUL_TABLETOP_API_KEY;
const api = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { "x-api-key": key, ...(b ? { "content-type": "application/json" } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (r.status === 404 && m === "GET") return null; if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 600)}`); return t ? JSON.parse(t) : null; };
const ids = {}; const id = async (rid) => ids[rid] ??= (await api("GET", `/content/soul/${rid}`)).id;
const type = await api("GET", "/content-type/soul/pf2e-character");
const me = (await api("GET", "/profile")).username;
const chars = [
  { name: "Test: Kyra", readableId: "test-pf2e-kyra", data: async () => ({
    level: 1, xp: 0, heroPoints: 1, ancestry: await id("ancestry-human"), heritage: await id("heritage-versatile-human"), background: await id("background-acolyte"),
    class: await id("class-cleric"), subclass: await id("feature-warpriest"), deity: await id("deity-sarenrae"), keyAttribute: "wis",
    attributes: { str: 2, dex: 0, con: 1, int: 0, wis: 4, cha: 1 }, languages: ["Common", "Empyrean"], hp: 17, tempHp: 0,
    perception: 1, initiative: { roll: "perception", bonus: 0 }, saves: { fortitude: 2, reflex: 1, will: 2 },
    skills: { religion: 1, medicine: 1, diplomacy: 1, athletics: 1, society: 1 }, lore: [{ name: "Scribing Lore", rank: 1 }], classDc: 1,
    attacks: { unarmed: 1, simple: 1, martial: 1 }, defenses: { unarmored: 1, light: 1, medium: 1 },
    armor: await id("item-chain-shirt"), shield: await id("item-wooden-shield"), shieldRaised: false, shieldHp: 12,
    strikes: [{ weapon: await id("item-scimitar"), attribute: "str", itemBonus: 0 }, { weapon: await id("item-sling"), attribute: "dex", itemBonus: 0 }],
    actions: [{ action: await id("action-raise-a-shield"), notes: "+2 circumstance to AC" }, { feat: await id("feat-shield-block"), notes: "Reduce damage by Hardness" }, { action: await id("action-seek") }],
    feats: [{ feat: await id("feat-natural-ambition"), category: "ancestry", level: 1 }, { feat: await id("feat-student-of-the-canon"), category: "skill", level: 1 }, { feat: await id("feat-shield-block"), category: "general", level: 1 }],
    spellcasting: { tradition: "divine", attribute: "wis", rank: 1, kind: "prepared" }, slots: [{ rank: 1, max: 2, used: 1 }],
    spells: [{ spell: await id("spell-bless"), rank: 1, cast: true }, { spell: await id("spell-command"), rank: 1 }, { spell: await id("spell-divine-lance"), rank: 1 }, { spell: await id("spell-guidance"), rank: 1 }, { spell: await id("spell-light"), rank: 1 }, { spell: await id("spell-shield"), rank: 1 }, { spell: await id("spell-stabilize"), rank: 1 }],
    divineFont: { spell: await id("spell-heal"), max: 4, used: 1 }, focus: { max: 0, used: 0, spells: [] },
    inventory: [{ item: await id("item-scimitar"), quantity: 1, state: "held" }, { item: await id("item-wooden-shield"), quantity: 1, state: "held" }, { item: await id("item-sling"), quantity: 1, state: "worn" }, { item: await id("item-chain-shirt"), quantity: 1, state: "worn" }, { item: await id("item-religious-symbol-wooden"), quantity: 1, state: "worn" }, { item: await id("item-backpack"), quantity: 1, state: "worn" }, { item: await id("item-bedroll"), quantity: 1, state: "stowed" }, { item: await id("item-rations"), quantity: 1, state: "stowed" }],
    coins: { gp: 4, sp: 3 }, biography: { pronouns: "she/her" } }) },
  { name: "Test: Merisiel", readableId: "test-pf2e-merisiel", data: async () => ({
    level: 1, xp: 320, heroPoints: 2, ancestry: await id("ancestry-elf"), heritage: await id("heritage-whisper-elf"), background: await id("background-criminal"),
    class: await id("class-rogue"), subclass: await id("feature-thief"), keyAttribute: "dex",
    attributes: { str: 0, dex: 4, con: 1, int: 1, wis: 1, cha: 1 }, languages: ["Common", "Elven", "Sylvan"], senses: ["Low-light vision"], hp: 9, wounded: 1, conditions: ["Frightened 1"],
    perception: 2, initiative: { roll: "stealth", bonus: 0 }, saves: { fortitude: 1, reflex: 2, will: 2 },
    skills: { acrobatics: 1, athletics: 1, deception: 1, stealth: 1, thievery: 1, society: 1, intimidation: 1, crafting: 1, diplomacy: 1 }, lore: [{ name: "Underworld Lore", rank: 1 }], classDc: 1,
    attacks: { unarmed: 1, simple: 1, martial: 1 }, defenses: { unarmored: 1, light: 1 }, armor: await id("item-leather-armor"),
    strikes: [{ weapon: await id("item-rapier"), attribute: "dex" }, { weapon: await id("item-shortbow"), attribute: "dex" }, { weapon: await id("item-dagger"), attribute: "dex" }],
    actions: [{ feat: await id("feat-nimble-dodge"), notes: "+2 circumstance to AC" }, { action: await id("action-steal"), notes: "Thievery" }, { action: await id("action-sneak"), notes: "Stealth" }],
    feats: [{ feat: await id("feat-nimble-elf"), category: "ancestry", level: 1 }, { feat: await id("feat-nimble-dodge"), category: "class", level: 1 }, { feat: await id("feat-experienced-smuggler"), category: "skill", level: 1 }, { feat: await id("feat-pickpocket"), category: "skill", level: 1 }],
    inventory: [{ item: await id("item-rapier"), quantity: 1, state: "held" }, { item: await id("item-shortbow"), quantity: 1, state: "worn" }, { item: await id("item-arrows"), quantity: 20, state: "worn" }, { item: await id("item-leather-armor"), quantity: 1, state: "worn" }, { item: await id("item-thieves-toolkit"), quantity: 1, state: "worn" }, { item: await id("item-backpack"), quantity: 1, state: "worn" }, { item: await id("item-bedroll"), quantity: 1, state: "stowed" }],
    coins: { gp: 2, sp: 7, cp: 5 } }) },
];
if (args.includes("delete")) {
  for (const c of chars) {
    const existing = await api("GET", `/content/${me}/${c.readableId}`);
    if (existing) await api("DELETE", `/content/${existing.id}`);
    console.log(existing ? `deleted ${c.readableId}` : `no ${c.readableId}`);
  }
  process.exit(0);
}
for (const c of chars) {
  const data = await c.data();
  const existing = await api("GET", `/content/${me}/${c.readableId}`);
  const rec = existing ? await api("PATCH", `/content/${existing.id}`, { name: c.name, data }) : await api("POST", "/content", { name: c.name, readableId: c.readableId, contentTypeId: type.id, data, isPubliclyReadable: false });
  console.log(c.readableId, (rec ?? existing).id);
}
