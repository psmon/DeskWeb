# HWP Viewer 테스트 가이드

## 빠른 테스트 (3분)

### 1. 서버 시작

```bash
cd /mnt/d/Code/Webnori/DeskWeb/refsrc/hwp-wasm-viewer
python3 -m http.server 8080
```

또는 Node.js:
```bash
npx http-server -p 8080
```

### 2. 브라우저 열기

```
http://localhost:8080
```

### 3. HWP 파일 선택

- **방법 1**: "HWP 파일 선택" 버튼 클릭
- **방법 2**: 파일을 브라우저 창에 드래그 앤 드롭

### 4. 결과 확인

브라우저 개발자 도구 (F12)를 열어 콘솔을 확인하세요.

#### 성공적인 파싱 예시:

```
HWP 파일 파싱 시작...
FileHeader 파싱 완료: {signature: "HWP Document File", version: {...}}
PrvText 파싱 완료: 970 글자
DocInfo 파싱 완료

스트림 압축 해제 성공: 3170 -> 21178 bytes ✅
DocInfo에서 358개 레코드 파싱 ✅

Section0 원본 크기: 337 bytes
스트림 압축 해제 성공: 337 -> 521 bytes ✅
Section0: 11개 레코드, 0개 문단

총 1개 섹션 파싱 완료
```

#### 예상 결과:

- ✅ **디버그 정보**에 파싱 통계 표시
- ✅ DocInfo: 358개 레코드
- ✅ Section: 11개 레코드
- ⚠️ 문단: 0개 (PARA_TEXT 없음) → PrvText 대체 렌더링

---

## 상세 테스트

### 테스트 파일

프로젝트에 포함된 `test/test.hwp` 사용:

```bash
# 브라우저에서 파일 선택 시
# test/test.hwp 선택
```

### 예상 결과

#### FileHeader

```
서명: HWP Document File
버전: 5.1.0.1
압축 여부: true
암호화 여부: false
플래그: 0x00020005
```

#### PrvText

```
길이: 970자
미리보기: "<글 문서 파일 구조 5.0 Hwp Document File Formats 5.0..."
```

#### DocInfo

```
레코드 수: 358개
글꼴: 49개
글자 모양: 65개
문단 모양: 69개
```

#### Sections

```
섹션 수: 1
전체 문단 수: 0개 (PARA_TEXT 없음)

Section 0:
  레코드: 11개
  문단: 0개
  주요 태그: 0x42(1), 0x43(1), 0x44(1)
```

#### 렌더링 결과

PrvText 대체 렌더링 (오렌지색 배경):
```
미리보기 텍스트 (PrvText)
복잡한 압축 구조로 인해 원본 문단 파싱에 실패했습니다.
대신 미리보기 텍스트를 표시합니다.

<글 문서 파일 구조 5.0 Hwp Document File Formats 5.0 revision 1.3:20181108>
...
```

---

## 브라우저 콘솔 확인

### Chrome/Edge

1. F12 키 또는 우클릭 → 검사
2. Console 탭 선택
3. 로그 메시지 확인

### Firefox

1. F12 키
2. 콘솔 탭 선택
3. 로그 메시지 확인

### 주요 로그 메시지

#### ✅ 성공 메시지

```
스트림 압축 해제 성공: 3170 -> 21178 bytes
DocInfo에서 358개 레코드 파싱
Section0: 11개 레코드, 0개 문단
```

#### ⚠️ 경고 메시지

```
PrvText 스트림을 찾을 수 없습니다  (일부 파일)
스트림 압축 해제 실패, 원본 사용  (ViewText 등)
레코드 크기가 데이터 범위를 초과  (손상된 파일)
```

#### ❌ 오류 메시지

```
FileHeader 파싱 실패  (HWP 파일 아님)
CFB 파일 파싱 실패  (손상된 파일)
```

---

## 다른 HWP 파일 테스트

### 1. 간단한 텍스트 문서

```
예상 결과:
- PrvText: 전체 텍스트
- Sections: 1~2개
- 문단: 가능 (PARA_TEXT 존재 시)
```

### 2. 복잡한 서식 문서

```
예상 결과:
- DocInfo 레코드: 많음 (200+)
- BIN_DATA: 이미지 수
- PARA_SHAPE, CHAR_SHAPE: 많음
```

### 3. 표가 포함된 문서

```
예상 결과:
- TABLE (0x5B) 레코드 존재
- 복잡한 구조
```

