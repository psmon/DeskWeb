# HWP 분석 도구 모음

## 📁 파일 구성

### 실행 파일

| 파일 | 용도 | 실행 방법 |
|------|------|----------|
| **hwp_analyzer.py** | HWP 파일 전체 분석 도구 | `python3 hwp_analyzer.py test.hwp` |
| **compression_test.py** | 압축 방식 테스트 도구 | `python3 compression_test.py test.hwp` |

### 문서

| 파일 | 내용 |
|------|------|
| **hwp-doc.md** | HWP 파일 형식 구현 가이드 (완전판) |
| **COMPRESSION_SOLUTION.md** | 압축 해제 문제 해결 방법 ⭐ |
| **README.md** | 이 폴더의 사용 설명서 |

### 테스트 데이터

| 파일 | 설명 |
|------|------|
| **test.hwp** | HWP 5.0 명세서 샘플 파일 (342KB) |

---

## 🚀 빠른 시작

### 1. 필수 라이브러리 설치

```bash
pip install olefile
```

### 2. HWP 파일 분석

```bash
# 전체 분석
python3 hwp_analyzer.py test.hwp

# 압축 테스트
python3 compression_test.py test.hwp
```

---

## 📖 문서 읽는 순서

### 초급: HWP 파일 형식 학습

1. **README.md** ← 여기서 시작
   - 도구 사용법
   - 프로젝트 개요

2. **hwp-doc.md** ← 핵심 레퍼런스
   - HWP 파일 형식 완전 가이드
   - 자료형, 구조체 정의
   - 언어별 구현 예제 (Python, JavaScript, C)
   - 단계별 구현 방법

### 중급: 압축 처리

3. **COMPRESSION_SOLUTION.md** ⭐ 중요!
   - 압축 해제 핵심 발견사항
   - Before/After 비교
   - 올바른 구현 방법
   - 기존 코드 수정 가이드

### 고급: 실제 데이터 분석

4. **hwp_analyzer.py 소스 코드**
   - 실제 구현 코드 참고
   - 클래스 구조
   - 레코드 파싱 로직

5. **compression_test.py 소스 코드**
   - 압축 테스트 방법
   - 다양한 압축 해제 시도

---

## 🎯 핵심 발견사항

### ⭐ 압축 해제 방법 (CRITICAL)

HWP 파일의 압축은 **레코드 단위가 아닌 스트림 전체 단위**입니다!

```python
# ❌ 잘못된 방법
for record in records:
    decompressed = zlib.decompress(record.data)  # 실패!

# ✅ 올바른 방법
decompressed_stream = zlib.decompress(entire_stream, -15)  # raw deflate
records = parse_records_from(decompressed_stream)  # 성공!
```

**결과**:
- DocInfo: 1개 → **358개 레코드** 파싱 성공 ✅
- Section0: 0개 → **11개 레코드** 파싱 성공 ✅

자세한 내용: **COMPRESSION_SOLUTION.md** 참조

---

## 📊 분석 결과 예제

### test.hwp 분석 결과

```
파일 크기: 342,528 bytes
버전: 5.1.0.1
압축: 활성화

FileHeader: 256 bytes
PrvText: 970 문자 (미리보기)

DocInfo: 3,170 bytes → 21,178 bytes (압축 해제)
  ✅ 358개 레코드:
    - DOCUMENT_PROPERTIES: 1
    - FACE_NAME: 49 (글꼴)
    - CHAR_SHAPE: 65 (글자 모양)
    - PARA_SHAPE: 69 (문단 모양)
    - STYLE: 41 (스타일)
    - BORDER_FILL: 72 (테두리)
    - BIN_DATA: 38 (이미지)

Section0: 337 bytes → 521 bytes (압축 해제)
  ✅ 11개 레코드

이미지: 38개 (PNG, BMP, WMF)
```

---

## 🛠️ 도구 사용법

### hwp_analyzer.py

완전한 HWP 파일 분석 도구

```bash
# 기본 사용
python3 hwp_analyzer.py document.hwp

# Python 코드에서 사용
from hwp_analyzer import HWPAnalyzer

with HWPAnalyzer('document.hwp') as analyzer:
    header = analyzer.parse_file_header()
    text = analyzer.parse_prvtext()
    docinfo = analyzer.analyze_docinfo()
    section = analyzer.analyze_section(0)
```

**기능**:
- ✅ 파일 구조 출력 (스토리지/스트림)
- ✅ FileHeader 파싱 (버전, 플래그)
- ✅ PrvText 추출 (UTF-16LE)
- ✅ DocInfo 레코드 분석
- ✅ Section 레코드 분석
- ✅ 문단 텍스트 추출

### compression_test.py

다양한 압축 해제 방법 테스트

