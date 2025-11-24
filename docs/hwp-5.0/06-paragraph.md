# Paragraph (문단)

이 문서는 한글문서파일형식 5.0 명세서에서 추출되었습니다.

**총 페이지 수:** 7

---

## Page 14

```
글 문서 파일 형식 5.0
본문에 사용 중인 글꼴, 글자 속성, 문단 속성, 탭, 스타일 등에 문서 내 공통으로 사용되는 세부 정보를
담고 있다.
DocInfo 스트림에 저장되는 데이터는 다음과 같다.
Tag ID 길이(바이트) 레벨 설명
HWPTAG_DOCUMENT_PROPERTIES 30 0 문서 속성(표 14 참조)
HWPTAG_ID_MAPPINGS 32 0 아이디 매핑 헤더(표 15 참조)
HWPTAG_BIN_DATA 가변 1 바이너리 데이터(표 17 참조)
HWPTAG_FACE_NAME 가변 1 글꼴(표 19 참조)
HWPTAG_BORDER_FILL 가변 1 테두리/배경(표 23 참조)
HWPTAG_CHAR_SHAPE 72 1 글자 모양(표 33 참조)
HWPTAG_TAB_DEF 14 1 탭 정의(표 36 참조)
HWPTAG_NUMBERING 가변 1 문단 번호(표 38 참조)
HWPTAG_BULLET 10 1 글머리표(표 42 참조)
HWPTAG_PARA_SHAPE 54 1 문단 모양(표 43 참조)
HWPTAG_STYLE 가변 1 스타일(표 47 참조)
HWPTAG_MEMO_SHAPE 22 1 메모 모양
HWPTAG_TRACK_CHANGE_AUTHOR 가변 1 변경 추적 작성자
HWPTAG_TRACK_CHANGE 가변 1 변경 추적 내용 및 모양
HWPTAG_DOC_DATA 가변 0 문서 임의의 데이터(표 49 참조)
HWPTAG_FORBIDDEN_CHAR 가변 0 금칙처리 문자
HWPTAG_COMPATIBLE_DOCUMENT 4 0 호환 문서(표 54 참조)
HWPTAG_LAYOUT_COMPATIBILITY 20 1 레이아웃 호환성(표 56 참조)
HWPTAG_DISTRIBUTE_DOC_DATA 256 0 배포용 문서
HWPTAG_TRACKCHANGE 1032 1 변경 추적 정보
전체 길이 가변
표 4 문서 정보
각각의 세부 정보는 <‘문서 정보’의 데이터 레코드>란에서 추가로 다룬다.
3.2.3. 본문
문서의 본문에 해당되는 문단, 표, 그리기 개체 등의 내용이 저장된다.
BodyText 스토리지는 본문의 구역에 따라 Section%d 스트림(%d는 구역의 번호)으로 구분된다. 구역
의 개수는 문서 정보의 문서 속성에 저장된다.
각 구역의 첫 문단에는 구역 정의 레코드가 저장되고, 각 단 설정의 첫 문단에는 단 정의 레코드가
저장된다.
각 구역의 가장 끝 위치에는 확장 바탕쪽(마지막 쪽, 임의 쪽) 관련 정보가 저장되고, 마지막 구역의
가장 끝 위치에는 메모 관련 정보가 저장된다.
Section 스트림에 저장되는 데이터는 문단들(문단 리스트)이며, 다음과 같은 문단 정보들이 반복 된다.
Tag ID 길이(바이트) 레벨 설명
HWPTAG_PARA_HEADER 22 0 문단 헤더(표 58 참조)
HWPTAG_PARA_TEXT 가변 1 문단의 텍스트(표 60 참조)
HWPTAG_PARA_CHAR_SHAPE 가변 1 문단의 글자 모양(표 61 참조)
HWPTAG_PARA_LINE_SEG 가변 1 문단의 레이아웃
9
```

---

## Page 16

