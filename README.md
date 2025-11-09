# DeskWeb - Windows XP Style Desktop Application

qooxdoo 프레임워크를 사용하여 구현한 Windows XP 스타일의 웹 데스크톱 애플리케이션입니다.

## 📸 주요 기능

- ✅ Windows XP 파란색 배경 데스크톱
- ✅ 드래그 가능한 데스크톱 아이콘 (내 컴퓨터, 내 문서, 휴지통)
- ✅ 하단 작업표시줄 (시작 버튼 + 창 버튼 + 시스템 트레이)
- ✅ 시작 메뉴 팝업
- ✅ 윈도우 관리 (열기, 최소화, 최대화, 닫기)
- ✅ 시계 클릭 시 달력 표시
- ✅ 활성/비활성 윈도우 구분 (색상 차별화)

## 🚀 시작하기

### 필수 요구사항

- Node.js (v14 이상)
- npm

### 설치 및 실행

1. **qooxdoo 컴파일러 설치**
   ```bash
   npm install -g @qooxdoo/compiler
   ```

2. **프로젝트 컴파일**
   ```bash
   qx compile
   ```

3. **개발 서버 실행**
   ```bash
   qx serve --listen-port=8080
   ```

    ```bash
    qx compile && qx serve --listen-port=8080
    ```

4. **브라우저에서 접속**
   ```
   http://localhost:8080/deskweb/
   ```

### 빌드 (프로덕션)

```bash
qx compile --target=build
```

빌드된 파일은 `compiled/build/` 디렉토리에 생성됩니다.

## 📁 프로젝트 구조

```
DeskWeb/
├── source/
│   ├── class/
│   │   └── deskweb/
│   │       ├── Application.js          # 메인 애플리케이션
│   │       ├── theme/                  # Windows XP 테마
│   │       │   ├── Theme.js           # 메타 테마
│   │       │   ├── Color.js           # 색상 정의
│   │       │   ├── Decoration.js      # 데코레이션 (테두리, 배경)
│   │       │   └── Appearance.js      # 위젯 외형
│   │       └── ui/                    # UI 컴포넌트
│   │           ├── DesktopIcon.js     # 드래그 가능한 아이콘
│   │           ├── Taskbar.js         # 작업표시줄
│   │           ├── StartMenu.js       # 시작 메뉴
│   │           └── MyComputerWindow.js # 내 컴퓨터 창
│   ├── resource/
│   │   └── deskweb/
│   │       └── images/                # 아이콘 이미지
│   │           ├── computer.svg
│   │           ├── folder.svg
│   │           └── recyclebin.svg
│   └── translation/
├── compiled/                          # 컴파일된 파일 (자동 생성)
│   ├── source/                       # 개발 빌드
│   └── build/                        # 프로덕션 빌드
├── compile.json                      # qooxdoo 컴파일러 설정
├── Manifest.json                     # 애플리케이션 메타데이터
├── package.json                      # npm 의존성
└── README.md                         # 프로젝트 문서
```

## 🏗️ 애플리케이션 레이아웃 구조

### 전체 레이아웃 계층

```
Root (qx.application.Standalone)
└── Composite (Dock Layout)
    ├── Desktop (center) - 데스크톱 영역
    │   └── Canvas Layout - 아이콘 자유 배치
    │       ├── DesktopIcon (내 컴퓨터)
    │       ├── DesktopIcon (내 문서)
    │       ├── DesktopIcon (휴지통)
    │       └── Window[] - 열린 창들
    └── Taskbar (south) - 작업표시줄
        └── HBox Layout
            ├── Start Button
            ├── Separator
            ├── Window Buttons Container (flex: 1)
            ├── Spacer (flex: 1)
            └── System Tray
                └── Clock (클릭 시 달력)
```

### 주요 레이아웃 매니저

1. **Dock Layout** (`qx.ui.layout.Dock`)
   - 메인 컨테이너에 사용
   - Desktop을 center에, Taskbar를 south에 배치

2. **Canvas Layout** (Desktop 내장)
   - `qx.ui.window.Desktop`이 자동으로 사용
   - 아이콘과 윈도우를 절대 좌표로 배치
   - 드래그 앤 드롭 지원

3. **HBox Layout** (`qx.ui.layout.HBox`)
   - Taskbar 내부 요소 수평 배치
   - StartMenu 메뉴 아이템 배치

