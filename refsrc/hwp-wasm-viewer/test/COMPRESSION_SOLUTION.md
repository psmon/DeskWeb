# HWP 압축 해결 방법

## 핵심 발견사항 ⭐

HWP 파일의 압축은 **레코드 단위가 아닌 스트림 전체 단위**로 이루어집니다!

### 잘못된 접근 (기존)

```python
# ❌ 잘못된 방법: 각 레코드를 개별적으로 압축 해제
while offset < len(data):
    header = parse_header()
    record_data = data[offset:offset+size]

    # 레코드마다 압축 해제 시도 - 실패!
    decompressed = zlib.decompress(record_data, -15)  # 대부분 실패
```

### 올바른 접근 (수정)

```python
# ✅ 올바른 방법: 스트림 전체를 먼저 압축 해제
def parse_records(data, is_compressed=False):
    # 1. 먼저 스트림 전체를 압축 해제
    if is_compressed:
        data = zlib.decompress(data, -15)  # raw deflate

    # 2. 그 다음에 레코드 파싱
    while offset < len(data):
        header = parse_header()
        record_data = data[offset:offset+size]  # 이미 압축 해제된 데이터
        records.append(record_data)
```

## 압축 해제 결과

### Before (레코드 단위 압축 해제 시도)

```
DocInfo:
  파싱된 레코드 수: 1개 ❌
  오류: "레코드 크기가 데이터 범위를 초과"

Section0:
  파싱된 레코드 수: 0개 ❌
  문단 수: 0개 ❌
```

### After (스트림 단위 압축 해제)

```
DocInfo:
  원본 크기: 3170 bytes
  압축 해제 후: 21178 bytes (6.68배)
  파싱된 레코드 수: 358개 ✅

레코드 타입별 분포:
  DOCUMENT_PROPERTIES: 1개
  ID_MAPPINGS: 1개
  FACE_NAME: 49개
  CHAR_SHAPE: 65개
  PARA_SHAPE: 69개
  STYLE: 41개
  BORDER_FILL: 72개
  BIN_DATA: 38개
  등등... 총 358개

Section0:
  원본 크기: 337 bytes
  압축 해제 후: 521 bytes (1.55배)
  파싱된 레코드 수: 11개 ✅
```

## 구현 방법

### Python

```python
import zlib

def parse_stream(stream_data, is_compressed):
    # Step 1: 스트림 전체 압축 해제
    if is_compressed:
        try:
            # raw deflate (windowBits=-15)
            stream_data = zlib.decompress(stream_data, -15)
        except:
            try:
                # 일반 zlib 시도
                stream_data = zlib.decompress(stream_data)
            except:
                # 압축 해제 실패 - 원본 사용
                pass

    # Step 2: 압축 해제된 데이터에서 레코드 파싱
    records = []
    offset = 0

    while offset < len(stream_data) - 4:
        # 레코드 헤더 읽기
        header = struct.unpack('<I', stream_data[offset:offset+4])[0]
        offset += 4

        tag_id = header & 0x3FF
        level = (header >> 10) & 0x3FF
        size = (header >> 20) & 0xFFF

        if size == 0xFFF:
            size = struct.unpack('<I', stream_data[offset:offset+4])[0]
            offset += 4

        # 레코드 데이터 (이미 압축 해제됨)
        record_data = stream_data[offset:offset+size]
        offset += size

        records.append({
            'tag_id': tag_id,
            'level': level,
            'data': record_data
        })

    return records
```

### JavaScript

```javascript
function parseStream(streamData, isCompressed) {
    // Step 1: 스트림 전체 압축 해제
    if (isCompressed) {
        try {
            // raw deflate
            streamData = pako.inflateRaw(streamData);
        } catch (e1) {
            try {
                // 일반 inflate
                streamData = pako.inflate(streamData);
            } catch (e2) {
                // 압축 해제 실패 - 원본 사용
            }
        }
    }

    // Step 2: 압축 해제된 데이터에서 레코드 파싱
    const records = [];
    const view = new DataView(streamData.buffer);
    let offset = 0;

    while (offset < streamData.length - 4) {
        // 레코드 헤더
        const header = view.getUint32(offset, true);
        offset += 4;

        const tagId = header & 0x3FF;
        const level = (header >> 10) & 0x3FF;
        let size = (header >> 20) & 0xFFF;

        if (size === 0xFFF) {
            size = view.getUint32(offset, true);
            offset += 4;
        }

        // 레코드 데이터 (이미 압축 해제됨)
        const recordData = streamData.slice(offset, offset + size);
        offset += size;

        records.push({ tagId, level, data: recordData });
    }

    return records;
}
```

