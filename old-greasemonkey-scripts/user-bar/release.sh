#!/bin/bash
# Release script - generates loader.user.js from loader-dev.user.js and tags the commit
#
# Usage:
#   ./release.sh v3.6.0

set -e

if [ -z "$1" ]; then
    echo "Usage: ./release.sh <tag>"
    echo "Example: ./release.sh v3.6.0"
    exit 1
fi

TAG="user-bar-$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "Generating loader.user.js from loader-dev.user.js..."
sed 's/dev/master/g' loader-dev.user.js > loader.user.js

echo "Committing..."
git add loader.user.js
git commit -m "Release $TAG"

echo "Tagging $TAG..."
git tag "$TAG"

echo ""
echo "Done! Release $TAG created."
echo "Run 'git push && git push --tags' to publish."
