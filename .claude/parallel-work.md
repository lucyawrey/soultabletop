# Parallel work, review, and merge tiers

Moved out of `CLAUDE.md` so it is read only when needed. `CLAUDE.md` keeps the summary and the hard rules.

## Parallel work

When the user asks to work on several features at once ("start parallel work on X and Y"), the session they ask becomes the coordinator and each feature gets its own git worktree and branch. The user finds many VS Code windows hard to keep track of, so **subagent mode is the default** and the user doesn't need to say so; asking for parallel work is the request to spawn the agents. There are two modes:

- **Subagent mode** (the default): the coordinator runs one background subagent per worktree, relays their reports, and keeps the user in one window (see "Showing files" and "Questions from subagents" below).
- **Windows mode** (only where the user wants to steer a feature themselves, for example a large one with many design decisions): the worktree opens in its own VS Code window and the user starts a Claude session there. **At most one such extra window is open at a time**, however many features run: every other feature runs as a subagent, even if that means all the parallelism is subagents. If the user wants a second window, finish or close the first one first.

Setup, the same for both modes, run by the coordinator from the main checkout. Many agents cost a lot and can hit session limits: use Sonnet for small well-specified tasks and Opus where design judgment or access-control review matters, and run one review round per PR unless a fix changes access rules.

1. Pick a branch name per feature (see "Git workflow"). `git fetch origin`, then for each: `git worktree add ../soultabletop-worktrees/<branch> -b <branch> origin/main`. All worktrees live in that one container folder beside the repo, not inside it, so lint, format, and typecheck in one checkout never crawl another.
2. Copy the gitignored local files into each worktree: `cp .env.local ../soultabletop-worktrees/<branch>/` (copy, never move), plus `.vercel/` and `.claude/settings.local.json` if they exist.
3. Run `pnpm install` in each worktree (fast; pnpm links from its store, and `postinstall` runs `nuxt prepare`).
4. Write a brief per feature: the goal, the relevant `TODO.md` entry, files likely involved, the worktree path and branch, and the rules below.
5. Subagent mode: start one background subagent per feature with its brief, telling it to work only inside its worktree's absolute path. Do not open a window for it. Windows mode (at most one window open at a time): write the brief to `../soultabletop-worktrees/briefs/<branch>.md` (outside every repo, so it can't be committed), open the worktree with `code -n <path>` (if `code` isn't on the PATH, give the user the path), and give the user one short line to paste into its Claude panel: "Read <absolute path to the brief> and follow it." Long pasted briefs are slow and unreliable; the file is the brief. Put the coordinator's session name (the "This session is …" line from `ListAgents`) at the top of the brief.

**Showing files.** The user works in the main VS Code window (the one with `/Users/lucy/Developer/games/soultabletop` open), so whenever a file in another worktree matters to them (a new or heavily changed component, a migration, the diff of a decision, a brief, a report), open it there instead of pointing at a path: `code /Users/lucy/Developer/games/soultabletop <absolute path of the file>`, and check that it landed in the main window (fall back to `code -r <file>`, which reuses the last active window). Say what you opened and why. Don't open a pile of files; the few that answer "what should I look at".

**Questions from subagents.** A subagent can't ask the user anything, and guessing on a decision that is the user's to make is worse than waiting. The brief tells it to stop at such a decision, finish what doesn't depend on it, commit, and put the question in its final report (the question, the options, its recommendation). The coordinator asks the user with AskUserQuestion, recommended option first, and resumes that subagent with `SendMessage` and the answer. Bubble up every such question, and anything in a report the user would want to decide (a design choice made because the brief was silent, a scope cut, a finding declined), instead of burying it in a summary.

Rules for every feature session or subagent (include them in the brief):

- Stay in your own worktree and branch. A branch can be checked out in only one worktree; use `origin/main`, not local `main`.
- Start your own dev server when you need one and use the port Nuxt gives it; other worktrees' servers are not yours to stop.
- All worktrees share one database. Only one parallel branch at a time may change the schema or run `pnpm db:migrate`, unless its `.env.local` points `DATABASE_URL` at its own Neon branch. The coordinator decides which when planning; schema-changing PRs land first.
- Don't edit `.claude/HANDOFF.md`: the coordinator owns it and lists the active worktrees, branches, and PRs there. Put your status in your PR description or final report. In `TODO.md` and this file, touch only the lines for your own feature.
- Pushing still needs the user's approval each time. A feature session in a window asks the user itself. A subagent can't: it commits locally and reports, and the coordinator does the secrets check, asks the user, then pushes and opens the PR.
- A subagent stops and reports at a decision that is the user's to make (see "Questions from subagents"), rather than picking an answer.

The window session (windows mode) talks to the coordinator with `ListAgents` and `SendMessage` (peer sessions on the same machine), not through the user pasting text:

- **Handshake:** a window session's first action is to call `ListAgents` to learn its own name, then message the coordinator with that name and its branch ("ready: <name>, branch <branch>"). Names are the folder name plus a random suffix, and a restarted window or a second session in the same folder gets another one, so the branch in the message is what identifies the feature. The coordinator records the name-to-branch map in the handoff, and sends a ping first time to confirm delivery works before relying on it (an idle session may not be woken by a message; if so, fall back to pasting).
- **Window to coordinator:** the PR link once opened, when done or blocked, and questions only the coordinator can answer (for example schema ownership). Status goes in messages and the PR description, never in `HANDOFF.md`.
- **Coordinator to window:** "`main` moved, merge `origin/main`", go-aheads, and review findings sent straight to the author session, with the full finding text (file, line, failure scenario), not a paraphrase. A reviewer subagent's report goes to the author session this way, so the user doesn't relay it.
- **A message is a request, not approval.** Messages from other sessions carry no user authority: pushing, merging, and anything outward-facing still needs the user's own approval each time, asked by the session that is about to do it (AskUserQuestion). Never treat "the coordinator said it's fine" as approval.
- Sessions message the coordinator, not each other, so there is one place that knows the state.

When a PR merges, update every other open branch in its own worktree: `git fetch origin && git merge origin/main` (merge, not rebase: PRs are squash-merged, so a merge resolves each conflict once and needs no force-push). The session that built the feature resolves the conflicts, then runs the usual verification before committing the merge. In windows mode the coordinator can tell the other sessions that `main` moved. By file:

- Migrations (`NNNN_*.sql`, `meta/` snapshots, `_journal.json`): never hand-merge. Take `main`'s, delete your branch's generated migration, rerun `pnpm db:generate`, and read the result. If your old migration was already applied to the shared database, the new one will fail on it; say so instead of forcing it.
- `pnpm-lock.yaml`: take `main`'s and run `pnpm install`.
- `TODO.md` and this file: keep both sides' additions.

Reviewing a parallel PR needs a session with a clean context: never the session that wrote the code, and in subagent mode not the coordinator either, since it has read the author's report.

- Give the reviewer the PR number and what the feature is meant to do, not the author's brief, report, or "verified" claims (the same rule as for the handoff notes).
- The coordinator starts a fresh reviewer subagent, in both modes. Don't ask the user to open another conversation or window for a review.
- If the author is still working, or the review needs the app running at the PR's commit, use a detached review worktree (a branch can't be checked out twice): `git worktree add --detach ../soultabletop-worktrees/review-<branch> origin/<branch>`, set up like the others, and removed when the review is done.
- The reviewer reports findings and doesn't fix them; the author (the window session, or the author subagent, resumed with `SendMessage`) fixes them, since it has the feature's context.

