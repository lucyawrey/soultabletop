# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **PR #87 open: Resource descriptions** (branch and worktree `resource-descriptions`; migration `0015` already applied). Reviewed; waiting for the user's merge.
- **PR #88 open: Demo polish** (branch and worktree `demo-polish`, Tier B, not reviewed yet). Smoke-tested on a dev server; not checked in a browser: `display="text"` for the dot Checkbox and max-less Tracker, and the collapsed-rail "working as" dot. After merging each PR, clean up its worktree, branch, and the `TODO.md` items its In progress entry lists.
- **PF2e demo system blockers** (checked 2026-10-05): only #87 (the credits live in the description) and the database reset (anything loaded before it is wiped). Its design and import script can start any time; the polish, onboarding, and dice items don't block it.
- **UI mockup process** (2026-10-05): `.claude/ui-mockups.md`; the redesign mockup is frozen in `.claude/mockups/ui-redesign/`. **PR #89 open: mockup tools** (worktree `mockup-tools`; scripts only): the Tailwind theme kit and `compare-mockup.mjs`. Its first comparison (landing) shows small drift from the frozen mockup (nav order, sign-in tab text size), not yet logged in `TODO.md`. Then continue the demo prep order in `TODO.md` Next up.
- The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax; the reset removes it.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
