# DeskWeb - 바이브 개발 가이드

## 프로젝트 개요

**DeskWeb**은 qooxdoo 프레임워크를 사용하여 구현한 Windows XP 스타일의 웹 데스크톱 애플리케이션입니다.
브라우저에서 데스크톱 환경을 경험할 수 있는 경량화된 WebOS UX를 제공합니다.

- **DEMO**: https://webos.webnori.com/
- **라이선스**: MIT

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **프레임워크** | qooxdoo v7.9 (JavaScript Desktop UI Framework) |
| **빌드** | qooxdoo 컴파일러 (@qooxdoo/compiler) |
| **실행환경** | Docker / Node.js v18+ |
| **저장소** | localStorage (브라우저 내장) |
| **3D 그래픽** | Three.js (테트리스, 장기 게임) |
| **LLM** | WebLLM (브라우저 내 AI) / 외부 API |
| **문서 처리** | hwp.js, pako (HWP 뷰어) |
| **마크다운** | marked.js, Mermaid |

---

## Application Layout 구조

```
Root (qx.application.Standalone)
└── Composite (Dock Layout)
    ├── Desktop (center) - 데스크톱 영역
    │   └── Canvas Layout - 아이콘 자유 배치
    │       ├── DesktopIcon[] - 바탕화면 아이콘
    │       └── Window[] - 열린 창들
    └── Taskbar (south) - 작업표시줄
        └── HBox Layout
            ├── Start Button
            ├── Window Buttons Container
            └── System Tray (Clock)
```

---

## 소스 코드 구조

```
source/class/deskweb/
├── Application.js          # 메인 애플리케이션 (앱 등록/실행)
├── theme/                  # Windows XP 테마
│   ├── Theme.js           # 메타 테마
│   ├── Color.js           # 색상 정의
│   ├── Decoration.js      # 데코레이션
│   ├── Appearance.js      # 위젯 외형
│   └── Font.js            # 폰트 정의
├── ui/                    # UI 컴포넌트 (윈도우 앱들)
│   ├── DesktopIcon.js     # 드래그 가능한 아이콘
│   ├── Taskbar.js         # 작업표시줄
│   ├── StartMenu.js       # 시작 메뉴
│   ├── NotepadWindow.js   # 메모장
│   ├── MyComputerWindow.js # 내 컴퓨터/파일탐색기
│   ├── FileExplorer.js    # 파일 탐색기 컴포넌트
│   ├── RecycleBinWindow.js # 휴지통
│   ├── SolitaireWindow.js # 솔리테어 게임
│   ├── MinesweeperWindow.js # 지뢰찾기 게임
│   ├── TetrisWindow.js    # 3D 테트리스
│   ├── JanggiWindow.js    # 3D 장기 게임
│   ├── ChatBotWindow.js   # AI 챗봇
│   ├── AskBotWindow.js    # ASK BOT (iframe 앱)
│   ├── CanvasDemoWindow.js # 캔버스 데모
│   ├── HWPViewerWindow.js # HWP 뷰어
│   └── CalcWindow.js      # 스프레드시트(엑셀)
├── game/                  # 게임 로직 분리
│   ├── SolitaireGame.js   # 솔리테어 게임 로직
│   ├── MinesweeperGame.js # 지뢰찾기 게임 로직
│   ├── TetrisGame.js      # 테트리스 게임 로직
│   └── JanggiGame.js      # 장기 게임 로직 (AI 대전)
└── util/                  # 유틸리티 클래스
    ├── StorageManager.js      # 가상 파일 시스템
    ├── FileExtensionRegistry.js # 파일 확장자 매핑
    ├── IconPositionManager.js # 아이콘 위치 저장
    ├── WebLLMManager.js       # WebLLM 관리
    ├── HwpParser.js           # HWP 파일 파싱
    ├── HwpRenderer.js         # HWP HTML 렌더링
    ├── SpreadsheetEngine.js   # 스프레드시트 엔진
    ├── FormulaParser.js       # 수식 파서
    └── CalcTutorialManager.js # 엑셀 튜토리얼
```

---

## 개발 히스토리 (기능추가 순서)

### v0.0 - 기본 데스크톱 환경 (00-fist-qooxdoo.md)
- Windows XP 스타일 데스크톱 구현
- 하단 작업표시줄 + 시작 버튼
- 푸른색 바탕화면 + 내 컴퓨터 아이콘
- 아이콘 드래그 이동 기능
- 윈도우 열기/닫기/최소화/최대화

### v0.1 - 메모장 앱 (01-notepad.md)
- NotepadWindow 구현
- 텍스트/Markdown 편집 지원
- 로컬 스토리지 기반 파일 저장
- 자동 저장 기능 (2초 타이핑 중단 후)
- 파일 확장자 매핑 시스템 도입
- 아이콘 위치 저장 기능

### v0.2 - 솔리테어 게임 (02-game-솔리테어.md)
- SolitaireWindow, SolitaireGame 구현
- 카드 드래그앤드롭 구현
- 실제 카드 느낌의 디자인
- 게임 상태 자동 저장

### v0.3 - AI ChatBot (03-chatbot.md)
- ChatBotWindow 구현
- WebLLM 통합 (브라우저 내 LLM)
- 4GB 이하 경량 모델 선택 지원
- 모델 로딩 진행률 표시
- GPU 가속 / CPU fallback
- 스트리밍 응답 표시

### v0.4 - Canvas 데모 (04-canvas-demo.md)
- CanvasDemoWindow 구현
- HTML5 Canvas 그래픽 패턴
- 원형/나선형/파동/프랙탈 패턴
- 패턴 속도/색상/크기 조절
- GPU 가속 옵션
- 전체 화면 모드

