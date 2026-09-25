#!/usr/bin/env bash
# Packages ./theme into dist/eden-theme.zip, ready for
# Online Store → Themes → Add theme → Upload zip file.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/eden-theme.zip
(cd theme && zip -rq -X ../dist/eden-theme.zip assets config layout locales sections snippets templates -x '*.DS_Store')
echo "Built dist/eden-theme.zip ($(du -h dist/eden-theme.zip | cut -f1))"
