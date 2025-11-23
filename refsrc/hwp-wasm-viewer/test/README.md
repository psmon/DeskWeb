# HWP 분석 테스트 도구

## 개요

HWP 5.0 파일 형식을 분석하고 텍스트를 추출하는 Python 도구 모음입니다.

## ⚠️ 핵심 발견 사항 (2025-11-24)

### 테스트 파일 (test.hwp)의 특징

`test.hwp`는 **일반 문서가 아닙니다!**

- **정체**: HWP 5.0 파일 형식 명세서
- **타입**: 배포용 보호 문서 (Distribution Document)
- **본문**: 배포 보호로 인해 접근 불가
- **PrvText**: 목차(차례) 970자 포함
- **BodyText**: 배포용 경고 메시지만 포함

**발견된 텍스트**:
```
"이 문서는 상위 버전의 배포용 문서입니다.
 문서를 읽으려면 최신 버전의 글 또는 글 전용 뷰어가 필요합니다."
```

### 결론

- ✅ JavaScript 뷰어는 **완벽하게 작동** 중
- ✅ PrvText 추출 성공 (목차 표시)
- ✅ BodyText 압축 해제 성공
- ⚠️ 본문 없음 (배포용 문서 특성)
- 📝 일반 HWP 파일로 추가 테스트 필요

**상세 분석**: [TEXT_EXTRACTION_FINDINGS.md](TEXT_EXTRACTION_FINDINGS.md)

## 필요한 라이브러리

```bash
pip install olefile
```

Python 기본 라이브러리 (설치 불필요):
- `struct` - 바이너리 데이터 파싱
- `zlib` - 압축 해제

## 도구 목록

### 1. hwp_analyzer.py - 종합 분석 도구

HWP 파일의 전체 구조를 분석합니다.

**기능**:
- 파일 구조 출력 (스토리지/스트림)
- FileHeader 파싱
- PrvText 추출
- DocInfo 분석 (358개 레코드)
- BodyText/ViewText 섹션 분석

**사용법**:
```bash
python3 hwp_analyzer.py test.hwp
```

**출력 예시**:
```
HWP 파일 분석: test.hwp
파일 크기: 342,528 bytes

=== HWP 파일 구조 ===
📁 ROOT:
  📄 FileHeader
  📄 DocInfo
  📄 PrvText
...

=== FileHeader ===
서명: HWP Document File
버전: 5.1.0.1
압축 여부: True

=== DocInfo ===
파싱된 레코드 수: 358
레코드 타입별 분포:
  FACE_NAME: 49개
  CHAR_SHAPE: 65개
  PARA_SHAPE: 69개
```

### 2. text_extractor.py - 텍스트 추출 도구 ⭐ NEW

BodyText와 ViewText 섹션에서 본문 텍스트를 추출합니다.

**기능**:
- 3가지 방법으로 텍스트 추출 시도:
  1. PARA_HEADER + PARA_TEXT 표준 구조
  2. PARA_TEXT 단독
  3. 휴리스틱 UTF-16LE 검색 (모든 레코드)
- 추출된 텍스트를 `_extracted.txt`로 저장

**사용법**:
```bash
python3 text_extractor.py test.hwp
```

**출력**:
```
######################################################################
# BodyText 섹션 분석
######################################################################

섹션: BodyText/Section0
크기: 337 bytes
타입: BodyText (압축 여부: True)

파싱된 레코드 수: 11
추출된 텍스트: 1개
  [HEURISTIC] 0x43: "이 문서는 상위 버전의 배포용 문서입니다..."

최종 결과
총 추출된 텍스트: 1개
전체 텍스트를 저장했습니다: test_extracted.txt
```

### 3. viewtext_decoder.py - ViewText 전용 디코더 ⭐ NEW

ViewText 섹션의 특수 구조를 분석합니다.

**기능**:
- ViewText 헤더 구조 분석 (256바이트)
- UTF-16LE 텍스트 블록 검색
- 바이너리 데이터 hex dump
- 추출된 텍스트를 `_viewtext.txt`로 저장

**사용법**:
```bash
python3 viewtext_decoder.py test.hwp
```

**출력**:
```
ViewText 구조 분석
헤더 (처음 256바이트):
  첫 DWORD: 0x1000001c
    - 바이트 0: 0x1c (항상 0x1c)

바디 크기: 964 bytes
텍스트 블록 검색 중...
발견된 텍스트 블록: 0개
```

### 4. bodytext_analyzer.py - BodyText 상세 분석 ⭐ NEW

BodyText 섹션을 레코드 단위로 상세 분석합니다.

**기능**:
- 압축 해제 검증
- 레코드별 구조 출력
- 각 레코드에서 텍스트 추출 시도
- Hex dump 제공

**사용법**:
```bash
python3 bodytext_analyzer.py test.hwp
```

