import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sheetThemeTokens } from "./sheet/theme-tokens";

// Checks the site theme's contrast (docs/theme.md) from the colors in
// app/assets/css/main.css, so a palette change that breaks it fails here.
const css = readFileSync(new URL("../app/assets/css/main.css", import.meta.url), "utf8");

const declarations = new Map<string, string>();
for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  declarations.set(name!, value!.trim());
}

// A token's color as [r, g, b] (0-255), following `var()` aliases.
function resolve(token: string, seen = new Set<string>()): [number, number, number] {
  const value = declarations.get(`--${token}`);
  if (!value) throw new Error(`--${token} isn't defined in main.css`);
  if (seen.has(token)) throw new Error(`--${token} refers to itself`);
  seen.add(token);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  if (alias) return resolve(alias[1]!, seen);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (!hex) throw new Error(`--${token} is "${value}"; the test reads only #rrggbb colors`);
  const n = Number.parseInt(hex[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// "primary/10@bg" is `primary` at 10% opacity over `bg`, as in Nuxt UI's
// `bg-primary/10` (soft and subtle variants).
function color(spec: string): [number, number, number] {
  const [top, under] = spec.split("@");
  const [token, alpha] = top!.split("/");
  const rgb = resolve(token!);
  if (!alpha) return rgb;
  const a = Number(alpha) / 100;
  const base = resolve(under!);
  return rgb.map((c, i) => c * a + base[i]! * (1 - a)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(color(a)), luminance(color(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const surfaces = ["ui-bg", "st-page", "ui-bg-muted", "ui-bg-elevated"];
const statusColors = ["ui-primary", "ui-secondary", "ui-success", "ui-info", "ui-warning", "ui-error"];

// Text needs 4.5:1 (WCAG AA).
const textPairs: [string, string][] = [
  ...["ui-text-highlighted", "ui-text", "ui-text-toned", "ui-text-muted", "ui-text-dimmed"].flatMap(
    (text) => surfaces.map((surface): [string, string] => [text, surface]),
  ),
  ["ui-text-highlighted", "ui-bg-accented"],
  ["ui-text-muted", "ui-bg-accented"],
  ["ui-text-inverted", "ui-bg-inverted"],
  // Colored text (links, `text-error`, alerts) on the panel and the page.
  ...statusColors.flatMap((c) => ["ui-bg", "st-page"].map((s): [string, string] => [c, s])),
  // Solid buttons and badges. On hover they darken (app.config.ts), which
  // only raises this.
  ...statusColors.map((c): [string, string] => ["ui-text-inverted", c]),
  // Soft and subtle variants: colored text on a 10% tint of the same color.
  ...statusColors.map((c): [string, string] => [c, `${c}/10@ui-bg`]),
];

// Control outlines, focus rings, and selected states need 3:1 (WCAG 1.4.11).
const outlinePairs: [string, string][] = [
  ...["ui-bg", "st-page", "ui-bg-muted"].map((s): [string, string] => ["ui-border-accented", s]),
  ...["ui-bg", "st-page", "ui-bg-elevated"].map((s): [string, string] => ["ui-primary", s]),
];

describe("theme contrast (app/assets/css/main.css)", () => {
  it.each(textPairs)("text --%s on --%s is at least 4.5:1", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(outlinePairs)("outline --%s on --%s is at least 3:1", (outline, surface) => {
    expect(contrast(outline, surface)).toBeGreaterThanOrEqual(3);
  });
});

describe("Sheet theme tokens", () => {
  it("are all defined in main.css", () => {
    const missing = sheetThemeTokens.filter((token) => !declarations.has(token.name));
    expect(missing).toEqual([]);
  });
});
