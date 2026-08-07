#!/usr/bin/env bash
# Build the UI + the AOT backend for one architecture and assemble the UPK
# rootfs. Intended to run on Linux (Debian 12 / CI), matching UGOS targets.
#
# Usage: scripts/build.sh <amd64|arm64>
set -euo pipefail

ARCH="${1:-amd64}"
case "$ARCH" in
  amd64) RID="linux-x64" ;;
  arm64) RID="linux-arm64" ;;
  *) echo "unknown arch: $ARCH (use amd64|arm64)" >&2; exit 1 ;;
esac

HERE="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$HERE/packaging"

echo "== [1/3] vendored assets =="
"$HERE/scripts/fetch-assets.sh"

echo "== [2/3] frontend (vite) → rootfs_common/www =="
( cd "$HERE/frontend" && npm ci && npm run build )

echo "== [3/3] backend AOT ($RID) → rootfs_$ARCH/bin/midi-ani-player =="
OUT="$PKG/rootfs_$ARCH/bin"
mkdir -p "$OUT"
dotnet publish "$HERE/backend/MidiAniPlayer.csproj" \
  -c Release -r "$RID" \
  -p:PublishAot=true \
  -o "$HERE/backend/artifacts/$ARCH"
cp "$HERE/backend/artifacts/$ARCH/midi-ani-player" "$OUT/midi-ani-player"
# Native shared libs the AOT binary dlopens at runtime (e.g. libe_sqlite3.so).
cp "$HERE/backend/artifacts/$ARCH/"*.so "$OUT/" 2>/dev/null || true
chmod +x "$OUT/midi-ani-player"

echo "✓ assembled rootfs for $ARCH"
echo "  UI:     $PKG/rootfs_common/www"
echo "  binary: $OUT/midi-ani-player"
