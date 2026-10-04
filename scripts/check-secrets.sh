#!/usr/bin/env bash
# Checks commits about to be pushed for secrets, without printing any:
#   scripts/check-secrets.sh            # commits not yet on this branch's upstream
#   scripts/check-secrets.sh <range>    # e.g. origin/main..HEAD
# Every commit's patch is searched (a secret added and removed again is still
# pushed), for the values in .env.local (the main checkout's if this one has
# none) and for connection strings and common key prefixes. Prints only
# variable names and pattern names. Exits 0 when clean, 1 on a hit, 2 when it
# couldn't check (no range, no .env.local): don't push then either.
set -o pipefail
cd "$(dirname "$0")/.." || exit 2

range=$1
if [ -z "$range" ]; then
  if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
    range='@{upstream}..HEAD'
  else
    range='origin/main..HEAD'
  fi
fi

env_file=.env.local
if [ ! -f "$env_file" ]; then
  main_checkout=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
  env_file="$main_checkout/.env.local"
fi
if [ ! -f "$env_file" ]; then
  echo "check-secrets: no .env.local found; can't check" >&2
  exit 2
fi

patch_file=$(mktemp)
trap 'rm -f "$patch_file"' EXIT
if ! git log -p --format='commit %H' "$range" >"$patch_file"; then
  echo "check-secrets: can't read commits in $range" >&2
  exit 2
fi

hits=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in '#'* | '') continue ;; esac
  name=${line%%=*}
  value=${line#*=}
  value=${value%\"}
  value=${value#\"}
  value=${value%\'}
  value=${value#\'}
  # Short values (flags, ports) would match by chance.
  [ ${#value} -ge 12 ] || continue
  if grep -qF -- "$value" "$patch_file"; then
    echo "check-secrets: the value of $name appears in $range"
    hits=1
  fi
done <"$env_file"

check_pattern() {
  if grep -qE -- "$2" "$patch_file"; then
    echo "check-secrets: $1 appears in $range"
    hits=1
  fi
}
check_pattern "a Postgres connection string with a password" 'postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@'
check_pattern "a GitHub token" '(ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
check_pattern "an AWS access key" 'AKIA[0-9A-Z]{16}'
check_pattern "an API key with an sk- prefix" 'sk-[A-Za-z0-9_-]{24,}'
check_pattern "a private key" 'BEGIN [A-Z ]*PRIVATE KEY'

if [ "$hits" -ne 0 ]; then
  echo "check-secrets: don't push; remove the secret from the commits first" >&2
  exit 1
fi
echo "check-secrets: clean ($(grep -c '^commit ' "$patch_file") commits in $range)"