**출력**:
```
압축 여부: True
원본 크기: 337 bytes
✅ 압축 해제 성공 (raw deflate)
압축 해제 후 크기: 521 bytes

레코드 파싱:
[레코드 0] Tag: LIST_HEADER (0x42), Level: 0, Size: 24
[레코드 1] Tag: PAGE_DEF (0x43), Level: 1, Size: 244
  💡 가능한 텍스트: "이 문서는 상위 버전의 배포용 문서입니다..."
```

### 5. compression_test.py - 압축 테스트 도구

다양한 압축 해제 방법을 테스트합니다.

**사용법**:
```bash
python3 compression_test.py test.hwp
```

## 문서

### 구현 가이드
- [hwp-doc.md](hwp-doc.md) - HWP 5.0 파일 형식 완전 가이드
- [COMPRESSION_SOLUTION.md](COMPRESSION_SOLUTION.md) - 압축 해제 솔루션

### 분석 결과
- [TEXT_EXTRACTION_FINDINGS.md](TEXT_EXTRACTION_FINDINGS.md) - 텍스트 추출 분석 결과 ⭐ NEW
- [INDEX.md](INDEX.md) - 빠른 시작 가이드

## 주요 발견 사항

### 압축 방식

**중요**: HWP는 **스트림 단위**로 압축됩니다 (레코드 단위 X)

```python
# ✅ 올바른 방법
decompressed_stream = zlib.decompress(stream_data, -15)  # raw deflate
records = parse_records(decompressed_stream)

# ❌ 잘못된 방법
for record in records:
    decompressed_record = zlib.decompress(record.data)  # 실패
```

### 레코드 구조

**레코드 헤더** (4 bytes, Little Endian):
```
Bits  0-9  : Tag ID (10 bits)
Bits 10-19 : Level (10 bits)
Bits 20-31 : Size (12 bits)
```

Size가 `0xFFF`인 경우 다음 4바이트에서 실제 크기 읽기

### 텍스트 추출 방법

#### 1. 표준 방법 (일반 HWP 파일)
```python
if tag_id == 0x50:  # PARA_HEADER
    if next_tag_id == 0x51:  # PARA_TEXT
        text = para_text_data.decode('utf-16le')
```

#### 2. PrvText (미리보기)
```python
prvtext = ole.openstream('PrvText').read()
text = prvtext.decode('utf-16le')
```

#### 3. 휴리스틱 (배포용 문서 등)
```python
for record in all_records:
    text = try_decode_utf16(record.data)
    if is_valid_text(text, min_ratio=0.6):
        # 텍스트 발견!
```

## 테스트 결과

### test.hwp 파일

| 항목 | 결과 | 상세 |
|------|------|------|
| 파일 크기 | 342,528 bytes | |
| FileHeader | ✅ 파싱 성공 | 버전 5.1.0.1, 압축 활성화 |
| PrvText | ✅ 970자 | 목차(차례) |
| DocInfo | ✅ 358개 레코드 | FACE_NAME 49개, CHAR_SHAPE 65개 |
| BodyText | ✅ 압축 해제 | 337 → 521 bytes |
| BodyText 레코드 | ✅ 11개 파싱 | PAGE_DEF에서 경고 메시지 |
| BodyText 본문 | ❌ 없음 | 배포용 문서 |
| ViewText | ✅ 6개 섹션 | 비압축, 바이너리 형식 |
| ViewText 텍스트 | ❌ 없음 | UTF-16LE 아님 |

### JavaScript 뷰어 검증

Python 분석 결과와 JavaScript 구현 비교:

| 기능 | Python | JavaScript | 상태 |
|------|--------|------------|------|
| CFB 파싱 | olefile | CFB.js | ✅ 동일 |
| 압축 해제 (스트림) | zlib | pako | ✅ 동일 |
| DocInfo 레코드 | 358개 | 358개 | ✅ 일치 |
| BodyText 레코드 | 11개 | 11개 | ✅ 일치 |
| PrvText | 970자 | 1,022자 | ⚠️ 약간 차이 (제어문자) |
| 휴리스틱 추출 | 구현 | 구현 | ✅ 동일 |

## 다음 단계

### 권장 사항

1. **일반 HWP 파일로 테스트**
   - 사용자가 작성한 간단한 텍스트 문서
   - 표/이미지가 포함된 문서
   - PARA_TEXT (0x51) 레코드 존재 확인

2. **JavaScript 뷰어 최종 테스트**
   - 브라우저에서 `index.html` 열기
   - `test.hwp` 선택 후 콘솔 로그 확인
   - 개선된 텍스트 추출 로그 확인

3. **본 프로젝트 통합 검토**
   - DeskWeb에 HWP 뷰어 기능 추가
   - PrvText 기반 간단한 뷰어로 시작
   - 향후 서식/표/이미지 지원 확장

## 문의 및 기여

버그 발견이나 개선사항이 있으면 이슈를 등록해주세요.

---

**업데이트**: 2025-11-24
**Python 버전**: 3.6+
**주요 라이브러리**: olefile, zlib (기본 포함)