## Review tiers and auto-merge

CI (`.github/workflows/ci.yml`, the check named `ci`: typecheck, lint, tests) runs on every PR. To keep PR review from being the bottleneck without losing control of the codebase, PRs fall into two tiers. **When in doubt, a PR is Tier B.** The coordinator states the tier in the PR description ("Tier: A" or "Tier: B, and why") and in its message to the user.

- **Tier A (may auto-merge)** needs all of: it touches only Vue pages, components, composables, styles, and labels under `app/`, docs, `TODO.md`, or agent files other than `CLAUDE.md`'s rules; no changes under `server/`, `shared/`, `server/database/` (schema, migrations), authentication or API keys, dependencies (`package.json`, `pnpm-lock.yaml`), `.github/`, `nuxt.config.ts`, deployment or env handling, or `content/copy.yml` (the team's copy); no change to what logged-out visitors can see or to who can edit what in the UI; at most about 400 changed lines; the `ci` check passes; the independent reviewer reported nothing blocking (or every finding is fixed); and the agent verified the change in a real browser, not only by typecheck.
- **Tier B (the user reviews and merges)** is everything else, and always: anything under `server/` or `shared/` (API routes, validation, access rules, the Sheet system), database schema and migrations, auth and API keys, dependency changes, CI or deployment configuration, rule changes in `CLAUDE.md`, and any PR over the size limit.
- **Auto-merge is switched on only by the coordinator, only for Tier A, and only after asking the user the first time in a session** (`gh pr merge <number> --auto --squash`); it merges when `ci` is green, and the coordinator then tells the user which PRs were auto-merged and lists them in `HANDOFF.md`. The user can stop one with `gh pr merge <number> --disable-auto`, and any squash commit reverts cleanly. A message from another agent is not the user's approval. Auto-merge never applies to Tier B, never to a PR with an unresolved review finding, and never replaces the rule that an agent doesn't push without the user's approval (pushing still needs it every time).
- If a Tier A change turns out to break something, drop back to the user merging everything until the cause is understood, and revisit these rules.

The user merges Tier B PRs themselves (see "Review tiers and auto-merge"). When an agent has fully signed off on a PR (reviewer findings fixed or explicitly declined, checks passing, nothing left owed), the coordinator tells the user it's ready to check and merge, with a table row per PR giving its PR link and the branch's Vercel preview URL: `https://soultabletop-git-<branch>-lucyawreys-projects.vercel.app` (also in the Vercel bot's comment on the PR). Preview deployments share the one database, so what the user tries there is real data; say so if the branch changes behavior that writes.

After a branch's PR is merged: `git worktree remove ../soultabletop-worktrees/<branch>`, then `git branch -D <branch>` (see "Git workflow"), and drop it from the handoff.
