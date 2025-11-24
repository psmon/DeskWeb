# Tables and Controls (표 및 컨트롤)

이 문서는 한글문서파일형식 5.0 명세서에서 추출되었습니다.

**총 페이지 수:** 9

---

## Page 15

```
글 문서 파일 형식 5.0
HWPTAG_PARA_RANGE_TAG 가변 1 문단의 영역 태그(표 63 참조)
HWPTAG_CTRL_HEADER 4 1 컨트롤 헤더(표 64 참조)
HWPTAG_LIST_HEADER 6 2 문단 리스트 헤더(표 65 참조)
HWPTAG_PAGE_DEF 40 2 용지 설정
HWPTAG_FOOTNOTE_SHAPE 30 2 각주/미주 모양
HWPTAG_PAGE_BORDER_FILL 14 2 쪽 테두리/배경
HWPTAG_SHAPE_COMPONENT 4 2 개체
HWPTAG_TABLE 가변 2 표 개체
HWPTAG_SHAPE_COMPONENT_LINE 20 3 직선 개체
HWPTAG_SHAPE_COMPONENT_RECTANGLE 9 3 사각형 개체
HWPTAG_SHAPE_COMPONENT_ELLIPSE 60 3 타원 개체
HWPTAG_SHAPE_COMPONENT_ARC 25 3 호 개체
HWPTAG_SHAPE_COMPONENT_POLYGON 가변 3 다각형 개체
HWPTAG_SHAPE_COMPONENT_CURVE 가변 3 곡선 개체
HWPTAG_SHAPE_COMPONENT_OLE 26 3 OLE 개체
HWPTAG_SHAPE_COMPONENT_PICTURE 가변 3 그림 개체
HWPTAG_CTRL_DATA 가변 2 컨트롤 임의의 데이터
HWPTAG_EQEDIT 가변 2 수식 개체
HWPTAG_SHAPE_COMPONENT_TEXTART 가변 3 글맵시
HWPTAG_FORM_OBJECT 가변 2 양식 개체
HWPTAG_MEMO_SHAPE 22 1 메모 모양
HWPTAG_MEMO_LIST 4 1 메모 리스트 헤더
HWPTAG_CHART_DATA 2 2 차트 데이터
HWPTAG_VIDEO_DATA 가변 3 비디오 데이터
HWPTAG_SHAPE_COMPONENT_UNKNOWN 36 3 Unknown
전체 길이 가변
표 5 본문
문단에 컨트롤이 포함되는 경우 컨트롤 헤더 이후로 문단 리스트 헤더와 같은 컨트롤의 레코드 데이터가
저장된다.
o 제어 문자 (컨트롤)
표, 그림 등 일반 문자로 표현할 수 없는 요소를 표현하기 위해서 문자 코드 중 일부분을 특수 용도로
사용하고 있다.
문단 내용 중에 문자 코드가 0-31인 문자들은 특수 용도로 사용된다. 이미 13번 문자는 문단 내용의
끝 식별 기호로 사용된다는 것은 설명한 바 있다. 이외의 특수 문자들은 표나 그림 등, 일반 문자로
표현할 수 없는 문서 장식 요소를 표현하기 위해서 제어문자(컨트롤)로 사용된다.
제어 문자는 다음 세 가지 형식이 존재한다.
- 문자 컨트롤 [char] = 하나의 문자로 취급되는 문자 컨트롤 / size = 1
- 인라인 컨트롤 [inline] = 별도의 오브젝트 포인터를 가리키지 않는 단순한 인라인 컨트롤 / size = 8
- 확장 컨트롤 [extended] = 별도의 오브젝트가 데이터를 표현하는 확장 컨트롤 / size = 8
코드 설명 컨트롤 형식
0 unusable char
1 예약 extended
2 구역 정의/단 정의 extended
필드 시작(누름틀, 하이퍼링크, 블록 책갈피, 표 계산식, 문서
3 요약, 사용자 정보, 현재 날짜/시간, 문서 날짜/시간, 파일 경로, extended
상호 참조, 메일 머지, 메모, 교정부호, 개인정보)
10
```

---

## Page 17

