# Handoff

One session's notes for the next. See "Handoff" in `CLAUDE.md` for how to use and update this file; check it against git before relying on it.

**Last updated:** 2026-09-30

- **State:** nothing in progress; the main checkout is on `main` and the only other worktree is `docs`. Recently merged: the current-system selector (#28), team copy in `content/copy.yml` (#29, #30), and user API keys (#31: Better Auth's API key plugin, `getAuthenticatedUser` takes the session then a key, Read Only or Full Access, managed on the profile page; the plugin's per-key rate limit is off, see the rate limiting item in `TODO.md`). The user checked both key types on the preview with `vercel curl` (curl flags go after `--`).
- **Next:** the user picks from `TODO.md`, starting with Next up. `TODO.md` was restructured into priority tiers (format rule in `CLAUDE.md`, "Handoff"); the tier placement was an agent's first draft for the user to reorder. The Unsorted section needs an interactive review with the user before anything is built from it.
- **Docs branch:** `docs` (worktree `../soultabletop-worktrees/docs`, pushed to `origin/docs`) holds changes not yet on `main`: the `TODO.md` restructure and new items, `CLAUDE.md` notes (browser checks, pnpm release-age exclusions, the `TODO.md` format), the user's `content/copy.yml` comment edit, and this file. They reach `main` by riding along with the next feature PR or a docs-only PR (tell the user when one is ready; don't open it unprompted).
- **Parallel work:** the rules in `CLAUDE.md` ("Parallel work") haven't been run as written yet; correct whatever doesn't hold on first use. Delivery of `SendMessage` to an idle window is untested.
- **Loose ends:**
  - Browser checks: on this CachyOS machine, Chromium's headless shell is in `~/.cache/ms-playwright` (see `CLAUDE.md`); the Mac uses installed Chrome. Scripts live in the session scratchpad and are gone afterwards; an in-repo integration suite is part of the launch QA item in `TODO.md`.
  - Not confirmed in a browser by an agent: the logged-out sign-in return; a broken icon URL on a full page load (guarded, couldn't reproduce); the editable signed `Number` input ("+3") and `Field.vue`'s value wrapper layout; the sheet editor's content pickers after the Official-first ordering; the two review fixes from #16 (locked table cells in box mode show only the pencil; a disabled Markdown box doesn't dirty the draft on Reload or Discard); `CodeEditor`'s syntax colors in dark mode.
  - A campaign you belong to but don't own, with no grant, shows under My labeled "Community" (no membership label in the source badge).
  - The test database has about 50 leftover `claude-smoke-*@example.invalid` users from older sessions; removing them is one SQL statement if the user wants. This session's throwaway users were all deleted.