---

## 문제 해결

### Q: "CFB 라이브러리가 로드되지 않았습니다"

**해결**:
1. 인터넷 연결 확인 (CDN 사용 시)
2. `lib/cfb.min.js` 파일 존재 확인
3. 로컬 웹 서버 사용 (file:// 프로토콜 사용 금지)

### Q: "스트림 압축 해제 실패"

**원인**:
- pako 라이브러리 로딩 실패
- 손상된 HWP 파일
- 비압축 스트림

**해결**:
1. pako 라이브러리 확인
2. 다른 HWP 파일로 테스트
3. 브라우저 콘솔에서 오류 메시지 확인

### Q: "PrvText를 찾을 수 없습니다"

**원인**: 일부 HWP 파일은 PrvText 스트림이 없음

**해결**:
- Section 파싱 결과 확인
- PARA_TEXT 레코드 확인
- 정상 동작 (경고일 뿐)

### Q: "문단 수: 0개"

**원인**:
- PARA_TEXT (0x51) 레코드가 없음
- BodyText가 실제 본문이 아닐 수 있음

**해결**:
- PrvText 사용 (자동 대체 렌더링)
- ViewText 섹션 확인 필요
- 다른 HWP 파일로 테스트

---

## Python 도구로 검증

JavaScript 결과를 Python 도구로 교차 검증:

```bash
cd test
python3 hwp_analyzer.py test.hwp
```

비교:
```
           JavaScript  |  Python
------------------------+---------
DocInfo 레코드    358개  |  358개 ✅
Section0 레코드    11개  |   11개 ✅
압축 해제       성공      |  성공 ✅
```

---

## 성능 테스트

### 소형 파일 (<1MB)

- 파싱 시간: <1초
- 메모리: ~10MB

### 중형 파일 (1-10MB)

- 파싱 시간: 1-3초
- 메모리: ~50MB

### 대형 파일 (>10MB)

- 파싱 시간: 3-10초
- 메모리: ~100MB+
- 브라우저가 느려질 수 있음

---

## 디버그 모드

더 상세한 로그를 보려면 `js/hwp-parser.js`에서:

```javascript
// 모든 레코드 로그
records.forEach((record, i) => {
    console.log(`Record ${i}: TagID=0x${record.tagId.toString(16)}, Size=${record.size}`);
});

// PARA_TEXT 내용 출력
if (tagId === 0x51) {
    const text = new TextDecoder('utf-16le').decode(recordData);
    console.log('PARA_TEXT:', text.substring(0, 100));
}
```

---

## 테스트 체크리스트

- [ ] 서버 시작 확인
- [ ] 브라우저에서 페이지 열기
- [ ] test.hwp 파일 선택
- [ ] 디버그 정보 확인
  - [ ] FileHeader: 버전, 압축 플래그
  - [ ] DocInfo: 358개 레코드
  - [ ] Section0: 11개 레코드
- [ ] 콘솔 로그 확인
  - [ ] "스트림 압축 해제 성공" 메시지
  - [ ] 레코드 파싱 로그
- [ ] 렌더링 결과 확인
  - [ ] PrvText 표시됨 (오렌지 배경)
- [ ] 다른 HWP 파일 테스트 (선택)
- [ ] Python 도구로 검증 (선택)

---

## 성공 기준

### ✅ 최소 성공

- FileHeader 파싱 성공
- PrvText 추출 성공 (있는 경우)
- DocInfo 압축 해제 성공
- DocInfo 레코드 100개 이상 파싱

### ✅ 완전 성공

- 위 항목 모두 +
- Section 압축 해제 성공
- Section 레코드 파싱 성공
- PARA_TEXT 추출 (있는 경우)

### ⚠️ 부분 성공

- FileHeader 파싱만 성공
- PrvText만 추출
- 압축 해제 실패하지만 PrvText 사용 가능

### ❌ 실패

- FileHeader 파싱 실패
- CFB 라이브러리 로딩 실패
- 브라우저 오류

---

## 다음 단계

테스트가 성공했다면:

1. **본 프로젝트 통합 검토**
   - 기술 검증 완료
   - 통합 방안 결정

2. **추가 기능 개발**
   - PARA_TEXT 추출 개선
   - 서식 정보 적용
   - 표, 이미지 렌더링

3. **문서화**
   - API 문서
   - 통합 가이드
   - 사용자 매뉴얼

Happy Testing! 🎉
