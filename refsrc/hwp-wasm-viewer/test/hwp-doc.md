# HWP 5.0 파일 형식 구현 가이드

## 목차

1. [개요](#개요)
2. [파일 구조](#파일-구조)
3. [자료형](#자료형)
4. [FileHeader 파싱](#fileheader-파싱)
5. [레코드 구조](#레코드-구조)
6. [주요 스트림](#주요-스트림)
7. [압축 처리](#압축-처리)
8. [언어별 구현 예제](#언어별-구현-예제)
9. [참고 자료](#참고-자료)

---

## 개요

HWP 5.0 파일은 **Microsoft Compound File Binary (CFB)** 형식을 기반으로 하는 복합 문서 파일입니다.

### 주요 특징

- **복합 파일 구조**: OLE Structured Storage (CFB) 사용
- **스트림 기반**: 여러 개의 독립적인 스트림으로 데이터 저장
- **레코드 단위 압축**: zlib (deflate) 알고리즘 사용
- **Little Endian**: 모든 정수형 데이터는 리틀 엔디안 바이트 순서

### 파일 서명

```
Signature: "HWP Document File"
Magic Bytes (CFB): D0 CF 11 E0 A1 B1 1A E1
```

---

## 파일 구조

### 스토리지 계층 구조

```
HWP 파일 (Root)
├─ FileHeader         (필수) - 256 bytes 고정
├─ DocInfo            (필수) - 문서 속성 정보
├─ PrvText            (선택) - 미리보기 텍스트 (비압축)
├─ PrvImage           (선택) - 미리보기 이미지
├─ BodyText/          (스토리지)
│  ├─ Section0        (필수) - 본문 섹션 0
│  ├─ Section1        (선택) - 본문 섹션 1
│  └─ ...
├─ BinData/           (스토리지)
│  ├─ BIN0001.png     (이미지)
│  ├─ BIN0002.jpg
│  └─ ...
├─ Scripts/           (스토리지)
│  └─ DefaultJScript
├─ ViewText/          (스토리지)
│  └─ Section0        (뷰 텍스트)
└─ DocOptions/        (스토리지)
   └─ _LinkDoc
```

### 필수 스트림

| 스트림 이름 | 설명 | 크기 | 압축 여부 |
|------------|------|------|----------|
| FileHeader | 파일 헤더 정보 | 256 bytes 고정 | 아니오 |
| DocInfo | 문서 속성 정보 | 가변 | 예 (플래그에 따름) |
| BodyText/Section0 | 본문 섹션 0 | 가변 | 예 (플래그에 따름) |

### 선택 스트림

| 스트림 이름 | 설명 | 압축 여부 |
|------------|------|----------|
| PrvText | 미리보기 텍스트 (UTF-16LE) | 아니오 |
| PrvImage | 미리보기 이미지 | 아니오 |
| BinData/BIN*.* | 삽입된 바이너리 데이터 | 아니오 |

---

## 자료형

### 기본 자료형 (Little Endian)

| 타입 | 크기 | 설명 | C/Python/JavaScript |
|------|------|------|---------------------|
| BYTE | 1 byte | 부호 없는 8비트 정수 | `uint8_t` / `B` / `Uint8` |
| WORD | 2 bytes | 부호 없는 16비트 정수 | `uint16_t` / `H` / `Uint16` |
| DWORD | 4 bytes | 부호 없는 32비트 정수 | `uint32_t` / `I` / `Uint32` |
| UINT | 4 bytes | 부호 없는 32비트 정수 | `uint32_t` / `I` / `Uint32` |
| INT16 | 2 bytes | 부호 있는 16비트 정수 | `int16_t` / `h` / `Int16` |
| INT32 | 4 bytes | 부호 있는 32비트 정수 | `int32_t` / `i` / `Int32` |
| WCHAR | 2 bytes | UTF-16LE 문자 | `wchar_t` / - / - |

### 복합 자료형

```c
// 버전 정보 (4 bytes)
typedef struct {
    BYTE revision;  // 0-255
    BYTE patch;     // 0-255
    BYTE minor;     // 0-255
    BYTE major;     // 0-255
} VERSION;

// 예: 5.1.0.1 = 0x05010001
// 리틀 엔디안: 01 00 01 05
```

---

## FileHeader 파싱

### 구조 (256 bytes 고정)

| Offset | 크기 | 타입 | 필드명 | 설명 |
|--------|------|------|--------|------|
| 0 | 32 bytes | CHAR[] | Signature | "HWP Document File" (NULL 패딩) |
| 32 | 4 bytes | DWORD | Version | 버전 정보 (0xMMnnPPrr) |
| 36 | 4 bytes | DWORD | Flags | 속성 플래그 |
| 40 | 4 bytes | DWORD | Flags2 | 추가 속성 플래그 |
| 44 | 4 bytes | DWORD | EncryptVersion | 암호화 버전 |
| 48 | 1 byte | BYTE | KOGLLicense | KOGL 라이선스 국가 코드 |
| 49 | 207 bytes | - | Reserved | 예약 영역 |

### Flags 비트맵 (36-39 bytes)

| 비트 | 플래그명 | 설명 |
|------|----------|------|
| 0x01 | Compressed | 압축 여부 (1=압축됨) |
| 0x02 | Encrypted | 암호화 여부 (1=암호화됨) |
| 0x04 | Distribution | 배포용 문서 |
| 0x08 | Script | 스크립트 포함 |
| 0x10 | DRM | DRM 보안 문서 |
| 0x20 | XMLTemplate | XML 템플릿 |
| 0x40 | History | 변경 이력 포함 |
| 0x80 | Signature | 전자 서명 |
| 0x100 | Certificate | 공인 인증서 암호화 |

### 버전 파싱 예제

```python
# Python
version_raw = struct.unpack('<I', data[32:36])[0]
major = (version_raw >> 24) & 0xFF
minor = (version_raw >> 16) & 0xFF
patch = (version_raw >> 8) & 0xFF
revision = version_raw & 0xFF
version_string = f"{major}.{minor}.{patch}.{revision}"
```

```javascript
// JavaScript
const version = view.getUint32(32, true);  // little endian
const major = (version >> 24) & 0xFF;
const minor = (version >> 16) & 0xFF;
const patch = (version >> 8) & 0xFF;
const revision = version & 0xFF;
const versionString = `${major}.${minor}.${patch}.${revision}`;
```

```c
// C
uint32_t version = *(uint32_t*)(data + 32);
uint8_t major = (version >> 24) & 0xFF;
uint8_t minor = (version >> 16) & 0xFF;
uint8_t patch = (version >> 8) & 0xFF;
uint8_t revision = version & 0xFF;
```

---

## 레코드 구조

DocInfo와 Section 스트림은 **레코드 구조**로 되어 있습니다.

### 레코드 헤더 (4 bytes)

```
31                                                            0
+------------------------------------------------------------+
|  Size (12 bits)  |   Level (10 bits)  |  TagID (10 bits)  |
+------------------------------------------------------------+
```

| 비트 | 필드 | 크기 | 설명 |
|------|------|------|------|
| 0-9 | TagID | 10 bits | 레코드 태그 식별자 (0-1023) |
| 10-19 | Level | 10 bits | 중첩 레벨 (0-1023) |
| 20-31 | Size | 12 bits | 레코드 크기 (0-4095 bytes) |

### Size 확장 필드

Size가 **0xFFF (4095)** 인 경우, 다음 4바이트에서 실제 크기를 읽습니다.

```python
# Python
header = struct.unpack('<I', data[offset:offset+4])[0]
offset += 4

tag_id = header & 0x3FF           # 10 bits
level = (header >> 10) & 0x3FF    # 10 bits
size = (header >> 20) & 0xFFF     # 12 bits

if size == 0xFFF:
    size = struct.unpack('<I', data[offset:offset+4])[0]
    offset += 4

record_data = data[offset:offset+size]
offset += size
```

### 주요 태그 ID

| Tag ID | 이름 | 설명 | 위치 |
|--------|------|------|------|
| 0x10 | DOCUMENT_PROPERTIES | 문서 속성 | DocInfo |
| 0x11 | ID_MAPPINGS | ID 맵핑 테이블 | DocInfo |
| 0x13 | FACE_NAME | 글꼴 이름 | DocInfo |
| 0x15 | CHAR_SHAPE | 글자 모양 | DocInfo |
| 0x19 | PARA_SHAPE | 문단 모양 | DocInfo |
| 0x1A | STYLE | 스타일 | DocInfo |
| 0x50 | PARA_HEADER | 문단 헤더 | Section |
| 0x51 | PARA_TEXT | 문단 텍스트 | Section |
| 0x52 | PARA_CHAR_SHAPE | 문단 글자 모양 | Section |
| 0x55 | CTRL_HEADER | 컨트롤 헤더 | Section |
| 0x5B | TABLE | 표 | Section |

---

## 주요 스트림

### PrvText (미리보기 텍스트)

**가장 간단하게 텍스트를 추출하는 방법**

- **인코딩**: UTF-16LE
- **압축**: 없음 (비압축)
- **용도**: 빠른 미리보기, 검색

```python
# Python
data = ole.openstream('PrvText').read()
text = data.decode('utf-16le', errors='ignore')
# 제어 문자 필터링
text = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
```

```javascript
// JavaScript
const data = CFB.find(cfb, 'PrvText').content;
const text = new TextDecoder('utf-16le').decode(data);
const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
```

### PARA_TEXT (문단 텍스트)

본문 텍스트는 Section 스트림의 **PARA_TEXT (0x51)** 레코드에 있습니다.

```python
# Python
# PARA_HEADER (0x50) 다음에 PARA_TEXT (0x51)가 옴
if record['tag_id'] == 0x51:  # PARA_TEXT
    text = record['data'].decode('utf-16le', errors='ignore')
    # 제어 문자 필터링
    text = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
```

---

## 압축 처리

### 압축 방식

- **알고리즘**: zlib (deflate)
- **단위**: 레코드 단위 압축
- **플래그**: FileHeader의 Flags & 0x01

### 압축 해제 방법

#### Python (zlib 사용)

```python
import zlib

def decompress_record(compressed_data):
    try:
        # raw deflate 시도 (windowBits=-15)
        return zlib.decompress(compressed_data, -15)
    except:
        try:
            # 일반 zlib 시도
            return zlib.decompress(compressed_data)
        except:
            # 압축 해제 실패 - 원본 반환
            return compressed_data
```

#### JavaScript (pako 사용)

```javascript
function decompressRecord(compressedData) {
    try {
        // raw deflate 시도
        return pako.inflateRaw(compressedData);
    } catch (e1) {
        try {
            // 일반 inflate 시도
            return pako.inflate(compressedData);
        } catch (e2) {
            // 압축 해제 실패 - 원본 반환
            return compressedData;
        }
    }
}
```

#### C/C++ (zlib 사용)

```c
#include <zlib.h>

int decompress_record(const unsigned char* src, int src_len,
                      unsigned char* dst, int* dst_len) {
    z_stream stream;
    stream.zalloc = Z_NULL;
    stream.zfree = Z_NULL;
    stream.opaque = Z_NULL;
    stream.avail_in = src_len;
    stream.next_in = (Bytef*)src;
    stream.avail_out = *dst_len;
    stream.next_out = (Bytef*)dst;

    // raw deflate 시도
    if (inflateInit2(&stream, -15) != Z_OK) {
        return -1;
    }

    int ret = inflate(&stream, Z_FINISH);
    *dst_len = stream.total_out;
    inflateEnd(&stream);

    return (ret == Z_STREAM_END) ? 0 : -1;
}
```

### 압축 처리 주의사항

1. **레코드 단위 압축**: 스트림 전체가 아닌 각 레코드가 개별적으로 압축됨
2. **Size 필드**: 압축된 크기인지 원본 크기인지 명세서 확인 필요
3. **일부 레코드 비압축**: 모든 레코드가 압축되는 것은 아님
4. **오류 처리**: 압축 해제 실패 시 원본 데이터 사용

---

## 언어별 구현 예제

### Python 전체 예제

```python
import olefile
import struct
import zlib

class HWPParser:
    def __init__(self, filepath):
        self.ole = olefile.OleFileIO(filepath)

    def parse_file_header(self):
        data = self.ole.openstream('FileHeader').read()

        signature = data[:32].decode('utf-8', errors='ignore').rstrip('\x00')
        version_raw = struct.unpack('<I', data[32:36])[0]
        flags_raw = struct.unpack('<I', data[36:40])[0]

        return {
            'signature': signature,
            'version': {
                'major': (version_raw >> 24) & 0xFF,
                'minor': (version_raw >> 16) & 0xFF,
                'patch': (version_raw >> 8) & 0xFF,
                'revision': version_raw & 0xFF
            },
            'compressed': bool(flags_raw & 0x01),
            'encrypted': bool(flags_raw & 0x02)
        }

    def parse_prvtext(self):
        try:
            data = self.ole.openstream('PrvText').read()
            text = data.decode('utf-16le', errors='ignore')
            return ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
        except:
            return None

    def parse_records(self, stream_name, is_compressed=False):
        data = self.ole.openstream(stream_name).read()
        records = []
        offset = 0

        while offset < len(data) - 4:
            header = struct.unpack('<I', data[offset:offset+4])[0]
            offset += 4

            tag_id = header & 0x3FF
            level = (header >> 10) & 0x3FF
            size = (header >> 20) & 0xFFF

            if size == 0xFFF:
                size = struct.unpack('<I', data[offset:offset+4])[0]
                offset += 4

            if offset + size > len(data):
                break

            record_data = data[offset:offset+size]
            offset += size

            # 압축 해제
            if is_compressed:
                try:
                    record_data = zlib.decompress(record_data, -15)
                except:
                    pass

            records.append({
                'tag_id': tag_id,
                'level': level,
                'data': record_data
            })

        return records

# 사용 예제
parser = HWPParser('document.hwp')
header = parser.parse_file_header()
print(f"Version: {header['version']['major']}.{header['version']['minor']}")
print(f"Compressed: {header['compressed']}")

text = parser.parse_prvtext()
if text:
    print(f"Text preview: {text[:100]}")
```

### JavaScript 전체 예제

```javascript
class HWPParser {
    constructor(arrayBuffer) {
        this.cfb = CFB.read(new Uint8Array(arrayBuffer), { type: 'array' });
    }

    parseFileHeader() {
        const data = CFB.find(this.cfb, 'FileHeader').content;
        const view = new DataView(data.buffer);

        const signature = new TextDecoder('utf-8')
            .decode(data.slice(0, 32))
            .replace(/\0/g, '');

        const version = view.getUint32(32, true);
        const flags = view.getUint32(36, true);

        return {
            signature: signature,
            version: {
                major: (version >> 24) & 0xFF,
                minor: (version >> 16) & 0xFF,
                patch: (version >> 8) & 0xFF,
                revision: version & 0xFF
            },
            compressed: !!(flags & 0x01),
            encrypted: !!(flags & 0x02)
        };
    }

    parsePrvText() {
        try {
            const data = CFB.find(this.cfb, 'PrvText').content;
            const text = new TextDecoder('utf-16le').decode(data);
            return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        } catch {
            return null;
        }
    }

    parseRecords(streamName, isCompressed = false) {
        const data = CFB.find(this.cfb, streamName).content;
        const view = new DataView(data.buffer);
        const records = [];
        let offset = 0;

        while (offset < data.length - 4) {
            const header = view.getUint32(offset, true);
            offset += 4;

            const tagId = header & 0x3FF;
            const level = (header >> 10) & 0x3FF;
            let size = (header >> 20) & 0xFFF;

            if (size === 0xFFF) {
                size = view.getUint32(offset, true);
                offset += 4;
            }

            if (offset + size > data.length) break;

            let recordData = data.slice(offset, offset + size);
            offset += size;

            // 압축 해제
            if (isCompressed) {
                try {
                    recordData = pako.inflateRaw(recordData);
                } catch {
                    // 압축 해제 실패 - 원본 사용
                }
            }

            records.push({ tagId, level, data: recordData });
        }

        return records;
    }
}

// 사용 예제
const parser = new HWPParser(arrayBuffer);
const header = parser.parseFileHeader();
console.log(`Version: ${header.version.major}.${header.version.minor}`);

const text = parser.parsePrvText();
if (text) {
    console.log(`Text: ${text.substring(0, 100)}`);
}
```

---

## 참고 자료

### 공식 문서

- **HWP 5.0 파일 형식 명세서** (한글과컴퓨터 제공)
- [Microsoft CFB 명세](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/)

### 오픈소스 구현

- **Python**: [hwp5tools](https://github.com/mete0r/pyhwp)
- **JavaScript**: [hwp.js](https://github.com/hahnlee/hwp.js)
- **Node.js**: [node-hwp](https://github.com/ohgyun/node-hwp)

### 관련 라이브러리

| 언어 | CFB 라이브러리 | zlib 라이브러리 |
|------|---------------|----------------|
| Python | `olefile` | `zlib` (내장) |
| JavaScript | `cfb` (SheetJS) | `pako` |
| C/C++ | `libgsf` | `zlib` |
| Java | `Apache POI` | `java.util.zip` |
| C# | `OpenMcdf` | `System.IO.Compression` |

---

## 빠른 시작 가이드

### 1. 간단한 텍스트 읽기 (PrvText)

```python
# Python - 가장 간단한 방법
import olefile

ole = olefile.OleFileIO('document.hwp')
prvtext = ole.openstream('PrvText').read()
text = prvtext.decode('utf-16le', errors='ignore')
print(text)
```

```javascript
// JavaScript - 가장 간단한 방법
const cfb = CFB.read(fileData, { type: 'array' });
const prvText = CFB.find(cfb, 'PrvText').content;
const text = new TextDecoder('utf-16le').decode(prvText);
console.log(text);
```

### 2. FileHeader 확인

```python
# Python
data = ole.openstream('FileHeader').read()
signature = data[:32].decode('utf-8').rstrip('\x00')
version = struct.unpack('<I', data[32:36])[0]
print(f"Signature: {signature}")
print(f"Version: {(version>>24)&0xFF}.{(version>>16)&0xFF}")
```

### 3. 단계별 구현 순서

1. **CFB 파싱**: 복합 파일 구조 읽기
2. **FileHeader 파싱**: 버전, 압축 여부 확인
3. **PrvText 읽기**: 간단한 텍스트 추출
4. **DocInfo 파싱**: 문서 속성 (고급)
5. **Section 파싱**: 본문 내용 (고급)
6. **압축 처리**: zlib 압축 해제 (고급)

---

## 트러블슈팅

### Q: 레코드 파싱 시 "크기 초과" 오류

**원인**: Size 필드가 압축된 크기를 나타내지 않을 수 있음

**해결**:
1. 압축 해제 전/후 크기 비교
2. Size 필드 의미 재확인
3. 명세서의 해당 레코드 타입 확인

### Q: 압축 해제 실패

**원인**:
- 모든 레코드가 압축되는 것은 아님
- windowBits 설정 오류

**해결**:
1. raw deflate (-15) 시도
2. 일반 zlib 시도
3. 실패 시 원본 데이터 사용

### Q: PrvText가 없는 파일

**원인**: 일부 HWP 파일은 PrvText를 포함하지 않음

**해결**: Section 스트림의 PARA_TEXT 레코드 파싱

---

## 라이선스 및 법적 고지

본 문서는 HWP 파일 형식을 학습하고 구현하기 위한 참고 자료입니다.

- HWP 파일 형식은 한글과컴퓨터의 재산입니다
- 상업적 사용 시 라이선스 확인 필요
- 본 문서는 교육 목적으로 작성되었습니다

---

## 기여 및 문의

본 문서에 오류나 개선사항이 있으면 이슈를 등록해주세요.