4. **VBox Layout** (`qx.ui.layout.VBox`)
   - 윈도우 내부 컨텐츠 수직 배치
   - StartMenu 팝업 구조

## 🎨 테마 시스템

### 색상 정의 (Color.js)

```javascript
// Windows XP 색상
"desktop-background": "#5A7EDB"        // 데스크톱 배경
"taskbar-background": "#245EDC"        // 작업표시줄
"window-caption-active": "#0054E3"     // 활성 윈도우 캡션
"window-caption-inactive": "#7A96DF"   // 비활성 윈도우 캡션
```

### 데코레이션 (Decoration.js)

- `desktop-background`: 단색 배경
- `taskbar`: 상단 테두리 + 배경색
- `taskbar-button`: 둥근 모서리 버튼
- `window-caption`: 그라디언트 효과

### 외형 정의 (Appearance.js)

- `desktop`: 데스크톱 스타일
- `taskbar`: 작업표시줄 스타일
- `desktop-icon`: 아이콘 호버 효과
- `startmenu`: 시작 메뉴 스타일

## 🧩 주요 컴포넌트

### 1. Application.js

메인 애플리케이션 클래스입니다.

**주요 메서드:**
- `main()`: 애플리케이션 초기화
- `_createDesktopIcons()`: 데스크톱 아이콘 생성
- `_onStartClick()`: 시작 버튼 클릭 처리
- `_openMyComputerWindow()`: 내 컴퓨터 창 열기
- `_onStartMenuItemClick()`: 시작 메뉴 아이템 클릭 처리

**레이아웃 구성:**
```javascript
// Dock 레이아웃으로 메인 컨테이너 생성
var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.Dock());

// Desktop (center), Taskbar (south) 배치
mainContainer.add(this.__desktop, {edge: "center"});
mainContainer.add(this.__taskbar, {edge: "south"});
```

### 2. DesktopIcon.js

드래그 가능한 데스크톱 아이콘 컴포넌트입니다.

**특징:**
- `qx.ui.basic.Atom` 확장
- 드래그 앤 드롭 지원 (`dragstart`, `drag`, `dragend` 이벤트)
- 더블클릭 시 `open` 이벤트 발생
- Canvas 레이아웃에서 절대 좌표로 배치

**드래그 구현:**
```javascript
_onDrag: function(e) {
  var mouseX = e.getDocumentLeft();
  var mouseY = e.getDocumentTop();
  var newLeft = mouseX - this.__dragOffsetX;
  var newTop = mouseY - this.__dragOffsetY;

  this.setLayoutProperties({
    left: newLeft,
    top: newTop
  });
}
```

### 3. Taskbar.js

Windows XP 스타일 작업표시줄입니다.

**구성 요소:**
- Start 버튼
- 윈도우 버튼 컨테이너 (열린 창마다 버튼 생성)
- 시스템 트레이 (시계)

**주요 메서드:**
- `attachWindow(window)`: 창을 작업표시줄에 추가
- `detachWindow(window)`: 창을 작업표시줄에서 제거
- `_updateClock()`: 시계 업데이트
- `_onClockClick()`: 시계 클릭 시 달력 표시

**윈도우 버튼 바인딩:**
```javascript
// 윈도우 속성을 버튼에 바인딩
window.bind("caption", button, "label");
window.bind("icon", button, "icon");

// 윈도우 상태 동기화
window.addListener("changeActive", function(e) {
  button.setValue(e.getData());
});
```

### 4. StartMenu.js

시작 버튼 클릭 시 표시되는 팝업 메뉴입니다.

**구조:**
- Sidebar (왼쪽 파란 영역)
- 메뉴 아이템 컨테이너 (VBox 레이아웃)

**메뉴 아이템:**
- My Computer
- My Documents
- Control Panel
- Run...

**이벤트:**
- `itemClick`: 메뉴 아이템 클릭 시 발생 (itemId 전달)

### 5. MyComputerWindow.js

내 컴퓨터 창 컴포넌트입니다.

**구조:**
- Toolbar (뒤로, 앞으로, 위로 버튼)
- Address Bar
- Content Area (시스템 태스크, 드라이브 정보)
- Status Bar

**레이아웃:**
```javascript
// VBox 레이아웃으로 수직 배치
this.setLayout(new qx.ui.layout.VBox());
this.add(toolbar);
this.add(addressBar);
this.add(contentArea, {flex: 1});
this.add(statusBar);
```

## 🔧 설정 파일

### compile.json

