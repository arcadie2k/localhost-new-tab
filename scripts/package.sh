#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/extension/manifest.json').version")"
OUT="$ROOT/dist/localhost-new-tab-$VERSION.zip"

(cd "$ROOT" && node --test >/dev/null) || { echo "Tests failed, nothing was packaged. Run: node --test" >&2; exit 1; }
if ! git -C "$ROOT" ls-remote --exit-code --tags origin "v$VERSION" >/dev/null 2>&1; then
  echo "Note: tag v$VERSION is not on GitHub yet. Push it before publishing, the setup command downloads install.sh from it." >&2
fi

mkdir -p "$ROOT/dist"
rm -f "$OUT"
cd "$ROOT/extension"
zip -rqX "$OUT" . -x ".*" -x "*/.*"
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
