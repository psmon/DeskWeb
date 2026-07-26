/**
 * MIDI Player - 미디 연주악단 (빈티지 주크박스 스킨)
 *
 * 무대(악단 뷰)가 메인 연출이며 스킨과 독립적으로 유지된다.
 * 재생 컨트롤은 카툰풍 빈티지 주크박스(jukebox.svg)로 스킨을 입혔다.
 * 곡 소스는 (1) 번들 MIDI, (2) 로컬 폴더/파일 등록, (3) BitMidi 온라인을 지원한다.
 * BitMidi 온라인은 다운로드 없이 CORS 스트리밍으로 재생하며,
 *   - 간편재생: 내장 카탈로그(deskweb/midi/bitmidi.json, 사전 카테고라이징)를 장르별 브라우즈
 *   - 실시간 검색: bitmidi.com 검색 API로 전체 라이브러리를 즉시 검색해 재생
 *
 * 악보보기(스코어 플레이어): 우측 패널에 html-midi-player의 <midi-visualizer>
 * (스태프 악보/피아노롤)를 붙여, 재생 위치(초)에 맞춰 현재 음을 강조하고 악보를
 * 자동 스크롤한다. 두 엔진(일반/Real) 공용으로 rAF 루프가 시퀀서/플레이어의
 * currentTime을 읽어 noteSequence의 활성 음표를 redraw(scrollIntoView)한다.
 *
 * MIDI 파일 재생 시 곡에 등장하는 악기(GM 프로그램)에 매칭되는 연주자 스프라이트가
 * 무대에 등장해 실제 노트에 맞춰 연주 애니메이션을 한다.
 * 스프라이트가 없는 악기는 유사 악기 연주자로 매핑한다.
 * 노트 이벤트 기반 스펙트럼 이펙트를 무대 뒤에 표현한다.
 *
 * 재생 엔진: html-midi-player (magenta SoundFont 신디사이저, CDN 동적 로드)
 * 엔진 UI는 숨기고 주크박스 컨트롤로 start()/stop()을 직접 구동한다.
 * 연주자 스프라이트: 192x192 4프레임 시트 (idle/play), agent-band 리소스 유래
 *
 * @ignore(Image)
 * @ignore(fetch)
 * @ignore(URL.*)
 * @ignore(requestAnimationFrame)
 * @ignore(cancelAnimationFrame)
 * @ignore(performance.now)
 * @ignore(AudioContext)
 * @ignore(webkitAudioContext)
 * @ignore(Event)
 * @asset(deskweb/midi/*)
 * @asset(deskweb/band/*)
 * @asset(deskweb/images/jukebox.svg)
 */
