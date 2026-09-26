#!/usr/bin/env bash
# Packages the theme folders (repo root) into dist/eden-theme.zip, ready for
# Online Store → Themes → Add theme → Upload zip file. Only Shopify's theme
# folders go in; README, tools, src, dist, etc. stay out.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/eden-theme.zip
zip -rq -X dist/eden-theme.zip assets config layout locales sections snippets templates -x '*.DS_Store'
echo "Built dist/eden-theme.zip ($(du -h dist/eden-theme.zip | cut -f1))"
