# HWP 파일 로딩 디버그 개선

## 문제 상황

사용자가 보고한 문제:
1. **MyComputer 파일 뷰어에서 더블클릭**: 파일이 로드되지 않음, 0 size로 표시됨
2. **앱을 열고 Open 버튼 사용**: 정상적으로 작동 (실제 컴퓨터에서 파일 선택)

## 원인 분석

### 두 가지 파일 로드 방식

#### 1. 내부 스토리지 로드 (`_loadFile()`)
- MyComputer에서 더블클릭 시 사용
- `StorageManager`에서 base64로 인코딩된 파일 읽기
- localStorage에 저장된 가상 파일시스템 사용

**문제점:**
- Base64 디코딩 실패 시 에러 메시지 불충분
- 파일 크기가 0으로 표시되는 원인 파악 어려움
- 디버그 로그 부족

#### 2. 실제 파일 로드 (`_loadFileFromDisk()`)
- Open 버튼 클릭 시 사용
- `FileReader.readAsArrayBuffer()` 사용
- 사용자의 실제 파일시스템에서 읽기

**이 방식은 정상 작동**

## 해결 방법

### 상세한 디버그 로깅 추가

```javascript
_loadFile: function(filePath) {
    console.log("[HWPViewerWindow] ===== Loading file from storage =====");
    console.log("[HWPViewerWindow] File path:", filePath);

    // 메타데이터 확인
    var metadata = this.__storage.getFileMetadata(filePath);
    console.log("[HWPViewerWindow] Metadata:", JSON.stringify(metadata));

    // 파일 내용 확인
    var fileContent = this.__storage.readFile(filePath);
    console.log("[HWPViewerWindow] File content type:", typeof fileContent);
    console.log("[HWPViewerWindow] File content length (string):", fileContent.length);
    console.log("[HWPViewerWindow] First 50 chars:", fileContent.substring(0, 50));

    // Base64 디코딩
    var binaryString = atob(fileContent);
    var uint8Array = new Uint8Array(binaryString.length);
    console.log("[HWPViewerWindow] Decoded size:", uint8Array.length, "bytes");

    // HWP 파일 시그니처 확인 (D0 CF 11 E0)
    var signature = Array.from(uint8Array.slice(0, 8)).map(b =>
        b.toString(16).padStart(2, '0')).join(' ');
    console.log("[HWPViewerWindow] File signature:", signature);

    if (uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF) {
        console.log("[HWPViewerWindow] ✅ Valid CFB signature");
    } else {
        console.warn("[HWPViewerWindow] ⚠️ Invalid signature");
    }
}
```

### 향상된 에러 처리

#### 1. 메타데이터 없음
```
❌ 파일 메타데이터를 찾을 수 없습니다
→ 파일이 가상 파일시스템에 제대로 업로드되지 않음
```

#### 2. 파일 내용 없음
```
❌ 파일 내용을 읽을 수 없습니다
→ localStorage에서 읽기 실패
```

#### 3. Base64 디코딩 실패
```
❌ 파일 디코딩 오류
오류: [atob error message]
파일 크기 (base64): [length] chars
제안: 파일을 다시 업로드해주세요
```

#### 4. 0 바이트 파일
```
❌ File data is empty after processing
→ 디코딩은 성공했지만 결과가 비어있음
```

### 사용자 친화적 에러 메시지

**변경 전:**
```
Error loading file: [technical error]
```

**변경 후:**
```html
<div style="padding: 20px;">
  <h3 style="color: red;">파일 디코딩 오류</h3>
  <p>파일을 base64에서 디코딩하는데 실패했습니다.</p>
  <p><strong>오류:</strong> Invalid character</p>
  <p><strong>파일 크기 (base64):</strong> 1234 chars</p>
  <p><strong>제안:</strong> 파일을 다시 업로드해주세요.</p>
</div>
```

## 디버그 체크리스트

파일이 로드되지 않을 때 브라우저 콘솔(F12)에서 확인:

### ✅ 정상 로드 시 로그
```
[HWPViewerWindow] ===== Loading file from storage =====
[HWPViewerWindow] File path: /Documents/test.hwp
[HWPViewerWindow] Metadata: {"name":"test.hwp","size":123456,"isBinary":true,...}
[HWPViewerWindow] File name: test.hwp
[HWPViewerWindow] Is HWP: true
[HWPViewerWindow] File content type: string
[HWPViewerWindow] File content length (string): 164608
[HWPViewerWindow] Metadata isBinary: true
[HWPViewerWindow] Should decode as binary: true
[HWPViewerWindow] Attempting base64 decode...
[HWPViewerWindow] First 50 chars of content: UEsDBBQAAAAIAECBT1f...
[HWPViewerWindow] ✅ Base64 decode SUCCESS
[HWPViewerWindow] Decoded size: 123456 bytes
[HWPViewerWindow] First 16 bytes (hex): d0 cf 11 e0 a1 b1 1a e1 00 00 00 00 00 00 00 00
[HWPViewerWindow] File signature: d0 cf 11 e0 a1 b1 1a e1
[HWPViewerWindow] ✅ Valid CFB (Compound File Binary) signature detected
[HWPViewerWindow] ===== File loaded successfully, rendering... =====
```

