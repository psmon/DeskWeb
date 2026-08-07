#!/usr/bin/env bash
# Assemble the UPK build directory and pack it with ugcli.
#
# Prereq: scripts/build.sh amd64 && scripts/build.sh arm64 have populated
# packaging/rootfs_{amd64,arm64}/bin and packaging/rootfs_common/www.
#
# NOTE: the exact `ugcli` invocation + UPK container format for NATIVE
# (is_docker_app:false) apps must be confirmed against the UGREEN developer
# portal. This script runs ugcli if present and otherwise stages the payload
# and tells you what to run.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$HERE/packaging"
OUT="$HERE/build_dir"
mkdir -p "$OUT"

BUILD="${1:-1}"   # ugcli --build number → version becomes x.y.z.000N

if command -v ugcli >/dev/null 2>&1; then
  echo "== ugcli found — packing (build $BUILD) =="
  # packaging/ is the ugcli project root (project.yaml + rootfs_* live here).
  ( cd "$PKG" && ugcli pack --build "$BUILD" )
  echo "✓ UPK(s):"
  find "$PKG" "$OUT" -name '*.upk' 2>/dev/null || true
else
  echo "⚠ ugcli not on PATH."
  echo "  Install it from the UGREEN developer portal, then run:"
  echo "     cd $PKG && ugcli pack --build $BUILD"
  echo "  Expected output: {amd64|arm64}_com.webnori.midiplayer_1.0.0.000${BUILD}.upk"
  echo
  echo "  Staged payload to verify:"
  echo "     $PKG/project.yaml"
  echo "     $PKG/rootfs_common/{icon.png,www/}"
  echo "     $PKG/rootfs_amd64/bin/midi-ani-player"
  echo "     $PKG/rootfs_arm64/bin/midi-ani-player"
  exit 2
fi
