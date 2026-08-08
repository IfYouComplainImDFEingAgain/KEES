#!/usr/bin/env bash
# Sync the feature scripts that the mobile build shares with the desktop
# extension, then optionally zip the package.
#
# The mobile build does NOT fork the feature files listed below - it copies them,
# so a fix on the desktop side lands on mobile too. The copies are gitignored;
# run this before loading mobile/ in about:debugging or web-ext, and re-run it
# after touching any shared file. CI runs this same script, so the copy is
# defined in exactly one place.
#
# Paths are relative to extension/ and land at the same relative path under
# mobile/, so the two trees stay structurally identical.
#
# homepage-hide.css is shared because it is functional (it hides elements before
# first paint), not cosmetic. user-muting.css is the opposite case: it is pure
# presentation, so mobile keeps its own touch-sized copy and it is NOT synced.
# Mobile-only differences belong there, never in a divergent copy of the JS.
#
# Usage:
#   ./mobile/build.sh          sync the shared files
#   ./mobile/build.sh --zip    sync, then write kees-mobile-<version>.zip to the repo root
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
src="$root/extension"
dest="$here"

SHARED_FILES=(
    src/features/user-muting.js
    src/features/native-video-player.js
    src/homepage-content.js
    src/homepage-hide.css
)

for f in "${SHARED_FILES[@]}"; do
    if [ ! -f "$src/$f" ]; then
        echo "error: missing shared source extension/$f" >&2
        exit 1
    fi
    mkdir -p "$dest/$(dirname "$f")"
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
