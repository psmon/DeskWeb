---
name: deskweb-app
description: "DeskWeb 일반 애플리케이션 생성 스킬. qooxdoo 프레임워크 기반 윈도우 앱(메모장, 엑셀, HWP뷰어, iframe앱 등)을 추가할 때 사용. 사용 사례: (1) 새로운 윈도우 앱 추가시, (2) 파일 연동 앱 구현시, (3) 외부 라이브러리 통합 앱 구현시, (4) iframe 기반 외부 URL 앱 추가시."
author: DeskWeb Team
date: 2026-03-07
---

# DeskWeb 일반 애플리케이션 생성 스킬

## 프로젝트 컨텍스트
- DeskWeb은 qooxdoo v7.9 기반 Windows XP 스타일 웹 데스크톱
- 소스 경로: `deskweb/source/class/deskweb/`
- 프로젝트 가이드: `prompt/deskweb/agent.md`

## Instructions

### 1. 앱 파일 생성
UI 컴포넌트를 `deskweb/source/class/deskweb/ui/` 하위에 생성:

```javascript
qx.Class.define("deskweb.ui.NewAppWindow", {
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "앱 이름", "deskweb/images/newapp.svg");
    this.set({
      width: 600,
      height: 400,
      showMinimize: true,
      showMaximize: true,
      allowMaximize: true,
      contentPadding: 0
    });
    this.setLayout(new qx.ui.layout.VBox());
    this._createUI();
  },

  members: {
    _createUI: function() {
      // UI 구성
    }
  }
});
```

### 2. Application.js에 등록 (3곳 수정 필수)
파일: `deskweb/source/class/deskweb/Application.js`

```
(a) _createDesktopIcons() - 바탕화면 아이콘 추가
(b) _openNewAppWindow() - 창 열기 메서드 추가
(c) _onStartMenuItemClick() - 시작 메뉴 항목 추가
```

### 3. 아이콘 생성
- 위치: `deskweb/source/resource/deskweb/images/newapp.svg`
- SVG 형식으로 직접 제작

### 4. 파일 연동 앱인 경우
- `deskweb/source/class/deskweb/util/FileExtensionRegistry.js`에 확장자 매핑 등록
- StorageManager를 통한 localStorage 기반 파일 저장/로드
- 내 컴퓨터(MyComputerWindow)에서 더블클릭시 해당 앱으로 열리도록 연동

### 5. 외부 라이브러리 통합시
- `deskweb/source/resource/` 하위에 라이브러리 배치
- `Manifest.json` 또는 HTML에서 스크립트 로드 설정
- qooxdoo 클래스 내에서 `@ignore` 어노테이션으로 외부 전역 객체 참조

### 6. iframe 기반 앱
- 외부 URL을 로드하는 앱은 `qx.ui.embed.Iframe` 활용
- favicon 아이콘 자동 로드 기능 포함
- 리사이즈 지원, 마지막 크기 기억

## 앱 유형별 참조 패턴

| 앱 유형 | 참조 파일 | 핵심 패턴 |
|---------|----------|-----------|
| 텍스트 편집기 | NotepadWindow.js | localStorage 저장, 자동저장, 확장자 매핑 |
| 문서 뷰어 | HWPViewerWindow.js | 외부 라이브러리, 파서/렌더러 분리, 드래그앤드롭 |
| 스프레드시트 | CalcWindow.js | 엔진 분리(SpreadsheetEngine), 수식 파서, 튜토리얼 |
| iframe 앱 | AskBotWindow.js | qx.ui.embed.Iframe, favicon, 커스텀 앱 추가 |

## 공통 규칙
- 윈도우 창은 반드시 `qx.ui.window.Window` 상속
- 로직이 복잡하면 `util/` 하위로 엔진 분리 (예: SpreadsheetEngine, FormulaParser)
- 반응형 디자인 적용 (창 리사이즈 대응)
- 세션 스토리지 개념 준수 (멀티 윈도우 지원)

## 빌드/테스트
```bash
docker exec deskweb-dev qx compile    # 소스 컴파일
docker logs deskweb-dev -f             # 로그 확인
# 접속: http://localhost:9090/deskweb/ (dev)
```
