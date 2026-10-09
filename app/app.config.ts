// Palette names are defined in app/assets/css/main.css (docs/theme.md).
const colors = ["primary", "secondary", "tertiary", "success", "info", "warning", "error"] as const;

export default defineAppConfig({
  ui: {
    colors: {
      primary: "plum",
      secondary: "gilt",
      tertiary: "steel",
      neutral: "folio",
    },
    // Roll toasts stay until closed, so every toast's close button is a
    // visible outlined button (.claude/mockups/dice-rolls/spec.md).
    toast: {
      slots: {
        close: "p-0 size-7 justify-center rounded-md ring ring-accented bg-default text-highlighted hover:bg-elevated",
      },
    },
    navigationMenu: {
      slots: {
        // Roomier rows, and small uppercase group labels like the mockup.
        link: "px-2.5 py-1.5 text-[15px] gap-2",
        separator: "hidden",
        // Groups (Play, Build) are separate lists; rows and groups are spaced
        // like the mockup.
        list: "flex flex-col gap-0.5 not-first:mt-[18px]",
        linkLeadingIcon: "size-[17px]",
        label: "px-2.5 pt-0 pb-1 text-[11px]/[16.5px] font-bold tracking-widest text-muted uppercase",
      },
      // The current page is a solid primary pill, not Nuxt UI's tinted one.
      compoundVariants: [
        // Other items' icons take the label's color, as in the mockup, not
        // Nuxt UI's lighter `text-dimmed`.
        {
          orientation: "vertical" as const,
          active: false,
          class: { linkLeadingIcon: "text-muted group-hover:text-default" },
        },
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
    tabs: {
      // Link tabs are the mockup's underline tabs: semibold, side by side with
      // no gap between them, with a 2px underline.
      variants: {
        variant: {
          // The underline is drawn from the active tab's own state rather than
          // Nuxt UI's sliding indicator, which only exists after hydration and
          // so jumps on load.
          link: {
            list: "w-auto gap-0 p-0",
            // `::before`, with Nuxt UI's own pre-hydration `::after` underline
            // hidden, so the server and client render the same line.
            trigger:
              "relative px-3 pt-1.5 pb-[9px] text-[15px] font-semibold after:hidden! data-[state=active]:before:absolute data-[state=active]:before:inset-x-0 data-[state=active]:before:-bottom-px data-[state=active]:before:h-0.5 data-[state=active]:before:bg-primary data-[state=active]:before:content-['']",
            indicator: "hidden",
          },
        },
      },
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
        thead: "bg-elevated",
        th: "px-4 py-2.5 text-xs font-bold tracking-[0.08em] text-muted uppercase",
        td: "px-4 py-3",
        tr: "hover:bg-primary/5",
        separator: "bg-(--ui-border)",
      },
    },
    formField: {
      // Semibold labels, and `lg` fields: the mockup's 40px inputs. Dense
      // places (Sheets, the schema builder) set `size="md"` on their fields.
      slots: { label: "font-semibold" },
      defaultVariants: { size: "lg" as const },
    },
    input: {
      variants: { size: { lg: { base: "px-3 py-2.5 text-[15px]/5" } } },
    },
    textarea: {
      variants: { size: { lg: { base: "px-3 py-2.5 text-[15px]/5" } } },
    },
    // Menus fit their options rather than their field: at least as wide as the
    // field, up to 28rem (or the space on screen), so narrow fields
    // (a Sheet's pickers) still show names and badges. Each one sets
    // `:content="{ align: 'start' }"`, so a wider menu lines up with its
    // field's left edge instead of centering on it.
    select: {
      slots: {
        content:
          "w-max min-w-(--reka-select-trigger-width) max-w-[min(28rem,var(--reka-select-content-available-width,28rem))]",
      },
      variants: { size: { lg: { base: "px-3 py-2.5 text-[15px]/5" } } },
    },
    selectMenu: {
      slots: {
        content:
          "w-max min-w-(--reka-combobox-trigger-width) max-w-[min(28rem,var(--reka-combobox-content-available-width,28rem))]",
      },
      variants: { size: { lg: { base: "px-3 py-2.5 text-[15px]/5" } } },
    },
    inputMenu: {
      slots: {
        content:
          "w-max min-w-(--reka-combobox-trigger-width) max-w-[min(28rem,var(--reka-combobox-content-available-width,28rem))]",
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
      compoundVariants: [
        // Solid buttons darken on hover and press instead of fading to 75%,
        // which would drop their light text below 4.5:1.
        ...colors.map((color) => ({
          color,
          variant: "solid" as const,
          class: `shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)] active:bg-[color-mix(in_oklab,var(--ui-${color})_85%,black)]`,
        })),
        // Outline buttons (Delete) get the mockup's border, the color mixed
        // with the strong border: Nuxt UI's 50% tint is under 3:1 on the page.
        ...colors.map((color) => ({
          color,
          variant: "outline" as const,
          class: `bg-default ring-[color-mix(in_srgb,var(--ui-${color})_60%,var(--ui-border-accented))]`,
        })),
      ],
    },
  },
});
