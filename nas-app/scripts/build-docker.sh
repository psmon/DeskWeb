#!/usr/bin/env bash
# Reproducible UPK-payload build using Docker only (no local .NET/Node/clang).
# Builds the UI + the Native AOT backend for one arch and assembles the rootfs.
#
# Usage: scripts/build-docker.sh <amd64|arm64>
#   amd64 builds natively; arm64 uses QEMU emulation (slower) unless run on an
#   arm64 host. Output lands in packaging/rootfs_{arch}/bin + rootfs_common/www.
set -euo pipefail

ARCH="${1:-amd64}"
case "$ARCH" in
  amd64) RID="linux-x64";   PLAT="linux/amd64" ;;
  arm64) RID="linux-arm64"; PLAT="linux/arm64" ;;
  *) echo "unknown arch: $ARCH (use amd64|arm64)" >&2; exit 1 ;;
esac

HERE="$(cd "$(dirname "$0")/.." && pwd)"
# Docker Desktop on Windows wants a Windows-style host path for -v.
HOSTPATH="$(cd "$HERE" && pwd -W 2>/dev/null || pwd)"
DRUN() { MSYS_NO_PATHCONV=1 docker run --rm -v "$HOSTPATH:/src" "$@"; }

echo "== [1/3] vendored assets (soundfont) =="
bash "$HERE/scripts/fetch-assets.sh"

echo "== [2/3] frontend (node) → rootfs_common/www =="
DRUN -w /src/frontend node:22-bookworm \
  bash -c "npm ci && npm run build"

echo "== [3/3] backend AOT ($RID, $PLAT) → rootfs_$ARCH/bin =="
DRUN --platform "$PLAT" mcr.microsoft.com/dotnet/sdk:10.0 bash -c "
  set -e
  # --no-install-recommends avoids the huge llvm-*-dev; retries/timeout so a
  # stalled mirror fails fast instead of hanging.
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    -o Acquire::Retries=5 -o Acquire::http::Timeout=30 \
    clang zlib1g-dev >/dev/null
  dotnet publish /src/backend/MidiAniPlayer.csproj -c Release -r $RID \
    -p:PublishAot=true --artifacts-path /tmp/art -o /out
  mkdir -p /src/packaging/rootfs_$ARCH/bin
  cp /out/midi-ani-player /src/packaging/rootfs_$ARCH/bin/
  chmod +x /src/packaging/rootfs_$ARCH/bin/midi-ani-player
"

echo "✓ assembled rootfs for $ARCH"
echo "  UI:     $HERE/packaging/rootfs_common/www"
echo "  binary: $HERE/packaging/rootfs_$ARCH/bin/midi-ani-player"
echo
echo "Next: install ugcli (UGREEN dev portal), then:"
echo "  cd $HERE/packaging && ugcli pack --build 1"
