# HWP WebAssembly Viewer

순수 JavaScript와 WebAssembly를 활용한 HWP(한글 워드프로세서) 파일 뷰어입니다.

## 📋 프로젝트 개요

이 프로젝트는 HWP 5.0 파일 형식 명세를 기반으로 브라우저에서 HWP 파일을 파싱하고 HTML로 렌더링하는 독립적인 모듈입니다. 본 프로젝트(DeskWeb)에서 기술을 참고하기 위한 POC(Proof of Concept)로 개발되었습니다.

## ✨ 주요 기능

- ✅ **HWP 5.0 파일 형식 지원**
- ✅ **Compound File Binary (CFB/OLE) 구조 파싱**
- ✅ **zlib 압축 해제** (pako 라이브러리 활용)
- ✅ **FileHeader 파싱 및 검증**
- ✅ **DocInfo 스트림 파싱** (글꼴, 스타일 정보)
- ✅ **BodyText 섹션 파싱** (문단 구조)
- ✅ **HTML 렌더링** (텍스트 위주)
- ✅ **드래그 앤 드롭** 파일 지원
- ✅ **디버그 정보 출력**

## 🚀 시작하기

### 필수 요구사항

- 최신 웹 브라우저 (Chrome, Firefox, Edge, Safari)
- 인터넷 연결 (외부 라이브러리 CDN 로딩)

### 실행 방법

1. 프로젝트 폴더로 이동:
   ```bash
   cd refsrc/hwp-wasm-viewer
   ```

2. 로컬 웹 서버 실행:
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js (http-server 사용)
   npx http-server -p 8000

   # PHP
   php -S localhost:8000
   ```

3. 브라우저에서 접속:
   ```
   http://localhost:8000
   ```

4. HWP 파일 선택 또는 드래그 앤 드롭

## 📁 프로젝트 구조

```
hwp-wasm-viewer/
├── index.html              # 메인 HTML 파일
├── css/
│   └── style.css           # 스타일시트
├── js/
│   ├── main.js             # 메인 애플리케이션 로직
│   ├── cfb-reader.js       # Compound File Binary 리더
│   ├── hwp-parser.js       # HWP 파서 (핵심 로직)
│   └── html-renderer.js    # HTML 렌더러
├── lib/                    # 외부 라이브러리 (CDN 사용)
├── wasm/                   # WebAssembly 모듈 (향후 확장)
├── sample/                 # 테스트용 샘플 파일
└── README.md               # 이 파일
```

## 🔧 기술 스택

### 핵심 기술
- **순수 JavaScript** (ES6+)
- **HTML5 File API**
- **WebAssembly** (zlib 압축 해제용)

### 외부 라이브러리
- **[cfb.js](https://github.com/SheetJS/js-cfb)** - Compound File Binary 파싱
- **[pako](https://github.com/nodeca/pako)** - zlib 압축 해제

## 📖 HWP 파일 형식 이해

### 파일 구조

HWP 파일은 Microsoft의 Compound File Binary (OLE) 구조를 기반으로 합니다:

```
HWP File (CFB Container)
├── FileHeader          # 파일 인식 정보 (256 bytes)
├── DocInfo            # 문서 정보 (글꼴, 스타일 등)
├── BodyText/
│   ├── Section0       # 본문 섹션 0
│   ├── Section1       # 본문 섹션 1
│   └── ...
├── BinData/           # 바이너리 데이터 (이미지 등)
└── ...
```

### FileHeader (256바이트)

- **Signature** (32 bytes): "HWP Document File"
- **Version** (4 bytes): 0xMMnnPPrr 형식
- **Flags** (4 bytes): 압축, 암호화, 배포용 등
- **EncryptVersion** (4 bytes): 암호화 버전

### 레코드 구조

DocInfo와 BodyText는 레코드 구조로 저장됩니다:

```
Record Header (4 bytes):
- Tag ID (10 bits): 레코드 종류
- Level (10 bits): 계층 구조 depth
- Size (12 bits): 데이터 길이
```

### 주요 레코드 Tag ID

- `0x10`: DOCUMENT_PROPERTIES (문서 속성)
- `0x13`: FACE_NAME (글꼴)
- `0x15`: CHAR_SHAPE (글자 모양)
- `0x19`: PARA_SHAPE (문단 모양)
- `0x50`: PARA_HEADER (문단 헤더)
- `0x51`: PARA_TEXT (문단 텍스트)

## 💡 구현 세부사항

### 1. CFB Reader (`cfb-reader.js`)

Compound File Binary 구조를 읽기 위한 래퍼 클래스입니다.

```javascript
const cfbReader = new CFBReader(arrayBuffer);
const fileHeader = cfbReader.readStream('FileHeader');
const section0 = cfbReader.readSection(0);
```

### 2. HWP Parser (`hwp-parser.js`)

HWP 5.0 파일 형식을 파싱하는 핵심 클래스입니다.

**주요 메서드:**
- `parseFileHeader()`: FileHeader 파싱
- `parseDocInfo()`: DocInfo 스트림 파싱
- `parseSections()`: BodyText 섹션 파싱
- `parseRecords()`: 레코드 구조 파싱
- `extractParagraphs()`: 문단 추출
- `decompressStream()`: zlib 압축 해제

### 3. HTML Renderer (`html-renderer.js`)

파싱된 데이터를 HTML로 렌더링합니다.

```javascript
const renderer = new HTMLRenderer();
renderer.render(parsedData, containerElement);
renderer.renderDebugInfo(parsedData, debugElement);
```

### 4. Main Application (`main.js`)

전체 애플리케이션 로직을 통합합니다.

## ⚠️ 제한사항 (MVP)

이 프로젝트는 기술 검증용 POC이므로 다음 기능은 제외되었습니다:

- ❌ 표 (Table) 렌더링
- ❌ 그림/이미지 렌더링
- ❌ OLE 객체
- ❌ 수식 (Equation)
- ❌ 차트 (Chart)
- ❌ 복잡한 레이아웃 (다단, 머리말/꼬리말)
- ❌ 글자 모양/문단 모양 적용
- ❌ 페이지 레이아웃

**현재 지원:** 텍스트 위주의 간단한 HWP 문서를 HTML로 변환

## 🐛 디버깅

### 브라우저 콘솔

파싱 과정의 상세 로그는 브라우저 개발자 도구 콘솔에서 확인할 수 있습니다:

```javascript
// CFB 구조 출력
cfbReader.debugPrintStructure();

