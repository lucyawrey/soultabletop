# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-09-30

- **State:** branch `logged-out-viewing`, just started: so far it only moves the handoff into this file. No open PRs; #16 (text/box display for non-editable fields, migration `0010_free_chat` applied) is merged.
- **Next:** logged-out viewing of public resources (this branch, if the user confirms it as the next task) → search with My/Find tabs → current-system selector → user API keys → the Soul Tabletop Sheets agent skill. The other test-user entries (showing systems, changing content type, printing, onboarding, authoring CLI, official D&D 2024 system) aren't placed in this order yet; the D&D system depends on API keys, the Sheets skill, and the CLI. The "(Important)" marks in `TODO.md` mean important, not next.
- **Loose ends:**
  - Not tried in a browser by an agent: the two review fixes that went into #16 (locked table cells in box mode show only the pencil; a disabled Markdown box doesn't dirty the draft on Reload or Discard).
  - Browser checks on the desktop worked with `playwright-core` installed in the session scratchpad, driving the installed Google Chrome headless (`channel: "chrome"`) against the user's dev server, registering throwaway `claude-smoke-*@example.invalid` users and deleting them (and their resources) afterwards. The scripts lived in the scratchpad and are gone; the earlier API/SSR check scripts are gone too. Moving checks like them into the repo as an integration suite (run against the dev server, cleaning up after themselves) was suggested but not done.
  - Unverified in a browser: `CodeEditor`'s syntax colors in dark mode, on the Sheet editor and detail page (CodeMirror's default highlight style is light-only; listed in `TODO.md`).
