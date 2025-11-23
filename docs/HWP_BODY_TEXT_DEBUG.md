# HWP 본문 텍스트 파싱 디버그 가이드

## 🎯 목표

본문 문단(PARA_TEXT)이 제대로 추출되지 않는 문제를 진단하고 해결하기 위한 상세 디버깅 가이드

## 📊 현재 상황

- **미리보기(PrvText)**: 정상 작동 ✅
- **본문 문단(PARA_TEXT)**: 추출 실패로 PrvText fallback 사용 ⚠️

## 🔍 디버깅 로그 확인 방법

### 1. 브라우저 콘솔 열기
- `F12` 키 누르기
- "Console" 탭 선택
- HWP 파일 열기
- 로그 확인

### 2. 핵심 로그 체크리스트

#### ✅ 파일 로드 단계
```
[HWPViewerWindow] ===== Loading file from storage =====
[HWPViewerWindow] File path: /Documents/test.hwp
[HWPViewerWindow] ✅ Base64 decode SUCCESS
[HWPViewerWindow] Decoded size: 123456 bytes
[HWPViewerWindow] ✅ Valid CFB signature detected
```

#### ✅ FileHeader 파싱
```
[HWPViewerWindow] FileHeader parsed: {
  signature: "HWP Document File",
  version: {...},
  flags: {
    compressed: true,    ← 압축 여부 확인!
    encrypted: false,
    raw: 1
  }
}
```

#### ✅ 섹션 파싱
```
[HWPViewerWindow] ===== Parsing Sections =====
[HWPViewerWindow] File compressed flag: true
[HWPViewerWindow] --- Section0 ---
[HWPViewerWindow] Raw size: 5432 bytes
[HWPViewerWindow] First 16 bytes: 0x78 0x9c 0x... ← 압축 데이터 시그니처
[HWPViewerWindow] First byte: 0x78
[HWPViewerWindow] Is ViewText: false
[HWPViewerWindow] Is Compressed: true    ← 압축 처리 여부
```

#### ✅ 압축 해제
```
[HWPViewerWindow] Parsing records, compressed: true, size: 5432
[HWPViewerWindow] Attempting stream decompression with pako.inflateRaw...
[HWPViewerWindow] ✅ Stream decompressed: 5432 -> 36789 bytes (ratio: 6.78x)
```

**압축 실패 시:**
```
[HWPViewerWindow] ❌ Decompression failed: incorrect header check
[HWPViewerWindow] Trying pako.inflate instead of inflateRaw...
[HWPViewerWindow] ✅ pako.inflate succeeded: 5432 -> 36789 bytes
```

#### ✅ 레코드 타입 통계
```
[HWPViewerWindow] Record types: {
  "0x50": 8,     ← PARA_HEADER (문단 헤더)
  "0x51": 8,     ← PARA_TEXT (문단 텍스트) ⭐ 핵심!
  "0x52": 5,     ← PARA_CHAR_SHAPE
  "0x15": 3,     ← CHAR_SHAPE
  ...
}
```

#### ⚠️ 문단 추출 결과
```
[HWPViewerWindow] Extracting paragraphs from 42 records...
[HWPViewerWindow] Extraction summary:
[HWPViewerWindow] - PARA_HEADER (0x50) found: 8
[HWPViewerWindow] - PARA_TEXT (0x51) found: 8    ← 0이면 문제!
[HWPViewerWindow] - Total paragraphs extracted: 8
```

**문단 없을 때 (Alternative 사용):**
```
[HWPViewerWindow] - Total paragraphs extracted: 0
[HWPViewerWindow] ⚠️ No PARA_TEXT records found, trying alternative extraction...
[HWPViewerWindow] Alternative extraction: trying to decode any record as text...
[HWPViewerWindow] Found text in record 0x1c, ratio: 0.95, text: 한글 문서...
[HWPViewerWindow] Alternative extraction found: 5 text blocks
```

## 🐛 문제 진단 시나리오

### 시나리오 1: 압축 해제 실패

**증상:**
```
[HWPViewerWindow] ❌ Decompression failed: incorrect header check
[HWPViewerWindow] ❌ pako.inflate also failed: incorrect header check
[HWPViewerWindow] Using raw data without decompression
[HWPViewerWindow] - PARA_TEXT (0x51) found: 0
```

**원인:**
- 파일이 실제로 압축되지 않았는데 compressed flag가 true
- 또는 다른 압축 방식 사용

**해결:**
1. `First 16 bytes` 확인
   - `0x78 0x9c` 시작 → zlib 압축
   - `0x1f 0x8b` 시작 → gzip 압축
   - 다른 값 → 비압축 또는 다른 방식

