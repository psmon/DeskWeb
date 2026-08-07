---
name: multiarch-build
type: knowledge
title: 멀티아키텍처(amd64+arm64) 이미지 전략 — 후속(GitHub Actions)
---

# 멀티아키텍처 이미지 전략 (후속 과제)

미디플레이어(AOT) 도커 배포를 **amd64(인텔/AMD) + arm64(애플실리콘 맥·arm NAS)** 로 확장하는 방법.
현재는 amd64 로컬 빌드만 반영, 멀티아치는 **분리된 후속**으로 진행.

## 핵심 원리
- **단일 AOT 바이너리로 두 아치 불가** — Native AOT는 RID별(linux-x64/linux-arm64) 기계어. 유니버설(fat) 바이너리 개념 없음.
- **단일 이미지 태그가 자동 선택은 가능** — **매니페스트 리스트(멀티아치 이미지)**. `docker pull/run`이 호스트 아치에 맞는 변형을 자동 선택 → 사용자는 태그 하나로 인텔/M칩 모두 네이티브 실행.
- "두 바이너리 + uname 분기" 뚱뚱한 이미지는 **비권장**: 단일 플랫폼 이미지는 타 아치 호스트에서 컨테이너 전체가 에뮬레이션 → 네이티브 성능 안 남, 크기만 2배.

## 준비된 것 (이미 반영)
- `scripts/build-docker.sh <amd64|arm64>` — 각 아치 AOT 바이너리 **+ 아치별 `libe_sqlite3.so`** 산출.
- `docker/Dockerfile` — `ARG TARGETARCH`로 `rootfs_${TARGETARCH}/bin` 자동 선택(멀티아치 대응).

## 왜 GitHub Actions인가
- 개발 PC가 단일 아치라 반대편 아치는 **QEMU 에뮬 빌드(느림, ~10~20분)** 또는 실패 위험.
- CI는 **네이티브 러너**로 각 아치 빌드 가능: `ubuntu-latest`(x64) + `ubuntu-24.04-arm`(arm64 네이티브) 매트릭스 → 크로스/에뮬 회피.

## 후속 구현 스케치 (`.github/workflows/`)
```yaml
# 매트릭스로 아치별 네이티브 빌드 → rootfs 아티팩트 → buildx로 매니페스트 push
strategy: { matrix: { include: [
  { arch: amd64, runner: ubuntu-latest },
  { arch: arm64, runner: ubuntu-24.04-arm } ] } }
# 각 잡: scripts/build.sh $arch  (네이티브, QEMU 불필요)
# 마지막 잡: docker buildx build --platform linux/amd64,linux/arm64 \
#   -f docker/Dockerfile -t psmon/midiplayer:<ver> --push .
```
또는 단일 러너 + QEMU:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -f docker/Dockerfile -t psmon/midiplayer:<ver> --push .
```
(단 arm64 AOT는 QEMU라 느림 → 네이티브 러너 매트릭스 권장.)

## 로컬 검증(푸시 전)
```bash
scripts/build-docker.sh amd64 && scripts/build-docker.sh arm64
# --load는 멀티플랫폼 불가 → 아치별로 따로 load해 각각 구동 확인, 매니페스트는 CI에서 --push
```

## 주의
- arm64 rootfs 미빌드 시 buildx 멀티아치는 실패 → 두 rootfs 모두 존재해야 함.
- `.so` 누락 함정 재발 방지: 각 아치 `rootfs_<arch>/bin`에 `libe_sqlite3.so` 포함 확인.
- 관련: [[nas-app-deployment]]
