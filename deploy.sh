#!/usr/bin/env bash
# Deploy app/ to Cloudflare Pages with cache-busting.
#
# Why this exists: CF Pages caches JS modules (default 4h), and a query string on
# the *page* URL can't bust them — only each module's OWN url can change. So we
# stamp ?v=BUILD onto every <script src> and every relative .js import. The HTML is
# always-revalidated (max-age=0, see app/_headers), so a fresh page load pulls the
# new module URLs automatically — no private tab, no clearing site data. This is the
# app's only "build step": a copy + a sed, no bundler/transpile. Source stays clean.
set -euo pipefail

BUILD="$(date +%m%d-%H%M)"
SRC="$(cd "$(dirname "$0")" && pwd)/app"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cp -R "$SRC"/. "$OUT"/

# The visible build stamp (Home footer + test panel).
printf 'export const VERSION = "0.3 · %s";\n' "$BUILD" > "$OUT/version.js"

# Cache-bust: append ?v=BUILD to relative .js imports and to <script src="*.js">.
find "$OUT" -name '*.js'   -type f -exec sed -i '' -E "s#from \"(\.[^\"]*\.js)\"#from \"\1?v=$BUILD\"#g" {} +
find "$OUT" -name '*.html' -type f -exec sed -i '' -E "s#src=\"([^\"]*\.js)\"#src=\"\1?v=$BUILD\"#g" {} +

echo "Deploying build $BUILD …"
wrangler pages deploy "$OUT" --project-name=cello-tracker --commit-dirty=true
echo "✅ Deployed build $BUILD"