### C/C++

```c
#include <zlib.h>

int parse_stream(const unsigned char* stream_data, int stream_len,
                 int is_compressed, Record** records, int* record_count) {
    unsigned char* decompressed = NULL;
    int decompressed_len = stream_len;

    // Step 1: 스트림 전체 압축 해제
    if (is_compressed) {
        z_stream strm;
        strm.zalloc = Z_NULL;
        strm.zfree = Z_NULL;
        strm.opaque = Z_NULL;

        // raw deflate (windowBits=-15)
        if (inflateInit2(&strm, -15) == Z_OK) {
            // 압축 해제 버퍼 할당 (최대 10배 예상)
            decompressed = malloc(stream_len * 10);

            strm.avail_in = stream_len;
            strm.next_in = stream_data;
            strm.avail_out = stream_len * 10;
            strm.next_out = decompressed;

            if (inflate(&strm, Z_FINISH) == Z_STREAM_END) {
                decompressed_len = strm.total_out;
                stream_data = decompressed;  // 압축 해제된 데이터 사용
            }

            inflateEnd(&strm);
        }
    }

    // Step 2: 레코드 파싱
    int offset = 0;
    *record_count = 0;

    while (offset < decompressed_len - 4) {
        // 레코드 헤더 (Little Endian)
        uint32_t header = *(uint32_t*)(stream_data + offset);
        offset += 4;

        uint16_t tag_id = header & 0x3FF;
        uint16_t level = (header >> 10) & 0x3FF;
        uint32_t size = (header >> 20) & 0xFFF;

        if (size == 0xFFF) {
            size = *(uint32_t*)(stream_data + offset);
            offset += 4;
        }

        // 레코드 데이터
        const unsigned char* record_data = stream_data + offset;
        offset += size;

        // 레코드 저장
        (*records)[*record_count].tag_id = tag_id;
        (*records)[*record_count].level = level;
        (*records)[*record_count].size = size;
        (*records)[*record_count].data = record_data;
        (*record_count)++;
    }

    if (decompressed) {
        free(decompressed);
    }

    return 0;
}
```

## 압축 방식 상세

### zlib deflate 알고리즘

- **Algorithm**: DEFLATE (RFC 1951)
- **Window Bits**: -15 (raw deflate, no header/trailer)
- **Compression Level**: 불명 (파일마다 다를 수 있음)

### raw deflate vs zlib

```python
# raw deflate: windowBits=-15
# - zlib 헤더/트레일러 없음
# - 순수 DEFLATE 스트림
zlib.decompress(data, -15)  # ← HWP에서 주로 사용

# zlib format: windowBits=15
# - 2바이트 zlib 헤더 포함
# - 4바이트 Adler-32 체크섬 트레일러
zlib.decompress(data)

# gzip format: windowBits=15+16
# - gzip 헤더/트레일러 포함
zlib.decompress(data, 15 + 16)
```

### 압축 플래그 확인

```python
# FileHeader의 Flags 필드 (offset 36-39)
flags = struct.unpack('<I', header_data[36:40])[0]
is_compressed = bool(flags & 0x01)

# 0x01 비트가 1이면 압축됨
# 예: 0x00020005 & 0x01 = 1 → 압축됨
```

## 적용 대상 스트림

이 압축 해제 방법은 다음 스트림에 적용됩니다:

