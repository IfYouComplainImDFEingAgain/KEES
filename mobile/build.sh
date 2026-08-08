#!/usr/bin/env bash
# Sync the feature scripts that the mobile build shares with the desktop
# extension, then optionally zip the package.
#
# The mobile build does NOT fork user-muting.js or native-video-player.js - it
# copies them, so a fix on the desktop side lands on mobile too. The copies are
# gitignored; run this before loading mobile/ in about:debugging or web-ext, and
# re-run it after touching either shared file. CI runs this same script, so the
# copy is defined in exactly one place.
#
# Mobile-only differences belong in mobile/src/features/user-muting.css, never
# in a divergent copy of the JS.
#
# Usage:
#   ./mobile/build.sh          sync the shared files
#   ./mobile/build.sh --zip    sync, then write kees-mobile-<version>.zip to the repo root
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
src="$root/extension/src/features"
dest="$here/src/features"

SHARED_FILES=(
    user-muting.js
    native-video-player.js
)

mkdir -p "$dest"
for f in "${SHARED_FILES[@]}"; do
    if [ ! -f "$src/$f" ]; then
        echo "error: missing shared source extension/src/features/$f" >&2
        exit 1
    fi
    cp "$src/$f" "$dest/$f"
    echo "synced $f"
done

if [ "${1:-}" = "--zip" ]; then
    version="$(grep -m1 '"version"' "$here/manifest.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
    out="$root/kees-mobile-$version.zip"
    rm -f "$out"
    (cd "$here" && zip -qr "$out" manifest.json src/ settings/ icons/ -x '*/.*' '.*')
    echo "wrote $out"
fi
