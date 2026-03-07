---
name: deskweb-llm
description: "DeskWeb LLM/AI 통합 스킬. 브라우저 내 WebLLM 또는 외부 LLM API를 활용하는 기능 구현시 사용. 사용 사례: (1) 챗봇 앱에 LLM 연동시, (2) 게임 AI에 LLM 프롬프트 설계시, (3) AI-OS 기능(앱 제어, 자동화)시, (4) WebLLM 브라우저 내 모델 로드시, (5) 스트리밍 응답 구현시."
author: DeskWeb Team
date: 2026-03-07
---

# DeskWeb LLM/AI 통합 스킬

## 프로젝트 컨텍스트
- DeskWeb은 qooxdoo v7.9 기반 Windows XP 스타일 웹 데스크톱
- LLM 관련 파일: WebLLMManager.js, ChatBotWindow.js, JanggiAI.js, AppController.js
- 프로젝트 가이드: `prompt/deskweb/agent.md`

## Instructions

### 1. 외부 LLM API 호출 (권장 - 다운로드 없이 바로 사용)

```javascript
// API 엔드포인트
var url = "https://mcp.webnori.com/api/llm/chat/completions";

// 비스트리밍 요청
var req = new qx.io.request.Xhr(url, "POST");
req.setRequestHeader("Content-Type", "application/json");
req.setRequestData(JSON.stringify({
  model: "openai/gpt-oss-20b",
  messages: [
    { role: "system", content: "You are a helpful assistant. Respond in Markdown format." },
    { role: "user", content: userMessage }
  ],
  max_tokens: 5000,
  temperature: 0.7,
  stream: false
}));
```

### 2. 스트리밍 응답 (실시간 타이핑 효과)

```javascript
// stream: true 로 요청
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "openai/gpt-oss-20b",
    messages: messages,
    max_tokens: 5000,
    temperature: 0.7,
    stream: true
  })
}).then(function(response) {
  var reader = response.body.getReader();
  var decoder = new TextDecoder();

  function read() {
    reader.read().then(function(result) {
      if (result.done) return;
      var chunk = decoder.decode(result.value);
      // SSE 형식 파싱: "data: {...}\n\n"
      // UI에 청크 단위 즉시 표시
      read();
    });
  }
  read();
});
```

### 3. WebLLM (브라우저 내 LLM)
- WebLLMManager.js 활용 (싱글톤 패턴)
- GPU 가속 기본, CPU fallback
- 4GB 이하 경량 모델 3개 선택 지원
- 모델 로딩 진행률 UI 표시
- 로컬 캐시 지원

### 4. 마크다운 렌더링 (LLM 응답 표시)
- marked.js: 마크다운 → HTML 변환
- Mermaid: 다이어그램 렌더링
- 대화 영역 텍스트 선택/복사 가능하게 구현
- 스크롤바 자동 하단 이동

### 5. 게임 AI 프롬프트 설계 패턴
참조: `deskweb/source/class/deskweb/game/JanggiAI.js`

```
프롬프트 구조:
1. 역할 부여 (게임 전문가)
2. 현재 게임 상황 (좌표 기반 보드 상태)
3. 게임 히스토리 (이전 수)
4. 전략 지침 (공격/수비 비율, 단계별 전략)
5. 응답 형식 지정 (JSON으로 다음 수 좌표)
```

핵심 원칙:
- **가드레일**: LLM 응답을 코드로 유효성 검증 (규칙 위반 수 차단)
- **Fallback**: LLM 실패시 규칙 기반 AI로 대체
- **전략 분리**: 전략 프롬프트를 사용자가 조정 가능하게 설정값으로 분리
- **상황 인식**: 잡은 말, 유불리 판단, 게임 진행 단계 반영

### 6. AI-OS 패턴 (앱 자동 제어)
참조: `deskweb/source/class/deskweb/util/AppController.js`

AI ChatBot 명령으로 DeskWeb 앱 제어:
- 앱 실행/종료
- 앱 내부 요소 클릭, 창 이동/확대/닫기
- 캔버스 게임: 키보드/마우스 이벤트 시뮬레이션
- 메모장: 텍스트 입력/편집
- 엑셀: 셀 편집, 수식 입력
- 게임 플레이 후 결과를 다른 앱으로 전달

## LLM 활용 유형별 참조

| 활용 유형 | 참조 파일 | 핵심 패턴 |
|----------|----------|-----------|
| 채팅봇 | ChatBotWindow.js | 스트리밍, 마크다운, 대화 이력 |
| 게임 AI | JanggiAI.js | 프롬프트 설계, 가드레일, Fallback |
| 앱 제어 | AppController.js | 이벤트 시뮬레이션, 앱 간 연동 |
| 브라우저 LLM | WebLLMManager.js | 모델 로드, GPU/CPU, 캐시 |

## 빌드/테스트
```bash
docker exec deskweb-dev qx compile
# 접속: http://localhost:9090/deskweb/ (dev)
```
