# DeskWeb - Vibe Coding으로 만드는 나만의 WebOS

qooxdoo 프레임워크 기반 Windows XP 스타일 웹 데스크톱 프로젝트입니다.

**DEMO**: https://webos.webnori.com/

## Fork & Vibe

이 프로젝트는 **Claude Code Skills**이 내장되어 있어, 포크 후 바이브 코딩만으로 나만의 WebOS 변종을 빠르게 만들 수 있습니다.

```
"메모장 앱 추가해줘" → 스킬이 프로젝트 컨벤션에 맞게 자동 생성
"Three.js 기반 체스 게임 만들어줘" → 기존 3D 게임 패턴을 참조해 구현
"AI 챗봇에 이미지 생성 기능 추가해줘" → LLM 통합 패턴 적용
```

내장 스킬 4종이 프로젝트 구조, 앱 등록, 게임 엔진, LLM 연동 등 반복 패턴을 가이드하므로 매번 긴 프롬프트를 작성할 필요 없이 간결한 지시만으로 일관된 코드가 생성됩니다.

| 스킬 | 용도 |
|------|------|
| `deskweb-convention` | 프로젝트 구조, 빌드, 스토리지, 테마 공통 규칙 |
| `deskweb-app` | 일반 앱 추가 (메모장, 뷰어, 엑셀, iframe 등) |
| `deskweb-game` | 게임 앱 (2D Canvas, Three.js 3D, AI 대전) |
| `deskweb-llm` | LLM/AI 통합 (챗봇, 게임AI, AI-OS 앱 제어) |

스킬 활용법과 베스트 프롬프트 예시는 [docs/skill-maker/readme.md](./docs/skill-maker/readme.md)를 참고하세요.

## 스킬 활용 Best Practice

### 일반 앱 추가
```
웹 브라우저 앱을 추가해줘.
- URL 입력창, 뒤로/앞으로/새로고침 버튼
- iframe으로 페이지 로드
- 북마크 기능 (localStorage 저장)
```

### 게임 앱 추가
```
Three.js 기반 체스 게임을 만들어줘.
- 3D 체스판/말 렌더링, 탑뷰 기본
- AI 대전 (LLM API 활용)
- 이동 가능 경로 하이라이트
```

### LLM 기능 확장
```
AI ChatBot에서 "엑셀 열어서 매출표 만들어줘" 명령을 처리하도록 해줘.
- 앱 실행 → 셀 데이터 입력 → 수식 적용 자동화
```

### 테마 변경
```
macOS 스타일 테마를 추가해줘.
- 상단 메뉴바, 둥근 모서리, 투명 효과
- 기존 XP 테마와 전환 가능
```

### 기존 앱 버그 수정
```
지뢰찾기에서 어려움→쉬움 난이도 전환시 게임판이 갱신되지 않는 버그 수정해줘.
- 재현: 어려움 선택 → 쉬움 전환 → 게임판 변화 없음
- 기대: 9x9 격자로 즉시 변경
```

> 스킬이 프로젝트 구조와 기존 코드 패턴을 알고 있으므로, **무엇을 만들지**만 설명하면 됩니다.
> 프레임워크 사용법, 파일 위치, 등록 절차 등은 스킬이 자동으로 처리합니다.

## 프로젝트 구조

```
DeskWeb/
├── .claude/skills/   # Claude Code Skills (바이브 코딩 가이드)
├── deskweb/          # 메인 웹 데스크톱 애플리케이션
├── docs/             # 공용 문서
├── prompt/           # AI 프롬프트 히스토리
└── refsrc/           # 참조 소스 및 스펙
```

## 빠른 시작

```bash
# 1. 포크 & 클론
git clone https://github.com/your-id/DeskWeb.git
cd DeskWeb/deskweb

# 2. 개발 서버 실행
npm install
docker-compose --profile dev up -d

# 3. 접속
# 개발: http://localhost:9090/deskweb/
# 프로덕션: http://localhost:80/deskweb/
```

## 탑재 앱

| 앱 | 유형 | 기술 |
|----|------|------|
| 메모장 | 일반 | localStorage, Markdown |
| 내 컴퓨터 | 일반 | 가상 파일 시스템, 드래그앤드롭 |
| 엑셀(Calc) | 일반 | 수식 엔진, ODS 포맷 |
| HWP 뷰어 | 일반 | hwp.js, WebAssembly |
| AI ChatBot | LLM | WebLLM / 외부 API, 스트리밍 |
| ASK BOT | iframe | 외부 URL 로드, favicon |
| 솔리테어 | 게임 | Canvas, 드래그앤드롭 |
| 지뢰찾기 | 게임 | Canvas, 난이도 |
| 3D 테트리스 | 게임 | Three.js, 사운드 |
| 3D 장기 | 게임 | Three.js, LLM AI 대전 |
| Canvas 데모 | 데모 | 수학적 패턴, GPU 가속 |

## 라이선스

MIT License
