#!/usr/bin/env bash
# Runs a command with the project's Node (.nvmrc, through nvm) and pnpm
# (corepack), for agent shells where they aren't on the PATH or are another
# version (see "Running commands" in .claude/CLAUDE.md):
#   scripts/agent-run.sh pnpm check
# Loads nvm directly, which is quiet and fast. If no nvm script works, falls
# back to a zsh login shell (whose .zshrc loads nvm), drops its startup noise,
# and keeps the command's exit status.
set -o pipefail
cd "$(dirname "$0")/.." || exit 1

for nvm_script in \
  "${NVM_DIR:-$HOME/.nvm}/nvm.sh" \
  /usr/share/nvm/init-nvm.sh \
  /opt/homebrew/opt/nvm/nvm.sh \
  /usr/local/opt/nvm/nvm.sh; do
  if [ -s "$nvm_script" ]; then
    # shellcheck source=/dev/null
    . "$nvm_script" >/dev/null 2>&1 && nvm use >/dev/null 2>&1 && exec "$@"
  fi
done

zsh -ilc 'nvm use >/dev/null 2>&1 && "$@"' zsh "$@" 2>&1 |
  grep -v -e "command not found" -e "can't change option" -e "gitstatus" -e "GITSTATUS" \
    -e "zshrc" -e "exec zsh" -e "Restart Zsh" -e "extra diagnostics" -e '^[[:space:]]*$'
status=${PIPESTATUS[0]}
exit "$status"
