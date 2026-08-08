#!/usr/bin/env bash
# Assemble the loadable KEES Mobile extension into mobile/build/.
#
# mobile/ on its own is NOT a loadable extension. It holds only the files that
# are unique to the Android build; the feature scripts come from extension/ and
# are copied in here, so a fix on the desktop side lands on mobile too. Nothing
# is copied into the source tree - everything lands in mobile/build/, which is
# gitignored and rebuilt from scratch on every run.
#
# Point web-ext and about:debugging at mobile/build, never at mobile/:
#   ./mobile/build.sh
#   web-ext run -t firefox-android --source-dir mobile/build \
#       --firefox-apk org.mozilla.firefox --android-device <id>
#
# homepage-hide.css is shared because it is functional (it hides elements before
# first paint), not cosmetic. user-muting.css is the opposite case: it is pure
# presentation, so mobile keeps its own touch-sized copy and it is NOT synced.
# Mobile-only differences belong there, never in a divergent copy of the JS.
#
# Usage:
#   ./mobile/build.sh          assemble mobile/build/
#   ./mobile/build.sh --zip    assemble, then write kees-mobile-<version>.zip to the repo root
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
shared_src="$root/extension"
out="$here/build"

# Files unique to the Android build, copied from mobile/ verbatim.
OWN_FILES=(
    manifest.json
    settings/settings.html
    settings/settings.js
    src/features/user-muting.css
    icons/kiwi-logo-extension-48.png
    icons/kiwi-logo-extension-128.png
)

# Files owned by the desktop extension and shared with this build. They keep the
# same relative path so the two trees stay structurally identical.
SHARED_FILES=(
    src/features/user-muting.js
    src/features/native-video-player.js
    src/homepage-content.js
    src/homepage-hide.css
)

copy_in() {
    local from="$1" rel="$2"
    if [ ! -f "$from" ]; then
        echo "error: missing source $from" >&2
        exit 1
    fi
    mkdir -p "$out/$(dirname "$rel")"
    cp "$from" "$out/$rel"
}

# Rebuild from scratch so a renamed or deleted source file cannot linger in the
# output and end up shipped.
rm -rf "$out"
mkdir -p "$out"

for f in "${OWN_FILES[@]}"; do
    copy_in "$here/$f" "$f"
done
for f in "${SHARED_FILES[@]}"; do
    copy_in "$shared_src/$f" "$f"
    echo "shared  $f"
done

# Every local file the manifest points at must exist in the output, or the build
# silently ships an extension with dead pages, missing icons, or - the failure
# this is really here to catch - a content script that never runs because its
# file was never copied in.
status=0
while read -r ref; do
    if [ ! -e "$out/$ref" ]; then
        echo "error: manifest references missing file: $ref" >&2
        status=1
    fi
done < <(jq -r '
    [ .options_ui.page?,
      .action.default_popup?,
      (.content_scripts // [] | .[] | (.js // [] | .[])),
      (.content_scripts // [] | .[] | (.css // [] | .[])),
      (.icons // {} | .[]),
      (.action.default_icon // {} | .[])
    ] | map(select(type == "string")) | unique | .[]' "$out/manifest.json")
[ $status -eq 0 ] || exit $status

echo "built $out"

if [ "${1:-}" = "--zip" ]; then
    version="$(jq -r '.version' "$out/manifest.json")"
    zipfile="$root/kees-mobile-$version.zip"
    rm -f "$zipfile"
    (cd "$out" && zip -qr "$zipfile" . -x '*/.*' '.*')
    echo "wrote $zipfile"
fi
