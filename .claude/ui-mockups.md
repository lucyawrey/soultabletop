# UI mockups

How UI is designed before it's built: for the site (HTML mockups turned into Nuxt pages) and for official character sheets (HTML mockups turned into Sheet markup and Sheet CSS). Agreed with the user on 2026-10-05, after the redesign (see [mockups/ui-redesign/spec.md](mockups/ui-redesign/spec.md)): its mockup worked well, and the build drifted from it.

Why the redesign mockup worked: it was built from a small set of tokens, so each option was coherent; it showed the app's real pages and content; every choice was a toggle the user could click through; the accessibility rules were built in (a live contrast table); and it came out of a long conversation with the user's ideas. Why the build drifted: nothing mapped mockup elements to Nuxt UI components; the plan pinned down tokens but not sizes and spacing; screenshots were compared only in a late review; and the reference still held every rejected option. The steps below close those gaps.

## Where mockups live

One folder per mockup, `.claude/mockups/<name>/`, on the `docs` branch (the user works on several Claude accounts, so the repo copy is the reference; a published artifact is only a convenience copy):

- `brief.md`: what it's for, the requirements, the real content to show, the constraints, and which choices become toggles.
- `mockup.html`: the working page with all options. Archived unchanged once the design is approved.
- `frozen.html`: the approved design, locked to the chosen options. It changes only to fix the page itself, never to follow the built result.
- `spec.md`: the chosen options, decisions made after the mockup, tokens, measurements, the implementation map (site) or tag map (sheets), and how to compare.

## Steps

1. **Brief.** The main session (Opus) and the user write `brief.md` together. Ask decisions with the question tool. Collect real content: names, IDs, counts, and copy from `content/copy.yml` (team copy stays a marked placeholder).
2. **Mockup.** The main Opus session builds it, never a subagent, in the conversation where the ideas came up. One self-contained HTML file:
   - Tokens first: every color, font, and radius comes from a short list of variables.
   - Real pages and content from this app, not generic filler.
   - Options as segmented controls at the top (`data-ctl` groups of buttons with `data-v` values), so the user picks by clicking. Keep that header lean, as in `mockups/ui-redesign/frozen.html` (user, 2026-10-05): one bar with a short title and a few words of status, then the controls with no visible labels (`role="group"` and an `aria-label` instead), and controls that only matter for one view shown only there. Explanations go in `brief.md` and `spec.md`, not on the page.
   - Accessibility built in: one light theme, text at least 4.5:1 and control outlines at least 3:1 (a live contrast table like the redesign's), visible focus, state never shown by color alone.
   - Desktop and phone widths both work.
   - Site mockups use Tailwind (the CDN build) with the app's tokens and Nuxt UI's semantic class names (`bg-elevated`, `text-muted`, `ring-accented`, `rounded-md`), so class strings carry over to the Nuxt code; free-form CSS only for a new theme. Each element is tagged with what builds it: `data-impl="UButton color=neutral variant=outline"`, `data-impl="DetailHeader"`, `data-impl="new: ResourceCounts"`.
   - Sheet mockups use only what the sheet system can express: each block is tagged with its tag and attributes (`data-tag="Tracker" data-attrs='field="hp" max="{hp.max}"'`), and styling uses only the `--st-*` tokens and `sheet-*` hook classes (`docs/theme.md`, `docs/sheet-system.md`), so the CSS moves into Sheet CSS nearly as is. Anything the system can't do yet is marked `data-gap="…"`, listed in the spec, and becomes a `TODO.md` item.
3. **Review.** The user clicks through the options and decides. Record each decision in the spec as it's made. Publishing the page as an artifact for review is fine; the repo file stays the reference.
4. **Freeze.** Make `frozen.html` (the chosen options, the option controls removed, view controls kept) and write `spec.md`: chosen options, tokens, measurements in px from the mockup's CSS, states (empty, loading, error, phone), and the map from each tagged element to its component, props, and classes (site) or tag and attributes (sheets). Later decisions go in its "Decided after the mockup" list; the frozen page isn't edited to show them.
5. **Build.** Opus builds the shared pieces first (headers, cards, layout components) from the frozen page and the spec; smaller models only apply pieces that already exist. Sheets: the author turns the tagged blocks into Sheet markup and checks it with the sheets skill.
6. **Compare.** Screenshot `frozen.html` and the built page at the same sizes (desktop and phone), and put the pairs side by side; the author shows them in the PR and the reviewer checks them. A difference is either fixed or written into the spec as a decision. Drift found later is measured against `frozen.html` the same way.
