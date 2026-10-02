// The site theme tokens Sheet CSS may use, e.g. `color: var(--st-ink)`.
// Defined in app/assets/css/main.css and documented in docs/theme.md. The
// names are a stable contract: published sheets refer to them, so never
// rename or remove one when the theme changes; add new ones instead
// (shared/theme.test.ts checks each is defined).

export interface SheetThemeToken {
  name: `--st-${string}`;
  description: string;
}

export const sheetThemeTokens: SheetThemeToken[] = [
  { name: "--st-page", description: "Page background behind panels" },
  { name: "--st-panel", description: "Panel and card background" },
  { name: "--st-panel-muted", description: "Shaded panel, e.g. table headers" },
  { name: "--st-ink", description: "Main text" },
  { name: "--st-ink-muted", description: "Secondary text" },
  { name: "--st-primary", description: "Primary color, for emphasis and links" },
  { name: "--st-on-primary", description: "Text on a primary background" },
  { name: "--st-accent", description: "Accent color (gilt)" },
  { name: "--st-border", description: "Dividers" },
  { name: "--st-border-strong", description: "Outlines that must stand out" },
  { name: "--st-radius", description: "Corner radius of buttons and inputs" },
  { name: "--st-font-body", description: "Body text font" },
  { name: "--st-font-display", description: "Display font, for large headings" },
];
