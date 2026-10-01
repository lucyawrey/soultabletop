#!/usr/bin/env bash
# Runs a command with the project's Node and pnpm, for agent shells that don't
# load nvm (there is no system Node; see "Running commands" in .claude/CLAUDE.md):
#   scripts/agent-run.sh pnpm check
# Runs it through a zsh login shell, drops that shell's startup
# noise ("command not found", "zle"), and keeps the command's exit status.
set -o pipefail
cd "$(dirname "$0")/.." || exit 1
zsh -ilc 'nvm use >/dev/null 2>&1 && "$@"' zsh "$@" 2>&1 | grep -v -e "command not found" -e "can't change option: zle"
status=${PIPESTATUS[0]}
exit "$status"
