#!/usr/bin/env bash
# Copies the static web app into dist/ (used for Cloudflare Pages deploy AND bundled into the Android app).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp -r robots.txt sitemap.xml og.png index.html i18n.js coins.js seasons.js share.js shop.js controls.js version.js whats-new.html privacy.html app.js ui.js gamepad.js moves.js features.js coach.js coach3d.js stages.js sw.js manifest.webmanifest icon-192.png icon-512.png CREDITS.md _headers sfx vendor dist/
# Stamp the version label into static HTML (visible without JS)
V=$(sed -E 's/.*DC_VERSION="([^"]*)".*/\1/' version.js)
for f in dist/index.html dist/privacy.html dist/whats-new.html; do python3 - "$f" "$V" <<'PY'
import re,sys
f,v=sys.argv[1],sys.argv[2];s=open(f).read()
s=re.sub(r'(class="[^"]*\bver\b[^"]*"[^>]*>)[^<]*(<)', lambda m: m.group(1)+v+m.group(2), s)
open(f,'w').write(s)
PY
done
