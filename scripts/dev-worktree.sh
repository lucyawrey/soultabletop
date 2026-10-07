#!/usr/bin/env bash
# Starts the dev server of one of this repo's git worktrees, with the main
# checkout's .env.local (on port 3000, or the next free one Nuxt picks):
#   pnpm dev:worktree                 # list the worktrees
#   pnpm dev:worktree <branch> [port] # a worktree by its branch
#   pnpm dev:worktree main [port]     # the main checkout, on any branch
# (or scripts/dev-worktree.sh with the same arguments)
# Works from any checkout of the repo. Installs dependencies first when the
# worktree has none. Uses the worktree's .claude/scripts/agent-run.sh for the
# project's Node and pnpm. Stop it with Ctrl+C.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# The first entry of `git worktree list` is the main checkout.
main=$(git -C "$here" worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')

if [ $# -eq 0 ]; then
  echo "Worktrees (pass a branch name):"
  git -C "$main" worktree list
  exit 0
fi

target=$1
if [ "$target" = main ]; then
  dir=$main
else
  dir=$(git -C "$main" worktree list --porcelain | awk -v ref="refs/heads/$target" '
    /^worktree /{path = substr($0, 10)}
    /^branch / && substr($0, 8) == ref {print path; exit}')
fi
if [ -z "$dir" ]; then
  echo "No worktree has the branch '$target'. Worktrees:" >&2
  git -C "$main" worktree list >&2
  exit 1
fi

env_file="$main/.env.local"
if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

run="$dir/.claude/scripts/agent-run.sh"
if [ ! -d "$dir/node_modules" ]; then
  echo "Installing dependencies in $dir"
  "$run" pnpm install
fi
echo "Starting $target ($dir)"
if [ -n "${2:-}" ]; then
  exec "$run" pnpm nuxt dev --dotenv "$env_file" --port "$2"
fi
exec "$run" pnpm nuxt dev --dotenv "$env_file"
