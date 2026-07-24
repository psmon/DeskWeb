# DeskWeb 빌드 가이드

이 문서는 DeskWeb 애플리케이션을 로컬 환경에서 빌드/실행하고, GitHub Pages로 배포하는 방법을 설명합니다.

DeskWeb은 **서버가 필요 없는 순수 정적 웹 애플리케이션**입니다.
빌드 결과물은 정적 파일이며, 어떤 정적 호스팅(GitHub Pages 등)에서도 동작합니다.

## 목차

- [로컬 환경 빌드](#로컬-환경-빌드)
- [GitHub Pages 배포](#github-pages-배포)
- [문제 해결](#문제-해결)

---

## 로컬 환경 빌드

### 필수 요구사항

- Node.js v18 이상
- npm

### 1. 개발 환경 설정

```bash
# qooxdoo 컴파일러 전역 설치
npm install -g @qooxdoo/compiler

# 프로젝트 디렉토리로 이동
cd deskweb
```

### 2. 개발 모드 실행

```bash
# 소스 모드로 컴파일
qx compile

# 개발 서버 시작
qx serve --listen-port=8080

# 브라우저에서 접속
# http://localhost:8080/deskweb/
```

### 3. 프로덕션 빌드

```bash
# 프로덕션 빌드 생성
qx compile --target=build

# 빌드 결과물 위치
# compiled/build/
```

빌드 결과물은 정적 파일이므로 아무 정적 웹서버로 서빙하면 됩니다:

```bash
# 예: npx serve로 로컬 확인
npx serve compiled/build
# http://localhost:3000/deskweb/
```

### 4. 캐시 정리

```bash
# 컴파일 캐시 삭제
qx clean

# 재컴파일
qx compile
```

---

## GitHub Pages 배포

배포는 GitHub Actions로 자동화되어 있습니다 (`.github/workflows/deploy-pages.yml`).

### 배포 방법 — 태그를 달면 배포된다

```bash
# 버전 태그 생성 및 푸시
git tag v0.1.1
git push origin v0.1.1
```

`v*` 패턴의 태그가 푸시되면:

1. GitHub Actions가 `qx compile --target=build`로 프로덕션 빌드 수행
2. `deskweb/compiled/build/`를 GitHub Pages에 배포
3. 배포 완료 후 접속: **https://psmon.github.io/DeskWeb/**

### 수동 배포

GitHub 저장소의 **Actions → Deploy to GitHub Pages → Run workflow**로 태그 없이 수동 배포도 가능합니다.

### 배포 구성 요약

| 항목 | 값 |
|------|-----|
| 트리거 | `v*` 태그 푸시 또는 수동 실행 |
| 빌드 | `qx compile --target=build` |
| 배포 대상 | `deskweb/compiled/build/` |
| 서비스 URL | https://psmon.github.io/DeskWeb/ |

---

## 문제 해결

### 컴파일 오류

```bash
# 캐시 없이 재컴파일
qx clean
qx compile
```

### 하얀 화면만 보임

- 올바른 URL 확인: `http://localhost:8080/deskweb/`
- 브라우저 콘솔(F12)에서 JavaScript 오류 확인
- 강력 새로고침 (Ctrl+Shift+R)

### 배포가 실패함

- GitHub 저장소 **Settings → Pages**에서 Source가 **GitHub Actions**인지 확인
- **Actions** 탭에서 실패한 잡의 로그 확인
- 태그가 `v*` 패턴인지 확인 (예: `v1.0.0`)

---

## 참고 자료

- [qooxdoo 문서](https://qooxdoo.org/documentation/)
- [GitHub Pages 문서](https://docs.github.com/pages)

---

## 라이선스

MIT License
