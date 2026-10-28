#!/bin/sh
set -eu

HOST_NAME="com.arcadie.localhost_newtab"
VERSION="1.0.0"
REPO="arcadie2k/localhost-new-tab"
BASE_URL="${LNT_BASE_URL:-https://raw.githubusercontent.com/$REPO/v$VERSION}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--uninstall" ]; then
  for base in "$HOME/Library/Application Support/Google/Chrome" \
              "$HOME/Library/Application Support/Google/Chrome Beta" \
              "$HOME/Library/Application Support/Chromium" \
              "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
              "$HOME/Library/Application Support/Arc/User Data"; do
    rm -f "$base/NativeMessagingHosts/$HOST_NAME.json"
  done
  if [ "${2:-}" = "--keep-history" ]; then
    find "$HOME/.localhost-new-tab" -mindepth 1 -maxdepth 1 ! -name state.json -exec rm -rf {} + 2>/dev/null || true
    echo "Removed the helper. Project history kept in ~/.localhost-new-tab/state.json"
  else
    rm -rf "$HOME/.localhost-new-tab"
    echo "Removed the helper and all its data (~/.localhost-new-tab)."
  fi
  echo "Remove the extension itself from chrome://extensions if you haven't already."
  exit 0
fi

if [ $# -lt 1 ]; then
  echo "Usage: install.sh <extension-id> [more-ids...]"
  echo "Open a new tab with the extension enabled: it shows the full command with your ID."
  exit 1
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node.js not found. Install Node 18 or newer (https://nodejs.org), then run this again." >&2
  exit 1
fi
if [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "Node $("$NODE" -v) is too old. Install Node 18 or newer, then run this again." >&2
  exit 1
fi

if [ -f "$DIR/host/host.js" ]; then
  SOURCE="$DIR/host/host.js"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "Downloading helper v$VERSION..."
  curl -fsSL "$BASE_URL/host/host.js" -o "$TMP/host.js" || { echo "Download failed: $BASE_URL/host/host.js" >&2; exit 1; }
  [ -s "$TMP/host.js" ] && "$NODE" --check "$TMP/host.js" 2>/dev/null || { echo "Downloaded helper is invalid, nothing was installed." >&2; exit 1; }
  SOURCE="$TMP/host.js"
fi

BIN="$HOME/.localhost-new-tab/bin"
mkdir -p "$BIN"
cp "$SOURCE" "$BIN/host.js"
cat > "$BIN/run-host.sh" <<EOF
#!/bin/sh
exec "$NODE" "$BIN/host.js" "\$@" 2>> "$HOME/.localhost-new-tab/host.err"
EOF
chmod +x "$BIN/run-host.sh"

ORIGINS=""
for id in "$@"; do
  ORIGINS="$ORIGINS${ORIGINS:+, }\"chrome-extension://$id/\""
done

MANIFEST=$(cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "localhost new tab helper",
  "path": "$BIN/run-host.sh",
  "type": "stdio",
  "allowed_origins": [$ORIGINS]
}
EOF
)

installed=0
for base in "$HOME/Library/Application Support/Google/Chrome" \
            "$HOME/Library/Application Support/Google/Chrome Beta" \
            "$HOME/Library/Application Support/Chromium" \
            "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
            "$HOME/Library/Application Support/Arc/User Data"; do
  [ -d "$base" ] || continue
  mkdir -p "$base/NativeMessagingHosts"
  printf '%s\n' "$MANIFEST" > "$base/NativeMessagingHosts/$HOST_NAME.json"
  echo "Installed for: $base"
  installed=1
done

[ "$installed" = 1 ] || { echo "No Chromium browser profile folder found" >&2; exit 1; }
echo "Done. Open a new tab."
