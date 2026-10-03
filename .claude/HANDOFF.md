# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-10-02
- **TODO.md was re-sorted into phases (2026-10-02)**: Next up is the exact order (1. Sheet path hardening, formulas PR 0; 2. Sheet formulas with conditional display, plan PRs 1–5), then Phase 1 (Sheets ready for real systems), Phase 2 (authoring and official content), Phase 3 (browsing, access, polish), Phase 4 (play and community). The groups "Official" badge bug is in Phase 3 and needs a screenshot or a look together.
- **Formula plan walked through (2026-10-02):** decisions at the top of `.claude/plans/sheet-formulas.md` (no `$` sigil: definitions are called like built-ins, `pb()`; `show=` is in the base release; no JS hooks). Next code is PR 0 (Sonnet is fine); use Opus for planning anything big.

- **In progress:** nothing. No open PRs, no worktrees besides the main checkout (on `docs`). Merged this session: #68 (Sheet Section border), #70 (dice favicon, auto-merged as Tier A after a Sonnet review).
- **Loose ends:** Chrome's choice between `favicon.svg` and `favicon.ico` wasn't checked in a browser; the user's dev server on port 3000 returned a 500 for a public character page while testing #68 (unchecked, may just be the branch it runs).
