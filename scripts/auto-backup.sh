#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/codygibbs/tv-dashboard"

cd "$REPO_DIR"

# Only commit/push when there are changes
if [[ -z "$(git status --porcelain)" ]]; then
  exit 0
fi

git add -A

git commit -m "Auto backup: $(date '+%Y-%m-%d %H:%M:%S')"

git push