```
글 문서 파일 형식 5.0
다.(3~9까지 8개의 ch)
0 1 2 3 4 5 6 7 8 9 10 11
‘A’ ‘B’ ch pointer ch ‘C’ 13
Control Object Instance
본 문서에 부가 설명 없이 ‘컨트롤’ 또는 ‘제어 문자’이라고 하면 바로 이 확장 컨트롤을 지칭하는
것이다.
3.2.4. 문서 요약
\005HwpSummaryInfomation 스트림에는 글 메뉴의 “파일-문서 정보-문서 요약”에서 입력한 내
용이 저장된다.
Summary Information에 대한 자세한 설명은 MSDN을 참고
The Summary Information Property Set
The DocumentSummaryInformation and UserDefined Property Set
Name Property ID string Property ID VT type
Title PIDSI_TITLE 0x00000002 VT_LPSTR
Subject PIDSI_SUBJECT 0x00000003 VT_LPSTR
Author PIDSI_AUTHOR 0x00000004 VT_LPSTR
Keywords PIDSI_KEYWORDS 0x00000005 VT_LPSTR
Comments PIDSI_COMMENTS 0x00000006 VT_LPSTR
Last Saved By PIDSI_LASTAUTHOR 0x00000008 VT_LPSTR
Revision Number PIDSI_REVNUMBER 0x00000009 VT_LPSTR
Last Printed PIDSI_LASTPRINTED 0x0000000B VT_FILETIME (UTC)
Create Time/Date( (*)) PIDSI_CREATE_DTM 0x0000000C VT_FILETIME (UTC)
Last saved Time/Date( (*)) PIDSI_LASTSAVE_DTM 0x0000000D VT_FILETIME (UTC)
Number of Pages PIDSI_PAGECOUNT 0x0000000E VT_I4
Date String(User define) HWPPIDSI_DATE_STR 0x00000014 VT_LPSTR
HWPPIDSI_PARACOUN
Para Count(User define) 0x00000015 VT_I4
T
표 7 문서 요약
3.2.5. 바이너리 데이터
BinData 스토리지에는 그림이나 OLE 개체와 같이 문서에 첨부된 바이너리 데이터가 각각의 스트림으
로 저장된다.
3.2.6. 미리보기 텍스트
PrvText 스트림에는 미리보기 텍스트가 유니코드 문자열로 저장된다.
12
```

---

## Page 38

