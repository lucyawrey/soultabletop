// Fonts Sheet CSS may use by name in `font-family`. They're registered with
// @nuxt/fonts in nuxt.config.ts (`global: true`, since @nuxt/fonts otherwise
// only picks up fonts it finds in the app's own CSS), which downloads them at
// build time and serves them from this app: viewers' browsers never contact
// the font provider. Add fonts here as needed.

export interface SheetFont {
  name: string;
  description: string;
}

export const sheetFonts: SheetFont[] = [
  { name: "Cinzel", description: "Classical capitals, for titles" },
  { name: "Uncial Antiqua", description: "Medieval uncial script" },
  { name: "IM Fell English", description: "Old printed book" },
  { name: "Crimson Pro", description: "Readable book serif" },
  { name: "Special Elite", description: "Typewriter" },
  { name: "Orbitron", description: "Futuristic, for sci-fi" },
];

// Generic families and keywords that are always fine in `font-family`.
export const genericFontFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);
