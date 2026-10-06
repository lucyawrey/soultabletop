# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (about 1 am)

- **Done tonight:** the PF2e sheet mockup is frozen (`.claude/mockups/pf2e-sheet/frozen.html`, `spec.md`), and #92 merged the first three sheet features from its gaps: `<Sheet density="compact">`, `editing()` in formulas, and `live` fields saving at once with Edit off.
- **Next:** the four sheet features at the top of Next up in `TODO.md`, in order (buttons that change a field, breakdown popovers, reference previews, dice buttons); the first two need a markup decision with the user. Then the PF2e character sheet build (`.claude/plans/pf2e-demo.md`, step 6).
- **Not yet seen by the user:** compact density in the real app. It was checked only on a throwaway test sheet (screenshots in the #92 description's checks). The first real compact sheet may need tuning.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
