# NAS App 배포 지식 (MIDI Ani Player)

DeskWeb의 MIDI Player를 NAS 전용 앱(`nas-app/`, .NET 10 AOT + React)으로 떼어내
UGREEN UGOS와 Docker로 배포하며 얻은 실전 지식. 잘 작동 검증됨.

## UGOS Pro 네이티브 앱 (developer.ugnas.com)
- 네이티브 앱 = **컴파일된 Linux 실행파일**(C/C++/Go/.NET AOT). `project.yaml` 스키마:
  `spec_version: "2.1"`, `app_id`(**소문자·숫자·점, 점 2개↑, 하이픈 불가** 예 `com.webnori.midiplayer`),
  `start_cmd: bin/<exe> --port=N`, `port`, `proxy_path: api`, `open_type: inner`,
  `i18n:`(name/description/author per locale), `tag_types`(media/utility/… 고정집합, `multimedia` 없음),
  `allow_add_access_path: true`, `permissions: [NETWORK.ACCESS_INTERNET]`, `depend_fw_version: 1.13.0.0000`.
- **www는 시스템 웹서버가 서빙**, 게이트웨이가 `/<proxy_path>/`만 백엔드 `port`로 포워딩.
- 런타임: 작업디렉토리=data 디렉토리. env `UGAPP_{INSTALL,DATA,CACHE,LOG,SHARED}_DIR`.
  인가된 공유폴더는 `$UGAPP_SHARED_DIR` 아래 심볼릭 링크로 노출 → 백엔드가 접근 루트로 사용.
- `ugcli`(1.1.0.13, Win/Linux/mac, `osswaf.ugnas.com`에서 다운—**WAF라 curl 차단, 브라우저/헤드리스로 받기**):
  `ugcli create <appid>`, `ugcli pack --build N --arch amd64` → `{arch}_{appid}_{ver}.upk`.
  **UPK는 서명된 "UGREEN-P" 컨테이너 → 수제작 불가, ugcli 필수.**
- **수동 설치엔 기기 개발자 인증 필요**: UGREEN에 이메일(시리얼+MAC+관리자계정) → `ugdev.sig` 받아
  관리자 개인폴더 업로드 → App Center>설정>앱 개발 설정>Authorize.

## .NET 10 Native AOT
- 빌드: `PublishAot` + `InvariantGlobalization`, 소스젠 JSON(`JsonSerializerContext`), `--port` 인자 파싱.
- 컨테이너 빌드: `clang zlib1g-dev` 필요. **`apt install clang`은 llvm-dev를 끌어와 느림/멈춤 →
  `--no-install-recommends` + `-o Acquire::Retries` 로 회피.**
- **런타임 컨테이너에 `libssl3` + `ca-certificates` 필수** — 없으면 HttpClient의 HTTPS 호출이
  `No usable version of libssl` → **SIGSEGV로 컨테이너 크래시**(BitMidi 프록시에서 재현됨).
- SMBLibrary 같은 리플렉션 라이브러리는 AOT 트림 경고(IL2104) → `<TrimmerRootAssembly>`로 통째 보존.

## Docker 배포 (Container Manager)
- 이미지는 **NAS 전용 아님 — 아무 Docker 호스트에서 동작**(PC/서버/클라우드). NAS 고유 요소는
  네이티브 UPK 경로에서만 사용.
- **Container Manager로 이미지 직접 실행 = UGREEN 승인 불필요**. Docker UPK로 패키징하면 여전히 승인 필요(우회 아님).
- 비루트(uid 10001) 실행 → 80 미만 포트 못 엶. **컨테이너 포트 29090 고정, 호스트만 매핑**(`-p 9010:29090`).
- **AudioWorklet은 보안 컨텍스트(HTTPS/localhost)에서만** 동작. 원격 `http://host:port`는
  `ctx.audioWorklet` undefined → 재생 실패. **원격은 HTTPS(신뢰 인증서) 종단 필수**. localhost는 예외라 됨.

## 환경/도구 함정
- **Docker Desktop(Windows)은 매핑된 네트워크 드라이브(예 `Y:` = `\\host\share`)를 바인드 마운트 못 함** →
  CIFS 볼륨(`--opt type=cifs,device=//host/share,o=username,password,uid=…`)으로 마운트. 게스트 거부 시 인증 필요.
- 앱 자체 SMB 접근: **SMBLibrary(userspace SMB2)** 로 마운트 없이 브라우즈/스트리밍. 비번은 클라이언트 미전송(빈 비번=기존 유지).
- MSYS 경로 변환: `docker -v C:/...`·`gh api /user/...`·node require에서 경로 깨짐 → `MSYS_NO_PATHCONV=1` 또는 Windows 경로.

## 레지스트리
- **GHCR**: `gh auth refresh -s write:packages` 후 `gh auth token | docker login ghcr.io`. user 패키지 visibility는
  GitHub REST로 못 바꿈 → 웹 UI에서 public 전환.
- **Docker Hub**: PAT로 `docker login`. Overview는 `POST /v2/users/login` → JWT → `PATCH /v2/repositories/<ns>/<repo>/`
  `{full_description, description}` 로 API 반영 가능.
- 시놀로지/NAS는 흔히 Docker Hub 공식만 지원 → `psmon/midiplayer` 사용.

## 검증 방법 (이 세션에서 쓴 패턴)
- Playwright(headless, `--autoplay-policy=no-user-gesture-required`)로 재생/악단(`window.__band.performerCount`)/
  악보(`.score-vis` noteSequence 길이=페이지단위)/SMB 브라우즈를 실측. 컨테이너에 fresh www 바인드 마운트해 반복 검증.