// 파싱 결과 확인
console.log(parsedData);
```

### 디버그 정보 섹션

웹 페이지의 "디버그 정보" 섹션에서 다음 정보를 확인할 수 있습니다:
- FileHeader 정보
- DocInfo 통계
- 섹션별 문단 수
- 각 문단의 글자 수 및 미리보기

## 📚 참고 자료

### HWP 파일 형식 명세
- `docs/hwp-5.0-spec.md`: HWP 5.0 파일 형식 전체 명세서
- `refsrc/hwp5-spec.md`: 추가 참조 문서

### 외부 라이브러리 문서
- [CFB (Compound File Binary)](https://github.com/SheetJS/js-cfb)
- [pako (zlib port)](https://github.com/nodeca/pako)

### Microsoft 문서
- [Compound File Binary Format](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/)

## 🔮 향후 계획

1. **WebAssembly 최적화**: C/C++로 작성된 파싱 엔진을 WASM으로 컴파일
2. **고급 레이아웃**: 표, 다단, 페이지 구조 지원
3. **이미지 렌더링**: BinData에서 이미지 추출 및 표시
4. **스타일 적용**: 글꼴, 색상, 크기 등 실제 스타일 적용
5. **암호화 지원**: 암호화된 HWP 파일 처리
6. **성능 최적화**: 대용량 문서 처리 개선

## 🤝 기여

이 프로젝트는 DeskWeb 프로젝트의 기술 검증용 독립 모듈입니다. 본 프로젝트에 통합될 예정입니다.

## 📄 라이선스

이 프로젝트는 HWP 5.0 파일 형식 명세를 기반으로 개발되었으며, 교육 및 연구 목적으로 사용됩니다.

### 사용된 라이브러리 라이선스
- **cfb.js**: Apache License 2.0
- **pako**: MIT License

## 👨‍💻 개발자

DeskWeb Team

---

**마지막 업데이트**: 2025-11-24
