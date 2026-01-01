# Claude Code 히스토리 구조 및 조회 가이드

Claude Code는 모든 대화 세션과 에이전트 작업을 로컬에 저장합니다. 이 문서는 히스토리 데이터의 구조와 조회 방법을 설명합니다.

## 1. 저장 경로

```
~/.claude/projects/
```

각 프로젝트는 작업 디렉토리 경로를 기반으로 폴더명이 생성됩니다:

```
~/.claude/projects/
├── -mnt-d-Code-AI-memorizer-v1/       # /mnt/d/Code/AI/memorizer-v1
├── -mnt-d-Code-Gou-GouStudio/         # /mnt/d/Code/Gou/GouStudio
├── -mnt-d-Code-Webnori-DeskWeb/       # /mnt/d/Code/Webnori/DeskWeb
└── ...
```

> 경로의 `/`가 `-`로 변환되어 폴더명이 됩니다.

---

## 2. 파일 구조

각 프로젝트 폴더 내에는 두 가지 유형의 `.jsonl` 파일이 있습니다:

### 2.1 세션 파일 (메인 대화)

```
{UUID}.jsonl
```

- 예: `4b47a203-33ad-46c0-be80-d68c2d06505e.jsonl`
- 사용자와의 메인 대화 세션을 저장
- 파일 크기가 클수록 긴 대화 또는 많은 작업 수행

### 2.2 에이전트 파일 (서브태스크)

```
agent-{short-id}.jsonl
```

- 예: `agent-a18bf1a.jsonl`
- Task 도구로 생성된 서브에이전트 작업 로그
- 메인 세션에서 분리된 독립적인 탐색/분석 작업

---

## 3. JSONL 파일 구조

각 줄은 독립적인 JSON 객체입니다. 주요 레코드 타입:

### 3.1 파일 히스토리 스냅샷

```json
{
  "type": "file-history-snapshot",
  "messageId": "uuid",
  "snapshot": {
    "trackedFileBackups": {},
    "timestamp": "2025-12-06T01:18:08.407Z"
  }
}
```

### 3.2 사용자 메시지

```json
{
  "type": "user",
  "parentUuid": null,
  "sessionId": "session-uuid",
  "cwd": "/mnt/d/Code/AI/memorizer-v1",
  "gitBranch": "dev",
  "message": {
    "role": "user",
    "content": "prompt/kr/35-Ai-Driven-Idea.md 수행"
  },
  "uuid": "message-uuid",
  "timestamp": "2025-12-06T01:18:08.395Z",
  "todos": []
}
```

### 3.3 어시스턴트 응답

```json
{
  "type": "assistant",
  "parentUuid": "parent-message-uuid",
  "sessionId": "session-uuid",
  "slug": "buzzing-swimming-wand",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "..."},
      {"type": "tool_use", "name": "Read", "input": {...}}
    ],
    "usage": {
      "input_tokens": 3,
      "output_tokens": 84
    }
  },
  "uuid": "message-uuid",
  "timestamp": "2025-12-06T01:18:11.478Z"
}
```

