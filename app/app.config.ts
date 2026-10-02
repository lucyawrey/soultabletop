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
        link: "px-2.5 py-1.5 text-[15px] gap-2",
        separator: "hidden",
        linkLeadingIcon: "size-4",
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
    modal: {
      slots: {
        // A display-font title over a divider, and a footer on the page tone.
        content: "rounded-xl",
        header: "min-h-0 border-b border-default px-5 py-4",
        title: "font-display text-2xl leading-tight font-bold text-highlighted",
        body: "p-5",
        footer: "justify-end border-t border-default bg-(--st-page) px-5 py-3.5",
      },
    },
    table: {
      slots: {
        // The table sits in a bordered panel.
        root: "rounded-lg border border-default bg-default",
        // A tinted header row with small uppercase labels, and a hover row.
        thead: "bg-muted",
        th: "px-4 py-2.5 text-xs font-bold tracking-[0.08em] text-muted uppercase",
        td: "px-4 py-3",
        tr: "hover:bg-primary/5",
        separator: "bg-(--ui-border)",
      },
    },
    button: {
      // The mockup's buttons: semibold 14px, 9px by 14px, 15px icons.
      slots: { base: "font-semibold" },
      variants: {
        size: {
          md: { base: "px-3.5 py-2 text-sm", leadingIcon: "size-4", trailingIcon: "size-4" },
        },
      },
      // Solid buttons darken on hover and press instead of fading to 75%,
      // which would drop their light text below 4.5:1.
      compoundVariants: colors.map((color) => ({
        color,
        variant: "solid" as const,
        class: `shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)] active:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)]`,
      })),
    },
  },
});
