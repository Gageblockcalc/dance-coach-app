#!/usr/bin/env bash
# Copies the static web app into dist/ (used for Cloudflare Pages deploy AND bundled into the Android app).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp -r index.html privacy.html app.js ui.js moves.js sw.js manifest.webmanifest icon-192.png icon-512.png CREDITS.md _headers sfx vendor dist/
