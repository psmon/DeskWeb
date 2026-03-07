---
name: deskweb-game
description: "DeskWeb 게임 애플리케이션 생성 스킬. qooxdoo 프레임워크 내에서 Canvas/Three.js 기반 게임을 구현할 때 사용. 사용 사례: (1) 2D Canvas 기반 카드/보드 게임 구현시, (2) Three.js 3D 게임 구현시, (3) 게임 AI(LLM) 통합시, (4) 게임 상태 관리/저장시."
author: DeskWeb Team
date: 2026-03-07
---

# DeskWeb 게임 애플리케이션 생성 스킬

## 프로젝트 컨텍스트
- DeskWeb은 qooxdoo v7.9 기반 Windows XP 스타일 웹 데스크톱
- 소스 경로: `deskweb/source/class/deskweb/`
- 프로젝트 가이드: `prompt/deskweb/agent.md`

## Instructions

### 1. 파일 구조 (UI/로직 분리 필수)
```
deskweb/source/class/deskweb/
├── ui/NewGameWindow.js      # UI 윈도우 (qooxdoo 위젯)
├── game/NewGameGame.js       # 게임 로직 (렌더링, 규칙)
└── game/NewGameAI.js         # AI 로직 (선택, LLM 활용시)
```

### 2. 게임 윈도우 (UI Layer)
```javascript
qx.Class.define("deskweb.ui.NewGameWindow", {
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "게임 이름", "deskweb/images/newgame.svg");
    this.set({
      width: 700, height: 600,
      showMinimize: true, showMaximize: true,
      contentPadding: 0
    });
    this.setLayout(new qx.ui.layout.VBox());
    this._createUI();
  },

  members: {
    __game: null,

    _createUI: function() {
      // 툴바 (난이도, 새 게임 등)
      // 게임 캔버스 영역
      // 상태바 (점수, 타이머 등)
    }
  }
});
```

### 3. Canvas 기반 게임 (2D)
- qooxdoo 위젯 내에 `qx.ui.embed.Html`로 Canvas 삽입
- 마우스 이벤트: `pointerdown`, `pointerup`, `contextmenu` (우클릭)
- 게임 루프: `requestAnimationFrame` 또는 `qx.event.Timer`
- 참조: SolitaireGame.js, MinesweeperGame.js

```javascript
// Canvas 삽입 패턴
var canvas = new qx.ui.embed.Html('<canvas id="game-canvas"></canvas>');
canvas.addListenerOnce("appear", function() {
  var el = canvas.getContentElement().getDomElement();
  var ctx = el.querySelector("canvas").getContext("2d");
  // 게임 초기화
}, this);
```

### 4. Three.js 기반 게임 (3D)
- Three.js CDN 또는 번들 로드
- WebGL 렌더러 기본, Canvas fallback
- 카메라 각도 조절 UI (슬라이더)
- 조명: 탑다운 방향 라이팅
- 재질 옵션 (플랫, 광택, 매탈릭 등)
- 참조: TetrisGame.js, JanggiGame.js

```javascript
// Three.js 초기화 패턴
_initThreeJS: function(container) {
  this.__scene = new THREE.Scene();
  this.__camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 1000);
  this.__renderer = new THREE.WebGLRenderer({ antialias: true });
  container.appendChild(this.__renderer.domElement);

  // 조명
  var light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 10, 0);
  this.__scene.add(light);
}
```

### 5. 게임 AI (LLM 연동)
- AI 로직은 별도 파일로 분리 (예: JanggiAI.js)
- LLM API 호출: `https://mcp.webnori.com/api/llm/chat/completions`
- 현재 게임 상황을 좌표/텍스트로 변환하여 프롬프트에 포함
- 코드 기반 가드레일 필수 (유효 수 검증)
- LLM 실패시 Fallback AI 구현
- 전략 프롬프트를 사용자가 조정 가능하게 분리

### 6. 게임 상태 관리
- 세션 기반 저장 (멀티 윈도우 지원)
- 전역 설정 사용 금지 (윈도우별 독립 상태)
- 게임 히스토리 로컬 스토리지 저장
- 게임 복기/분석 기능 고려

### 7. 사운드/이펙트
- 3D 입체음향: Web Audio API
- 이동 애니메이션: 포물선 궤적 (3D 게임)
- 타격감: 사운드 + 시각 효과 조합
- 상태 전환 이펙트 (승리, 패배, 장군 등)

## 게임 유형별 참조

| 게임 유형 | 참조 파일 | 핵심 패턴 |
|----------|----------|-----------|
| 카드 게임 | SolitaireGame.js | 드래그앤드롭, 카드 스택 관리 |
| 보드 게임 (2D) | MinesweeperGame.js | 격자 기반, 좌/우클릭, 난이도 |
| 3D 액션 | TetrisGame.js | Three.js, 키보드 입력, 스테이지 |
| 3D + AI | JanggiGame.js + JanggiAI.js | Three.js, LLM 대전, 포물선 이동 |

## Application.js 등록
deskweb-app 스킬의 등록 절차와 동일 (아이콘, 시작메뉴, 창 열기 메서드)

## 빌드/테스트
```bash
docker exec deskweb-dev qx compile
# 접속: http://localhost:9090/deskweb/ (dev)
```