```bash
python3 compression_test.py document.hwp
```

**테스트 항목**:
- raw deflate (windowBits=-15) ✅
- zlib default
- gzip format
- 스트림 전체 압축 해제
- 레코드 단위 압축 해제
- 압축 패턴 분석

---

## 📚 HWP 파일 형식 요약

### 파일 구조

```
HWP 파일 (CFB/OLE)
├── FileHeader (256 bytes 고정)
├── DocInfo (압축, 레코드 구조)
├── PrvText (비압축, UTF-16LE)
├── BodyText/Section* (압축, 레코드 구조)
└── BinData/BIN*.* (이미지, 비압축)
```

### 레코드 구조

```
[4 bytes Header] [Data ...]
│               │
├─ TagID (10 bits)   레코드 타입
├─ Level (10 bits)   중첩 레벨
└─ Size (12 bits)    데이터 크기

Size == 0xFFF이면 다음 4바이트가 실제 크기
```

### 주요 태그 ID

| ID | 이름 | 설명 | 위치 |
|----|------|------|------|
| 0x10 | DOCUMENT_PROPERTIES | 문서 속성 | DocInfo |
| 0x13 | FACE_NAME | 글꼴 | DocInfo |
| 0x15 | CHAR_SHAPE | 글자 모양 | DocInfo |
| 0x19 | PARA_SHAPE | 문단 모양 | DocInfo |
| 0x50 | PARA_HEADER | 문단 헤더 | Section |
| 0x51 | PARA_TEXT | 문단 텍스트 | Section |

---

## 🔧 다른 언어로 구현하기

### Python

```python
import olefile
import zlib
import struct

ole = olefile.OleFileIO('document.hwp')
stream = ole.openstream('DocInfo').read()

# 압축 해제
decompressed = zlib.decompress(stream, -15)

# 레코드 파싱
offset = 0
while offset < len(decompressed) - 4:
    header = struct.unpack('<I', decompressed[offset:offset+4])[0]
    tag_id = header & 0x3FF
    # ...
```

### JavaScript

```javascript
const cfb = CFB.read(fileData, { type: 'array' });
const stream = CFB.find(cfb, 'DocInfo').content;

// 압축 해제
const decompressed = pako.inflateRaw(stream);

// 레코드 파싱
const view = new DataView(decompressed.buffer);
let offset = 0;
while (offset < decompressed.length - 4) {
    const header = view.getUint32(offset, true);
    const tagId = header & 0x3FF;
    // ...
}
```

자세한 내용: **hwp-doc.md** 참조

---

## 🐛 알려진 이슈

### BodyText/Section0 문단 추출 실패

현재 Section0에서 PARA_TEXT (0x51) 레코드가 발견되지 않습니다.

**원인 추정**:
- 태그 ID 0x42~0x4B는 명세서에 없는 태그
- ViewText 섹션일 수 있음 (문서 편집 뷰)
- 실제 본문은 다른 Section에 있을 수 있음

**대안**:
- PrvText 사용 (미리보기 텍스트)
- ViewText/Section* 탐색
- 다른 HWP 파일로 테스트

### ViewText 섹션 압축 해제 실패

ViewText/Section* 스트림은 압축 해제가 실패합니다.

**원인 추정**:
- ViewText는 비압축일 수 있음
- 다른 압축 방식 사용?
- 레코드 구조가 다를 수 있음

---

## 📝 추가 참고 자료

### 공식 문서

- HWP 5.0 파일 형식 명세서 (한글과컴퓨터)
- Microsoft CFB 명세서

### 오픈소스 프로젝트

- **hwp5tools** (Python): https://github.com/mete0r/pyhwp
- **hwp.js** (JavaScript): https://github.com/hahnlee/hwp.js
- **node-hwp** (Node.js): https://github.com/ohgyun/node-hwp

### 라이브러리

| 언어 | CFB | zlib |
|------|-----|------|
| Python | `olefile` | `zlib` (내장) |
| JavaScript | `cfb` (SheetJS) | `pako` |
| C/C++ | `libgsf` | `zlib` |

---

## 📧 문의 및 기여

버그나 개선사항이 있으면 이슈를 등록해주세요.

---

## ✅ 체크리스트

구현 전 확인 사항:

- [ ] olefile (Python) 또는 cfb.js (JavaScript) 설치
- [ ] zlib (Python) 또는 pako (JavaScript) 설치
- [ ] **COMPRESSION_SOLUTION.md** 읽기 (필수!)
- [ ] hwp-doc.md에서 레코드 구조 이해
- [ ] 스트림 전체 압축 해제 구현
- [ ] 레코드 파싱 구현
- [ ] 문단 텍스트 추출 구현

---

**Happy HWP Parsing! 🎉**
