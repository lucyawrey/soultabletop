# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (afternoon)

- **Waiting on the user:** review and merge PR #93, sheet buttons (`<Button>` with `<Set>` children, `*`, shared `amount` box, Undo toast), worktree `../soultabletop-worktrees/sheet-buttons`. Choices the user hasn't confirmed: buttons hidden from viewers who can't edit, disabled with Edit off unless `live`; an empty amount box gives a "Type an amount first" toast.
- **Next:** the remaining sheet features at the top of Next up in `TODO.md`, in order (breakdown popovers, reference previews, dice buttons); popovers need a markup decision with the user. Then the PF2e character sheet build (`.claude/plans/pf2e-demo.md`, step 6). After #93 merges, delete its TODO item and mark gap 4 done in `.claude/mockups/pf2e-sheet/spec.md`.
- **Not yet seen by the user:** compact density in the real app (#92); it was checked only on throwaway test sheets.
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