```
글 문서 파일 형식 5.0
4 필드 끝 inline
5-7 예약 inline
8 title mark inline
9 탭 inline
10 한 줄 끝(line break) char
11 그리기 개체/표 extended
12 예약 extended
13 문단 끝(para break) char
14 예약 extended
15 숨은 설명 extended
16 머리말/꼬리말 extended
17 각주/미주 extended
18 자동번호(각주, 표 등) extended
19-20 예약 inline
21 페이지 컨트롤(감추기, 새 번호로 시작 등) extended
22 책갈피/찾아보기 표식 extended
23 덧말/글자 겹침 extended
24 하이픈 char
25-29 예약 char
30 묶음 빈칸 char
31 고정폭 빈칸 char
표 6 제어 문자
문서 파일에서 문단 내용을 읽다가 제어 문자를 발견하면, 문서를 읽는 쪽에서는 제어 문자 종류에
따라 읽어 들이거나 건너 뛰어 다음 데이터의 시작 위치까지 파일 포인터를 옮기기 위한 적절한 처리를
수행해야 한다. 제어 문자 가운데는 또 다른 문단 리스트를 포함하는 경우도 있기 때문에, 제어 문자를
일반 문자처럼 처리하면 문서 파일을 정상적으로 읽을 수 없다.
표, 각주 등과 같은 문단 리스트를 포함하는 컨트롤 문자들은 독자적인 문단 리스트를 가진다. 해당
리스트들은 아래와 같은 리스트 헤더 정보를 포함한다. 실제 문단들은 그 다음에 serialize된다.
문단 내에서 컨트롤은 세 가지 형식에 따라 다음과 같은 차이가 있다.
§ 문자 컨트롤
부가정보 없이 문자 하나로 표현되는 제어 문자이다. (3번째 ch)
0 1 2 3 4 5 6 7 8 9 10 11
‘A’ ‘B’ ‘C’ ch ‘D’ ‘E’ ‘F’ ‘G’ ‘H’ ‘I’ ‘J’ 13
§ 인라인 컨트롤
부가정보가 12바이트(6 WCHAR) 이내에서 표현될 수 있는 제어 문자이다. info에 부가정보를 다 넣지
못하는 경우는 확장 컨트롤로 대체된다.(3~9까지 8개의 ch)
0 1 2 3 4 5 6 7 8 9 10 11
‘A’ ‘B’ ch info ch ‘C’ 13
§ 확장 컨트롤
제어 문자는 포인터를 가지고 있고, 포인터가 가리키는 곳에 실제 오브젝트가 존재하는 제어 문자이
11
```

---

## Page 33

```
글 문서 파일 형식 5.0
자료형 길이(바이트) 설명
BYTE stream 8 문단 머리의 정보
WCHAR 2 글머리표 문자
INT32 4 이미지 글머리표 여부 (글머리표 :0, 이미지글머리표 : ID)
BYTE stream 4 이미지 글머리 (대비, 밝기 ,효과, ID)
WCHAR 2 체크 글머리표 문자
전체 길이 20
표 42 글머리표
4.2.10. 문단 모양
Tag ID : HWPTAG_PARA_SHAPE
자료형 길이(바이트) 설명
UINT32 4 속성 1(표 44 참조)
INT32 4 왼쪽 여백
INT32 4 오른쪽 여백
INT32 4 들여 쓰기/내어 쓰기
INT32 4 문단 간격 위
INT32 4 문단 간격 아래
INT32 4 줄 간격. 글 2007 이하 버전(5.0.2.5 버전 미만)에서 사용.
UINT16 2 탭 정의 아이디(TabDef ID) 참조 값
번호 문단 ID(Numbering ID) 또는 글머리표 문단 모양
UINT16 2
ID(Bullet ID) 참조 값
UINT16 2 테두리/배경 모양 ID(BorderFill ID) 참조 값
INT16 2 문단 테두리 왼쪽 간격
INT16 2 문단 테두리 오른쪽 간격
INT16 2 문단 테두리 위쪽 간격
INT16 2 문단 테두리 아래쪽 간격
UINT32 4 속성 2(표 40 참조) (5.0.1.7 버전 이상)
UINT32 4 속성 3(표 41 참조) (5.0.2.5 버전 이상)
UINT32 4 줄 간격(5.0.2.5 버전 이상)
전체 길이 54
표 43 문단 모양
범위 구분 값 설명
0 글자에 따라(%)
줄 간격 종류.
bit 0～1 1 고정값
글 2007 이하 버전에서 사용.
2 여백만 지정
0 양쪽 정렬
1 왼쪽 정렬
2 오른쪽 정렬
bit 2～4 정렬 방식
3 가운데 정렬
4 배분 정렬
5 나눔 정렬
0 단어
bit 5～6 줄 나눔 기준 영어 단위 1 하이픈
2 글자
0 어절
bit 7 줄 나눔 기준 한글 단위
1 글자
bit 8 편집 용지의 줄 격자 사용 여부
28
```