### ❌ 문제 상황별 로그

#### 1. 메타데이터 없음
```
[HWPViewerWindow] File path: /Documents/test.hwp
[HWPViewerWindow] ❌ File metadata not found
→ 파일이 가상 파일시스템에 없음
```

#### 2. Base64 디코딩 실패
```
[HWPViewerWindow] Attempting base64 decode...
[HWPViewerWindow] First 50 chars of content: [garbled text]
[HWPViewerWindow] ❌ Base64 decode FAILED: InvalidCharacterError
→ 파일이 base64 형식이 아니거나 손상됨
```

#### 3. 잘못된 파일 형식
```
[HWPViewerWindow] File signature: 50 4b 03 04 14 00 00 00
[HWPViewerWindow] ⚠️ Unexpected file signature - may not be a valid HWP file
→ HWP가 아닌 다른 형식 (예: ZIP, PDF 등)
```

#### 4. 0 바이트 파일
```
[HWPViewerWindow] ✅ Base64 decode SUCCESS
[HWPViewerWindow] Decoded size: 0 bytes
[HWPViewerWindow] ❌ Error: Decoded file is empty (0 bytes)
→ 파일이 비어있거나 잘못 저장됨
```

## HWP 파일 시그니처

### CFB (Compound File Binary) 포맷
HWP 5.0 파일은 Microsoft의 CFB 형식 사용

**정상 시그니처 (첫 8바이트):**
```
D0 CF 11 E0 A1 B1 1A E1
```

이 시그니처가 없으면 유효한 HWP 파일이 아님!

## 테스트 방법

### 1. 정상 파일 테스트
```
1. MyComputer에서 HWP 파일 업로드
2. 파일 더블클릭
3. 콘솔 확인: ✅ Valid CFB signature
4. 문서가 정상적으로 표시되어야 함
```

### 2. 손상된 파일 테스트
```
1. 텍스트 파일을 .hwp로 리네임
2. 업로드 후 더블클릭
3. 콘솔 확인: ⚠️ Unexpected file signature
4. 적절한 에러 메시지 표시
```

### 3. 빈 파일 테스트
```
1. 빈 파일 생성 (0 bytes)
2. .hwp 확장자로 저장
3. 업로드 후 더블클릭
4. 에러: "Decoded file is empty (0 bytes)"
```

## 문제 해결 가이드

### 사용자가 0 size 문제 보고 시

1. **브라우저 콘솔 확인 요청**
   - F12 키 눌러 개발자 도구 열기
   - Console 탭 선택
   - 에러 로그 확인

2. **로그 분석**
   - `Decoded size: 0 bytes` → 파일이 비어있음
   - `Base64 decode FAILED` → 파일 인코딩 문제
   - `File metadata not found` → 파일이 스토리지에 없음

3. **해결 방법**
   - 파일 다시 업로드
   - 다른 HWP 파일로 테스트
   - Open 버튼 사용 (실제 파일 선택)

## 개선 효과

### Before (기존)
```
❌ 에러 발생 시 "Error loading file" 만 표시
❌ 콘솔 로그 부족으로 디버깅 어려움
❌ 0 size 원인 파악 불가
```

### After (개선)
```
✅ 각 단계별 상세 로그 출력
✅ 파일 시그니처 검증
✅ 사용자 친화적 에러 메시지
✅ 구체적인 해결 방법 제시
✅ 문제 원인 즉시 파악 가능
```

## 향후 개선 사항

1. **자동 복구 시도**
   - Base64 디코딩 실패 시 다른 인코딩 시도
   - 파일 재로드 자동 시도

2. **파일 검증**
   - 업로드 시 HWP 파일 형식 미리 검증
   - 잘못된 파일 업로드 차단

3. **오프라인 지원**
   - IndexedDB로 마이그레이션
   - 더 큰 파일 지원

4. **성능 모니터링**
   - 로드 시간 측정
   - 병목 구간 파악

---

## 참고: 파일 저장 구조

### StorageManager 구조
```
localStorage:
  /Documents/test.hwp              → base64 인코딩된 파일 내용
  /Documents/test.hwp::meta        → JSON 메타데이터
```

### 메타데이터 예시
```json
{
  "name": "test.hwp",
  "path": "/Documents/test.hwp",
  "size": 123456,
  "created": 1703123456789,
  "modified": 1703123456789,
  "isBinary": true,
  "type": "file"
}
```

### Base64 인코딩 예시
```
원본 바이너리: [D0 CF 11 E0 A1 B1 1A E1 ...]
↓ base64 인코딩
저장된 문자열: "0M8R4KGxGuEAAAAAAAAA..."
↓ base64 디코딩
복원된 바이너리: [D0 CF 11 E0 A1 B1 1A E1 ...]
```

---

## 요약

- ✅ 상세한 디버그 로깅 추가
- ✅ 파일 시그니처 검증
- ✅ 단계별 에러 체크
- ✅ 사용자 친화적 에러 메시지
- ✅ 문제 해결 가이드 제공

이제 파일 로딩 문제를 쉽게 진단하고 해결할 수 있습니다!