```
글 문서 파일 형식 5.0
4.3. ‘본문’의 데이터 레코드
본문에서 사용되는 데이터 레코드는 다음과 같다.
Tag ID Value 설명
HWPTAG_PARA_HEADER HWPTAG_BEGIN+50 문단 헤더
HWPTAG_PARA_TEXT HWPTAG_BEGIN+51 문단의 텍스트
HWPTAG_PARA_CHAR_SHAPE HWPTAG_BEGIN+52 문단의 글자 모양
HWPTAG_PARA_LINE_SEG HWPTAG_BEGIN+53 문단의 레이아웃
HWPTAG_PARA_RANGE_TAG HWPTAG_BEGIN+54 문단의 영역 태그
HWPTAG_CTRL_HEADER HWPTAG_BEGIN+55 컨트롤 헤더
HWPTAG_LIST_HEADER HWPTAG_BEGIN+56 문단 리스트 헤더
HWPTAG_PAGE_DEF HWPTAG_BEGIN+57 용지 설정
HWPTAG_FOOTNOTE_SHAPE HWPTAG_BEGIN+58 각주/미주 모양
HWPTAG_PAGE_BORDER_FILL HWPTAG_BEGIN+59 쪽 테두리/배경
HWPTAG_SHAPE_COMPONENT HWPTAG_BEGIN+60 개체
HWPTAG_TABLE HWPTAG_BEGIN+61 표 개체
HWPTAG_SHAPE_COMPONENT_LINE HWPTAG_BEGIN+62 직선 개체
HWPTAG_SHAPE_COMPONENT_RECTANGLE HWPTAG_BEGIN+63 사각형 개체
HWPTAG_SHAPE_COMPONENT_ELLIPSE HWPTAG_BEGIN+64 타원 개체
HWPTAG_SHAPE_COMPONENT_ARC HWPTAG_BEGIN+65 호 개체
HWPTAG_SHAPE_COMPONENT_POLYGON HWPTAG_BEGIN+66 다각형 개체
HWPTAG_SHAPE_COMPONENT_CURVE HWPTAG_BEGIN+67 곡선 개체
HWPTAG_SHAPE_COMPONENT_OLE HWPTAG_BEGIN+68 OLE 개체
HWPTAG_SHAPE_COMPONENT_PICTURE HWPTAG_BEGIN+69 그림 개체
HWPTAG_SHAPE_COMPONENT_CONTAINER HWPTAG_BEGIN+70 컨테이너 개체
HWPTAG_CTRL_DATA HWPTAG_BEGIN+71 컨트롤 임의의 데이터
HWPTAG_EQEDIT HWPTAG_BEGIN+72 수식 개체
RESERVED HWPTAG_BEGIN+73 예약
HWPTAG_SHAPE_COMPONENT_TEXTART HWPTAG_BEGIN+74 글맵시
HWPTAG_FORM_OBJECT HWPTAG_BEGIN+75 양식 개체
HWPTAG_MEMO_SHAPE HWPTAG_BEGIN+76 메모 모양
HWPTAG_MEMO_LIST HWPTAG_BEGIN+77 메모 리스트 헤더
HWPTAG_CHART_DATA HWPTAG_BEGIN+79 차트 데이터
HWPTAG_VIDEO_DATA HWPTAG_BEGIN+82 비디오 데이터
HWPTAG_SHAPE_COMPONENT_UNKNOWN HWPTAG_BEGIN+99 Unknown
표 57 본문의 데이터 레코드
4.3.1. 문단 헤더 Tag ID : HWPTAG_PARA_HEADER
자료형 길이(바이트) 설명
text(=chars)
UINT32 4 if (nchars & 0x80000000) {
nchars &= 0x7fffffff;
}
control mask
UINT32 4 (UINT32)(1<<ctrlch) 조합
ctrlch는 HwpCtrlAPI.Hwp 2.1 CtrlCh 참고
UINT16 2 문단 모양 아이디 참조값
UINT8 1 문단 스타일 아이디 참조값
UINT8 1 단 나누기 종류(표 59 참조)
UINT16 2 글자 모양 정보 수
33
```

---

## Page 42

```
글 문서 파일 형식 5.0
컨트롤 ID 개체 공통 속성 개체 요소 속성
1 표 MAKE_4CHID('t', 'b', 'l', ' ') √
( 그리기 개체 )
선 MAKE_4CHID('$', 'l', 'i', 'n')
사각형 MAKE_4CHID('$', 'r', 'e', 'c')
2 타원 MAKE_4CHID('$', 'e', 'l', 'l') √ √
호 MAKE_4CHID('$', 'a', 'r', 'c')
다각형 MAKE_4CHID('$', 'p', 'o', 'l')
곡선 MAKE_4CHID('$', 'c', 'u', 'r')
3 글 97 수식 MAKE_4CHID('e', 'q', 'e', 'd') √
4 그림 MAKE_4CHID('$', 'p', 'i', 'c') √ √
5 OLE MAKE_4CHID('$', 'o', 'l', 'e') √ √
6 묶음 개체 MAKE_4CHID('$', 'c', 'o', 'n') √ √
표 67 개체 공통 속성을 포함하는 컨트롤과 컨트롤ID
자료형 길이(바이트) 설명
BYTE stream n 개체 공통 속성(표 69 참조)
BYTE stream n2 캡션 정보가 있으면 캡션 리스트 정보를 얻는다(표 71 참조)
전체 길이 가변 n + n2 바이트
표 68 개체 공통 속성
자료형 길이(바이트) 설명
UINT32 4 ctrl ID
UINT32 4 속성(표 70 참조)
HWPUNIT 4 세로 오프셋 값
HWPUNIT 4 가로 오프셋 값
HWPUNIT 4 width 오브젝트의 폭
HWPUNIT 4 height 오브젝트의 높이
INT32 4 z-order
HWPUNIT16
2×4 오브젝트의 바깥 4방향 여백
array[4]
UINT32 4 문서 내 각 개체에 대한 고유 아이디(instance ID)
INT32 4 쪽나눔 방지 on(1) / off(0)
WORD 2 개체 설명문 글자 길이(len)
WCHAR array[len] 2×len 개체 설명문 글자
전체 길이 가변 46 + (2×len) 바이트
표 69 개체 공통 속성
범위 구분 값 설명
bit 0 글자처럼 취급 여부
bit 1 예약
줄 간격에 영향을
bit 2
줄지 여부
0 paper
세로 위치의 기준
bit 3～4 1 page
(VertRelTo)
2 para
VerRelTo이 ‘paper’나 ‘page’ 이면 top,
0
그렇지 않으면 left
세로 위치의 기준에 1 VerRelTo이 ‘paper’나 ‘page’ 이면 center
bit 5～7 대한 상대적인 배열 VerRelTo이 ‘paper’나 ‘page’ 이면 bottom,
2
방식 그렇지 않으면 right
3 VerRelTo이 ‘paper’나 ‘page’ 이면 inside
4 VerRelTo이 ‘paper’나 ‘page’ 이면 outside
37
```