---

## Page 35

```
글 문서 파일 형식 5.0
전체 길이 가변 12 + (2×len1) + (2×len2) 바이트
표 47 스타일
범위 구분 값 설명
0 문단 스타일
bit 0～2 스타일 종류
1 글자 스타일
표 48 스타일 종류
4.2.12. 문서 임의의 데이터
라벨 문서인지 여부나 인쇄 대화상자의 정보를 저장한다.
Tag ID : HWPTAG_DOC_DATA
자료형 길이(바이트) 설명
Parameter Set 가변 파라미터 셋(표 50 참조)
전체 길이 가변
표 49 문서 임의의 데이터
30
```

---

## Page 39

```
글 문서 파일 형식 5.0
UINT16 2 range tag 정보 수
UINT16 2 각 줄에 대한 align에 대한 정보 수
UINT32 4 문단 Instance ID (unique ID)
UINT16 2 변경추적 병합 문단여부. (5.0.3.2 버전 이상)
전체 길이 24
표 58 문단 헤더
값 설명
0x01 구역 나누기
0x02 다단 나누기
0x04 쪽 나누기
0x08 단 나누기
표 59 단 나누기 종류
텍스트의 수가 1 이상이면 문자 수만큼 텍스트를 로드하고 그렇지 않을 경우 PARA_BREAK로 문단을
생성한다.
4.3.2. 문단의 텍스트
Tag ID : HWPTAG_PARA_TEXT
자료형 길이(바이트) 설명
WCHAR array[sizeof(nchars)] 2×nchars 문자수만큼의 텍스트
전체 길이 가변 (2×nchars) 바이트
표 60 문단 텍스트
문단은 최소 하나의 문자 Shape buffer가 존재하며, 첫 번째 pos가 반드시 0이어야 한다.
예를 들어 문자길이 40자 짜리 문단이 10자씩 4가지 다른 글자 모양으로 구성되어 있다면 buffer는
다음과 같다.
모양 1 모양 2 모양 3 모양 4
m_Pos=0, m_ID=1 m_Pos=10, m_ID=2 m_Pos=20, m_ID=3 m_Pos=30, m_ID=4
그림 47 문단 버퍼 구조
텍스트 문자 Shape 레코드를 글자 모양 정보 수(Character Shapes)만큼 읽는다.
4.3.3. 문단의 글자 모양
Tag ID : HWPTAG_PARA_CHAR_SHAPE
자료형 길이(바이트) 설명
UINT32 4 글자 모양이 바뀌는 시작 위치
UINT32 4 글자 모양 ID
전체 길이 가변 8×n
표 61 문단의 글자 모양
34
```

---

## Page 41

