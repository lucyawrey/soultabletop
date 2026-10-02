// Palette names are defined in app/assets/css/main.css (docs/theme.md).
const colors = ["primary", "secondary", "success", "info", "warning", "error"] as const;

export default defineAppConfig({
  ui: {
    colors: {
      primary: "plum",
      secondary: "gilt",
      neutral: "folio",
    },
    navigationMenu: {
      slots: {
        // Roomier rows, and small uppercase group labels like the mockup.
        link: "py-2 text-[15px]",
        label: "px-2.5 pb-1 text-[11px] font-bold tracking-widest text-muted uppercase",
      },
      // The current page is a solid primary pill, not Nuxt UI's tinted one.
      compoundVariants: [
        {
          orientation: "vertical" as const,
          variant: "pill" as const,
          active: true,
          class: {
            link: "font-bold text-inverted",
            linkLeadingIcon: "text-inverted",
            linkLabel: "font-bold",
          },
        },
        ...(["primary", "neutral"] as const).map((color) => ({
          color,
          orientation: "vertical" as const,
          variant: "pill" as const,
          active: true,
          class: { link: "before:bg-primary" },
        })),
      ],
    },
    table: {
      slots: {
        // The table sits in a bordered panel.
        root: "rounded-lg border border-default bg-default",
        // A tinted header row with small uppercase labels, and a hover row.
        thead: "bg-muted",
        th: "py-2.5 text-xs font-semibold tracking-wide text-highlighted uppercase",
        tr: "hover:bg-muted/60",
      },
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