---

## Page 44

```
글 문서 파일 형식 5.0
범위 구분 값 설명
0 left
1 right
bit 0～1 방향
2 top
3 bottom
bit 2 캡션 폭에 마진을 포함할 지 여부 가로 방향일 때만 사용
표 73 캡션 속성
4.3.9.1. 표 개체
Tag ID : HWPTAG_TABLE
자료형 길이(바이트) 설명
BYTE stream n 개체 공통 속성(표 68 참조)
BYTE stream n2 표 개체 속성(표 75 참조)
셀 리스트(표 79 참조)
BYTE stream n3
셀 size×셀 개수.
전체 길이 가변 n + n2 + n3
표 74 표 개체
자료형 길이(바이트) 설명
UINT32 4 속성
UINT16 2 RowCount
UINT16 2 nCols
HWPUNIT16 2 CellSpacing
BYTE stream 8 안쪽 여백 정보(표 77 참조)
BYTE stream 2×n Row Size
UINT16 2 Border Fill ID
UINT16 2 Valid Zone Info Size (5.0.1.0 이상)
BYTE stream 10×n 영역 속성(표 73 참조) (5.0.1.0 이상)
전체 길이 가변 22 + (2×row) + (10×zone)
표 75 표 개체 속성
범위 구분 값 설명
0 나누지 않음
bit 0-1 쪽 경계에서 나눔 1 셀 단위로 나눔
2 나누지 않음
제목 줄 자동 반복
bit 2
여부
표 76 표 속성의 속성
자료형 길이(바이트) 설명
HWPUNIT16 2 왼쪽 여백
HWPUNIT16 2 오른쪽 여백
HWPUNIT16 2 위쪽 여백
HWPUNIT16 2 아래쪽 여백
전체 길이 8
표 77 안쪽 여백 정보
39
```

---

## Page 45

```
글 문서 파일 형식 5.0
자료형 길이(바이트) 설명
UINT16 2 시작 열 주소
UINT16 2 시작 행 주소
UINT16 2 끝 열 주소
UINT16 2 끝 행 주소
UINT16 2 테두리 채우기 ID
전체 길이 10
표 78 영역 속성
자료형 길이(바이트) 설명
BYTE stream n 문단 리스트 헤더(표 65 참조)
BYTE stream 26 셀 속성(표 80 참조)
전체 길이 가변 26+n 바이트
표 79 셀 리스트
자료형 길이(바이트) 설명
UINT16 2 셀 주소(Column, 맨 왼쪽 셀이 0부터 시작하여 1씩 증가)
UINT16 2 셀 주소(Row, 맨 위쪽 셀이 0부터 시작하여 1씩 증가)
UINT16 2 열의 병합 개수
UINT16 2 행의 병합 개수
HWPUNIT 4 셀의 폭
HWPUNIT 4 셀의 높이
HWPUNIT16 array[4] 2×4 셀 4방향 여백
UINT16 2 테두리/배경 아이디
전체 길이 26
표 80 셀 속성
4.3.9.2. 그리기 개체(선, 사각형, 타원, 호, 다각형, 곡선)
모든 그리기 개체에 대한 serialization은 우선 base인 그리기 개체 공통 속성을 serialize한 다음
자신이 가지고 있는 개체 요소 속성을 serialize한다.
자료형 길이(바이트) 설명
BYTE stream n 개체 요소 속성(표 82 참조)
BYTE stream 11 테두리 선 정보(표 86 참조)
BYTE stream n2 채우기 정보(표 28 참조)
BYTE stream 12 글상자 속성이 있으면 글상자의 리스트 정보를 얻는다.
전체 길이 가변 23 + n + n2 바이트
표 81 그리기 개체 공통 속성
4.3.9.2.1. 개체 요소
Tag ID : HWPTAG_SHAPE_COMPONENT(GenShapeObject일 경우 id가 두 번 기록됨)
자료형 길이(바이트) 설명
40
```

