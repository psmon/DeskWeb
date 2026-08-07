# Runtime image for UGOS Container Manager (no UPK, no UGREEN approval).
# Packages the already-built AOT binary + www. Build context = nas-app/.
#   docker build -f docker/Dockerfile -t midi-ani-player:1.0.0 .
# (Run scripts/build-docker.sh amd64 first to produce the binary + www.)
FROM debian:12-slim
# BuildKit sets TARGETARCH to amd64 / arm64 — matching our rootfs_<arch> dir names.
# So one Dockerfile builds both (Intel + Apple-Silicon/NAS-arm) via buildx:
#   docker buildx build --platform linux/amd64,linux/arm64 -f docker/Dockerfile -t <img> .
# (run scripts/build-docker.sh amd64 AND arm64 first to produce each rootfs.)
ARG TARGETARCH=amd64

# libssl3 + ca-certificates are REQUIRED for outbound HTTPS (BitMidi proxy);
# without them .NET HttpClient crashes ("No usable version of libssl"). zlib1g
# is needed by the AOT runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends zlib1g libssl3 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m -d /home/app app

WORKDIR /app
# Copy the arch-matched bin dir: the AOT binary PLUS native shared libs it dlopens
# at runtime (e.g. libe_sqlite3.so for the embedded playlist DB) — these are NOT
# statically linked into the single binary.
COPY packaging/rootfs_${TARGETARCH}/bin/ /app/bin/
COPY packaging/rootfs_common/www /app/www
RUN chmod +x /app/bin/midi-ani-player \
 && mkdir -p /data /music \
 && chown -R app /data

# MIDI_ROOTS=/music → bind-mount your NAS music folder there in compose.
ENV MIDI_WWW=/app/www \
    MIDI_DATA_DIR=/data \
    MIDI_ROOTS=/music \
    MIDI_PORT=29090
EXPOSE 29090
USER app
ENTRYPOINT ["/app/bin/midi-ani-player", "--port=29090"]
