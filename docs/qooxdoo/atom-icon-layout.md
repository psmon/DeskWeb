# qooxdoo Atom 위젯 - 아이콘 레이아웃 주의사항

## 개요

`qx.ui.basic.Atom`은 아이콘 + 라벨을 조합하는 위젯이다.
`iconPosition: "top"` 설정 시 아이콘이 위, 라벨이 아래에 배치된다.
아이콘 영역은 내부적으로 `qx.ui.basic.Image` 자식 위젯으로 관리된다.

---

## 핵심 원칙: DOM 직접 조작 금지

qooxdoo는 자체 가상 DOM + 레이아웃 시스템을 사용한다.
**DOM을 직접 조작하면 qooxdoo의 레이아웃과 충돌**하여 예상치 못한 결과가 발생한다.

### 잘못된 방법들 (실패 사례)

```javascript
// ❌ DOM으로 기존 아이콘 숨기고 새 이미지 삽입
var el = this.getContentElement().getDomElement();
var imgEls = el.querySelectorAll("img");
imgEls[i].style.display = "none";  // qooxdoo가 다시 렌더링하면 무효화됨
el.insertBefore(faviconDiv, el.firstChild);  // 레이아웃에 참여하지 않아 라벨과 겹침

// ❌ absolute positioning으로 아이콘 덮기
container.style.position = "absolute";
container.style.top = "5px";
// → qooxdoo 레이아웃 흐름 밖이라 라벨 위치에 영향 없음

// ❌ 1x1 투명 gif 플레이스홀더
this.setIcon("data:image/gif;base64,R0lGODlh...");
// → qooxdoo Image 위젯의 크기 계산이 1x1 기준이 되어 공간 확보 안됨
```

### 올바른 방법

```javascript
// ✅ qooxdoo API로 아이콘 소스 교체
this.setIcon(externalUrl);  // 외부 URL도 지원됨

// ✅ 아이콘 크기 조정은 자식 위젯 API로
var iconWidget = this.getChildControl("icon", true);
if (iconWidget) {
  iconWidget.set({
    width: 48,
    height: 48,
    scale: true
  });
}
```

---

## 외부 이미지 URL 사용

qooxdoo의 `qx.ui.basic.Image` (Atom의 내부 아이콘 위젯)는 외부 URL을 지원한다.

```javascript
// 리소스 매니저 경로 (내부)
this.setIcon("deskweb/images/askbot.svg");

// 외부 URL (http/https) - 직접 사용 가능
this.setIcon("https://www.google.com/s2/favicons?domain=example.com&sz=64");
```

- `http://` 또는 `https://`로 시작하는 URL은 리소스 매니저를 거치지 않고 직접 사용됨
- 크기 지정이 필요하면 `getChildControl("icon")` 위젯에서 `width`, `height`, `scale` 설정

---

## 아이콘 교체 시 겹침 방지

### 문제 상황

```javascript
// 생성 시 기본 아이콘 설정
var icon = new DesktopIcon("App", "deskweb/images/askbot.svg", "id");
// 이후 비동기로 favicon 설정
icon.setFaviconFromUrl("https://example.com");  // async → setIcon(faviconUrl)
```

기본 아이콘이 먼저 렌더링되고, favicon이 비동기로 로드되어 `setIcon()`으로 교체할 때
**투명 배경 favicon의 경우 기존 아이콘이 비쳐보이는 현상** 발생 가능.

### 해결법

```javascript
// favicon 모드일 때는 처음부터 아이콘 없이 생성
var isFavicon = !appDef.iconType || appDef.iconType === "favicon";
var iconImage = isFavicon ? null : appDef.icon;
var icon = new DesktopIcon("App", iconImage, "id");

// favicon이 로드되면 유일한 아이콘으로 설정됨 (겹침 없음)
icon.setFaviconFromUrl(url);
```

---

## CORS와 외부 이미지

### `<img>` 태그의 crossOrigin 속성

```javascript
// ❌ crossOrigin 설정 시 CORS 헤더 요구 → 대부분의 외부 이미지 차단됨
var img = new Image();
img.crossOrigin = "anonymous";  // 브라우저가 CORS 정책 강제
img.src = "https://external.com/favicon.ico";  // CORS 헤더 없으면 ERR_FAILED

// ✅ 단순 표시 목적이면 crossOrigin 설정하지 않기
var img = new Image();
img.src = "https://external.com/favicon.ico";  // CORS 없이도 표시 가능
```

- `crossOrigin = "anonymous"` → 캔버스 픽셀 읽기 등 **데이터 접근** 시에만 필요
- 이미지 **단순 표시** → crossOrigin 불필요, 설정하면 오히려 차단됨

---

## Favicon 획득 전략

많은 웹사이트가 `/favicon.ico`를 제공하지 않고 HTML `<link>` 태그로 파비콘을 지정한다.
직접 HTML을 파싱하려면 CORS 문제가 있으므로 외부 서비스를 활용한다.

### 3단계 폴백 전략

| 우선순위 | 방법 | URL 패턴 | 특징 |
|---------|------|---------|------|
| 1 | Google Favicon Service | `google.com/s2/favicons?domain=DOMAIN&sz=64` | 가장 신뢰도 높음, HTML link 태그 파싱 |
| 2 | DuckDuckGo Favicon | `icons.duckduckgo.com/ip3/DOMAIN.ico` | Google 실패 시 백업 |
| 3 | Direct favicon.ico | `DOMAIN/favicon.ico` | 전통 방식, 404 가능성 높음 |

```javascript
var candidates = [
  "https://www.google.com/s2/favicons?domain=" + domain + "&sz=64",
  "https://icons.duckduckgo.com/ip3/" + domain + ".ico",
  origin + "/favicon.ico"
];

// 순차적으로 시도, onload 성공 시 적용, onerror 시 다음 후보
function tryNext(index) {
  if (index >= candidates.length) return;
  var img = new Image();
  img.onload = function() { applyIcon(candidates[index]); };
  img.onerror = function() { tryNext(index + 1); };
  img.src = candidates[index];
}
```

---

## qooxdoo 위젯 상태(State) 활용

Atom 위젯의 시각적 상태(hover, selected 등)는 qooxdoo의 상태 시스템으로 관리한다.

```javascript
// 상태 추가/제거
this.addState("selected");
this.removeState("selected");
this.hasState("selected");

// Appearance에서 상태 분기
"desktop-icon": {
  style: function(states) {
    return {
      decorator: states.selected ? "desktop-icon-selected"
               : states.hovered ? "desktop-icon-hover"
               : "desktop-icon"
    };
  }
}

// Decoration 정의
"desktop-icon-selected": {
  style: {
    backgroundColor: "rgba(100, 150, 220, 0.35)",
    width: 1,
    color: "rgba(100, 150, 220, 0.7)",
    style: "solid",
    radius: 3
  }
}
```

- `addState()` / `removeState()` → Appearance 자동 재적용
- CSS 클래스 직접 조작 불필요
