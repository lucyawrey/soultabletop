# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06

- **Next: freeze the PF2e sheet mockup.** The user approved it on 2026-10-06 with the Tabs right layout and asked to freeze it, then switched to a new conversation before the freeze. Read the end of `.claude/mockups/pf2e-sheet/brief.md` ("Approved") and `.claude/ui-mockups.md` step 4, then make `frozen.html`, write `spec.md` (decisions are all in `brief.md`), and turn the gaps listed in `brief.md` into `TODO.md` items. Opus should do this.
- `icons.html` in the same folder is the icon comparison page. The user chose the icons, and the page wasn't deleted. Ask whether to keep it.
- **Then: the PF2e demo system** (`TODO.md` In progress, plan `.claude/plans/pf2e-demo.md`). The character content type waits on the frozen sheet; the nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
