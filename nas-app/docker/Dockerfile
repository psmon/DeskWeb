# Runtime image for UGOS Container Manager (no UPK, no UGREEN approval).
# Packages the already-built AOT binary + www. Build context = nas-app/.
#   docker build -f docker/Dockerfile -t midi-ani-player:1.0.0 .
# (Run scripts/build-docker.sh amd64 first to produce the binary + www.)
FROM debian:12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends zlib1g \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m -d /home/app app

WORKDIR /app
COPY packaging/rootfs_amd64/bin/midi-ani-player /app/bin/midi-ani-player
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
