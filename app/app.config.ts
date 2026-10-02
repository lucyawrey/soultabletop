// Palette names are defined in app/assets/css/main.css (docs/theme.md).
const colors = ["primary", "secondary", "success", "info", "warning", "error"] as const;

export default defineAppConfig({
  ui: {
    colors: {
      primary: "plum",
      secondary: "gilt",
      neutral: "folio",
    },
    button: {
      // Solid buttons darken on hover and press instead of fading to 75%,
      // which would drop their light text below 4.5:1.
      compoundVariants: colors.map((color) => ({
        color,
        variant: "solid" as const,
        class: `hover:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)] active:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)]`,
      })),
    },
  },
});
