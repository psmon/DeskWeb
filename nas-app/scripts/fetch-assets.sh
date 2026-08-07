#!/usr/bin/env bash
# Download the vendored, self-hosted engine assets into frontend/public/vendor.
# These are large binaries we don't commit; run once before building the UI.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$HERE/frontend/public/vendor"
mkdir -p "$VENDOR"

SF3="$VENDOR/GeneralUserGS.sf3"
SF3_PRIMARY="https://cdn.jsdelivr.net/gh/spessasus/SpessaSynth@master/soundfonts/GeneralUserGS.sf3"
SF3_FALLBACK="https://spessasus.github.io/SpessaSynth/soundfonts/GeneralUserGS.sf3"

if [[ -f "$SF3" ]]; then
  echo "✓ soundfont already present: $SF3"
else
  echo "↓ downloading GeneralUserGS.sf3 …"
  curl -fL --retry 3 -o "$SF3" "$SF3_PRIMARY" \
    || curl -fL --retry 3 -o "$SF3" "$SF3_FALLBACK"
  echo "✓ $(du -h "$SF3" | cut -f1) → $SF3"
fi

echo "done. (simple-engine Magenta SGM_plus mirroring is a later milestone.)"