---

## Page 46

```
글 문서 파일 형식 5.0
UINT32 4 개체 컨트롤 ID
전체 길이 4
표 82 개체 요소 속성
자료형 길이(바이트) 설명
INT32 4 개체가 속한 그룹 내에서의 X offset
INT32 4 개체가 속한 그룹 내에서의 Y offset
WORD 2 몇 번이나 그룹 되었는지
WORD 2 개체 요소의 local file version
UINT32 4 개체 생성 시 초기 폭
UINT32 4 개체 생성 시 초기 높이
UINT32 4 개체의 현재 폭
UINT32 4 개체의 현재 높이
속성
값 설명
UINT32 4
0 horz flip
1 vert flip
HWPUNIT16 2 회전각
INT32 4 회전 중심의 x 좌표(개체 좌표계)
INT32 4 회전 중심의 y 좌표(개체 좌표계)
n Rendering 정보(표 79 참조)
전체 길이 가변 42+n 바이트
표 83 개체 요소 속성
자료형 길이(바이트) 설명
scale matrix와 rotration matrix쌍의 개수(cnt)
WORD 2 초기엔 1, group할 때마다 하나씩 증가하고, ungroup할
때 마다 하나씩 감소한다.
BYTE stream 48 ranslation matrix(표 85 참조)
BYTE stream cnt×48×2 scale matrix/rotration matrix sequence(표 85 참조)
전체 길이 가변 50 + (cnt×48×2) 바이트
표 84 Rendering 정보
각 matrix는 원소가 double로 표현되는 3 X 3 matrix로 구현된다. 마지막 줄(row)은 항상 0, 0,
1이기 때문에 실제 serialization에서는 마지막 줄은 빠진다. 저장되는 정보는 다음과 같다.
자료형 길이(바이트) 설명
double array[6] 8×6 3 X 2 matrix의 원소
전체 길이 48
표 85 matrix 정보
자료형 길이(바이트) 설명
COLORREF 4 선 색상
INT16 2 선 굵기
UINT32 4 속성(표 87 참조)
BYTE 1 Outline style(표 88 참조)
전체 길이 11
표 86 테두리 선 정보
41
```

---

## Page 56

```
글 문서 파일 형식 5.0
4.3.9.7. 묶음 개체(HWPTAG_SHAPE_COMPONENT_CONTAINER)
자료형 길이(바이트) 설명
BYTE stream n 개체 공통 속성(표 68 참조)
BYTE stream n2 묶음 개체 속성(표 121 참조)
개체 속성 x 묶음 개체의 갯수.
BYTE stream n3
(묶음 가능 개체 : 그리기 개체, OLE, 그림, 묶음 개체)
전체 길이 가변 n + n2 + n3 바이트
표 120 묶음 개체
자료형 길이(바이트) 설명
WORD 2 개체의 개수(n)
UINT32 array[n] 4×n 개체의 컨트롤 ID array
전체 길이 가변 2 + (4×n) 바이트
표 121 묶음 개체 속성
4.3.9.8. 동영상 개체(HWPTAG_VIDEO_TDATA)
자료형 길이(바이트) 설명
BYTE stream n 개체 공통 속성(표 68 참조)
BYTE stream n2 동영상 개체 속성
전체 길이 가변 n + n2 바이트
표 122 동영상 개체
자료형 길이(바이트) 설명
INT32 4 동영상 타입(표 124 참조)
BYTE stream n 동영상 타입에 따라 길이가 다름(표 125, 표 126 참조)
전체 길이 가변 n + n2 바이트
표 123 동영상 개체 속성
값 설명
0 로컬 동영상
1 웹 동영상
표 124 동영상 타입
자료형 길이(바이트) 설명
UINT16 2 비디오 파일의 사용하는 스토리지의 BinData ID
UINT16 2 썸내일 파일이 사용하는 스토리지의 BinData ID
전체 길이 4
표 125 로컬 동영상 속성
자료형 길이(바이트) 설명
51
```

