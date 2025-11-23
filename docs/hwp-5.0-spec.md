# HWP 한글 문서 파일 형식 5.0 명세서

## 목차

1. [개요](#1-개요)
2. [자료형](#2-자료형)
3. [파일 구조](#3-파일-구조)
4. [데이터 레코드](#4-데이터-레코드)
5. [부록](#5-부록)

---

## 1. 개요

### 1.1 기본 정보

한글 문서 파일(.HWP)은 2000년 10월 이후 출시된 한글 제품군(한글 워디안, 한글 2002, 한글 2005, 한글 2007, 한글 2010, 한글 2014, 한글 2018 등)에서 생성되는 문서 형식입니다.

### 1.2 주요 특징

- **파일 구조**: Windows Compound File 기반
- **문자 코드**: ISO-10646 표준 기반, 유니코드(UTF-16LE) 형식
- **압축**: zlib 라이브러리 사용 (zlib License)
- **저장 내용**:
  - 사용자가 입력한 문서 내용 및 문자 장식 정보
  - 글꼴 정보
  - 조판 설정 (용지 종류, 여백 정보 등)

### 1.3 압축

파일 크기를 최소화하기 위해 압축 기능을 사용합니다.
- **압축되지 않는 부분**: 기본 정보 저장 부분
- **압축되는 부분**: 사용자가 입력한 본문과 그림 관련 데이터
- **압축 라이브러리**: zlib (zlib.org의 공개 소프트웨어)

---

## 2. 자료형

### 2.1 기본 자료형

| 자료형 | 길이(바이트) | 부호 | 설명 |
|--------|-------------|------|------|
| BYTE | 1 | 없음 | 한 바이트 (0～255) |
| WORD | 2 | 없음 | 16비트 unsigned int |
| DWORD | 4 | 없음 | 16비트 unsigned long |
| WCHAR | 2 | - | 유니코드 기반 문자 |
| UINT8 | 1 | 없음 | unsigned __int8 |
| UINT16 | 2 | 없음 | unsigned __int16 |
| UINT32 (=UINT) | 4 | 없음 | unsigned __int32 |
| INT8 | 1 | 있음 | signed __int8 |
| INT16 | 2 | 있음 | signed __int16 |
| INT32 | 4 | 있음 | signed __int32 |

### 2.2 HWP 전용 자료형

| 자료형 | 길이(바이트) | 부호 | 설명 |
|--------|-------------|------|------|
| HWPUNIT | 4 | 없음 | 1/7200인치 단위 |
| SHWPUNIT | 4 | 있음 | 1/7200인치 단위 (부호 있음) |
| HWPUNIT16 | 2 | 있음 | INT16과 동일 |
| COLORREF | 4 | - | RGB 값 (0x00bbggrr) |
| BYTE stream | 가변 | - | 일련의 BYTE 구성 |

### 2.3 자료형 사용 규칙

- **바이트 순서**: 리틀 엔디언 (Little-endian)
  - 최하위 바이트가 먼저 저장
  - 최상위 바이트가 나중에 저장
- **배열 표현**: `자료형 array[개수]` (예: `word array[10]`)

### 2.4 단위 시스템

**HWPUNIT**는 문서 구성 요소의 크기를 표현하는 단위입니다.
- **기본 단위**: 1/7200 인치
- **예시**: [가로 2인치 × 세로 1인치] 그림 = `14400 × 7200` HWPUNIT

---

## 3. 파일 구조

### 3.1 전체 구조 개요

한글 문서 파일은 복합 파일(Compound File) 구조를 가지며, 스토리지(Storage)와 스트림(Stream)으로 구성됩니다.

| 구분 | 스토리지 | 스트림 | 길이 | 레코드 구조 | 압축/암호화 |
|------|----------|--------|------|------------|------------|
| 파일 인식 정보 | Root | FileHeader | 고정(256B) | - | - |
| 문서 정보 | Root | DocInfo | 가변 | ✓ | ✓ |
| 본문 | BodyText | Section0, Section1... | 가변 | ✓ | ✓ |
| 문서 요약 | Root | \005HwpSummaryInformation | 고정 | - | - |
| 바이너리 데이터 | BinData | BinaryData0, BinaryData1... | 가변 | - | ✓ |
| 미리보기 텍스트 | Root | PrvText | 고정 | - | - |
| 미리보기 이미지 | Root | PrvImage | 가변 | - | - |
| 문서 옵션 | DocOptions | _LinkDoc, DrmLicense... | 가변 | - | - |
| 스크립트 | Scripts | DefaultJScript, JScriptVersion... | 가변 | - | - |
| XML 템플릿 | XMLTemplate | Schema, Instance... | 가변 | - | - |
| 문서 이력 | DocHistory | VersionLog0, VersionLog1... | 가변 | ✓ | ✓ |

### 3.2 FileHeader (파일 인식 정보)

파일 인식 정보는 256바이트 고정 크기입니다.

| 자료형 | 길이 | 설명 |
|--------|------|------|
| BYTE array[32] | 32 | 서명 ("HWP Document File") |
| DWORD | 4 | 파일 버전 (0xMMnnPPrr) |
| DWORD | 4 | 속성 (bit flags) |
| DWORD | 4 | 추가 속성 |
| DWORD | 4 | EncryptVersion |
| BYTE | 1 | 공공누리 라이선스 국가 |
| BYTE array[207] | 207 | 예약 영역 |

#### 파일 버전 형식 (0xMMnnPPrr)

- **MM**: 문서 형식 구조 변경 (호환 불가)
- **nn**: 큰 변화 (호환 불가)
- **PP**: Record 추가 (호환 가능)
- **rr**: Record 정보 추가 (호환 가능)

#### 속성 비트 플래그

| Bit | 설명 |
|-----|------|
| 0 | 압축 여부 |
| 1 | 암호 설정 여부 |
| 2 | 배포용 문서 여부 |
| 3 | 스크립트 저장 여부 |
| 4 | DRM 보안 문서 여부 |
| 5 | XMLTemplate 스토리지 존재 여부 |
| 6 | 문서 이력 관리 존재 여부 |
| 7 | 전자 서명 정보 존재 여부 |
| 8 | 공인 인증서 암호화 여부 |
| 9 | 전자 서명 예비 저장 여부 |
| 10 | 공인 인증서 DRM 보안 문서 여부 |
| 11 | CCL 문서 여부 |
| 12 | 모바일 최적화 여부 |
| 13 | 개인 정보 보안 문서 여부 |
| 14 | 변경 추적 문서 여부 |
| 15 | 공공누리(KOGL) 저작권 문서 |
| 16 | 비디오 컨트롤 포함 여부 |
| 17 | 차례 필드 컨트롤 포함 여부 |
| 18-31 | 예약 |

#### EncryptVersion 값

| 값 | 설명 |
|----|------|
| 0 | None |
| 1 | 한글 2.5 버전 이하 |
| 2 | 한글 3.0 버전 Enhanced |
| 3 | 한글 3.0 버전 Old |
| 4 | 한글 7.0 버전 이후 |

### 3.3 DocInfo (문서 정보)

문서에 공통으로 사용되는 세부 정보를 담고 있습니다.

#### 문서 정보 레코드 목록

| Tag ID | 레벨 | 길이 | 설명 |
|--------|------|------|------|
| HWPTAG_DOCUMENT_PROPERTIES | 0 | 30 | 문서 속성 |
| HWPTAG_ID_MAPPINGS | 0 | 32 | 아이디 매핑 헤더 |
| HWPTAG_BIN_DATA | 1 | 가변 | 바이너리 데이터 |
| HWPTAG_FACE_NAME | 1 | 가변 | 글꼴 |
| HWPTAG_BORDER_FILL | 1 | 가변 | 테두리/배경 |
| HWPTAG_CHAR_SHAPE | 1 | 72 | 글자 모양 |
| HWPTAG_TAB_DEF | 1 | 14 | 탭 정의 |
| HWPTAG_NUMBERING | 1 | 가변 | 문단 번호 |
| HWPTAG_BULLET | 1 | 10 | 글머리표 |
| HWPTAG_PARA_SHAPE | 1 | 54 | 문단 모양 |
| HWPTAG_STYLE | 1 | 가변 | 스타일 |
| HWPTAG_MEMO_SHAPE | 1 | 22 | 메모 모양 |
| HWPTAG_TRACK_CHANGE_AUTHOR | 1 | 가변 | 변경 추적 작성자 |
| HWPTAG_TRACK_CHANGE | 1 | 가변 | 변경 추적 내용 및 모양 |
| HWPTAG_DOC_DATA | 0 | 가변 | 문서 임의의 데이터 |
| HWPTAG_FORBIDDEN_CHAR | 0 | 가변 | 금칙처리 문자 |
| HWPTAG_COMPATIBLE_DOCUMENT | 0 | 4 | 호환 문서 |
| HWPTAG_LAYOUT_COMPATIBILITY | 1 | 20 | 레이아웃 호환성 |
| HWPTAG_DISTRIBUTE_DOC_DATA | 0 | 256 | 배포용 문서 |
| HWPTAG_TRACKCHANGE | 1 | 1032 | 변경 추적 정보 |

### 3.4 BodyText (본문)

문서의 본문 내용이 저장되며, 구역별로 Section%d 스트림으로 구분됩니다.

#### 본문 레코드 목록

| Tag ID | 레벨 | 설명 |
|--------|------|------|
| HWPTAG_PARA_HEADER | 0 | 문단 헤더 |
| HWPTAG_PARA_TEXT | 1 | 문단의 텍스트 |
| HWPTAG_PARA_CHAR_SHAPE | 1 | 문단의 글자 모양 |
| HWPTAG_PARA_LINE_SEG | 1 | 문단의 레이아웃 |
| HWPTAG_PARA_RANGE_TAG | 1 | 문단의 영역 태그 |
| HWPTAG_CTRL_HEADER | 1 | 컨트롤 헤더 |
| HWPTAG_LIST_HEADER | 2 | 문단 리스트 헤더 |
| HWPTAG_PAGE_DEF | 2 | 용지 설정 |
| HWPTAG_FOOTNOTE_SHAPE | 2 | 각주/미주 모양 |
| HWPTAG_PAGE_BORDER_FILL | 2 | 쪽 테두리/배경 |
| HWPTAG_SHAPE_COMPONENT | 2 | 개체 |
| HWPTAG_TABLE | 2 | 표 개체 |
| HWPTAG_SHAPE_COMPONENT_LINE | 3 | 직선 개체 |
| HWPTAG_SHAPE_COMPONENT_RECTANGLE | 3 | 사각형 개체 |
| HWPTAG_SHAPE_COMPONENT_ELLIPSE | 3 | 타원 개체 |
| HWPTAG_SHAPE_COMPONENT_ARC | 3 | 호 개체 |
| HWPTAG_SHAPE_COMPONENT_POLYGON | 3 | 다각형 개체 |
| HWPTAG_SHAPE_COMPONENT_CURVE | 3 | 곡선 개체 |
| HWPTAG_SHAPE_COMPONENT_OLE | 3 | OLE 개체 |
| HWPTAG_SHAPE_COMPONENT_PICTURE | 3 | 그림 개체 |
| HWPTAG_CTRL_DATA | 2 | 컨트롤 임의의 데이터 |
| HWPTAG_EQEDIT | 2 | 수식 개체 |
| HWPTAG_SHAPE_COMPONENT_TEXTART | 3 | 글맵시 |
| HWPTAG_FORM_OBJECT | 2 | 양식 개체 |
| HWPTAG_MEMO_LIST | 1 | 메모 리스트 헤더 |
| HWPTAG_CHART_DATA | 2 | 차트 데이터 |
| HWPTAG_VIDEO_DATA | 3 | 비디오 데이터 |
| HWPTAG_SHAPE_COMPONENT_UNKNOWN | 3 | Unknown |

#### 제어 문자 (컨트롤)

문자 코드 0-31은 특수 용도로 사용됩니다.

**컨트롤 형식 3가지:**
1. **문자 컨트롤** [char]: 하나의 문자로 취급 (size = 1)
2. **인라인 컨트롤** [inline]: 단순한 인라인 컨트롤 (size = 8)
3. **확장 컨트롤** [extended]: 별도 오브젝트 데이터 (size = 8)

| 코드 | 설명 | 형식 |
|------|------|------|
| 0 | unusable char | - |
| 1 | 예약 | extended |
| 2 | 구역 정의/단 정의 | extended |
| 3 | 필드 시작 (누름틀, 하이퍼링크 등) | extended |
| 4 | 필드 끝 | inline |
| 5-7 | 예약 | inline |
| 8 | title mark | inline |
| 9 | 탭 | inline |
| 10 | 한 줄 끝 (line break) | char |
| 11 | 그리기 개체/표 | extended |
| 12 | 예약 | extended |
| 13 | 문단 끝 (para break) | char |
| 14 | 예약 | extended |
| 15 | 숨은 설명 | extended |
| 16 | 머리말/꼬리말 | extended |
| 17 | 각주/미주 | extended |
| 18 | 자동번호 | extended |
| 19-20 | 예약 | inline |
| 21 | 페이지 컨트롤 | extended |
| 22 | 책갈피/찾아보기 표식 | extended |
| 23 | 덧말/글자 겹침 | extended |
| 24 | 하이픈 | char |
| 25-29 | 예약 | char |
| 30 | 묶음 빈칸 | char |
| 31 | 고정폭 빈칸 | char |

### 3.5 문서 요약 (\005HwpSummaryInformation)

파일 메뉴의 "문서 정보-문서 요약"에 입력한 내용이 저장됩니다.

| Name | Property ID | VT type |
|------|-------------|---------|
| Title | PIDSI_TITLE (0x00000002) | VT_LPSTR |
| Subject | PIDSI_SUBJECT (0x00000003) | VT_LPSTR |
| Author | PIDSI_AUTHOR (0x00000004) | VT_LPSTR |
| Keywords | PIDSI_KEYWORDS (0x00000005) | VT_LPSTR |
| Comments | PIDSI_COMMENTS (0x00000006) | VT_LPSTR |
| Last Saved By | PIDSI_LASTAUTHOR (0x00000008) | VT_LPSTR |
| Revision Number | PIDSI_REVNUMBER (0x00000009) | VT_LPSTR |
| Last Printed | PIDSI_LASTPRINTED (0x0000000B) | VT_FILETIME (UTC) |
| Create Time/Date | PIDSI_CREATE_DTM (0x0000000C) | VT_FILETIME (UTC) |
| Last saved Time/Date | PIDSI_LASTSAVE_DTM (0x0000000D) | VT_FILETIME (UTC) |
| Number of Pages | PIDSI_PAGECOUNT (0x0000000E) | VT_I4 |
| Date String | HWPPIDSI_DATE_STR (0x00000014) | VT_LPSTR |
| Para Count | HWPPIDSI_PARACOUNT (0x00000015) | VT_I4 |

### 3.6 바이너리 데이터 (BinData)

그림이나 OLE 개체 등의 바이너리 데이터가 각각의 스트림으로 저장됩니다.

### 3.7 미리보기 (PrvText, PrvImage)

- **PrvText**: 미리보기 텍스트 (유니코드 문자열)
- **PrvImage**: 미리보기 이미지 (BMP 또는 GIF 형식)

### 3.8 문서 옵션 (DocOptions)

| 스트림 | 설명 |
|--------|------|
| _LinkDoc | 연결 문서 경로 |
| DrmLicense | DRM Packaging Version |
| DrmRootSect | 암호화 알고리즘 |
| CertDrmHeader | DRM Packaging Version |
| CertDrmInfo | 공인인증서 DRM 정보 |
| DigitalSignature | 전자 서명 정보 |
| PublicKeyInfo | 공개 키 정보 |

### 3.9 스크립트 (Scripts)

| 스트림 | 내용 |
|--------|------|
| JScriptVersion | Script Version (DWORD HIGH + LOW, 8바이트) |
| DefaultJScript | Script 헤더, 소스, Pre/Post 소스 |

---

## 4. 데이터 레코드

### 4.1 레코드 구조

데이터 레코드는 헤더(4바이트)와 데이터로 구성됩니다.

#### 레코드 헤더 (32bits)

| 필드 | 비트 | 설명 |
|------|------|------|
| Tag ID | 10 | 레코드 종류 (0x000-0x3FF) |
| Level | 10 | 계층 구조의 depth |
| Size | 12 | 데이터 길이 (바이트) |

**Tag ID 범위:**
- `0x000 - 0x00F`: 특별한 용도
- `0x010 - 0x1FF`: 한글 내부용 (HWPTAG_BEGIN = 0x010)
- `0x200 - 0x3FF`: 외부 어플리케이션용

**Size 필드:**
- 4095 바이트 이상일 때: 추가 DWORD로 실제 길이 표시

### 4.2 문서 정보 레코드

#### 4.2.1 문서 속성 (HWPTAG_DOCUMENT_PROPERTIES)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT16 | 2 | 구역 개수 |
| UINT16 | 2 | 페이지 시작 번호 |
| UINT16 | 2 | 각주 시작 번호 |
| UINT16 | 2 | 미주 시작 번호 |
| UINT16 | 2 | 그림 시작 번호 |
| UINT16 | 2 | 표 시작 번호 |
| UINT16 | 2 | 수식 시작 번호 |
| UINT32 | 4 | 리스트 아이디 |
| UINT32 | 4 | 문단 아이디 |
| UINT32 | 4 | 문단 내 글자 위치 |
| **합계** | **26** | |

#### 4.2.2 아이디 매핑 헤더 (HWPTAG_ID_MAPPINGS)

매핑 개수를 나타내는 인덱스:

| 인덱스 | 설명 |
|--------|------|
| 0 | 바이너리 데이터 |
| 1 | 한글 글꼴 |
| 2 | 영어 글꼴 |
| 3 | 한자 글꼴 |
| 4 | 일어 글꼴 |
| 5 | 기타 글꼴 |
| 6 | 기호 글꼴 |
| 7 | 사용자 글꼴 |
| 8 | 테두리/배경 |
| 9 | 글자 모양 |
| 10 | 탭 정의 |
| 11 | 문단 번호 |
| 12 | 글머리표 |
| 13 | 문단 모양 |
| 14 | 스타일 |
| 15 | 메모 모양 (5.0.2.1+) |
| 16 | 변경추적 (5.0.3.2+) |
| 17 | 변경추적 사용자 (5.0.3.2+) |

#### 4.2.3 바이너리 데이터 (HWPTAG_BIN_DATA)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT16 | 2 | 속성 |
| WORD | 2 | LINK 타입: 절대 경로 길이 (len1) |
| WCHAR array[len1] | 2×len1 | LINK 타입: 절대 경로 |
| WORD | 2 | LINK 타입: 상대 경로 길이 (len2) |
| WCHAR array[len2] | 2×len2 | LINK 타입: 상대 경로 |
| UINT16 | 2 | EMBEDDING/STORAGE: 바이너리 ID |
| WORD | 2 | EMBEDDING: 형식 이름 길이 (len3) |
| WCHAR array[len3] | 2×len3 | EMBEDDING: extension (jpg, bmp, gif, ole) |

**속성 비트:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0-3 | Type | 0x0000 | LINK (그림 외부 파일 참조) |
| | | 0x0001 | EMBEDDING (그림 파일 포함) |
| | | 0x0002 | STORAGE (OLE 포함) |
| bit 4-5 | 압축 | 0x0000 | 스토리지 디폴트 모드 |
| | | 0x0010 | 무조건 압축 |
| | | 0x0020 | 무조건 압축 안 함 |
| bit 8-9 | 상태 | 0x0000 | access 안 됨 |
| | | 0x0100 | access 성공 |
| | | 0x0200 | access 실패 |
| | | 0x0300 | 링크 실패했으나 무시 |

#### 4.2.4 글꼴 (HWPTAG_FACE_NAME)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| BYTE | 1 | 속성 |
| WORD | 2 | 글꼴 이름 길이 (len1) |
| WCHAR array[len1] | 2×len1 | 글꼴 이름 |
| BYTE | 1 | 대체 글꼴 유형 |
| WORD | 2 | 대체 글꼴 이름 길이 (len2) |
| WCHAR array[len2] | 2×len2 | 대체 글꼴 이름 |
| BYTE array[10] | 10 | 글꼴 유형 정보 |
| WORD | 2 | 기본 글꼴 이름 길이 (len3) |
| WCHAR array[len3] | 2×len3 | 기본 글꼴 이름 |

**속성 값:**

| 값 | 설명 |
|----|------|
| 0x80 | 대체 글꼴 존재 여부 |
| 0x40 | 글꼴 유형 정보 존재 여부 |
| 0x20 | 기본 글꼴 존재 여부 |

**대체 글꼴 유형:**

| 값 | 설명 |
|----|------|
| 0 | 원래 종류를 알 수 없음 |
| 1 | 트루타입 글꼴 (TTF) |
| 2 | 한글 전용 글꼴 (HFT) |

**글꼴 유형 정보 (10바이트):**

1. 글꼴 계열
2. 세리프 유형
3. 굵기
4. 비례
5. 대조
6. 스트로크 편차
7. 자획 유형
8. 글자형
9. 중간선
10. X-높이

#### 4.2.5 테두리/배경 (HWPTAG_BORDER_FILL)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT16 | 2 | 속성 |
| UINT8 array[4] | 4 | 4방향 테두리선 종류 |
| UINT8 array[4] | 4 | 4방향 테두리선 굵기 |
| COLORREF array[4] | 16 | 4방향 테두리선 색상 |
| UINT8 | 1 | 대각선 종류 |
| UINT8 | 1 | 대각선 굵기 |
| COLORREF | 4 | 대각선 색깔 |
| BYTE stream | n | 채우기 정보 |

**테두리선 종류:**

| 값 | 설명 |
|----|------|
| 0 | 실선 |
| 1 | 긴 점선 |
| 2 | 점선 |
| 3 | -.-.-.-. |
| 4 | -..-..-..- |
| 5 | Dash보다 긴 선분의 반복 |
| 6 | Dot보다 큰 동그라미의 반복 |
| 7 | 2중선 |
| 8 | 가는선 + 굵은선 2중선 |
| 9 | 굵은선 + 가는선 2중선 |
| 10 | 가는선 + 굵은선 + 가는선 3중선 |
| 11 | 물결 |
| 12 | 물결 2중선 |
| 13 | 두꺼운 3D |
| 14 | 두꺼운 3D (광원 반대) |
| 15 | 3D 단선 |
| 16 | 3D 단선 (광원 반대) |

**테두리선 굵기:**

| 값 | 굵기 | 값 | 굵기 |
|----|------|----|------|
| 0 | 0.1mm | 8 | 0.6mm |
| 1 | 0.12mm | 9 | 0.7mm |
| 2 | 0.15mm | 10 | 1.0mm |
| 3 | 0.2mm | 11 | 1.5mm |
| 4 | 0.25mm | 12 | 2.0mm |
| 5 | 0.3mm | 13 | 3.0mm |
| 6 | 0.4mm | 14 | 4.0mm |
| 7 | 0.5mm | 15 | 5.0mm |

**대각선 종류:**

| 값 | 설명 |
|----|------|
| 0 | Slash |
| 1 | BackSlash |
| 2 | CrookedSlash |

**채우기 정보:**

```
채우기 종류 (UINT 4바이트):
- 0x00000000: 채우기 없음
- 0x00000001: 단색 채우기
- 0x00000002: 이미지 채우기
- 0x00000004: 그러데이션 채우기
```

**단색 채우기 (type & 0x01):**
- COLORREF 4: 배경색
- COLORREF 4: 무늬색
- INT32 4: 무늬 종류

**그러데이션 채우기 (type & 0x04):**
- INT16 2: 그러데이션 유형 (줄무늬형=1, 원형=2, 원뿔형=3, 사각형=4)
- INT16 2: 기울임 (시작 각)
- INT16 2: 가로 중심
- INT16 2: 세로 중심
- INT16 2: 번짐 정도 (0-100)
- INT16 2: 색상 수 (num)
- INT32 4×num: 색상 위치
- COLORREF array[num]: 색상

**이미지 채우기 (type & 0x02):**
- BYTE 1: 이미지 채우기 유형 (0-15)
- BYTE stream 5: 그림 정보

**이미지 채우기 유형:**

| 값 | 설명 |
|----|------|
| 0 | 바둑판식으로-모두 |
| 1 | 바둑판식으로-가로/위 |
| 2 | 바둑판식으로-가로/아래 |
| 3 | 바둑판식으로-세로/왼쪽 |
| 4 | 바둑판식으로-세로/오른쪽 |
| 5 | 크기에 맞추어 |
| 6 | 가운데로 |
| 7 | 가운데 위로 |
| 8 | 가운데 아래로 |
| 9 | 왼쪽 가운데로 |
| 10 | 왼쪽 위로 |
| 11 | 왼쪽 아래로 |
| 12 | 오른쪽 가운데로 |
| 13 | 오른쪽 위로 |
| 14 | 오른쪽 아래로 |
| 15 | NONE |

#### 4.2.6 글자 모양 (HWPTAG_CHAR_SHAPE)

72바이트 고정 크기

| 자료형 | 길이 | 설명 |
|--------|------|------|
| WORD array[7] | 14 | 언어별 글꼴 ID |
| UINT8 array[7] | 7 | 언어별 장평 (50%-200%) |
| INT8 array[7] | 7 | 언어별 자간 (-50%-50%) |
| UINT8 array[7] | 7 | 언어별 상대 크기 (10%-250%) |
| INT8 array[7] | 7 | 언어별 글자 위치 (-100%-100%) |
| INT32 | 4 | 기준 크기 (0pt-4096pt) |
| UINT32 | 4 | 속성 |
| INT8 | 1 | 그림자 간격 X (-100%-100%) |
| INT8 | 1 | 그림자 간격 Y (-100%-100%) |
| COLORREF | 4 | 글자 색 |
| COLORREF | 4 | 밑줄 색 |
| COLORREF | 4 | 음영 색 |
| COLORREF | 4 | 그림자 색 |
| UINT16 | 2 | 글자 테두리/배경 ID (5.0.2.1+) |
| COLORREF | 4 | 취소선 색 (5.0.3.0+) |

**언어 인덱스:**

| 값 | 언어 |
|----|------|
| 0 | 한글 |
| 1 | 영어 |
| 2 | 한자 |
| 3 | 일어 |
| 4 | 기타 |
| 5 | 기호 |
| 6 | 사용자 |

**글자 모양 속성:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0 | 기울임 | 0/1 | 여부 |
| bit 1 | 진하게 | 0/1 | 여부 |
| bit 2-3 | 밑줄 종류 | 0 | 없음 |
| | | 1 | 글자 아래 |
| | | 3 | 글자 위 |
| bit 4-7 | 밑줄 모양 | | 테두리선 종류 참조 |
| bit 8-10 | 외곽선 종류 | 0 | 없음 |
| | | 1 | 실선 |
| | | 2 | 점선 |
| | | 3 | 굵은 실선 |
| | | 4 | 파선 |
| | | 5 | 일점쇄선 |
| | | 6 | 이점쇄선 |
| bit 11-12 | 그림자 종류 | 0 | 없음 |
| | | 1 | 비연속 |
| | | 2 | 연속 |
| bit 13 | 양각 | 0/1 | 여부 |
| bit 14 | 음각 | 0/1 | 여부 |
| bit 15 | 위 첨자 | 0/1 | 여부 |
| bit 16 | 아래 첨자 | 0/1 | 여부 |
| bit 18-20 | 취소선 | 0/1 | 여부 |
| bit 21-24 | 강조점 | 0 | 없음 |
| | | 1 | 검정 동그라미 |
| | | 2 | 속 빈 동그라미 |
| | | 3-6 | 기타 |
| bit 25 | 빈칸 | 0/1 | 글꼴에 어울리는 빈칸 |
| bit 26-29 | 취소선 모양 | | 테두리선 종류 참조 |
| bit 30 | Kerning | 0/1 | 여부 |

#### 4.2.7 탭 정의 (HWPTAG_TAB_DEF)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 속성 |
| INT16 | 4 | 탭 개수 (count) |

각 탭 정보 (8바이트 × count):

| HPWUNIT | 4 | 탭의 위치 |
| UINT8 | 1 | 탭의 종류 (왼쪽=0, 오른쪽=1, 가운데=2, 소수점=3) |
| UINT8 | 1 | 채움 종류 |
| UINT16 | 2 | 예약 |

**탭 정의 속성:**

| 범위 | 설명 |
|------|------|
| bit 0 | 문단 왼쪽 끝 자동 탭 유무 |
| bit 1 | 문단 오른쪽 끝 자동 탭 유무 |

#### 4.2.8 문단 번호 (HWPTAG_NUMBERING)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| BYTE stream | 8 | 문단 머리 정보 |
| WORD | 2 | 번호 형식 길이 (len) |

7회 반복 (수준 1-7):
- WCHAR array[len] 2×len: 번호 형식
- UINT16 2: 시작 번호
- UINT 4: 수준별 시작번호 (5.0.2.5+)

3회 반복 (수준 8-10):
- WORD 2: 확장 번호 형식 길이
- WCHAR array[len] 2×len: 확장 번호 형식
- UINT 4: 확장 수준별 시작번호 (5.1.0.0+)

**번호 형식 제어코드:**
- `^n`: 레벨 경로 (예: 1.1.1.1.1.1.1)
- `^N`: 레벨 경로 + 마침표 (예: 1.1.1.1.1.1.1.)

**번호 형식 값:**

| 값 | 형식 |
|----|------|
| 0 | 1, 2, 3 |
| 1 | 동그라미 쳐진 1, 2, 3 |
| 2 | I, II, III |
| 3 | i, ii, iii |
| 4 | A, B, C |
| 5 | a, b, c |
| 6 | 동그라미 쳐진 A, B, C |
| 7 | 동그라미 쳐진 a, b, c |
| 8 | 가, 나, 다 |
| 9 | 동그라미 쳐진 가, 나, 다 |
| 10 | ㄱ, ㄴ, ㄷ |
| 11 | 동그라미 쳐진 ㄱ, ㄴ, ㄷ |
| 12 | 일, 이, 삼 |
| 13 | 一, 二, 三 |
| 14 | 동그라미 쳐진 一, 二, 三 |

**문단 머리 정보 (8바이트):**

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT | 4 | 속성 |
| HWPUNIT16 | 2 | 너비 보정값 |
| HWPUNIT16 | 2 | 본문과의 거리 |
| UINT | 4 | 글자 모양 아이디 |

**문단 머리 속성:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0-1 | 정렬 | 0 | 왼쪽 |
| | | 1 | 가운데 |
| | | 2 | 오른쪽 |
| bit 2 | 너비 | 0/1 | 실제 문자열 너비 따름 |
| bit 3 | 자동 내어쓰기 | 0/1 | 여부 |
| bit 4 | 거리 종류 | 0 | 글자 크기 상대 비율 |
| | | 1 | 값 |

#### 4.2.9 글머리표 (HWPTAG_BULLET)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| BYTE stream | 8 | 문단 머리 정보 |
| WCHAR | 2 | 글머리표 문자 |
| INT32 | 4 | 이미지 글머리표 여부 (0 또는 ID) |
| BYTE stream | 4 | 이미지 글머리 (대비, 밝기, 효과, ID) |
| WCHAR | 2 | 체크 글머리표 문자 |

#### 4.2.10 문단 모양 (HWPTAG_PARA_SHAPE)

54바이트 고정 크기

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 속성 1 |
| INT32 | 4 | 왼쪽 여백 |
| INT32 | 4 | 오른쪽 여백 |
| INT32 | 4 | 들여쓰기/내어쓰기 |
| INT32 | 4 | 문단 간격 위 |
| INT32 | 4 | 문단 간격 아래 |
| INT32 | 4 | 줄 간격 (5.0.2.5 미만) |
| UINT16 | 2 | 탭 정의 ID |
| UINT16 | 2 | 번호 문단/글머리표 ID |
| UINT16 | 2 | 테두리/배경 ID |
| INT16 | 2 | 문단 테두리 왼쪽 간격 |
| INT16 | 2 | 문단 테두리 오른쪽 간격 |
| INT16 | 2 | 문단 테두리 위쪽 간격 |
| INT16 | 2 | 문단 테두리 아래쪽 간격 |
| UINT32 | 4 | 속성 2 (5.0.1.7+) |
| UINT32 | 4 | 속성 3 (5.0.2.5+) |
| UINT32 | 4 | 줄 간격 (5.0.2.5+) |

**속성 1:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0-1 | 줄 간격 종류 | 0 | 글자에 따라(%) |
| | | 1 | 고정값 |
| | | 2 | 여백만 지정 |
| bit 2-4 | 정렬 | 0 | 양쪽 정렬 |
| | | 1 | 왼쪽 정렬 |
| | | 2 | 오른쪽 정렬 |
| | | 3 | 가운데 정렬 |
| | | 4 | 배분 정렬 |
| | | 5 | 나눔 정렬 |
| bit 5-6 | 줄나눔 영어 | 0 | 단어 |
| | | 1 | 하이픈 |
| | | 2 | 글자 |
| bit 7 | 줄나눔 한글 | 0 | 어절 |
| | | 1 | 글자 |
| bit 8 | 줄 격자 | 0/1 | 편집 용지의 줄 격자 사용 |
| bit 9-15 | 공백 최소값 | | 0%-75% |
| bit 16 | 외톨이줄 보호 | 0/1 | 여부 |
| bit 17 | 다음 문단과 함께 | 0/1 | 여부 |
| bit 18 | 문단 보호 | 0/1 | 여부 |
| bit 19 | 쪽 나눔 | 0/1 | 문단 앞에서 항상 |
| bit 20-21 | 세로 정렬 | 0 | 글꼴 기준 |
| | | 1 | 위쪽 |
| | | 2 | 가운데 |
| | | 3 | 아래 |
| bit 22 | 줄 높이 | 0/1 | 글꼴에 어울리는 |
| bit 23-24 | 문단 머리 | 0 | 없음 |
| | | 1 | 개요 |
| | | 2 | 번호 |
| | | 3 | 글머리표 |
| bit 25-27 | 문단 수준 | | 1수준-7수준 |
| bit 28 | 문단 테두리 연결 | 0/1 | 여부 |
| bit 29 | 문단 여백 무시 | 0/1 | 여부 |
| bit 30 | 문단 꼬리 모양 | 0/1 | 여부 |

**속성 2:**

| 범위 | 설명 |
|------|------|
| bit 0-1 | 한 줄로 입력 여부 |
| bit 4 | 한글과 영어 간격 자동 조절 |
| bit 5 | 한글과 숫자 간격 자동 조절 |

**속성 3:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0-4 | 줄 간격 종류 | 0 | 글자에 따라 |
| | | 1 | 고정 값 |
| | | 2 | 여백만 지정 |
| | | 3 | 최소 |

#### 4.2.11 스타일 (HWPTAG_STYLE)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| WORD | 2 | 로컬 스타일 이름 길이 (len1) |
| WCHAR array[len1] | 2×len1 | 로컬 스타일 이름 |
| WORD | 2 | 영문 스타일 이름 길이 (len2) |
| WCHAR array[len2] | 2×len2 | 영문 스타일 이름 |
| BYTE | 1 | 속성 (스타일 종류) |
| BYTE | 1 | 다음 스타일 ID |
| INT16 | 2 | 언어 ID |
| UINT16 | 2 | 문단 모양 ID |
| UINT16 | 2 | 글자 모양 ID |

**스타일 종류:**

| 범위 | 값 | 설명 |
|------|-------|------|
| bit 0-2 | 0 | 문단 스타일 |
| | 1 | 글자 스타일 |

#### 4.2.12 문서 임의의 데이터 (HWPTAG_DOC_DATA)

파라미터 셋 구조로 저장됩니다.

**파라미터 셋:**

| 자료형 | 길이 | 설명 |
|--------|------|------|
| WORD | 2 | 파라미터 셋 ID |
| INT16 | 2 | 아이템 개수 (n) |
| Parameter Item | 가변×n | 파라미터 아이템 |

**파라미터 아이템:**

| 자료형 | 길이 | 설명 |
|--------|------|------|
| WORD | 2 | 아이템 ID |
| WORD | 2 | 아이템 종류 |
| Data | 가변 | 아이템 데이터 |

**파라미터 아이템 종류:**

| 값 | 구분 | 자료형 | 설명 |
|----|------|--------|------|
| 0 | PIT_NULL | UINT | NULL |
| 1 | PIT_BSTR | WORD + WCHAR[] | 문자열 |
| 2 | PIT_I1 | UINT | INT8 |
| 3 | PIT_I2 | UINT | INT16 |
| 4 | PIT_I4 | UINT | INT32 |
| 5 | PIT_I | UINT | INT |
| 6 | PIT_UI1 | UINT | UINT8 |
| 7 | PIT_UI2 | UINT | UINT16 |
| 8 | PIT_UI4 | UINT | UINT32 |
| 9 | PIT_UI | UINT | UINT |
| 0x8000 | PIT_SET | Parameter Set | 파라미터 셋 |
| 0x8001 | PIT_ARRAY | INT16 + Array | 파라미터 셋 배열 |
| 0x8002 | PIT_BINDATA | UINT16 | 바이너리 데이터 ID |

### 4.3 본문 레코드

#### 4.3.1 문단 헤더 (HWPTAG_PARA_HEADER)

22바이트

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 문자 수 (nchars) |
| UINT32 | 4 | control mask |
| UINT16 | 2 | 문단 모양 ID |
| UINT8 | 1 | 문단 스타일 ID |
| UINT8 | 1 | 나눔 방식 |
| UINT16 | 2 | 글자 모양 개수 |
| UINT16 | 2 | range tag 정보 수 |
| UINT16 | 2 | align 정보 수 |
| UINT32 | 4 | 문단 Instance ID |
| UINT16 | 2 | 변경추적 병합 문단 여부 (5.0.3.2+) |

**나눔 방식:**

| 값 | 설명 |
|----|------|
| 0x01 | 구역 나누기 |
| 0x02 | 다단 나누기 |
| 0x04 | 쪽 나누기 |
| 0x08 | 단 나누기 |

**nchars 처리:**
```
if (nchars & 0x80000000) {
    nchars &= 0x7fffffff;
}
```

텍스트 수가 1 이상이면 문자 수만큼 텍스트를 로드하고, 그렇지 않으면 PARA_BREAK로 문단을 생성합니다.

#### 4.3.2 문단의 텍스트 (HWPTAG_PARA_TEXT)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| WCHAR array[nchars] | 2×nchars | 문자수만큼의 텍스트 |

#### 4.3.3 문단의 글자 모양 (HWPTAG_PARA_CHAR_SHAPE)

글자 모양 개수만큼 반복:

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 글자 모양이 바뀌는 시작 위치 |
| UINT32 | 4 | 글자 모양 ID |

#### 4.3.4 문단의 레이아웃 (HWPTAG_PARA_LINE_SEG)

문단의 각 줄을 출력할 때 사용한 Cache 정보입니다.

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 텍스트 시작 위치 |
| INT32 | 4 | 줄의 세로 위치 |
| INT32 | 4 | 줄의 높이 |
| INT32 | 4 | 텍스트 부분의 높이 |
| INT32 | 4 | 베이스라인까지 거리 |
| INT32 | 4 | 줄간격 |
| INT32 | 4 | 컬럼에서의 시작 위치 |
| INT32 | 4 | 세그먼트의 폭 |
| UINT32 | 4 | 태그 |

**태그 비트:**

| Bit | 설명 |
|-----|------|
| 0 | 페이지의 첫 줄 여부 |
| 1 | 컬럼의 첫 줄 여부 |
| 16 | 빈 세그먼트 여부 |
| 17 | 줄의 첫 세그먼트 여부 |
| 18 | 줄의 마지막 세그먼트 여부 |
| 19 | auto-hyphenation 수행 여부 |
| 20 | indentation 적용 |
| 21 | 문단 머리 모양 적용 |

#### 4.3.5 문단의 영역 태그 (HWPTAG_PARA_RANGE_TAG)

텍스트의 일정 영역을 마킹하는 용도 (형광펜, 교정 부호 등). 영역은 서로 겹칠 수 있습니다.

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 영역 시작 |
| UINT32 | 4 | 영역 끝 |
| UINT32 | 4 | 태그 (상위 8bit: 종류, 하위 24bit: 데이터) |

#### 4.3.6 컨트롤 헤더 (HWPTAG_CTRL_HEADER)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | 컨트롤 ID |

컨트롤 ID는 4글자 조합으로 생성됩니다:
```
MAKE_4CHID(a, b, c, d) = ((a << 24) | (b << 16) | (c << 8) | d)
```

**주요 컨트롤 ID:**

| 번호 | 컨트롤 | ID |
|------|--------|-----|
| 1 | 표 | MAKE_4CHID('t','b','l',' ') |
| 2 | 선 | MAKE_4CHID('$','l','i','n') |
| 2 | 사각형 | MAKE_4CHID('$','r','e','c') |
| 2 | 타원 | MAKE_4CHID('$','e','l','l') |
| 2 | 호 | MAKE_4CHID('$','a','r','c') |
| 2 | 다각형 | MAKE_4CHID('$','p','o','l') |
| 2 | 곡선 | MAKE_4CHID('$','c','u','r') |
| 3 | 수식 | MAKE_4CHID('e','q','e','d') |
| 4 | 그림 | MAKE_4CHID('$','p','i','c') |
| 5 | OLE | MAKE_4CHID('$','o','l','e') |
| 6 | 묶음 개체 | MAKE_4CHID('$','c','o','n') |

#### 4.3.7 문단 리스트 헤더 (HWPTAG_LIST_HEADER)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| INT16 | 2 | 문단 수 |
| UINT32 | 4 | 속성 |

**속성:**

| 범위 | 구분 | 값 | 설명 |
|------|------|-------|------|
| bit 0-2 | 텍스트 방향 | 0 | 가로 |
| | | 1 | 세로 |
| bit 3-4 | 줄바꿈 | 0 | 일반적인 줄바꿈 |
| | | 1 | 자간 조종하여 한 줄 유지 |
| | | 2 | 내용에 따라 폭 늘어남 |
| bit 5-6 | 세로 정렬 | 0 | top |
| | | 1 | center |
| | | 2 | bottom |

#### 4.3.8 컨트롤 임의의 데이터 (HWPTAG_CTRL_DATA)

컨트롤의 필드 이름이나 하이퍼링크 정보를 저장합니다.
파라미터 셋 구조를 사용합니다.

#### 4.3.9 개체 공통 속성 (HWPTAG_SHAPE_COMPONENT)

| 자료형 | 길이 | 설명 |
|--------|------|------|
| UINT32 | 4 | ctrl ID |
| UINT32 | 4 | 속성 |
| HWPUNIT | 4 | 세로 오프셋 값 |
| HWPUNIT | 4 | 가로 오프셋 값 |
| HWPUNIT | 4 | width (폭) |
| HWPUNIT | 4 | height (높이) |
| INT32 | 4 | z-order |
| HWPUNIT16 array[4] | 8 | 바깥 4방향 여백 |
| UINT32 | 4 | instance ID |
| INT32 | 4 | 쪽나눔 방지 (on=1/off=0) |
| WORD | 2 | 개체 설명문 길이 (len) |
| WCHAR array[len] | 2×len | 개체 설명문 |

---

## 5. 부록

### 5.1 레코드 Tag ID 전체 목록

**문서 정보 (HWPTAG_BEGIN = 0x010):**

| Tag | Value | 설명 |
|-----|-------|------|
| HWPTAG_DOCUMENT_PROPERTIES | BEGIN+0 | 문서 속성 |
| HWPTAG_ID_MAPPINGS | BEGIN+1 | 아이디 매핑 헤더 |
| HWPTAG_BIN_DATA | BEGIN+2 | BinData |
| HWPTAG_FACE_NAME | BEGIN+3 | 글꼴 |
| HWPTAG_BORDER_FILL | BEGIN+4 | 테두리/배경 |
| HWPTAG_CHAR_SHAPE | BEGIN+5 | 글자 모양 |
| HWPTAG_TAB_DEF | BEGIN+6 | 탭 정의 |
| HWPTAG_NUMBERING | BEGIN+7 | 번호 정의 |
| HWPTAG_BULLET | BEGIN+8 | 불릿 정의 |
| HWPTAG_PARA_SHAPE | BEGIN+9 | 문단 모양 |
| HWPTAG_STYLE | BEGIN+10 | 스타일 |
| HWPTAG_DOC_DATA | BEGIN+11 | 문서 임의 데이터 |
| HWPTAG_DISTRIBUTE_DOC_DATA | BEGIN+12 | 배포용 문서 데이터 |
| HWPTAG_COMPATIBLE_DOCUMENT | BEGIN+14 | 호환 문서 |
| HWPTAG_LAYOUT_COMPATIBILITY | BEGIN+15 | 레이아웃 호환성 |
| HWPTAG_TRACKCHANGE | BEGIN+16 | 변경 추적 정보 |
| HWPTAG_MEMO_SHAPE | BEGIN+76 | 메모 모양 |
| HWPTAG_FORBIDDEN_CHAR | BEGIN+78 | 금칙처리 문자 |
| HWPTAG_TRACK_CHANGE | BEGIN+80 | 변경 추적 내용 및 모양 |
| HWPTAG_TRACK_CHANGE_AUTHOR | BEGIN+81 | 변경 추적 작성자 |

**본문:**

| Tag | Value | 설명 |
|-----|-------|------|
| HWPTAG_PARA_HEADER | BEGIN+50 | 문단 헤더 |
| HWPTAG_PARA_TEXT | BEGIN+51 | 문단의 텍스트 |
| HWPTAG_PARA_CHAR_SHAPE | BEGIN+52 | 문단의 글자 모양 |
| HWPTAG_PARA_LINE_SEG | BEGIN+53 | 문단의 레이아웃 |
| HWPTAG_PARA_RANGE_TAG | BEGIN+54 | 문단의 영역 태그 |
| HWPTAG_CTRL_HEADER | BEGIN+55 | 컨트롤 헤더 |
| HWPTAG_LIST_HEADER | BEGIN+56 | 문단 리스트 헤더 |
| HWPTAG_PAGE_DEF | BEGIN+57 | 용지 설정 |
| HWPTAG_FOOTNOTE_SHAPE | BEGIN+58 | 각주/미주 모양 |
| HWPTAG_PAGE_BORDER_FILL | BEGIN+59 | 쪽 테두리/배경 |
| HWPTAG_SHAPE_COMPONENT | BEGIN+60 | 개체 |
| HWPTAG_TABLE | BEGIN+61 | 표 개체 |
| HWPTAG_SHAPE_COMPONENT_LINE | BEGIN+62 | 직선 개체 |
| HWPTAG_SHAPE_COMPONENT_RECTANGLE | BEGIN+63 | 사각형 개체 |
| HWPTAG_SHAPE_COMPONENT_ELLIPSE | BEGIN+64 | 타원 개체 |
| HWPTAG_SHAPE_COMPONENT_ARC | BEGIN+65 | 호 개체 |
| HWPTAG_SHAPE_COMPONENT_POLYGON | BEGIN+66 | 다각형 개체 |
| HWPTAG_SHAPE_COMPONENT_CURVE | BEGIN+67 | 곡선 개체 |
| HWPTAG_SHAPE_COMPONENT_OLE | BEGIN+68 | OLE 개체 |
| HWPTAG_SHAPE_COMPONENT_PICTURE | BEGIN+69 | 그림 개체 |
| HWPTAG_SHAPE_COMPONENT_CONTAINER | BEGIN+70 | 컨테이너 개체 |
| HWPTAG_CTRL_DATA | BEGIN+71 | 컨트롤 임의 데이터 |
| HWPTAG_EQEDIT | BEGIN+72 | 수식 개체 |
| HWPTAG_SHAPE_COMPONENT_TEXTART | BEGIN+74 | 글맵시 |
| HWPTAG_FORM_OBJECT | BEGIN+75 | 양식 개체 |
| HWPTAG_MEMO_LIST | BEGIN+77 | 메모 리스트 헤더 |
| HWPTAG_CHART_DATA | BEGIN+79 | 차트 데이터 |
| HWPTAG_VIDEO_DATA | BEGIN+82 | 비디오 데이터 |
| HWPTAG_SHAPE_COMPONENT_UNKNOWN | BEGIN+99 | Unknown |

### 5.2 참고 자료

- **복합 파일 형식**: Microsoft OLE Compound File
- **압축 라이브러리**: zlib (zlib.org)
- **문자 코드**: ISO-10646, UTF-16LE
- **MSDN 참조**:
  - Summary Information Property Set
  - DocumentSummaryInformation Property Set
  - UserDefined Property Set

### 5.3 버전 히스토리

- **5.0.1.7**: 속성 2 추가
- **5.0.2.1**: 메모 모양, 글자 테두리/배경 추가
- **5.0.2.5**: 수준별 시작번호, 줄 간격 개선
- **5.0.3.0**: 취소선 색 추가
- **5.0.3.2**: 변경추적, 병합 문단 추가
- **5.1.0.0**: 확장 수준별 시작번호 (8-10)

---

**문서 끝**

---

이 문서는 HWP 5.0 파일 형식을 파싱하고 렌더링하기 위한 기술 명세서입니다.
