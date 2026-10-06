# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-06 (late afternoon)

- **In progress:** PR #95, breakdown popovers (`<Part>` children), worktree `../soultabletop-worktrees/breakdown-popovers`. An agent reviewer was started; fix its findings, then the user reviews and merges.
- **Test data to delete after #95 merges** (user's account, via the API, in this order): content `9973d6bc-8adf-482c-b572-a467229acf7d` (Kyra), sheet `3c582967-42ea-4dc0-ac51-757dbc3edfdc`, content type `8060add8-a017-411e-9a65-f0b79c2ca023`, system `77cc06e9-b408-45f5-bd30-25833ea368d4` ("Test: breakdown popovers").
- **Next:** after #95, reference previews, then dice buttons (needs a design decision), then the PF2e character sheet build (`.claude/plans/pf2e-demo.md`, step 6).
- **Not yet seen by the user:** compact density on a real, full sheet (only test sheets so far).
- **Waiting on the user:** keep or delete `icons.html` in the mockup folder; whether the Initiative "rolls with" picker should offer Lore skills.
- The nine reference content types in `.claude/pf2e/content-types/` are drafted but not validated against the API or reviewed.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70). The Mac's `.env.local` names the API key `SOUL_API_KEY`, while the README says `SOUL_TABLETOP_API_KEY`.