| 스트림 | 압축 여부 | 비고 |
|--------|----------|------|
| FileHeader | ❌ 비압축 | 항상 256 bytes 고정 |
| DocInfo | ✅ 압축 | Flags에 따름 |
| BodyText/Section* | ✅ 압축 | Flags에 따름 |
| ViewText/Section* | ❓ 불명 | 대부분 비압축? |
| PrvText | ❌ 비압축 | UTF-16LE 텍스트 |
| PrvImage | ❌ 비압축 | 이미지 바이너리 |
| BinData/* | ❌ 비압축 | 이미지/바이너리 |

## 테스트 결과

### test.hwp 파일 분석

```bash
$ python3 hwp_analyzer.py test.hwp

DocInfo:
  원본 크기: 3,170 bytes
  압축 해제 후: 21,178 bytes
  압축률: 6.68배
  레코드 수: 358개 ✅

  레코드 타입:
    - DOCUMENT_PROPERTIES: 1개
    - FACE_NAME: 49개 (글꼴)
    - CHAR_SHAPE: 65개 (글자 모양)
    - PARA_SHAPE: 69개 (문단 모양)
    - STYLE: 41개 (스타일)
    - BORDER_FILL: 72개 (테두리/채우기)
    - BIN_DATA: 38개 (이미지 참조)

Section0:
  원본 크기: 337 bytes
  압축 해제 후: 521 bytes
  압축률: 1.55배
  레코드 수: 11개 ✅
```

### 압축 테스트 도구

```bash
$ python3 compression_test.py test.hwp

압축 패턴 분석
--------------
DocInfo:
  첫 2바이트: 0xec94
  유니크 바이트: 250/256 → 높은 엔트로피 (압축된 데이터)

전체 스트림 압축 해제 시도:
  ✅ raw deflate (-15): 3170 → 21178 bytes (6.68x)
  ❌ zlib default: incorrect header check
  ❌ gzip format: incorrect header check

결론: raw deflate만 작동!
```

## 기존 JavaScript 구현 수정

### 수정 전 (hwp-parser.js)

```javascript
parseRecords(data, isCompressed = false) {
    const records = [];
    let offset = 0;

    while (offset < data.length - 4) {
        // 헤더 파싱
        const header = view.getUint32(offset, true);
        offset += 4;

        let recordData = data.slice(offset, offset + size);
        offset += size;

        // ❌ 레코드마다 압축 해제 시도 - 대부분 실패
        if (isCompressed && size > 0) {
            try {
                const decompressed = this.decompressStream(recordData);
                recordData = decompressed;
            } catch (e) {
                // 실패하면 원본 사용
            }
        }

        records.push({ tagId, level, size, data: recordData });
    }
}
```

### 수정 후 (권장)

```javascript
parseRecords(data, isCompressed = false) {
    // ✅ Step 1: 먼저 스트림 전체를 압축 해제
    if (isCompressed && data.length > 0) {
        try {
            data = pako.inflateRaw(data);
            console.log(`스트림 압축 해제 성공: ${data.length} bytes`);
        } catch (e1) {
            try {
                data = pako.inflate(data);
                console.log(`스트림 압축 해제 성공 (zlib): ${data.length} bytes`);
            } catch (e2) {
                console.warn('스트림 압축 해제 실패, 원본 사용');
            }
        }
    }

    // Step 2: 압축 해제된 데이터에서 레코드 파싱
    const records = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
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

        if (offset + size > data.length) {
            console.warn('레코드 크기 초과');
            break;
        }

        // 레코드 데이터 (이미 압축 해제됨)
        const recordData = data.slice(offset, offset + size);
        offset += size;

        records.push({ tagId, level, size, data: recordData });
    }

    return records;
}
```

## 결론

✅ **핵심 교훈**: HWP 파일의 압축은 스트림 전체 단위로 수행됨
✅ **해결 방법**: 레코드 파싱 전에 스트림 전체를 먼저 압축 해제
✅ **압축 알고리즘**: raw deflate (zlib, windowBits=-15)
✅ **검증 완료**: DocInfo 358개, Section 11개 레코드 파싱 성공

이제 JavaScript 구현에도 이 방법을 적용하면 완전한 HWP 파싱이 가능합니다!
