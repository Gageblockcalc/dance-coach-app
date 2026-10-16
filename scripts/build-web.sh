#!/usr/bin/env bash
# Copies the static web app into dist/ (used for Cloudflare Pages deploy AND bundled into the Android app).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp -r index.html i18n.js coins.js shop.js controls.js version.js whats-new.html privacy.html app.js ui.js gamepad.js moves.js sw.js manifest.webmanifest icon-192.png icon-512.png CREDITS.md _headers sfx vendor dist/
