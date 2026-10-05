# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-05

- **PR #88 open: Demo polish** (branch and worktree `demo-polish`, Tier B, not reviewed yet). Smoke-tested on a dev server; not checked in a browser: `display="text"` for the dot Checkbox and max-less Tracker, and the collapsed-rail "working as" dot. After merging each PR, clean up its worktree, branch, and the `TODO.md` items its In progress entry lists.
- **PF2e demo system blockers** (checked 2026-10-05): only the database reset (#87, descriptions for the credits, has merged) (anything loaded before it is wiped). Its design and import script can start any time; the polish, onboarding, and dice items don't block it.
- **UI mockup process** (2026-10-05): `.claude/ui-mockups.md`; the redesign mockup is frozen in `.claude/mockups/ui-redesign/`. **PR #89 open: mockup tools** (worktree `mockup-tools`; agent scripts in `.claude/scripts/`): the Tailwind theme kit and `compare-mockup.mjs`. Its first comparison (landing) shows small drift from the frozen mockup (nav order, sign-in tab text size), not yet logged in `TODO.md`. Then continue the demo prep order in `TODO.md` Next up.
- **After #89 merges:** `agent-run.sh` and `smoke-session.mjs` move to `.claude/scripts/`. Merge `origin/main` into `docs` right away (it brings the new `settings.json` paths), then update the docs-only references (`.claude/ui-mockups.md`, this file) and the user's `.claude/settings.local.json` allowlist entries. Other worktrees keep the old paths until they merge `main`.
- The live `pf2e-test` sheet still uses the old `{= }` / braced `show` syntax; the reset removes it.
- **Unverified on the Mac:** that `code` is on the PATH. **Unverified:** Chrome's choice between `favicon.svg` and `favicon.ico` (#70).
