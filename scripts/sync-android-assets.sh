#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
ASSETS_DIR="$ROOT_DIR/android-tv/app/src/main/assets/www"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "dist/ not found. Run npm run build first." >&2
  exit 1
fi

rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -R "$DIST_DIR"/. "$ASSETS_DIR"/

echo "Synced dist/ to android-tv assets."