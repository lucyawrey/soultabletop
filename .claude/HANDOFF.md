# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **Nothing in progress.** Merged today: #87 (resource descriptions), #88 (demo polish), #89 (mockup tools; agent-only scripts moved to `.claude/scripts/`, including `agent-run.sh`: older worktrees still have it in `scripts/`). All their worktrees and branches are removed.
- **Next:** the demo prep order in `TODO.md` Next up, starting with the database reset (confirm with the user right before dropping). The PF2e demo system is planned in `.claude/plans/pf2e-demo.md`; export `pf2e-test` (its step 1) before dropping.
- **PF2e sheet mockup:** first draft in `.claude/mockups/pf2e-sheet/` (brief + mockup.html), not yet reviewed by the user or checked in a browser by an agent. Review notes and the play/edit proposal are in its `brief.md` (the user asked about the default edit mode; answered, not yet confirmed). Next: confirm play/edit, then mockup v2 with ideas 1–6 from the brief.
- **UI mockups:** the process is `.claude/ui-mockups.md`; the redesign's frozen reference is `.claude/mockups/ui-redesign/`. A first comparison of the landing page found small drift (nav order: Content before Characters; smaller sign-in tab text; Sign in button looks disabled until filled), not yet logged in `TODO.md` or checked with the user.
- The user asked about the `frontend-design` plugin: worth trying for an exploratory direction mockup, not for matching the frozen design.
- The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax; the reset removes it.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
