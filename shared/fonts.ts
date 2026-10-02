// Every font on the site: the app's own (`--font-*` in main.css) and the
// extra ones for sheets. Sheet CSS may use any of them by name in
// `font-family`. nuxt.config.ts registers them all with @nuxt/fonts
// (`global: true`, since @nuxt/fonts otherwise only picks up fonts it finds in
// the app's own CSS), which downloads them at build time and serves them from
// this app: viewers' browsers never contact the font provider. A weight is
// only downloaded when a page uses it, so list each weight the font has that
// sheets may want; an unlisted weight is faked by the browser.
//
// Each font's designer and license are in the font table in docs/theme.md;
// add a row there with a new font (fonts.test.ts checks).

export interface SiteFont {
  name: string;
  description: string;
  weights: number[];
}

export const siteFonts: SiteFont[] = [
  // The app's fonts.
  { name: "Nunito Sans", description: "The site's body text", weights: [400, 600, 700] },
  { name: "Cormorant Garamond", description: "The site's headings", weights: [400, 600, 700] },
  { name: "JetBrains Mono", description: "The site's IDs and code", weights: [400, 500, 700] },
  // Extra fonts for sheets.
  { name: "Cinzel", description: "Classical capitals, for titles", weights: [400, 700] },
  { name: "Uncial Antiqua", description: "Medieval uncial script", weights: [400] },
  { name: "IM Fell English", description: "Old printed book", weights: [400] },
  { name: "Crimson Pro", description: "Readable book serif", weights: [400, 700] },
  { name: "Special Elite", description: "Typewriter", weights: [400] },
  { name: "Orbitron", description: "Futuristic, for sci-fi", weights: [400, 700] },
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
