---
name: deskweb-convention
description: "DeskWeb 프로젝트 컨벤션 및 공통 패턴 스킬. 프로젝트 구조, 빌드, 테스트, 스토리지, 테마, 아이콘 관리 등 공통 규칙 참조시 사용. 사용 사례: (1) 프로젝트 구조/컨벤션 확인시, (2) 빌드/배포 절차시, (3) 스토리지/세션 관리시, (4) 아이콘/테마 커스텀시, (5) 바탕화면 기능 추가시."
author: DeskWeb Team
date: 2026-03-07
---

# DeskWeb 프로젝트 컨벤션 스킬

## 프로젝트 개요
- **프레임워크**: qooxdoo v7.9
- **컨셉**: Windows XP 스타일 웹 데스크톱 (WebOS)
- **DEMO**: https://webos.webnori.com/
- **프로젝트 가이드**: `prompt/deskweb/agent.md`

## 소스 구조
```
deskweb/source/class/deskweb/
├── Application.js          # 메인 (앱 등록/실행 허브)
├── theme/                  # Windows XP 테마
│   ├── Theme.js, Color.js, Decoration.js, Appearance.js, Font.js
├── ui/                     # UI 컴포넌트 (윈도우 앱들)
│   ├── DesktopIcon.js      # 바탕화면 아이콘
│   ├── Taskbar.js          # 작업표시줄
│   ├── StartMenu.js        # 시작 메뉴
│   └── *Window.js          # 각 앱 윈도우
├── game/                   # 게임 로직 (UI와 분리)
│   └── *Game.js, *AI.js
└── util/                   # 유틸리티
    ├── StorageManager.js       # 가상 파일 시스템
    ├── FileExtensionRegistry.js # 확장자-앱 매핑
    ├── IconPositionManager.js  # 아이콘 위치 관리
    └── AppController.js        # AI-OS 앱 제어
```

## 핵심 컨벤션

### 1. 새 앱 추가 절차
1. `ui/NewAppWindow.js` 생성 (qx.ui.window.Window 상속)
2. 로직 복잡시 `game/` 또는 `util/`에 엔진 분리
3. `Application.js` 3곳 수정:
   - `_createDesktopIcons()` - 아이콘 등록
   - `_openNewAppWindow()` - 창 열기 메서드
   - `_onStartMenuItemClick()` - 시작 메뉴 연결
4. SVG 아이콘: `source/resource/deskweb/images/`
5. 컴파일: `docker exec deskweb-dev qx compile`

### 2. 스토리지 관리
- **StorageManager**: localStorage 기반 가상 파일 시스템
- 세션 ID별 격리: `c:/webroot/{sessionId}/...`
- 파일 저장시 확장자 매핑으로 앱 연결 (FileExtensionRegistry)
- 세션 스토리지 개념 준수 (멀티 윈도우 동시 실행 지원)
- 전역 설정 사용 금지 (윈도우별 독립 상태 관리)

### 3. 바탕화면 기능
- **아이콘 드래그**: DesktopIcon.js (위치 저장/복원)
- **우클릭 메뉴**: 앱 추가 (이름+URL → iframe 앱), 앱 삭제
- **아이콘 선택**: 클릭시 선택 오버레이 표시
- **커스텀 앱**: favicon 자동 로드, 아이콘 변경 기능

### 4. 윈도우 앱 공통 패턴
- `qx.ui.window.Window` 상속
- 최소화/최대화/닫기 버튼 지원
- 리사이즈 지원 (마지막 크기 기억)
- Taskbar에 자동 등록
- 반응형 디자인 (창 크기 변화 대응)

### 5. 외부 라이브러리 통합
- 리소스: `source/resource/` 하위 배치
- CDN 로드: HTML 또는 동적 스크립트 로드
- qooxdoo 내 외부 전역 객체: `@ignore` 어노테이션
- 예: Three.js, marked.js, Mermaid, hwp.js, pako

### 6. 테마/스타일
- Windows XP 룩앤필 유지
- 커스텀 위젯 외형: `theme/Appearance.js`
- 색상: `theme/Color.js`
- 데코레이션: `theme/Decoration.js`

## 개발/빌드 명령어
```bash
# 개발 서버 실행
docker-compose --profile dev up deskweb-dev -d

# 소스 컴파일 (도커 재시작 없이)
docker exec deskweb-dev qx compile

# 로그 확인
docker logs deskweb-dev -f

# 접속 URL
# 개발: http://localhost:9090/deskweb/
# 프로덕션: http://localhost:80/deskweb/
```

## 디버깅 팁
- 개발시 로그를 꼼꼼히 작성 (`this.debug()`, `console.log`)
- 도커 재시작 없이 `qx compile`로 즉시 반영
- 브라우저 DevTools로 실시간 확인
- 멀티 윈도우 동시 열기 테스트 필수