### v0.5 - 지뢰찾기 게임 (05-game-지뢰찾기.md)
- MinesweeperWindow, MinesweeperGame 구현
- 초급/중급/고급 난이도
- 좌클릭: 칸 열기, 우클릭: 깃발
- 더블클릭: 코딩(주변 자동 열기)
- 첫 클릭 안전 보장

### v0.6 - 파일 업로드/다운로드 (06-파일업로드다운.md)
- 내 컴퓨터 파일 탐색기 개선
- 우클릭 컨텍스트 메뉴 (새폴더, 삭제, 이름바꾸기, 다운로드)
- 실제 PC에서 드래그앤드롭 업로드
- 휴지통 기능 구현 (삭제 → 휴지통 → 복원/완전삭제)

### v0.7 - ChatBot 개선 (07-chatbot.md)
- 외부 LLM API 방식 추가 (다운로드 없이 바로 사용)
- 스트림 방식 실시간 응답
- API 엔드포인트: mcp.webnori.com

### v0.8 - ASK BOT (08-askbot.md)
- AskBotWindow 구현 (iframe 기반)
- 외부 URL 로드 기능
- 바탕화면 우클릭 → 커스텀 앱 추가
- 사용자 추가 앱 삭제 기능

### v0.9 - HWP 뷰어 (09-hwpview.md)
- HWPViewerWindow 구현
- hwp.js 라이브러리 활용
- .hwp 파일 열기/렌더링
- 페이지 탐색, 확대/축소
- 드래그앤드롭 업로드 지원

### v1.0 - HWP WebAssembly (10.hwp-assem.md)
- hwp-wasm-viewer 모듈 개발
- WebAssembly를 활용한 HWP 해독
- HWP → HTML 변환 렌더링

### v1.1~1.4 - HWP 뷰어 확장 (11~14-hwpview-ex.md)
- 본문 보기 기능 개선
- 페이지 단위 스타일 구분
- 내 컴퓨터에서 HWP 더블클릭 열기
- 텍스트 인코딩 문제 해결

### v1.5 - HWP 리팩토링 (15-hwpview-refact.md)
- HwpParser 모듈 분리 (HWP 파싱 담당)
- HwpRenderer 모듈 분리 (HTML 렌더링 담당)
- 코드 유지보수성 개선

### v1.6 - 3D 테트리스 (16-game-3dtetris.md)
- TetrisWindow, TetrisGame 구현
- Three.js 활용 3D 블록
- 카메라 뷰 조절 (줌, 각도)
- 3D 입체음향 효과
- 10 스테이지 난이도
- 광택 재질 옵션

### v1.7 - 엑셀 앱 (17-excel-app.md)
- CalcWindow 구현 (OpenOffice Calc 벤치마킹)
- SpreadsheetEngine, FormulaParser 구현
- 셀 병합/서식/수식 계산
- SUM, AVERAGE, IF, VLOOKUP 함수
- 상대/절대 참조, 순환참조 방지
- ODS 포맷 저장/불러오기
- 인터랙티브 튜토리얼 기능

### v1.8 - 3D 장기 게임 (18-game-3d장기.md)
- JanggiWindow, JanggiGame 구현
- Three.js 활용 3D 장기판/장기말 렌더링
- 전통 장기 규칙 완전 구현 (차, 마, 상, 포, 졸/병, 사, 장)
- AI 대전 기능 (LLM API 활용)
  - 외부 LLM으로 다음 수 예측
  - 코드 기반 가드레일 (유효 수 검증)
  - Fallback AI (LLM 실패 시)
- 세션 기반 게임 상태 저장 (멀티 윈도우 지원)
- 게임 복기(분석) 기능
- 이동 가능 경로 하이라이트
- 카메라 각도 조절

---

## 주요 유틸리티 설명

### StorageManager
- 브라우저 localStorage 기반 가상 파일 시스템
- 세션 ID별 격리된 파일 공간
- 경로: `c:/webroot/{sessionId}/...`

### FileExtensionRegistry
- 파일 확장자별 애플리케이션 매핑
- `.txt`, `.md` → Notepad
- `.hwp` → HWP Viewer
- `.ods` → Calc

### IconPositionManager
- 데스크톱 아이콘 위치 저장/복원
- 사용자별 아이콘 배치 유지

### WebLLMManager
- 브라우저 내 LLM 관리
- 모델 로딩/캐싱
- GPU/CPU fallback

---

## 개발 명령어

```bash
# 개발 서버 실행 (Docker)
docker-compose --profile dev up deskweb-dev -d

# 소스 컴파일 (Docker 내)
docker exec deskweb-dev qx compile

# 로그 확인
docker logs deskweb-dev -f

# 로컬 개발 (Node.js)
npm install -g @qooxdoo/compiler
qx compile --target=source
qx serve --listen-port=8080

# 프로덕션 빌드
qx compile --target=build
```

**접속 URL**: http://localhost:9090/deskweb/ (개발) / http://localhost:80/deskweb/ (프로덕션)

---

## 새 앱 추가 방법

1. **UI 컴포넌트 생성**: `source/class/deskweb/ui/NewAppWindow.js`
2. **Application.js에 등록**:
   - `_createDesktopIcons()`: 아이콘 정의 추가
   - `_openNewAppWindow()`: 창 열기 메서드 추가
   - `_onStartMenuItemClick()`: 시작 메뉴 항목 추가
3. **아이콘 이미지**: `source/resource/deskweb/images/newapp.svg`
4. **컴파일**: `docker exec deskweb-dev qx compile`

---

## 참고 문서

- [qooxdoo 공식 문서](https://qooxdoo.org/documentation/v7.9/)
- [qooxdoo Desktop Guide](https://qooxdoo.org/documentation/v7.9/#/desktop/)
- [HWP 5.0 스펙](docs/hwp-5.0-spec.md)
