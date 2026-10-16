#!/usr/bin/env bash
# Writes version.js and syncs Android versionName/versionCode with package.json. BUMP=1 bumps the patch first.
set -euo pipefail; cd "$(dirname "$0")/.."
[ "${BUMP:-0}" = 1 ] && npm version patch --no-git-tag-version >/dev/null
V=$(node -p 'require("./package.json").version'); IFS=. read MA MI PA <<<"$V"; CODE=$((MA*10000+MI*100+PA))
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo dev); D=$(date +"%b %-d")
echo "window.DC_VERSION=\"v$V · $SHA · $D\";window.DC_VERSION_CODE=$CODE;" > version.js
sed -i -E "s/versionCode [0-9]+/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$V\"/" android/app/build.gradle
echo "stamped v$V ($CODE) $SHA"
