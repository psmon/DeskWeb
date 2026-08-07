# 🎵 MIDI Ani Player

![MIDI Ani Player — band, piano keyboard & playlist](https://raw.githubusercontent.com/psmon/DeskWeb/main/nas-app/img/midipalyer1.jpg)

### ▶ Live demo — **https://midi.webnori.com/**  (try it in your browser)

**A web MIDI player for your NAS, server, or PC.** Play `.mid` files from NAS folders
or online right in the browser — with an **animated performer band**, a **live piano
keyboard**, **staff / score view**, and a tap‑to‑play **drum pad**. One container,
offline playback, mobile‑friendly.

> `.NET 10 Native AOT` backend + `React` UI. Ships as a single image.

---

## ✨ Features

- 🎭 **Animated performer band** — each instrument in the song gets an anime performer + a live spectrum.
- 🎹 **Live piano keyboard** — a vertical keyboard whose keys are struck as the music plays (default score view).
- 🎼 **Staff score view (5‑line)** — real notation that scrolls line‑by‑line, kept light via page windowing.
- 🥁 **Tap‑to‑jam drum pad** — click/touch the stage to add drums: **left = drum kit, right = DJ FX**, multi‑touch.
- 🎧 **BitMidi built‑in** — 2,200+ pre‑categorized songs + **instant full‑text search** (embedded DB, no whole‑list load), streamed with no local files.
- 📂 **Persistent library** — scan a NAS folder once; your library, favorites & settings survive restarts in an embedded DB (incremental rescans). Big lists stay fast (paged, virtualized).
- ❤️ **Favorites** — like any track into your own list.
- 📁 **NAS folders** — mount a folder, or add an **SMB share** right in Settings (no OS mount).
- 📱 **Mobile‑friendly** — YouTube‑Music‑style list → band, plus offline high‑quality synthesis (self‑hosted SoundFont).

![Band + staff score view](https://raw.githubusercontent.com/psmon/DeskWeb/main/nas-app/img/midipalyer2.jpg)

---

## 🚀 Quick start

```bash
docker run -d -p 29090:29090 \
  -v /path/to/midi:/music:ro \
  psmon/midiplayer:latest
```

Open **http://localhost:29090**

docker-compose:

```yaml
services:
  midiplayer:
    image: psmon/midiplayer:latest
    ports:
      - "29090:29090"
    volumes:
      - ./data:/data
      - /path/to/midi:/music:ro      # your music folder (optional)
    restart: unless-stopped
```

No folder mounted? Open **⚙ Settings → add an SMB share** to browse a NAS share directly.

---

## ⚙️ Configuration

| Item | Default | Notes |
|---|---|---|
| Container port | `29090` | map with `-p <host>:29090` (runs as non‑root, so ports < 1024 aren't allowed) |
| `-v .../:/music:ro` | — | folder of `.mid` files (read‑only) |
| `-v .../:/data` | — | persists the app DB (settings, SMB shares, scanned library, catalog). Keep it to survive `docker rm`. |
| `MIDI_ROOTS` | `/music` | allowed folders (`;`‑separated), the browse boundary |

---

## ⚠️ Remote access needs HTTPS

The audio engine (Web Audio **AudioWorklet**) only runs in a **secure context**:

- `http://localhost:29090` → ✅ (localhost is exempt)
- `http://<remote-host>:port` → ❌ (browser blocks audio)
- **`https://<remote…>` → ✅** — put HTTPS (reverse proxy / LB + trusted cert) in front for remote use.

---

## 🏷️ Tags / architecture

- `psmon/midiplayer:latest`, versioned tags (e.g. `1.3.0`)
- **Multi-arch — `linux/amd64` + `linux/arm64` in one tag.** `docker pull` / `run`
  auto-selects the image for your host, so the **same command runs natively** on:
  - 🖥️ **Intel / AMD** — x86 servers, Intel Macs, most NAS boxes (amd64)
  - 🍎 **Apple Silicon** Macs (M1–M4) and 🧩 **arm64 NAS** / SBCs (arm64)
  - No emulation, no per-arch tag to pick — just `docker pull psmon/midiplayer:1.3.0`.

Source: https://github.com/psmon/DeskWeb (`nas-app/`)