2. 압축 방식 강제 변경 테스트

### 시나리오 2: PARA_TEXT 레코드가 없음

**증상:**
```
[HWPViewerWindow] Record types: {
  "0x50": 8,     ← PARA_HEADER는 있음
  "0x15": 3,
  "0x19": 2,
  ...
}
[HWPViewerWindow] - PARA_TEXT (0x51) found: 0    ← 0x51이 없음!
```

**원인:**
- 파일이 특수한 방식으로 저장됨 (ViewText만 있음)
- 레코드 파싱 오류
- 다른 태그 ID 사용

**해결:**
- Alternative extraction 활성화 (이미 구현됨)
- ViewText 섹션 확인

### 시나리오 3: 레코드 파싱 오류

**증상:**
```
[HWPViewerWindow] ✅ Stream decompressed: 5432 -> 36789 bytes
[HWPViewerWindow] ✅ Section0 parsed: 2 records, 0 paragraphs    ← 레코드 수가 너무 적음
```

**원인:**
- 레코드 헤더 파싱 오류
- Extended size 처리 문제
- 데이터 오프셋 오류

**해결:**
1. 첫 4바이트 확인 (레코드 헤더)
2. Size 필드가 0xFFF인지 확인
3. 데이터 범위 초과 체크

### 시나리오 4: ViewText만 있는 파일

**증상:**
```
[HWPViewerWindow] First byte: 0x1c
[HWPViewerWindow] Is ViewText: true
[HWPViewerWindow] Is Compressed: false
[HWPViewerWindow] Record types: {
  "0x1c": 1,
  ...
}
[HWPViewerWindow] - PARA_TEXT (0x51) found: 0
```

**원인:**
- BodyText 섹션 없이 ViewText만 있음
- 오래된 HWP 버전 또는 특수 문서

**해결:**
- ViewText에서 직접 텍스트 추출
- Alternative extraction이 자동으로 처리

## 🔧 Alternative Extraction (대체 추출)

PARA_TEXT (0x51) 레코드를 찾지 못할 때 자동으로 실행되는 휴리스틱 방법:

### 작동 방식

1. **모든 레코드 스캔**
   - 각 레코드 데이터를 UTF-16LE로 디코딩 시도

2. **텍스트 검증**
   - 인쇄 가능한 문자 비율 계산
   - 60% 이상이면 텍스트로 간주

3. **텍스트 정리**
   - 제어 문자 제거
   - 10자 이상만 추출

### 로그 예시

```
[HWPViewerWindow] ⚠️ No PARA_TEXT records found, trying alternative extraction...
[HWPViewerWindow] Alternative extraction: trying to decode any record as text...
[HWPViewerWindow] Found text in record 0x1c, ratio: 0.95, text: HWP 5.0 문서 형식...
[HWPViewerWindow] Found text in record 0x56, ratio: 0.87, text: 표 내용...
[HWPViewerWindow] Alternative extraction found: 5 text blocks
```

## 📋 디버깅 체크리스트

HWP 파일을 열고 다음을 확인:

### [ ] 1. 파일 로드
- [ ] Base64 디코딩 성공
- [ ] CFB 시그니처 확인 (D0 CF)
- [ ] 파일 크기 > 0

### [ ] 2. FileHeader
- [ ] 압축 플래그 확인 (`compressed: true/false`)
- [ ] 암호화 플래그 확인 (`encrypted: false` 여야 함)
- [ ] 버전 정보 확인

### [ ] 3. 섹션 파싱
- [ ] Section0 존재
- [ ] 압축 여부 판단 (`Is Compressed:`)
- [ ] 첫 바이트 확인 (0x78 또는 0x1c)

### [ ] 4. 압축 해제
- [ ] 압축 파일: `pako.inflateRaw` 성공
- [ ] 압축 비율 합리적 (2x ~ 10x)
- [ ] 압축 해제 후 크기 > 원본 크기

### [ ] 5. 레코드 파싱
- [ ] 레코드 수 > 0
- [ ] Record types에 다양한 태그 존재
- [ ] 0x50 (PARA_HEADER) 존재 여부
- [ ] **0x51 (PARA_TEXT) 존재 여부** ⭐

### [ ] 6. 문단 추출
- [ ] PARA_TEXT 레코드 수 > 0
- [ ] 추출된 문단 수 > 0
- [ ] Alternative extraction 사용 여부

## 🎯 주요 레코드 타입