qx.Class.define("deskweb.ui.MidiPlayerWindow", {
  extend: qx.ui.window.Window,

  statics: {
    __libPromise: null,
    __spessaPromise: null,
    __cssInjected: false,

    LIB_URL: "https://cdn.jsdelivr.net/combine/npm/tone@14.7.58,npm/@magenta/music@1.23.1/es6/core.js,npm/focus-visible@5,npm/html-midi-player@1.5.0",
    SOUND_FONT: "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",

    /**
     * Real 악기 재생 엔진 = SpessaSynth (AudioWorklet SF2/SF3 신디사이저, Apache-2.0)
     * 압축 사운드폰트(SF3) GeneralUserGS(8MB, 관대한 라이선스)로 실제 악기 렌더링.
     * ESM/worklet은 jsdelivr, 사운드폰트는 jsdelivr-gh(+ GH Pages 폴백) 전부 CORS 개방.
     */
    SPESSA_ESM: "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.11/+esm",
    SPESSA_WORKLET: "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.11/dist/spessasynth_processor.min.js",
    SPESSA_SOUNDFONT: "https://cdn.jsdelivr.net/gh/spessasus/SpessaSynth@master/soundfonts/GeneralUserGS.sf3",
    SPESSA_SOUNDFONT_FALLBACK: "https://spessasus.github.io/SpessaSynth/soundfonts/GeneralUserGS.sf3",

    /** SpessaSynth ESM 모듈 동적 로드 (전역 1회, dynamic import) */
    loadSpessaModule: function() {
      var clazz = deskweb.ui.MidiPlayerWindow;
      if (clazz.__spessaPromise) {
        return clazz.__spessaPromise;
      }
      clazz.__spessaPromise = new Promise(function(resolve, reject) {
        // 주의: 아래 window 전역은 인라인 스크립트 문자열과 이름이 반드시 일치해야 한다.
        // qooxdoo build 타깃은 '__' 접두사 식별자를 맹글링하므로 '__'를 쓰면 안 됨
        // (문자열 안의 이름은 맹글링되지 않아 read/write 이름이 어긋난다).
        if (window.deskwebSpessaLib) {
          resolve(window.deskwebSpessaLib);
          return;
        }
        var evOk = "deskweb-spessa-ready";
        var evErr = "deskweb-spessa-error";
        window.addEventListener(evOk, function h() {
          window.removeEventListener(evOk, h);
          resolve(window.deskwebSpessaLib);
        });
        window.addEventListener(evErr, function h() {
          window.removeEventListener(evErr, h);
          clazz.__spessaPromise = null;
          reject(window.deskwebSpessaErr || new Error("SpessaSynth 로드 실패"));
        });
        // dynamic import()는 qooxdoo 트랜스파일을 피하려고 인라인 스크립트로 실행
        var s = document.createElement("script");
        s.textContent =
          'import(' + JSON.stringify(clazz.SPESSA_ESM) + ')' +
          '.then(function(m){window.deskwebSpessaLib=m;' +
          'window.dispatchEvent(new Event("' + evOk + '"));})' +
          '.catch(function(e){window.deskwebSpessaErr=e;' +
          'window.dispatchEvent(new Event("' + evErr + '"));});';
        document.head.appendChild(s);
      });
      return clazz.__spessaPromise;
    },

    /** BitMidi 온라인 소스 (다운로드 없이 CORS 스트리밍 재생, audio/midi) */
    BITMIDI_SEARCH_API: "https://bitmidi.com/api/midi/search",
    BITMIDI_BASE: "https://bitmidi.com",
    /** 내장 BitMidi 간편재생 카탈로그 (사전 카테고라이징) */
    BITMIDI_CATALOG: "deskweb/midi/bitmidi.json",
    /** 악보보기: 한 페이지(행)에 담는 시간 길이(초). 대곡 프리즈 방지를 위한 윈도우 크기 */
    SCORE_PAGE_SEC: 8,

    /** BitMidi 모드 장르(간편재생 카테고리) */
    BITMIDI_GENRES: ["전체", "인기", "게임", "영화", "애니", "팝록", "클래식", "재즈", "캐럴"],
    /** 내 라이브러리 모드 장르 */
    LOCAL_GENRES: ["전체", "게임", "클래식", "바로크", "전통음악", "캐럴"],

    /** 스프라이트 시트 공통 스펙 */
    FRAME_SIZE: 192,
    FRAME_COUNT: 4,
    FRAME_STRIDE: 200,
    FRAME_OFFSET: 8,

    loadLib: function() {
      var clazz = deskweb.ui.MidiPlayerWindow;
      if (clazz.__libPromise) {
        return clazz.__libPromise;
      }
      clazz.__libPromise = new Promise(function(resolve, reject) {
        if (window.customElements && window.customElements.get("midi-player")) {
          resolve();
          return;
        }
        var script = document.createElement("script");
        script.src = clazz.LIB_URL;
        script.onload = function() {
          console.log("[MidiPlayer] html-midi-player loaded");
          resolve();
        };
        script.onerror = function() {
          clazz.__libPromise = null;
          reject(new Error("플레이어 라이브러리 로드 실패"));
        };
        document.head.appendChild(script);
      });
      return clazz.__libPromise;
    },

    /** 주크박스 스킨 CSS 주입 (1회) */
    injectCss: function() {
      var clazz = deskweb.ui.MidiPlayerWindow;
      if (clazz.__cssInjected) {
        return;
      }
      clazz.__cssInjected = true;
      var css = [
        ".mp-jukebox{position:absolute;inset:0;overflow:hidden;font-family:Tahoma,sans-serif;}",
        ".mp-jukebox .mp-bg{position:absolute;inset:0;width:100%;height:100%;display:block;}",
        ".mp-engine{position:absolute;left:-9999px;top:0;width:400px;height:80px;visibility:hidden;}",
        /* display (over glass region x300-700 y36-140 => 30%/13.8%/40%/40%) */
        ".mp-display{position:absolute;left:31%;top:18%;width:38%;height:33%;",
        "display:flex;align-items:center;gap:10px;padding:0 6px;box-sizing:border-box;}",
        ".mp-vinyl{width:44px;height:44px;flex:0 0 44px;border-radius:50%;",
        "background:radial-gradient(circle at 50% 50%,#333 0 30%,#111 31% 46%,#2a2a2a 47% 100%);",
        "box-shadow:0 0 6px rgba(255,190,69,.5);position:relative;}",
        ".mp-vinyl::after{content:'';position:absolute;left:50%;top:50%;width:8px;height:8px;",
        "margin:-4px 0 0 -4px;border-radius:50%;background:#ffbe45;}",
        ".mp-vinyl.spin{animation:mpspin 2.2s linear infinite;}",
        "@keyframes mpspin{to{transform:rotate(360deg);}}",
        ".mp-info{flex:1;min-width:0;color:#ffcf6a;text-shadow:0 0 6px rgba(255,160,40,.7);}",
        ".mp-title-wrap{overflow:hidden;white-space:nowrap;}",
        ".mp-title{display:inline-block;font-size:15px;font-weight:bold;letter-spacing:.5px;}",
        ".mp-title.scroll{animation:mpmarq 11s linear infinite;}",
        "@keyframes mpmarq{0%,10%{transform:translateX(0);}90%,100%{transform:translateX(-60%);}}",
        ".mp-genre{font-size:10px;color:#c98a3a;margin-top:1px;}",
        ".mp-eq{display:flex;gap:3px;align-items:flex-end;height:16px;margin-top:3px;}",
        ".mp-eq span{width:5px;height:3px;background:#ffbe45;border-radius:1px;box-shadow:0 0 4px #ffa028;}",
        /* controls (over strip region) */
        ".mp-controls{position:absolute;left:0;right:0;top:63%;height:26%;",
        "display:flex;justify-content:center;align-items:center;gap:14px;}",
        ".mp-btn{width:42px;height:42px;border-radius:50%;border:2px solid #5c666f;cursor:pointer;",
        "background:radial-gradient(circle at 50% 30%,#fff,#c3ccd4 55%,#8b959e);",
        "color:#2a2f34;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;",
        "box-shadow:0 2px 4px rgba(0,0,0,.35),inset 0 1px 2px rgba(255,255,255,.7);transition:transform .06s;}",
        ".mp-btn:active{transform:translateY(1px);}",
        ".mp-btn.mp-play{width:52px;height:52px;font-size:22px;",
        "background:radial-gradient(circle at 50% 30%,#ffe6a0,#ffbe45 55%,#d98a1e);color:#5b3608;}",
        ".mp-btn.mp-on{background:radial-gradient(circle at 50% 30%,#bfe9c0,#4ad06a 60%,#2a9a48);color:#0c3a1a;}",
        /* 악보 2행 스택 (상단=현재/하단=다음, 가로 스크롤 + 페이지 세로 전환) */
        ".mp-score-wrap{display:flex;flex-direction:column;width:100%;height:100%;gap:4px;}",
        ".mp-score-row{flex:1 1 50%;min-height:0;overflow:auto;position:relative;",
        "background:#ffffff;border:1px solid #e6e2d0;border-radius:4px;}",
        ".mp-score-row.mp-score-active{background:#fffdf3;border-color:#ffce6b;",
        "box-shadow:inset 0 0 0 2px rgba(255,190,69,.55);}",
        ".mp-score-row svg{max-width:none;height:auto;}",
        ".mp-score-row .active{fill:#e8451e;}"
      ].join("");
      var style = document.createElement("style");
      style.type = "text/css";
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    }
  },

  construct: function() {
    this.base(arguments, "MIDI Player", "deskweb/images/midiplayer.svg");

    this.set({
      width: 940,
      height: 660,
      showMinimize: true,
      showMaximize: true,
      allowMaximize: true,
      contentPadding: 0
    });
    this.setLayout(new qx.ui.layout.VBox());

    this.__performers = {};
    this.__performerOrder = [];
    this.__spectrum = new Array(64).fill(0);
    this.__spriteCache = {};
    this.__songs = [];
    this.__currentSong = null;
    this.__playing = false;
    this.__shuffle = false;
    this.__sourceMode = "local";        // "local" | "bitmidi"
    this.__bitmidiCatalog = null;       // 내장 카탈로그 (지연 로드)
    this.__searchResults = null;        // BitMidi 실시간 검색 결과 (있으면 목록 대체)
    this.__searchSeq = 0;               // 검색 디바운스/경합 방지 토큰
    this.__engineMode = "simple";       // "simple"(일반 MIDI) | "real"(Real 악기 HQ)
    this.__chProg = new Array(16);      // Real 모드: 채널→프로그램/드럼 추적 (비주얼라이저)
    this.__scoreOn = false;             // 악보보기 표시 여부
    this.__scoreVisType = "staff";      // 악보 표현 방식

    this._createUI();
    this._loadSongList();

    this.addListener("close", this._shutdown, this);
  },

  destruct: function() {
    this._shutdown();
    if (this.__folderInput && this.__folderInput.parentNode) {
      this.__folderInput.parentNode.removeChild(this.__folderInput);
    }
  },

  members: {
    __songs: null,
    __songList: null,
    __searchField: null,
    __genreBox: null,
    __sourceBox: null,
    __statusLabel: null,
    __sourceMode: null,
    __bitmidiCatalog: null,
    __searchResults: null,
    __searchSeq: null,
    __searchTimer: null,
    __suppressRefresh: null,
    // Real 악기 엔진 (SpessaSynth)
    __engineMode: null,
    __engineBox: null,
    __spReady: null,          // 초기화 Promise (지연 1회)
    __spCtx: null,            // AudioContext
    __spSynth: null,          // WorkletSynthesizer
    __spSeq: null,            // Sequencer
    __chProg: null,           // 채널별 프로그램/드럼
    // 악보보기 (스코어 플레이어)
    __scoreOn: null,
    __scoreBtn: null,
    __scorePanel: null,
    __scoreHtml: null,
    __scoreWrap: null,        // 2행 스택 컨테이너
    __scoreTop: null,         // 현재 페이지 <midi-visualizer>
    __scoreBot: null,         // 다음 페이지 <midi-visualizer> (선행 준비)
    __scoreFullNs: null,      // 전체 파싱 NoteSequence (렌더 안 함)
    __topNotes: null,         // 상단 행 페이지 노트
    __botNotes: null,         // 하단 행 페이지 노트
    __topPage: null,          // 상단 행 페이지 인덱스
    __scoreTypeBox: null,
    __scoreVisType: null,     // "staff" | "piano-roll"
    __scoreNotes: null,       // 현재 페이지 startTime 정렬 노트(커서용)
    __scoreCursor: null,      // 현재 강조 노트 인덱스
    __scoreRaf: null,         // 커서 rAF
    __currentUri: null,       // 현재 곡 재생/악보 공용 URI (objURL 1개)
    __scoreForceRedraw: null,
    __scoreLoadSeq: null,     // 악보 로드 경합 방지 토큰
    __stageHtml: null,
    __playerHost: null,
    __playerEl: null,
    __canvas: null,
    __ctx: null,
    __rafId: null,
    __performers: null,
    __performerOrder: null,
    __spectrum: null,
    __spriteCache: null,
    __currentSong: null,
    __playing: null,
    __shuffle: null,
    // 주크박스 스킨 DOM 참조
    __titleEl: null,
    __genreEl: null,
    __playBtn: null,
    __shuffleBtn: null,
    __vinylEl: null,
    __eqBars: null,
    __eqTimer: null,
    __engineReady: null,
    __pendingSong: null,
    // 로컬 로드
    __folderInput: null,
    __fileInput: null,
    __localGenreAdded: null,
    __objUrl: null,

    // ─────────────────────────────────── UI

    _createUI: function() {
      var root = new qx.ui.container.Composite(new qx.ui.layout.HBox());

      // ── 좌측: 곡 목록 패널 (선곡 패널)
      var left = new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
      left.set({width: 270, padding: 8, backgroundColor: "#ECE9D8"});

      // 소스 선택: 내 라이브러리(번들+로컬) / BitMidi 온라인
      this.__sourceBox = new qx.ui.form.SelectBox();
      var srcLib = new qx.ui.form.ListItem("📀 내 라이브러리");
      srcLib.setModel("local");
      var srcNet = new qx.ui.form.ListItem("🌐 BitMidi 온라인");
      srcNet.setModel("bitmidi");
      this.__sourceBox.add(srcLib);
      this.__sourceBox.add(srcNet);
      this.__sourceBox.addListener("changeSelection", this._onSourceChange, this);
      left.add(this.__sourceBox);

      // 재생 엔진: 일반 MIDI(기본) / Real 악기(HQ, SpessaSynth 사운드폰트)
      this.__engineBox = new qx.ui.form.SelectBox();
      var engSimple = new qx.ui.form.ListItem("🎹 일반 MIDI 재생");
      engSimple.setModel("simple");
      var engReal = new qx.ui.form.ListItem("🎻 Real 악기 재생 (HQ)");
      engReal.setModel("real");
      this.__engineBox.add(engSimple);
      this.__engineBox.add(engReal);
      this.__engineBox.setToolTipText("Real 악기: 8MB 고음질 사운드폰트로 실제 악기 음색 렌더링 (첫 재생 시 로딩)");
      this.__engineBox.addListener("changeSelection", this._onEngineChange, this);
      left.add(this.__engineBox);

      this.__searchField = new qx.ui.form.TextField();
      this.__searchField.setPlaceholder("곡 검색...");
      this.__searchField.addListener("input", this._onSearchInput, this);
      left.add(this.__searchField);

      this.__genreBox = new qx.ui.form.SelectBox();
      this._setGenres(deskweb.ui.MidiPlayerWindow.LOCAL_GENRES);
      this.__genreBox.addListener("changeSelection", this._onGenreChange, this);
      left.add(this.__genreBox);

      this.__songList = new qx.ui.form.List();
      this.__songList.set({selectionMode: "single"});
      this.__songList.addListener("dblclick", function() {
        var sel = this.__songList.getSelection()[0];
        if (sel) {
          this._playSong(sel.getModel());
        }
      }, this);
      left.add(this.__songList, {flex: 1});

      var playButton = new qx.ui.form.Button("▶ 연주 시작");
      playButton.addListener("execute", function() {
        var sel = this.__songList.getSelection()[0];
        if (sel) {
          this._playSong(sel.getModel());
        }
      }, this);
      left.add(playButton);

      // 로컬 폴더/파일 로드
      var loadRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
      var folderBtn = new qx.ui.form.Button("📁 폴더 열기");
      folderBtn.setToolTipText("폴더를 선택하면 그 안의 MIDI 파일이 목록에 등록됩니다");
      folderBtn.addListener("execute", this._pickFolder, this);
      var fileBtn = new qx.ui.form.Button("🎵 파일 추가");
      fileBtn.setToolTipText("개별 MIDI(.mid/.midi) 파일을 추가합니다");
      fileBtn.addListener("execute", this._pickFiles, this);
      loadRow.add(folderBtn, {flex: 1});
      loadRow.add(fileBtn, {flex: 1});
      left.add(loadRow);

      // 악보보기 토글 (연주에 맞춰 악보가 흐르는 학습용 스코어 패널)
      this.__scoreBtn = new qx.ui.form.ToggleButton("🎼 악보보기");
      this.__scoreBtn.setToolTipText("연주에 맞춰 악보가 지나가는 학습용 스코어 패널을 우측에 표시합니다");
      this.__scoreBtn.addListener("changeValue", this._onScoreToggle, this);
      left.add(this.__scoreBtn);

      this.__statusLabel = new qx.ui.basic.Label("곡을 선택하세요 (더블클릭 = 연주)");
      this.__statusLabel.set({rich: true, wrap: true, textColor: "#555555", font: qx.bom.Font.fromString("11px Tahoma")});
      left.add(this.__statusLabel);

      root.add(left);

      // ── 우측: 무대(메인) + 주크박스 스킨
      var right = new qx.ui.container.Composite(new qx.ui.layout.VBox());

      this.__stageHtml = new qx.ui.embed.Html();
      this.__stageHtml.set({backgroundColor: "#0A0A14", overflowX: "hidden", overflowY: "hidden"});
      this.__stageHtml.addListenerOnce("appear", this._initStage, this);
      right.add(this.__stageHtml, {flex: 1});

      this.__playerHost = new qx.ui.embed.Html();
      this.__playerHost.set({height: 210, backgroundColor: "#1A1A2A"});
      this.__playerHost.addListenerOnce("appear", this._buildJukebox, this);
      right.add(this.__playerHost);

      root.add(right, {flex: 1});

      // ── 우측: 악보 패널 (악보보기 토글 시 표시)
      this.__scorePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(4));
      this.__scorePanel.set({width: 340, padding: 6, backgroundColor: "#FBFBF3"});
      this.__scorePanel.exclude(); // 기본 숨김

      var scoreHead = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
      var scoreTitle = new qx.ui.basic.Label("🎼 악보 (연주 따라가기)");
      scoreTitle.set({
        font: qx.bom.Font.fromString("bold 12px Tahoma"),
        textColor: "#333333", alignY: "middle"
      });
      this.__scoreTypeBox = new qx.ui.form.SelectBox();
      this.__scoreTypeBox.set({width: 110});
      var stStaff = new qx.ui.form.ListItem("스태프 악보");
      stStaff.setModel("staff");
      var stRoll = new qx.ui.form.ListItem("피아노롤");
      stRoll.setModel("piano-roll");
      this.__scoreTypeBox.add(stStaff);
      this.__scoreTypeBox.add(stRoll);
      this.__scoreTypeBox.addListener("changeSelection", this._onScoreTypeChange, this);
      scoreHead.add(scoreTitle, {flex: 1});
      scoreHead.add(this.__scoreTypeBox);
      this.__scorePanel.add(scoreHead);

      this.__scoreHtml = new qx.ui.embed.Html();
      this.__scoreHtml.set({backgroundColor: "#FFFFFF", overflowX: "auto", overflowY: "auto"});
      this.__scorePanel.add(this.__scoreHtml, {flex: 1});

      var scoreHint = new qx.ui.basic.Label(
        "곡을 재생하면 현재 음이 강조되며 악보가 스크롤됩니다.");
      scoreHint.set({rich: true, wrap: true, textColor: "#888888",
        font: qx.bom.Font.fromString("10px Tahoma")});
      this.__scorePanel.add(scoreHint);

      root.add(this.__scorePanel);

      this.add(root, {flex: 1});

      // 좁은 화면(모바일)에서는 선곡 패널을 축소
      this.addListener("resize", function() {
        var b = this.getBounds();
        if (b) {
          left.setWidth(b.width < 600 ? 150 : 270);
        }
      }, this);
    },

    // ─────────────────────────────────── 곡 목록

    _loadSongList: function() {
      var self = this;
      var uri = qx.util.ResourceManager.getInstance().toUri("deskweb/midi/songs.json");
      fetch(uri).then(function(r) {
        return r.json();
      }).then(function(songs) {
        self.__songs = songs;
        self._refreshSongList();
        self.__statusLabel.setValue(songs.length + "곡 준비됨. 곡을 더블클릭하면 악단이 연주합니다.");
      }).catch(function(e) {
        console.error("[MidiPlayer] song list load failed:", e);
        self.__statusLabel.setValue("곡 목록 로드 실패");
      });
    },

    _selectedGenre: function() {
      var genreSel = this.__genreBox.getSelection()[0];
      return genreSel ? genreSel.getLabel() : "전체";
    },

    _refreshSongList: function() {
      if (this.__sourceMode === "bitmidi") {
        this._refreshBitmidiList();
      } else {
        this._refreshLocalList();
      }
    },

    _refreshLocalList: function() {
      if (!this.__songs) {
        return;
      }
      var query = (this.__searchField.getValue() || "").toLowerCase().trim();
      var genre = this._selectedGenre();

      this.__songList.removeAll();
      this.__songs.forEach(function(song) {
        if (genre !== "전체" && song.genre !== genre) {
          return;
        }
        if (query && (song.title + " " + song.genre).toLowerCase().indexOf(query) === -1) {
          return;
        }
        var prefix = song.localFile ? "💾 " : "";
        var item = new qx.ui.form.ListItem(prefix + "[" + song.genre + "] " + song.title);
        item.setModel(song);
        this.__songList.add(item);
      }, this);
    },

    /**
     * BitMidi 목록 렌더:
     *  - 실시간 검색 결과(__searchResults)가 있으면 그것을 표시
     *  - 없으면 내장 카탈로그를 선택 장르로 필터한 "간편재생" 목록 표시
     */
    _refreshBitmidiList: function() {
      this.__songList.removeAll();

      if (this.__searchResults) {
        this.__searchResults.forEach(function(song) {
          var item = new qx.ui.form.ListItem("🔎 " + song.title);
          item.setModel(song);
          this.__songList.add(item);
        }, this);
        return;
      }

      var catalog = this.__bitmidiCatalog;
      if (!catalog) {
        return; // 로딩 중
      }
      var genre = this._selectedGenre();
      catalog.forEach(function(song) {
        if (genre !== "전체" && song.genre !== genre) {
          return;
        }
        var item = new qx.ui.form.ListItem("🌐 [" + song.genre + "] " + song.title);
        item.setModel(song);
        this.__songList.add(item);
      }, this);
    },

    // ─────────────────────────────────── 소스 전환 (내 라이브러리 / BitMidi)

    _setGenres: function(genres) {
      this.__suppressRefresh = true;
      this.__genreBox.removeAll();
      genres.forEach(function(g) {
        this.__genreBox.add(new qx.ui.form.ListItem(g));
      }, this);
      this.__suppressRefresh = false;
    },

    _onGenreChange: function() {
      if (this.__suppressRefresh) {
        return;
      }
      // 장르를 바꾸면 실시간 검색 결과를 비우고 간편재생(카테고리 브라우즈)으로 복귀
      if (this.__sourceMode === "bitmidi" && this.__searchResults) {
        this.__searchResults = null;
        this.__searchField.setValue("");
      }
      this._refreshSongList();
    },

    _onSourceChange: function() {
      var clazz = deskweb.ui.MidiPlayerWindow;
      var sel = this.__sourceBox.getSelection()[0];
      var mode = sel ? sel.getModel() : "local";
      this.__sourceMode = mode;
      this.__searchResults = null;
      this.__searchField.setValue("");

      if (mode === "bitmidi") {
        this.__searchField.setPlaceholder("BitMidi 전체 검색 (엔터/입력)...");
        this._setGenres(clazz.BITMIDI_GENRES);
        this._loadBitmidiCatalog();
      } else {
        this.__searchField.setPlaceholder("곡 검색...");
        this._setGenres(this.__localGenreAdded
          ? clazz.LOCAL_GENRES.concat(["내 폴더"]) : clazz.LOCAL_GENRES);
        this._refreshSongList();
      }
    },

    /** BitMidi 간편재생 카탈로그 지연 로드 */
    _loadBitmidiCatalog: function() {
      var self = this;
      var clazz = deskweb.ui.MidiPlayerWindow;
      if (this.__bitmidiCatalog) {
        this._refreshSongList();
        return;
      }
      this.__statusLabel.setValue("BitMidi 카탈로그 로딩중...");
      var uri = qx.util.ResourceManager.getInstance().toUri(clazz.BITMIDI_CATALOG);
      fetch(uri).then(function(r) {
        return r.json();
      }).then(function(list) {
        list.forEach(function(s) { s.source = "bitmidi"; });
        self.__bitmidiCatalog = list;
        if (self.__sourceMode === "bitmidi") {
          self._refreshSongList();
          self.__statusLabel.setValue("BitMidi " + list.length +
            "곡 간편재생 준비됨. 검색창으로 전체 검색도 가능합니다.");
        }
      }).catch(function(e) {
        console.error("[MidiPlayer] bitmidi catalog load failed:", e);
        self.__statusLabel.setValue("BitMidi 카탈로그 로드 실패");
      });
    },

    // ─────────────────────────────────── 검색 (로컬 필터 / BitMidi 실시간)

    _onSearchInput: function() {
      if (this.__sourceMode === "bitmidi") {
        this._scheduleBitmidiSearch();
      } else {
        this._refreshSongList();
      }
    },

    _scheduleBitmidiSearch: function() {
      var self = this;
      if (this.__searchTimer) {
        window.clearTimeout(this.__searchTimer);
      }
      var query = (this.__searchField.getValue() || "").trim();
      if (!query) {
        // 검색어 비우면 간편재생(카테고리)로 복귀
        this.__searchResults = null;
        this._refreshSongList();
        return;
      }
      this.__searchTimer = window.setTimeout(function() {
        self._bitmidiSearch(query);
      }, 400);
    },

    /** BitMidi 전체 라이브러리 실시간 검색 (API, 다운로드 없이 URL 재생) */
    _bitmidiSearch: function(query) {
      var self = this;
      var clazz = deskweb.ui.MidiPlayerWindow;
      var seq = ++this.__searchSeq;
      this.__statusLabel.setValue("BitMidi 검색중: " + query + " ...");
      var url = clazz.BITMIDI_SEARCH_API + "?q=" + encodeURIComponent(query) + "&page=0";
      fetch(url).then(function(r) {
        return r.json();
      }).then(function(j) {
        if (seq !== self.__searchSeq || self.__sourceMode !== "bitmidi") {
          return; // 더 최신 검색이 진행됨 → 폐기
        }
        var rows = (j.result && j.result.results) || [];
        self.__searchResults = rows.filter(function(r) {
          return r.downloadUrl;
        }).map(function(r) {
          return {
            title: r.name.replace(/\.mid$/i, ""),
            genre: "검색",
            url: clazz.BITMIDI_BASE + r.downloadUrl,
            source: "bitmidi"
          };
        });
        self._refreshSongList();
        self.__statusLabel.setValue("검색 결과 " + self.__searchResults.length +
          "곡 (\"" + query + "\") — 더블클릭하면 연주");
      }).catch(function(e) {
        if (seq !== self.__searchSeq) {
          return;
        }
        console.error("[MidiPlayer] bitmidi search failed:", e);
        self.__statusLabel.setValue("BitMidi 검색 실패 (네트워크 확인)");
      });
    },

    // ─────────────────────────────────── 로컬 폴더/파일 로드

    _pickFolder: function() {
      var self = this;
      if (!this.__folderInput) {
        var inp = document.createElement("input");
        inp.type = "file";
        inp.setAttribute("webkitdirectory", "");
        inp.setAttribute("directory", "");
        inp.multiple = true;
        inp.style.display = "none";
        inp.addEventListener("change", function() {
          self._onFilesPicked(inp.files, true);
          inp.value = "";
        });
        document.body.appendChild(inp);
        this.__folderInput = inp;
      }
      this.__folderInput.click();
    },

    _pickFiles: function() {
      var self = this;
      if (!this.__fileInput) {
        var inp = document.createElement("input");
        inp.type = "file";
        inp.accept = ".mid,.midi,audio/midi";
        inp.multiple = true;
        inp.style.display = "none";
        inp.addEventListener("change", function() {
          self._onFilesPicked(inp.files, false);
          inp.value = "";
        });
        document.body.appendChild(inp);
        this.__fileInput = inp;
      }
      this.__fileInput.click();
    },

    _onFilesPicked: function(fileList, isFolder) {
      var self = this;
      var added = 0;
      var folderName = null;
      Array.prototype.forEach.call(fileList, function(f) {
        if (!/\.midi?$/i.test(f.name)) {
          return;
        }
        var rel = f.webkitRelativePath || f.name;
        var top = rel.indexOf("/") >= 0 ? rel.split("/")[0] : "내 폴더";
        if (!folderName) {
          folderName = isFolder ? top : "내 파일";
        }
        self.__songs.push({
          title: f.name.replace(/\.midi?$/i, ""),
          genre: "내 폴더",
          folder: top,
          localFile: f
        });
        added++;
      });

      if (added > 0) {
        // BitMidi 모드였다면 내 라이브러리로 전환해 추가된 파일을 노출
        if (this.__sourceMode !== "local") {
          this.__sourceBox.setSelection([this.__sourceBox.getSelectables()[0]]);
        }
        this._ensureLocalGenre();
        this._refreshSongList();
        this.__statusLabel.setValue("<b>" + added + "개</b> MIDI 등록됨" + (folderName ? " (" + folderName + ")" : ""));
      } else {
        this.__statusLabel.setValue("선택한 곳에 MIDI(.mid/.midi) 파일이 없습니다.");
      }
    },

    _ensureLocalGenre: function() {
      if (this.__localGenreAdded) {
        return;
      }
      this.__localGenreAdded = true;
      // 로컬 모드일 때만 장르박스에 즉시 반영 (BitMidi 모드면 복귀 시 반영)
      if (this.__sourceMode === "local") {
        this.__genreBox.add(new qx.ui.form.ListItem("내 폴더"));
      }
    },

    // ─────────────────────────────────── GM 프로그램 → 연주자 매핑

    /**
     * GM 프로그램 번호(0-127)를 보유 스프라이트 슬러그로 매핑.
     * 스프라이트가 없는 악기는 가장 유사한 연주자로 폴백한다.
     * (예: 색소폰→클라리넷, 오르간/신스→synth, 민속현악→기타)
     */
    _mapProgram: function(program, isDrum) {
      if (isDrum) {
        return "drum";
      }
      var p = program || 0;
      if (p <= 7) { return "piano"; }                    // Piano
      if (p <= 15) { return "keytar"; }                  // Chromatic Perc → 키타
      if (p <= 23) { return "synth"; }                   // Organ/Accordion → 신스
      if (p <= 25) { return "guitar"; }                  // Acoustic Guitar
      if (p <= 31) { return "elec-guitar"; }             // Electric Guitar
      if (p === 32) { return "contrabass"; }             // Acoustic Bass
      if (p <= 39) { return "elec-bass"; }               // Bass
      if (p === 40) { return "violin"; }
      if (p === 41) { return "viola"; }
      if (p === 42) { return "cello"; }
      if (p === 43) { return "contrabass"; }
      if (p <= 45) { return "violin"; }                  // Tremolo/Pizzicato
      if (p === 46) { return "harp"; }
      if (p === 47) { return "drum"; }                   // Timpani
      if (p <= 51) { return "violin"; }                  // String Ensemble
      if (p <= 54) { return "vocal-1"; }                 // Choir/Voice
      if (p === 55) { return "drum"; }                   // Orchestra Hit
      if (p === 56 || p === 59) { return "trumpet"; }
      if (p === 57) { return "trombone"; }
      if (p === 58) { return "tuba"; }
      if (p === 60) { return "horn"; }
      if (p <= 63) { return "trumpet"; }                 // Brass Section
      if (p <= 67) { return "clarinet"; }                // Sax → 클라리넷 (유사 목관)
      if (p === 68 || p === 69) { return "oboe"; }       // Oboe/English Horn
      if (p <= 71) { return "clarinet"; }                // Bassoon/Clarinet
      if (p <= 79) { return "flute"; }                   // Pipes
      if (p <= 95) { return "synth"; }                   // Synth Lead/Pad
      if (p <= 103) { return "dj-deck"; }                // Synth FX → DJ
      if (p === 104 || p === 105 || p === 107) { return "guitar"; } // Sitar/Banjo/Koto
      if (p === 110) { return "violin"; }                // Fiddle
      if (p <= 111) { return "flute"; }                  // 기타 민속 관악
      if (p <= 119) { return "drum"; }                   // Percussive
      return "dj-deck";                                  // Sound FX
    },

    // ─────────────────────────────────── 무대 렌더링 (스킨 독립 메인 뷰)

    _initStage: function() {
      var element = this.__stageHtml.getContentElement().getDomElement();
      this.__canvas = document.createElement("canvas");
      this.__canvas.style.display = "block";
      this.__canvas.style.width = "100%";
      this.__canvas.style.height = "100%";
      element.appendChild(this.__canvas);
      this.__ctx = this.__canvas.getContext("2d");

      this.__stageHtml.addListener("resize", this._resizeStage, this);
      this._resizeStage();
      this._startLoop();
    },

    _resizeStage: function() {
      if (!this.__canvas) {
        return;
      }
      var bounds = this.__stageHtml.getBounds();
      if (bounds) {
        this.__canvas.width = bounds.width;
        this.__canvas.height = bounds.height;
      }
    },

    _getSprite: function(slug, mode) {
      var key = slug + "/" + mode;
      if (!this.__spriteCache[key]) {
        var img = new Image();
        img.src = qx.util.ResourceManager.getInstance().toUri("deskweb/band/" + slug + "/" + mode + ".png");
        this.__spriteCache[key] = img;
      }
      return this.__spriteCache[key];
    },

    /** 노트 발생 → 해당 연주자 소환/활성화 + 스펙트럼 에너지 주입 */
    _onNote: function(note) {
      var slug = this._mapProgram(note.program, note.isDrum);

      if (!this.__performers[slug]) {
        this.__performers[slug] = {
          slug: slug,
          lastNote: 0,
          bornAt: performance.now()
        };
        this.__performerOrder.push(slug);
        console.log("[MidiPlayer] 연주자 등장:", slug, "(program", note.program + ")");
      }
      this.__performers[slug].lastNote = performance.now();

      // 스펙트럼: 음높이 → 밴드 인덱스, 세기 → 막대 높이
      var bins = this.__spectrum.length;
      var idx = Math.max(0, Math.min(bins - 1,
        Math.floor((note.pitch - 24) / 72 * bins)));
      var energy = Math.min(1, (note.velocity || 80) / 127);
      this.__spectrum[idx] = Math.max(this.__spectrum[idx], energy);
      if (idx > 0) {
        this.__spectrum[idx - 1] = Math.max(this.__spectrum[idx - 1], energy * 0.5);
      }
      if (idx < bins - 1) {
        this.__spectrum[idx + 1] = Math.max(this.__spectrum[idx + 1], energy * 0.5);
      }
    },

    _startLoop: function() {
      var self = this;
      var frameSpec = deskweb.ui.MidiPlayerWindow;

      var draw = function() {
        self.__rafId = requestAnimationFrame(draw);
        var ctx = self.__ctx;
        var canvas = self.__canvas;
        if (!ctx || !canvas || canvas.width === 0) {
          return;
        }
        var w = canvas.width;
        var h = canvas.height;
        var now = performance.now();

        // 배경 - 무대 그라디언트
        var bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#0A0A18");
        bg.addColorStop(0.7, "#141428");
        bg.addColorStop(1, "#2A2A44");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // 스펙트럼 (무대 뒤편)
        var bins = self.__spectrum.length;
        var barW = w / bins;
        for (var i = 0; i < bins; i++) {
          var v = self.__spectrum[i];
          if (v > 0.01) {
            var barH = v * h * 0.55;
            var hue = (i / bins) * 300;
            ctx.fillStyle = "hsla(" + hue + ", 85%, 60%, 0.55)";
            ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
            ctx.fillStyle = "hsla(" + hue + ", 90%, 75%, 0.9)";
            ctx.fillRect(i * barW + 1, h - barH, barW - 2, 3);
            self.__spectrum[i] *= 0.94;
          }
        }

        // 무대 바닥
        ctx.fillStyle = "rgba(60, 50, 90, 0.5)";
        ctx.fillRect(0, h * 0.88, w, h * 0.12);

        // 연주자
        var order = self.__performerOrder;
        var n = order.length;
        if (n > 0) {
          var perRow = Math.min(n, n > 5 ? Math.ceil(n / 2) : n);
          var size = Math.min(170, Math.max(80, (w - 40) / (perRow + 0.5)));
          for (var k = 0; k < n; k++) {
            var perf = self.__performers[order[k]];
            var row = Math.floor(k / perRow);
            var col = k % perRow;
            var rowCount = (row === Math.floor((n - 1) / perRow))
              ? (n - row * perRow) : perRow;
            var cx = w / 2 + (col - (rowCount - 1) / 2) * (size * 1.05);
            var cy = h * (n > perRow ? (row === 0 ? 0.52 : 0.80) : 0.72);

            var active = (now - perf.lastNote) < 300;
            var mode = active ? "play" : "idle";
            var img = self._getSprite(perf.slug, mode);
            if (img.complete && img.naturalWidth > 0) {
              var frame = active
                ? Math.floor(now / 140) % frameSpec.FRAME_COUNT
                : Math.floor(now / 500) % frameSpec.FRAME_COUNT;
              var sx = frameSpec.FRAME_OFFSET + frame * frameSpec.FRAME_STRIDE;
              // 등장 연출 - 커지면서 등장
              var age = Math.min(1, (now - perf.bornAt) / 400);
              var s = size * (0.6 + 0.4 * age);
              // 연주 중이면 살짝 바운스
              var bounce = active ? Math.sin(now / 90) * 4 : 0;
              ctx.drawImage(img, sx, frameSpec.FRAME_OFFSET,
                frameSpec.FRAME_SIZE, frameSpec.FRAME_SIZE,
                cx - s / 2, cy - s + bounce, s, s);
            }
          }
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "16px Tahoma";
          ctx.textAlign = "center";
          ctx.fillText("연주자 대기중 — 곡을 재생하면 악단이 등장합니다", w / 2, h / 2);
        }

        // 곡 제목
        if (self.__currentSong) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "bold 15px Tahoma";
          ctx.textAlign = "center";
          ctx.fillText("♪ " + self.__currentSong.title + " — " + self.__currentSong.genre, w / 2, 28);
        }
      };
      draw();
    },

    // ─────────────────────────────────── 주크박스 스킨

    _buildJukebox: function() {
      var self = this;
      var clazz = deskweb.ui.MidiPlayerWindow;
      clazz.injectCss();

      var host = this.__playerHost.getContentElement().getDomElement();
      if (!host) {
        return;
      }
      host.style.position = "relative";

      var bgUri = qx.util.ResourceManager.getInstance().toUri("deskweb/images/jukebox.svg");
      var box = document.createElement("div");
      box.className = "mp-jukebox";
      box.innerHTML =
        '<img class="mp-bg" src="' + bgUri + '" alt="jukebox"/>' +
        '<div class="mp-display">' +
          '<div class="mp-vinyl"></div>' +
          '<div class="mp-info">' +
            '<div class="mp-title-wrap"><div class="mp-title">— 곡을 선택하세요 —</div></div>' +
            '<div class="mp-genre">MIDI JUKEBOX</div>' +
            '<div class="mp-eq"><span></span><span></span><span></span><span></span><span></span></div>' +
          '</div>' +
        '</div>' +
        '<div class="mp-controls">' +
          '<button class="mp-btn" data-act="prev" title="이전 곡">⏮</button>' +
          '<button class="mp-btn mp-play" data-act="play" title="재생/정지">▶</button>' +
          '<button class="mp-btn" data-act="next" title="다음 곡">⏭</button>' +
          '<button class="mp-btn mp-shuffle" data-act="shuffle" title="셔플">🔀</button>' +
        '</div>';
      host.appendChild(box);

      this.__titleEl = box.querySelector(".mp-title");
      this.__genreEl = box.querySelector(".mp-genre");
      this.__vinylEl = box.querySelector(".mp-vinyl");
      this.__playBtn = box.querySelector('[data-act="play"]');
      this.__shuffleBtn = box.querySelector('[data-act="shuffle"]');
      this.__eqBars = box.querySelectorAll(".mp-eq span");

      box.querySelector(".mp-controls").addEventListener("click", function(e) {
        var btn = e.target.closest ? e.target.closest(".mp-btn") : null;
        if (!btn) {
          return;
        }
        var act = btn.getAttribute("data-act");
        if (act === "prev") { self._playPrev(); }
        else if (act === "next") { self._playNext(); }
        else if (act === "play") { self._togglePlay(); }
        else if (act === "shuffle") { self._toggleShuffle(); }
      });

      // EQ 애니메이션 (스펙트럼 평균 반영)
      this.__eqTimer = window.setInterval(function() {
        self._updateEq();
      }, 90);

      // 엔진 로드 후 midi-player 삽입
      clazz.loadLib().then(function() {
        var el = document.createElement("midi-player");
        el.setAttribute("sound-font", clazz.SOUND_FONT);
        el.className = "mp-engine";
        host.appendChild(el);
        self.__playerEl = el;

        el.addEventListener("note", function(e) {
          var note = e.detail && (e.detail.note || e.detail);
          if (note && typeof note.pitch === "number") {
            self._onNote(note);
          }
        });
        el.addEventListener("load", function() {
          el.start();
        });
        el.addEventListener("start", function() {
          self._setPlaying(true);
        });
        el.addEventListener("stop", function(e) {
          self._setPlaying(false);
          if (e.detail && e.detail.finished) {
            self._playNext();
          }
        });

        self.__engineReady = true;
        if (self.__pendingSong) {
          var s = self.__pendingSong;
          self.__pendingSong = null;
          self._playSong(s);
        }
      }).catch(function(e) {
        console.error("[MidiPlayer] engine load failed:", e);
        self.__statusLabel.setValue("플레이어 엔진 로드 실패");
      });
    },

    _setPlaying: function(playing) {
      this.__playing = playing;
      if (this.__playBtn) {
        this.__playBtn.textContent = playing ? "❚❚" : "▶";
      }
      if (this.__vinylEl) {
        if (playing) {
          this.__vinylEl.classList.add("spin");
        } else {
          this.__vinylEl.classList.remove("spin");
        }
      }
      if (this.__currentSong) {
        this.__statusLabel.setValue((playing ? "연주중: " : "정지: ") + this.__currentSong.title);
      }
    },

    _updateDisplay: function(song) {
      if (!this.__titleEl) {
        return;
      }
      this.__titleEl.textContent = song.title;
      var srcIcon = song.localFile ? "💾 " : (song.url ? "🌐 " : "");
      this.__genreEl.textContent = srcIcon + "[" + song.genre + "]";
      // 긴 제목이면 마퀴 스크롤
      var wrap = this.__titleEl.parentNode;
      this.__titleEl.classList.remove("scroll");
      if (this.__titleEl.scrollWidth > wrap.clientWidth + 4) {
        this.__titleEl.classList.add("scroll");
      }
    },

    _updateEq: function() {
      if (!this.__eqBars || !this.__eqBars.length) {
        return;
      }
      var spec = this.__spectrum;
      var bins = spec.length;
      var groups = this.__eqBars.length;
      var step = Math.floor(bins / groups);
      for (var g = 0; g < groups; g++) {
        var sum = 0;
        for (var j = 0; j < step; j++) {
          sum += spec[g * step + j] || 0;
        }
        var avg = sum / step;
        var px = Math.max(3, Math.round(avg * 16));
        this.__eqBars[g].style.height = px + "px";
      }
    },

    // ─────────────────────────────────── 재생 제어

    /** 곡 → 재생 URI (localFile은 objectURL, BitMidi는 원격 URL, 번들은 리소스) */
    _songUri: function(song) {
      if (this.__objUrl) {
        URL.revokeObjectURL(this.__objUrl);
        this.__objUrl = null;
      }
      if (song.localFile) {
        this.__objUrl = URL.createObjectURL(song.localFile);
        return this.__objUrl;
      }
      if (song.url) {
        return song.url; // BitMidi 원격 (CORS 스트리밍)
      }
      return qx.util.ResourceManager.getInstance().toUri(song.file);
    },

    /** 곡 → MIDI ArrayBuffer (Real 엔진용) */
    _songArrayBuffer: function(song) {
      if (song.localFile) {
        return song.localFile.arrayBuffer();
      }
      var uri = song.url ? song.url
        : qx.util.ResourceManager.getInstance().toUri(song.file);
      return fetch(uri).then(function(r) {
        if (!r.ok) {
          throw new Error("MIDI 로드 실패 " + r.status);
        }
        return r.arrayBuffer();
      });
    },

    _pickAndPlay: function() {
      var pick = this.__songList.getSelection()[0] || this.__songList.getChildren()[0];
      if (pick) {
        this.__songList.setSelection([pick]);
        this._playSong(pick.getModel());
      }
    },

    _playSong: function(song) {
      if (!song) {
        return;
      }
      this.__currentSong = song;
      this._resetBand();
      this._updateDisplay(song);

      // 오디오/악보 공용 URI (objURL은 곡당 1개만 생성)
      this.__currentUri = this._songUri(song);
      if (this.__scoreOn) {
        this._loadScore();
      }

      if (this.__engineMode === "real") {
        this._playSongReal(song);
        return;
      }

      // 일반 MIDI (html-midi-player / magenta)
      if (!this.__playerEl) {
        this.__pendingSong = song; // 엔진 준비 전 - 예약
        this.__statusLabel.setValue("주크박스 준비중... (" + song.title + ")");
        return;
      }
      this.__statusLabel.setValue("로딩중: " + song.title);
      try {
        this.__playerEl.stop();
      } catch (e) {
        // ignore
      }
      // src 설정 → 'load' 이벤트에서 start()
      this.__playerEl.src = this.__currentUri;
    },

    _togglePlay: function() {
      if (this.__engineMode === "real") {
        if (this.__spSeq && this.__currentSong) {
          if (this.__playing && !this.__spSeq.paused) {
            this.__spSeq.pause();
            this._setPlaying(false);
          } else {
            this.__spCtx.resume();
            this.__spSeq.play();
            this._setPlaying(true);
          }
        } else {
          this._pickAndPlay();
        }
        return;
      }

      // 일반 MIDI
      if (!this.__playerEl) {
        this._pickAndPlay(); // 엔진 준비 전이면 선택곡을 예약 재생
        return;
      }
      if (this.__playing) {
        this.__playerEl.stop();
        return;
      }
      if (this.__currentSong) {
        this.__playerEl.start();
      } else {
        this._pickAndPlay();
      }
    },

    // ─────────────────────────────────── Real 악기 엔진 (SpessaSynth)

    _onEngineChange: function() {
      var self = this;
      var sel = this.__engineBox.getSelection()[0];
      var mode = sel ? sel.getModel() : "simple";
      if (mode === this.__engineMode) {
        return;
      }
      this._stopAllEngines();
      this.__engineMode = mode;
      if (mode === "real") {
        this.__statusLabel.setValue("Real 악기 모드 — 고음질 사운드폰트(8MB) 불러오는 중...");
        // 미리 초기화(첫 재생 지연 감소)
        this._ensureSpessa().then(function() {
          if (self.__engineMode === "real") {
            self.__statusLabel.setValue("Real 악기 준비됨 🎻 — 곡을 재생하세요.");
          }
        }, function(e) {
          self.__statusLabel.setValue("Real 엔진 로드 실패: " + (e && e.message || e));
        });
      } else {
        this.__statusLabel.setValue("일반 MIDI 재생 모드 🎹");
      }
    },

    _stopAllEngines: function() {
      try {
        if (this.__playerEl) {
          this.__playerEl.stop();
        }
      } catch (e) { /* ignore */ }
      try {
        if (this.__spSeq && !this.__spSeq.paused) {
          this.__spSeq.pause();
        }
      } catch (e) { /* ignore */ }
      this._setPlaying(false);
    },

    _resetChProg: function() {
      for (var i = 0; i < 16; i++) {
        this.__chProg[i] = { program: 0, isDrum: i === 9 };
      }
    },

    /** SpessaSynth 지연 초기화 (모듈+worklet+신디+사운드폰트+시퀀서, 1회) */
    _ensureSpessa: function() {
      var self = this;
      var clazz = deskweb.ui.MidiPlayerWindow;
      if (this.__spReady) {
        return this.__spReady;
      }
      this.__spReady = clazz.loadSpessaModule().then(function(S) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        var ctx = new Ctx();
        return ctx.audioWorklet.addModule(clazz.SPESSA_WORKLET).then(function() {
          var synth = new S.WorkletSynthesizer(ctx);
          synth.connect(ctx.destination);
          return self._fetchSoundfont().then(function(sf) {
            return synth.soundBankManager.addSoundBank(sf, "main");
          }).then(function() {
            return synth.isReady;
          }).then(function() {
            var seq = new S.Sequencer(synth);
            seq.loopCount = 0;

            // 비주얼라이저 연동: programChange로 채널 악기 추적, noteOn으로 연주자 소환
            synth.eventHandler.addEvent("programChange", "deskweb-viz", function(e) {
              self.__chProg[e.channel] = { program: e.program, isDrum: !!e.isDrum };
            });
            synth.eventHandler.addEvent("noteOn", "deskweb-viz", function(e) {
              var cp = self.__chProg[e.channel] || {};
              self._onNote({
                pitch: e.midiNote,
                velocity: e.velocity,
                program: cp.program || 0,
                isDrum: cp.isDrum || (e.channel === 9)
              });
            });
            // 곡 종료 → 다음 곡
            seq.eventHandler.addEvent("songEnded", "deskweb-adv", function() {
              if (self.__engineMode === "real") {
                self._setPlaying(false);
                self._playNext();
              }
            });

            self.__spCtx = ctx;
            self.__spSynth = synth;
            self.__spSeq = seq;
            console.log("[MidiPlayer] SpessaSynth (Real 악기) 준비 완료");
          });
        });
      });
      // 실패 시 다음 시도에서 재초기화 허용
      this.__spReady["catch"](function() { self.__spReady = null; });
      return this.__spReady;
    },

    /** 사운드폰트 로드 (jsdelivr-gh → 실패 시 GH Pages 폴백) */
    _fetchSoundfont: function() {
      var clazz = deskweb.ui.MidiPlayerWindow;
      return fetch(clazz.SPESSA_SOUNDFONT).then(function(r) {
        if (!r.ok) {
          throw new Error("soundfont http " + r.status);
        }
        return r.arrayBuffer();
      })["catch"](function() {
        return fetch(clazz.SPESSA_SOUNDFONT_FALLBACK).then(function(r) {
          return r.arrayBuffer();
        });
      });
    },

    _playSongReal: function(song) {
      var self = this;
      this.__statusLabel.setValue("Real 엔진 준비중: " + song.title);
      this._ensureSpessa().then(function() {
        return self._songArrayBuffer(song);
      }).then(function(buf) {
        if (self.__currentSong !== song || self.__engineMode !== "real") {
          return; // 그 사이 곡/모드 변경됨
        }
        self._resetChProg();
        self.__spCtx.resume();
        self.__spSeq.loadNewSongList([{ binary: buf, fileName: song.title }]);
        self.__spSeq.play();
        self._setPlaying(true);
      })["catch"](function(e) {
        console.error("[MidiPlayer] real play failed:", e);
        self.__statusLabel.setValue("Real 엔진 재생 실패: " + (e && e.message || e));
      });
    },

    // ─────────────────────────────────── 악보보기 (스코어 플레이어)

    _onScoreToggle: function() {
      var self = this;
      var on = this.__scoreBtn.getValue();
      this.__scoreOn = on;
      if (on) {
        this.__scorePanel.setVisibility("visible");
        this._ensureScoreVis(function() {
          self._loadScore();
          self._startScoreTick();
        });
        this.__statusLabel.setValue("악보보기 켜짐 🎼 — 재생하면 악보가 연주를 따라갑니다.");
      } else {
        this._stopScoreTick();
        this._clearScoreRows();
        this.__scorePanel.exclude();
      }
    },

    _clearScoreRows: function() {
      try { if (this.__scoreTop) { this.__scoreTop.clearActiveNotes(); } } catch (e) { /* ignore */ }
      try { if (this.__scoreBot) { this.__scoreBot.clearActiveNotes(); } } catch (e) { /* ignore */ }
    },

    _onScoreTypeChange: function() {
      var sel = this.__scoreTypeBox.getSelection()[0];
      this.__scoreVisType = sel ? sel.getModel() : "staff";
      if (this.__scoreTop) {
        try {
          this.__scoreTop.type = this.__scoreVisType;
          this.__scoreBot.type = this.__scoreVisType;
        } catch (e) { /* ignore */ }
        this.__topPage = -1; // 강제 재렌더
        this._loadScore();
      }
    },

    /**
     * 악보 2행 스택(현재/다음) 지연 생성.
     * 상단 행 = 현재 페이지(커서 진행), 하단 행 = 다음 페이지(선행 준비).
     * → 페이지 내 가로 스크롤 + 페이지 전환 시 세로 이동의 혼합.
     */
    _ensureScoreVis: function(cb) {
      var self = this;
      if (this.__scoreTop) {
        if (cb) { cb(); }
        return;
      }
      var host = this.__scoreHtml.getContentElement().getDomElement();
      if (!host) {
        this.__scoreHtml.addListenerOnce("appear", function() {
          self._ensureScoreVis(cb);
        });
        return;
      }
      deskweb.ui.MidiPlayerWindow.injectCss();
      deskweb.ui.MidiPlayerWindow.loadLib().then(function() {
        var wrap = document.createElement("div");
        wrap.className = "mp-score-wrap";
        var top = document.createElement("midi-visualizer");
        var bot = document.createElement("midi-visualizer");
        top.setAttribute("type", self.__scoreVisType || "staff");
        bot.setAttribute("type", self.__scoreVisType || "staff");
        top.className = "mp-score-row mp-score-active";
        bot.className = "mp-score-row";
        wrap.appendChild(top);
        wrap.appendChild(bot);
        host.appendChild(wrap);
        self.__scoreWrap = wrap;
        self.__scoreTop = top;
        self.__scoreBot = bot;
        if (cb) { cb(); }
      })["catch"](function(e) {
        console.error("[MidiPlayer] score visualizer load failed:", e);
        self.__statusLabel.setValue("악보 로드 실패");
      });
    },

    /** magenta 코어 네임스페이스 (html-midi-player 로드 후 전역 노출) */
    _magenta: function() {
      return window.core || window.mm || null;
    },

    /**
     * 현재 곡을 악보로 로드.
     * 전체를 한 번에 렌더하면 대곡에서 메인스레드가 수십 초 얼어붙으므로,
     * urlToNoteSequence로 렌더 없이 파싱만 한 뒤 시간 윈도우(페이지) 단위로만 렌더한다.
     */
    _loadScore: function() {
      var self = this;
      var mm = this._magenta();
      if (!this.__scoreTop || !this.__currentUri) {
        return;
      }
      // 로드 토큰: 곡을 연속으로 바꿔도 최신 로드만 유효
      var seq = (this.__scoreLoadSeq = (this.__scoreLoadSeq || 0) + 1);
      var uri = this.__currentUri;
      this.__scoreFullNs = null;
      this.__scoreNotes = null;
      this.__topPage = -1;
      this.__scoreCursor = 0;
      this.__scoreForceRedraw = true;
      this._clearScoreRows();

      if (!mm || !mm.urlToNoteSequence) {
        // 파서 전역이 없으면 폴백(소형 곡 한정 통짜 렌더)
        try { this.__scoreTop.src = uri; } catch (e) { /* ignore */ }
        return;
      }
      mm.urlToNoteSequence(uri).then(function(ns) {
        if (seq !== self.__scoreLoadSeq) {
          return; // 더 최신 로드가 시작됨
        }
        self.__scoreFullNs = ns;
        var PAGE = deskweb.ui.MidiPlayerWindow.SCORE_PAGE_SEC;
        var t = self._engineCurrentTime() || 0;
        self._renderPages(Math.max(0, Math.floor(t / PAGE)));
      })["catch"](function(e) {
        console.error("[MidiPlayer] score parse failed:", e);
        self.__statusLabel.setValue("악보 파싱 실패");
      });
    },

    /** [a,c) 시간 구간에 걸치는 음표만 담은 서브 시퀀스 (같은 note 객체 참조 유지) */
    _pageSub: function(a, c) {
      var ns = this.__scoreFullNs;
      var all = ns.notes;
      var notes = [];
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if ((n.startTime || 0) < c && (n.endTime || 0) > a) {
          notes.push(n);
        }
      }
      return {
        notes: notes,
        tempos: ns.tempos,
        timeSignatures: ns.timeSignatures,
        totalTime: ns.totalTime,
        ticksPerQuarter: ns.ticksPerQuarter,
        quantizationInfo: ns.quantizationInfo
      };
    },

    /** 한 행에 지정 페이지를 렌더하고 그 페이지의 note 배열을 반환 */
    _renderInto: function(elem, idx) {
      var PAGE = deskweb.ui.MidiPlayerWindow.SCORE_PAGE_SEC;
      var sub = this._pageSub(idx * PAGE, (idx + 1) * PAGE);
      try { elem.noteSequence = sub; } catch (e) { /* ignore */ }
      return sub.notes;
    },

    /** 상단=현재 페이지, 하단=다음 페이지. 정상 진행 시 준비된 하단을 위로 올려 재렌더 최소화 */
    _renderPages: function(idx) {
      if (!this.__scoreFullNs || !this.__scoreTop) {
        return;
      }
      if (idx === this.__topPage) {
        return;
      }
      if (this.__topPage < 0 || idx !== this.__topPage + 1) {
        // 최초 로드 또는 시크(비연속): 두 행 새로 렌더
        this.__topNotes = this._renderInto(this.__scoreTop, idx);
        this.__botNotes = this._renderInto(this.__scoreBot, idx + 1);
      } else {
        // 정상 진행: 미리 준비된 하단 행을 위로 올리고, 새 다음 페이지를 하단에 준비
        var host = this.__scoreTop.parentNode;
        if (host) {
          host.insertBefore(this.__scoreBot, this.__scoreTop);
        }
        var newTop = this.__scoreBot;
        var newBot = this.__scoreTop;
        this.__scoreTop = newTop;
        this.__scoreBot = newBot;
        this.__topNotes = this.__botNotes; // 이미 page(idx) 렌더 완료
        this.__botNotes = this._renderInto(this.__scoreBot, idx + 1);
      }
      this.__topPage = idx;
      if (this.__scoreTop.classList) {
        this.__scoreTop.classList.add("mp-score-active");
      }
      if (this.__scoreBot.classList) {
        this.__scoreBot.classList.remove("mp-score-active");
      }
      // 커서용 정렬 배열(같은 note 객체 참조 → redraw 매칭)
      this.__scoreNotes = (this.__topNotes || []).slice().sort(function(a, b) {
        return (a.startTime || 0) - (b.startTime || 0);
      });
      this.__scoreCursor = 0;
      this.__scoreForceRedraw = true;
    },

    _startScoreTick: function() {
      if (this.__scoreRaf) {
        return;
      }
      var self = this;
      var tick = function() {
        self.__scoreRaf = requestAnimationFrame(tick);
        self._scoreTick();
      };
      tick();
    },

    _stopScoreTick: function() {
      if (this.__scoreRaf) {
        cancelAnimationFrame(this.__scoreRaf);
        this.__scoreRaf = null;
      }
    },

    /** 활성 엔진의 현재 재생 위치(초) */
    _engineCurrentTime: function() {
      if (this.__engineMode === "real") {
        return this.__spSeq ? this.__spSeq.currentTime : null;
      }
      return this.__playerEl ? this.__playerEl.currentTime : null;
    },

    /** 매 프레임: 페이지 전환 + 현재 시각 음표 강조/스크롤 */
    _scoreTick: function() {
      if (!this.__scoreOn || !this.__scoreTop || !this.__scoreFullNs) {
        return;
      }
      var t = this._engineCurrentTime();
      if (t == null) {
        return;
      }
      var PAGE = deskweb.ui.MidiPlayerWindow.SCORE_PAGE_SEC;
      var pageIdx = Math.max(0, Math.floor(t / PAGE));
      if (pageIdx !== this.__topPage) {
        this._renderPages(pageIdx);
      }
      var notes = this.__scoreNotes;
      if (!notes || !notes.length) {
        return;
      }
      var i = this.__scoreCursor || 0;
      while (i + 1 < notes.length && (notes[i + 1].startTime || 0) <= t) {
        i++;
      }
      while (i > 0 && (notes[i].startTime || 0) > t) {
        i--;
      }
      if (i !== this.__scoreCursor || this.__scoreForceRedraw) {
        this.__scoreCursor = i;
        this.__scoreForceRedraw = false;
        var n = notes[i];
        if (n && (n.startTime || 0) <= t + 0.1) {
          try { this.__scoreTop.redraw(n); } catch (e) { /* ignore */ }
        }
      }
    },

    _toggleShuffle: function() {
      this.__shuffle = !this.__shuffle;
      if (this.__shuffleBtn) {
        if (this.__shuffle) {
          this.__shuffleBtn.classList.add("mp-on");
        } else {
          this.__shuffleBtn.classList.remove("mp-on");
        }
      }
      this.__statusLabel.setValue("셔플 " + (this.__shuffle ? "켜짐 🔀" : "꺼짐"));
    },

    _currentIndex: function(items) {
      var cur = this.__currentSong;
      if (!cur) {
        return -1;
      }
      for (var i = 0; i < items.length; i++) {
        var m = items[i].getModel();
        if (m === cur) {
          return i;
        }
        if (m.file && cur.file && m.file === cur.file) {
          return i;
        }
        if (m.url && cur.url && m.url === cur.url) {
          return i;
        }
      }
      return -1;
    },

    _playNext: function() {
      var items = this.__songList.getChildren();
      if (!items.length) {
        return;
      }
      var next;
      if (this.__shuffle) {
        next = items[Math.floor(Math.random() * items.length)];
      } else {
        var idx = this._currentIndex(items);
        next = items[(idx + 1) % items.length];
      }
      this.__songList.setSelection([next]);
      this._playSong(next.getModel());
    },

    _playPrev: function() {
      var items = this.__songList.getChildren();
      if (!items.length) {
        return;
      }
      var idx = this._currentIndex(items);
      var prev = items[(idx - 1 + items.length) % items.length];
      this.__songList.setSelection([prev]);
      this._playSong(prev.getModel());
    },

    _resetBand: function() {
      this.__performers = {};
      this.__performerOrder = [];
      for (var i = 0; i < this.__spectrum.length; i++) {
        this.__spectrum[i] = 0;
      }
    },

    _shutdown: function() {
      if (this.__playerEl) {
        try {
          this.__playerEl.stop();
        } catch (e) {
          // already stopped
        }
        this.__playerEl = null;
      }
      if (this.__rafId) {
        cancelAnimationFrame(this.__rafId);
        this.__rafId = null;
      }
      if (this.__eqTimer) {
        window.clearInterval(this.__eqTimer);
        this.__eqTimer = null;
      }
      if (this.__searchTimer) {
        window.clearTimeout(this.__searchTimer);
        this.__searchTimer = null;
      }
      this._stopScoreTick();
      if (this.__objUrl) {
        URL.revokeObjectURL(this.__objUrl);
        this.__objUrl = null;
      }
      // Real 악기 엔진 정리
      if (this.__spSeq) {
        try {
          this.__spSeq.pause();
        } catch (e) {
          // ignore
        }
        this.__spSeq = null;
      }
      this.__spSynth = null;
      if (this.__spCtx) {
        try {
          this.__spCtx.close();
        } catch (e) {
          // ignore
        }
        this.__spCtx = null;
      }
    }
  }
});
