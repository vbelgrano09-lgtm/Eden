#!/usr/bin/env bash
# EDEN verification loop: Theme Check → local preview → browser checks → zip.
# Usage: bash .claude/skills/eden-theme/scripts/verify.sh [suite]
#   suite: all (default) | home | mobile | reduced | product | other
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
SUITE="${1:-all}"
export PATH="$ROOT/node_modules/.bin:$PATH"
[ -d node_modules ] || npm install --no-audit --no-fund

echo "== Theme Check"
if ! shopify theme check --path . --fail-level error; then
  echo "Theme Check failed — fix before continuing." >&2
  exit 1
fi

echo "== Preview server"
PORT="${PORT:-4321}"
node tools/preview/server.mjs > /tmp/eden-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT/__reset" >/dev/null && break; sleep 0.3; done

echo "== Browser checks ($SUITE)"
node tools/preview/test.mjs "$SUITE" | tee /tmp/eden-browser.log
FAILS=$(grep -c '^FAIL' /tmp/eden-browser.log || true)
echo "Screenshots: tools/preview/shots/ — look at the ones your change affects."

echo "== Zip"
npm run -s zip

if [ "$FAILS" -gt 0 ]; then
  echo "$FAILS browser check(s) failed." >&2
  exit 1
fi
echo "All green."
