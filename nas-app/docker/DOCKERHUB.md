# 🎵 MIDI Ani Player

**NAS·서버·PC 어디서든 도는 웹 MIDI 플레이어.** NAS 폴더/네트워크 공유의 `.mid` 파일을
브라우저에서 재생하며, 음악에 맞춰 움직이는 **연주 악단 애니메이션**과 **실시간 악보(오선보/피아노롤)**,
**BitMidi 온라인 카탈로그**를 제공합니다. 단일 컨테이너, 오프라인 재생 지원.

> `.NET 10 Native AOT` 백엔드 + `React` UI. 이미지 한 장으로 끝.

---

## ✨ 기능

- 🎹 **고음질 재생** — SpessaSynth(WASM SF3) 신디사이저, **인터넷 없이 로컬 재생**
- 🎭 **악단 애니메이션** — 곡의 악기(GM)에 맞춰 연주자 스프라이트 + 스펙트럼
- 🎼 **악보보기** — 오선보/피아노롤, 재생 커서 동기화 (대곡도 페이지 단위로 가볍게)
- 🌐 **BitMidi** — 1,839곡 사전 분류 카탈로그(8장르) 브라우즈 + 실시간 검색, 파일 없이 스트리밍
- 📁 **NAS 폴더 접근** — 폴더 마운트 **또는** 설정에서 **SMB 공유 직접 추가**(OS 마운트 불필요)

---

## 🚀 빠른 시작

```bash
docker run -d -p 29090:29090 \
  -v /path/to/midi:/music:ro \
  psmon/midiplayer:1.1.2
```

접속: **http://localhost:29090**

docker-compose:

```yaml
services:
  midiplayer:
    image: psmon/midiplayer:1.1.2
    ports:
      - "29090:29090"
    volumes:
      - ./data:/data
      - /path/to/midi:/music:ro      # 재생할 음악 폴더 (선택)
    restart: unless-stopped
```

폴더를 마운트하지 않아도, 실행 후 **⚙ 설정 → SMB 공유 추가**로 NAS 공유를 앱에서 바로 등록할 수 있습니다.

---

## ⚙️ 설정

| 항목 | 기본값 | 설명 |
|---|---|---|
| 컨테이너 포트 | `29090` | `-p 호스트:29090` 로 매핑 (비루트라 80 미만은 불가) |
| `-v .../:/music:ro` | — | 재생할 MIDI 폴더 (읽기 전용) |
| `-v .../:/data` | — | 설정 저장(settings.json) |
| `MIDI_ROOTS` | `/music` | 접근 허용 폴더 (`;` 구분) |

---

## ⚠️ 원격 접속은 HTTPS 필요

오디오 엔진(AudioWorklet)은 **보안 컨텍스트**에서만 동작합니다.

- `http://localhost:29090` → ✅ (localhost 예외)
- `http://<원격호스트>:포트` → ❌ (브라우저가 오디오 차단)
- **`https://<원격...>` → ✅** ← 원격 사용 시 앞단에 HTTPS(리버스 프록시/LB + 신뢰 인증서)

---

## 🏷️ 태그 / 아키텍처

- `psmon/midiplayer:1.1.2`, `psmon/midiplayer:latest`
- 아키텍처: **linux/amd64** (arm64 필요 시 문의)

소스: https://github.com/psmon/DeskWeb (`nas-app/`)