### 3.4 도구 실행 결과

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_xxx",
        "content": "파일 내용 또는 실행 결과..."
      }
    ]
  },
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file",
      "content": "...",
      "numLines": 50
    }
  }
}
```

### 3.5 세션 요약

```json
{
  "type": "summary",
  "summary": "AI-Driven Ideas: Architecture & Roadmap",
  "leafUuid": "last-message-uuid"
}
```

---

## 4. 주요 필드 설명

| 필드 | 설명 |
|------|------|
| `type` | 레코드 유형 (user, assistant, summary, file-history-snapshot) |
| `uuid` | 메시지 고유 식별자 |
| `parentUuid` | 부모 메시지 ID (대화 흐름 추적용) |
| `sessionId` | 세션 고유 식별자 |
| `cwd` | 작업 디렉토리 |
| `gitBranch` | Git 브랜치명 |
| `timestamp` | ISO 8601 형식 타임스탬프 |
| `message.content` | 메시지 내용 (텍스트 또는 도구 호출) |
| `message.usage` | 토큰 사용량 (input_tokens, output_tokens) |
| `todos` | 작업 목록 상태 |

---

## 5. 조회 명령어

### 5.1 프로젝트 목록 조회

```bash
ls -la ~/.claude/projects/
```

### 5.2 프로젝트별 세션 수 및 크기

```bash
# 크기 확인
du -sh ~/.claude/projects/*

# 세션 파일 수 (에이전트 제외)
ls ~/.claude/projects/{프로젝트명}/*.jsonl | grep -v agent | wc -l

# 에이전트 파일 수
ls ~/.claude/projects/{프로젝트명}/*.jsonl | grep agent | wc -l
```

### 5.3 최근 세션 확인

```bash
# 최근 수정된 세션 파일
ls -lt ~/.claude/projects/{프로젝트명}/*.jsonl | head -5
```

### 5.4 세션 내용 미리보기

```bash
# 첫 50줄 확인
head -50 ~/.claude/projects/{프로젝트명}/{세션ID}.jsonl

# 사용자 메시지만 추출
grep '"type":"user"' {파일}.jsonl | head -10

# 요약 확인
grep '"type":"summary"' {파일}.jsonl
```

### 5.5 특정 작업 검색

```bash
# 파일명으로 작업 검색
grep -l "특정파일.md" ~/.claude/projects/{프로젝트명}/*.jsonl

# 내용으로 검색
grep "검색어" ~/.claude/projects/{프로젝트명}/*.jsonl
```

---

## 6. 데이터 분석 예시

### 6.1 Python을 이용한 세션 분석

```python
import json
from pathlib import Path
from collections import Counter

def analyze_session(jsonl_path):
    """세션 파일 분석"""
    records = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    # 레코드 타입 통계
    types = Counter(r.get('type') for r in records)

    # 사용자 메시지 추출
    user_messages = [
        r['message']['content']
        for r in records
        if r.get('type') == 'user' and isinstance(r.get('message', {}).get('content'), str)
    ]

    # 도구 사용 통계
    tool_uses = []
    for r in records:
        if r.get('type') == 'assistant':
            content = r.get('message', {}).get('content', [])
            if isinstance(content, list):
                for item in content:
                    if item.get('type') == 'tool_use':
                        tool_uses.append(item.get('name'))

    return {
        'total_records': len(records),
        'record_types': dict(types),
        'user_messages': user_messages[:5],  # 처음 5개
        'tool_usage': dict(Counter(tool_uses))
    }

# 사용 예
result = analyze_session('~/.claude/projects/-mnt-d-Code-AI-memorizer-v1/xxx.jsonl')
print(json.dumps(result, indent=2, ensure_ascii=False))
```

### 6.2 토큰 사용량 집계

```python
def get_token_usage(jsonl_path):
    """토큰 사용량 집계"""
    total_input = 0
    total_output = 0

    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                record = json.loads(line)
                if record.get('type') == 'assistant':
                    usage = record.get('message', {}).get('usage', {})
                    total_input += usage.get('input_tokens', 0)
                    total_output += usage.get('output_tokens', 0)

    return {
        'input_tokens': total_input,
        'output_tokens': total_output,
        'total_tokens': total_input + total_output
    }
```

---

## 7. 프로젝트 활동 요약 템플릿

```markdown
## {프로젝트명} 활동 요약

### 개요
- **경로**: /mnt/d/Code/...
- **세션 수**: N개
- **에이전트 수**: M개
- **총 크기**: X MB
- **활동 기간**: YYYY-MM-DD ~ YYYY-MM-DD

### 주요 세션

| 날짜 | 크기 | 주요 작업 |
|------|------|----------|
| Dec 6 | 221KB | 작업 내용 요약 |
| Dec 22 | 227KB | 작업 내용 요약 |

### 기술 스택
- 언어/프레임워크: ...
- 데이터베이스: ...
- AI 기능: ...

### 구현된 주요 기능
1. 기능 1
2. 기능 2
3. 기능 3
```

---

## 8. 주의사항

1. **개인정보**: 히스토리에는 API 키, 인증 토큰 등 민감한 정보가 포함될 수 있습니다.
2. **파일 크기**: 대용량 세션 파일은 메모리 사용에 주의하세요.
3. **인코딩**: 모든 파일은 UTF-8 인코딩입니다.
4. **버전**: Claude Code 버전에 따라 스키마가 변경될 수 있습니다.

---

## 9. 관련 경로

| 경로 | 설명 |
|------|------|
| `~/.claude/` | Claude Code 루트 설정 디렉토리 |
| `~/.claude/projects/` | 프로젝트별 히스토리 |
| `~/.claude/settings.json` | 전역 설정 |
| `.claude/settings.local.json` | 프로젝트별 로컬 설정 |

---

### 10. 히스토리 최대 보관일수
default 값은 30일이며, 설정파일을 수정해 보관일수를 늘릴수 있습니다.
```
~/.claude/settings.json
{
"cleanupPeriodDays": 99999
}
```


*작성일: 2026-01-01*
*Claude Code 버전: 2.0.x 기준*