| Tag ID | 이름 | 설명 | 중요도 |
|--------|------|------|--------|
| 0x50 | PARA_HEADER | 문단 헤더 | ⭐⭐⭐ |
| 0x51 | PARA_TEXT | **문단 텍스트** | ⭐⭐⭐⭐⭐ |
| 0x52 | PARA_CHAR_SHAPE | 문단 글자 모양 | ⭐⭐ |
| 0x53 | PARA_LINE_SEG | 줄 분리 정보 | ⭐ |
| 0x15 | CHAR_SHAPE | 글자 모양 | ⭐⭐ |
| 0x19 | PARA_SHAPE | 문단 모양 | ⭐⭐ |
| 0x1c | 기타 | ViewText 관련 | ⭐ |

## 💡 문제 해결 팁

### 압축 관련

**문제:** `Decompression failed`
```javascript
// 해결: pako.inflate 시도
try {
    data = pako.inflateRaw(data);
} catch (e) {
    data = pako.inflate(data);  // 헤더 포함된 zlib
}
```

### PARA_TEXT 찾기

**문제:** 0x51 레코드가 없음
```javascript
// 해결: Alternative extraction
// - 모든 레코드를 UTF-16LE로 디코딩
// - 60% 이상 인쇄 가능 문자면 텍스트로 간주
```

### ViewText vs BodyText

**ViewText (0x1c 시작):**
- 비압축
- 간단한 구조
- 빠른 접근

**BodyText (0x78 또는 압축):**
- 압축됨
- 복잡한 구조
- PARA_TEXT 레코드 포함

## 📊 성공 사례 로그 예시

```
[HWPViewerWindow] ===== Loading file from storage =====
[HWPViewerWindow] File path: /Documents/report.hwp
[HWPViewerWindow] ✅ Base64 decode SUCCESS
[HWPViewerWindow] Decoded size: 245760 bytes
[HWPViewerWindow] ✅ Valid CFB (Compound File Binary) signature detected
[HWPViewerWindow] ===== File loaded successfully, rendering... =====

[HWPViewerWindow] Parsing HWP file...
[HWPViewerWindow] CFB structure parsed
[HWPViewerWindow] FileHeader parsed: {compressed: true, encrypted: false}

[HWPViewerWindow] ===== Parsing Sections =====
[HWPViewerWindow] File compressed flag: true

[HWPViewerWindow] --- Section0 ---
[HWPViewerWindow] Raw size: 8765 bytes
[HWPViewerWindow] First byte: 0x78
[HWPViewerWindow] Is Compressed: true

[HWPViewerWindow] Parsing records, compressed: true
[HWPViewerWindow] Attempting stream decompression with pako.inflateRaw...
[HWPViewerWindow] ✅ Stream decompressed: 8765 -> 52340 bytes (ratio: 5.97x)

[HWPViewerWindow] ✅ Section0 parsed: 127 records, 15 paragraphs

[HWPViewerWindow] Record types: {
  "0x50": 15,
  "0x51": 15,  ← PARA_TEXT 있음!
  "0x52": 10,
  "0x15": 5,
  "0x19": 8
}

[HWPViewerWindow] Extracting paragraphs from 127 records...
[HWPViewerWindow] Found PARA_HEADER + PARA_TEXT pair, text length: 234
[HWPViewerWindow] Added paragraph: 이 문서는 한글 문서입니다...
[HWPViewerWindow] Found standalone PARA_TEXT, length: 156, text: 두 번째 문단입니다...

[HWPViewerWindow] Extraction summary:
[HWPViewerWindow] - PARA_HEADER (0x50) found: 15
[HWPViewerWindow] - PARA_TEXT (0x51) found: 15
[HWPViewerWindow] - Total paragraphs extracted: 15

[HWPViewerWindow] ✅ Section0 parsed: 127 records, 15 paragraphs
[HWPViewerWindow] ===== Total sections parsed: 1 =====
[HWPViewerWindow] HWP parsed successfully
```

## 🚀 다음 단계

로그를 확인한 후:

1. **정상 작동 시:**
   - PARA_TEXT가 제대로 추출됨
   - 본문보기 모드에서 문단 구조 표시

2. **Alternative 사용 시:**
   - PARA_TEXT 없지만 텍스트 추출됨
   - PrvText와 유사한 내용 표시

3. **완전 실패 시:**
   - 콘솔 로그 캡처
   - 파일 특성 확인 (버전, 크기, 형식)
   - 추가 개선 필요

---

## 테스트 파일 체크

다양한 HWP 파일로 테스트:

- [ ] 일반 문서 (압축, BodyText)
- [ ] 간단한 문서 (ViewText)
- [ ] 오래된 HWP 파일
- [ ] 특수 문서 (배포용 보호, DRM)
- [ ] 큰 파일 (1MB 이상)

각 파일마다 콘솔 로그를 확인하고 패턴 분석!