---

## Page 58

```
글 문서 파일 형식 5.0
FIELD_REVISION_LINEATTACH MAKE_4CHID('%', '%', '*', 'A')
FIELD_REVISION_LINELINK MAKE_4CHID('%', '%', '*', 'i')
FIELD_REVISION_LINETRANSFER MAKE_4CHID('%', '%', '*', 't')
FIELD_REVISION_RIGHTMOVE MAKE_4CHID('%', '%', '*', 'r')
FIELD_REVISION_LEFTMOVE MAKE_4CHID('%', '%', '*', 'l')
FIELD_REVISION_TRANSFER MAKE_4CHID('%', '%', '*', 'n')
FIELD_REVISION_SIMPLEINSERT MAKE_4CHID('%', '%', '*', 'e')
FIELD_REVISION_SPLIT MAKE_4CHID('%', 's', 'p', 'l')
FIELD_REVISION_CHANGE MAKE_4CHID('%', '%', 'm', 'r')
FIELD_MEMO MAKE_4CHID('%', '%', 'm', 'e')
FIELD_PRIVATE_INFO_SECURITY MAKE_4CHID('%', 'c', 'p', 'r')
FIELD_TABLEOFCONTENTS MAKE_4CHID('%', 't', 'o', 'c')
표 128 필드 컨트롤 ID
4.3.10.1. 구역 정의
자료형 길이(바이트) 설명
UINT32 4 속성(표 130 참조)
HWPUNIT16 2 동일한 페이지에서 서로 다른 단 사이의 간격
세로로 줄맞춤을 할지 여부
HWPUNIT16 2
0 = off, 1 - n = 간격을 HWPUNIT 단위로 지정
가로로 줄맞춤을 할지 여부
HWPUNIT16 2
0 = off, 1 - n = 간격을 HWPUNIT 단위로 지정
HWPUNIT 4 기본 탭 간격(hwpunit 또는 relative characters)
UINT16 2 번호 문단 모양 ID
UINT16 2 쪽 번호 (0 = 앞 구역에 이어, n = 임의의 번호로 시작)
그림, 표, 수식 번호 (0 = 앞 구역에 이어, n = 임의의 번호로
UINT16 array[3] 2×3
시작)
대표Language(Language값이 없으면(==0), Application에 지정된
UINT16 2
Language) 5.0.1.5 이상
전체 길이 26
하위 레코드
길이(바이트) 설명
자료형
BYTE stream 40 용지설정 정보(표 131 참조)
BYTE stream 26 각주 모양 정보(표 133 참조)
BYTE stream 26 미주 모양 정보(표 133 참조)
BYTE stream 12 쪽 테두리/배경 정보(표 135 참조)
양 쪽, 홀수 쪽, 짝수 쪽의 바탕쪽 내용이 있으면 바탕쪽 정보를
BYTE stream 10
얻는다. 바탕쪽 정보는 문단 리스트를 포함한다(표 137 참조)
전체 길이 140
표 129 구역 정의
범위 설명
bit 0 머리말을 감출지 여부
bit 1 꼬리말을 감출지 여부
bit 2 바탕쪽을 감출지 여부
bit 3 테두리를 감출지 여부
bit 4 배경을 감출지 여부
bit 5 쪽 번호 위치를 감출지 여부
bit 8 구역의 첫 쪽에만 테두리 표시 여부
bit 9 구역의 첫 쪽에만 배경 표시 여부
bit 16～18 텍스트 방향(0 : 가로 1 : 세로)
53
```

---