qooxdoo 컴파일러 설정 파일입니다.

```json
{
  "targets": [
    {
      "type": "source",
      "outputPath": "compiled/source"
    },
    {
      "type": "build",
      "outputPath": "compiled/build"
    }
  ],
  "applications": [
    {
      "class": "deskweb.Application",
      "theme": "deskweb.theme.Theme",
      "name": "deskweb"
    }
  ]
}
```

### Manifest.json

애플리케이션 메타데이터입니다.

```json
{
  "provides": {
    "namespace": "deskweb",
    "class": "source/class",
    "resource": "source/resource"
  },
  "requires": {
    "@qooxdoo/framework": "^6.0.4"
  }
}
```

## 🎯 사용 방법

### 데스크톱 아이콘 사용

1. **아이콘 이동**: 아이콘을 클릭하고 드래그하여 원하는 위치로 이동
2. **프로그램 실행**: 아이콘을 더블클릭하여 창 열기

### 윈도우 관리

1. **창 열기**: 아이콘 더블클릭 또는 시작 메뉴에서 선택
2. **창 이동**: 캡션 바를 드래그
3. **창 크기 조절**: 테두리를 드래그
4. **최소화**: 작업표시줄로 최소화
5. **복원**: 작업표시줄 버튼 클릭
6. **닫기**: X 버튼 클릭

### 시작 메뉴

1. **열기**: 시작 버튼 클릭
2. **프로그램 실행**: 메뉴 아이템 클릭
3. **닫기**: 메뉴 외부 클릭 또는 ESC

### 시계 및 달력

1. **시간 확인**: 작업표시줄 오른쪽 시계 확인
2. **달력 보기**: 시계 클릭
3. **날짜 선택**: 달력에서 날짜 클릭

## 🛠️ 개발 가이드

### 새로운 데스크톱 아이콘 추가

```javascript
// Application.js의 _createDesktopIcons 메서드에서
var newIcon = new deskweb.ui.DesktopIcon("아이콘 이름", "이미지 경로");
newIcon.setLayoutProperties({left: 20, top: 320});
newIcon.addListener("open", function() {
  this._openWindow("창 제목", "내용");
}, this);
this.__desktop.add(newIcon);
```

### 새로운 윈도우 만들기

```javascript
var win = new qx.ui.window.Window("창 제목");
win.setLayout(new qx.ui.layout.VBox(10));
win.set({
  width: 400,
  height: 300,
  showMinimize: true,
  showMaximize: true,
  showClose: true
});

// 컨텐츠 추가
var content = new qx.ui.basic.Label("내용");
win.add(content);

// 데스크톱에 추가
this.__desktop.add(win);
this.__taskbar.attachWindow(win);
win.center();
win.open();
```

### 테마 색상 변경

`source/class/deskweb/theme/Color.js`에서 색상 값 수정:

```javascript
colors: {
  "desktop-background": "#새로운색상",
  "taskbar-background": "#새로운색상",
  // ...
}
```

### 시작 메뉴 아이템 추가

`source/class/deskweb/ui/StartMenu.js`의 생성자에서:

```javascript
this._addMenuItem("새 메뉴", "아이콘", "menu-id");
```

`Application.js`의 `_onStartMenuItemClick`에서 처리:

```javascript
switch(itemId) {
  case "menu-id":
    // 처리 로직
    break;
}
```

## 📚 참고 자료

- [qooxdoo 공식 문서](https://qooxdoo.org/documentation/)
- [qooxdoo Desktop Guide](https://qooxdoo.org/documentation/v7.9/#/desktop/)
- [qooxdoo API Reference](https://qooxdoo.org/documentation/v7.9/#/api/)

## 🐛 문제 해결

### 컴파일 오류

```bash
# 캐시 삭제 후 재컴파일
qx clean
qx compile
```

### 하얀 화면만 보임

- 올바른 URL 확인: `http://localhost:8080/deskweb/`
- 브라우저 콘솔(F12)에서 JavaScript 오류 확인
- 강력 새로고침 (Ctrl+Shift+R)

### 변경사항이 반영되지 않음

```bash
# 재컴파일 필요
qx compile
```

개발 서버(`qx serve`)는 파일 변경을 자동 감지하지만, 때로는 수동 컴파일이 필요합니다.

## 📝 라이선스

MIT License

## 👥 기여자

- DeskWeb Team

---

**Powered by qooxdoo Framework** 🚀