```
글 문서 파일 형식 5.0
Tag ID : HWPTAG_CTRL_HEADER
자료형 길이(바이트) 설명
컨트롤 ID
UINT32 4
컨트롤 ID 이하 속성들은 CtrlID에 따라 다르다. - 각
컨트롤 및 개체 참고
전체 길이 4
표 64 컨트롤 헤더
4.3.7. 문단 리스트 헤더
Tag ID : HWPTAG_LIST_HEADER
자료형 길이(바이트) 설명
INT16 2 문단 수
속성
범위 구분 값 설명
0 가로
bit 0～2 텍스트 방향
1 세로
0 일반적인 줄바꿈
UINT32 4
bit 3～4 문단의 줄바꿈 1 자간을 조종하여 한 줄을 유지
2 내용에 따라 폭이 늘어남
0 top
bit 5～6 세로 정렬 1 center
2 bottom
전체 길이 6
표 65 문단 리스트 헤더
4.3.8. 컨트롤 임의의 데이터
컨트롤의 필드 이름이나 하이퍼링크 정보를 저장한다.
Tag ID : HWPTAG_CTRL_DATA
자료형 길이(바이트) 설명
Parameter Set 가변 파라미터 셋(표 50 참조)
전체 길이 가변
표 66 컨트롤 임의의 데이터
4.3.9. 개체 공통 속성을 포함하는 컨트롤(개체 컨트롤)
extended type의 컨트롤은 종류를 나타내는 식별 기호로 32 비트 ID가 사용된다. 컨트롤 코드가 큰
범주를 나타내는 식별 기호라고 한다면, 컨트롤 ID는 세부 분류를 나타내는 식별 기호인 셈이다.
예를 들어 단 정의 컨트롤 ID는 MAKE_4CHID('c', 'o', 'l', 'd') 같은 형식으로 정의한다.
MAKE_4CHID(a, b, c, d) (((a) << 24) | ((b) << 16) | ((c) << 8) | (d))
36
```

---

## Page 43

```
글 문서 파일 형식 5.0
0 page
가로 위치의 기준 1 page
bit 8～9
(HorzRelTo) 2 column
3 para
HorzRelTo에 대한
bit 10～12 bit 5～7 참조
상대적인 배열 방식
VertRelTo이 ‘para’일
0 off
때 오브젝트의 세로
bit 13
위치를 본문 영역으로
1 on
제한할지 여부
다른 오브젝트와
오브젝트의 위치가 본문 영역으로 제한되면 언제나
bit 14 겹치는 것을 허용할지
false로 간주한다.
여부
0 paper
1 page
bit 15～17 오브젝트 폭의 기준 2 coloum
3 para
4 absolute
0 paper
bit 18～19 오브젝트 높이의 기준 1 page
2 absolute
VertRelTo이 para일 0 off
bit 20
때 크기 보호 여부 1 on
오브젝트 주위를 텍스트가 어떻게 흘러갈지 지정하는 옵션
Square 0 bound rect를 따라
Tight 1 오브젝트의 outline을 따라
bit 21～23 Through 2 오브젝트 내부의 빈 공간까지
TopAndBottom 3 좌, 우에는 텍스트를 배치하지 않음
BehindText 4 글과 겹치게 하여 글 뒤로
InFrontOfText 5 글과 겹치게 하여 글 앞으로
0 BothSides
오브젝트의 좌/우 어느
1 LeftOnly
bit 24～25 쪽에 글을 배치할지
2 RightOnly
지정하는 옵션
3 LargestOnly
0 none
이 개체가 속하는 1 figure
bit 26～28
번호 범주 2 table
3 equation
표 70 개체 공통 속성의 속성
자료형 길이(바이트) 설명
BYTE stream n 문단 리스트 헤더(표 65 참조)
BYTE stream 12 캡션(표 67 참조)
전체 길이 가변 12+n 바이트
표 71 캡션 리스트
자료형 길이(바이트) 설명
UNIT 4 속성(표 73 참조)
HWPUNIT 4 캡션 폭(세로 방향일 때만 사용)
HWPUNIT16 2 캡션과 틀 사이 간격
HWPUNIT 4 텍스트의 최대 길이(=개체의 폭)
전체 길이 14
표 72 캡션
38
```

---

