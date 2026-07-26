/**
 * MIDI Player - 미디 연주악단 (빈티지 주크박스 스킨)
 *
 * 무대(악단 뷰)가 메인 연출이며 스킨과 독립적으로 유지된다.
 * 재생 컨트롤은 카툰풍 빈티지 주크박스(jukebox.svg)로 스킨을 입혔다.
 * 곡 소스는 (1) 번들 MIDI, (2) 로컬 폴더/파일 등록 두 가지를 지원한다.
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
 * @asset(deskweb/midi/*)
 * @asset(deskweb/band/*)
 * @asset(deskweb/images/jukebox.svg)
 */
qx.Class.define("deskweb.ui.MidiPlayerWindow", {
  extend: qx.ui.window.Window,

  statics: {
    __libPromise: null,
    __cssInjected: false,

    LIB_URL: "https://cdn.jsdelivr.net/combine/npm/tone@14.7.58,npm/@magenta/music@1.23.1/es6/core.js,npm/focus-visible@5,npm/html-midi-player@1.5.0",
    SOUND_FONT: "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",

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
        ".mp-btn.mp-on{background:radial-gradient(circle at 50% 30%,#bfe9c0,#4ad06a 60%,#2a9a48);color:#0c3a1a;}"
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
    __statusLabel: null,
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

      this.__searchField = new qx.ui.form.TextField();
      this.__searchField.setPlaceholder("곡 검색...");
      this.__searchField.addListener("input", this._refreshSongList, this);
      left.add(this.__searchField);

      this.__genreBox = new qx.ui.form.SelectBox();
      ["전체", "게임", "클래식", "바로크", "전통음악", "캐럴"].forEach(function(g) {
        this.__genreBox.add(new qx.ui.form.ListItem(g));
      }, this);
      this.__genreBox.addListener("changeSelection", this._refreshSongList, this);
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

    _refreshSongList: function() {
      if (!this.__songs) {
        return;
      }
      var query = (this.__searchField.getValue() || "").toLowerCase().trim();
      var genreSel = this.__genreBox.getSelection()[0];
      var genre = genreSel ? genreSel.getLabel() : "전체";

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
      this.__genreBox.add(new qx.ui.form.ListItem("내 폴더"));
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
      this.__genreEl.textContent = (song.localFile ? "💾 " : "") + "[" + song.genre + "]";
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

    _playSong: function(song) {
      if (!song) {
        return;
      }
      if (!this.__playerEl) {
        // 엔진 준비 전 - 예약
        this.__pendingSong = song;
        this.__currentSong = song;
        this._updateDisplay(song);
        this.__statusLabel.setValue("주크박스 준비중... (" + song.title + ")");
        return;
      }

      this.__currentSong = song;
      this._resetBand();
      this._updateDisplay(song);
      this.__statusLabel.setValue("로딩중: " + song.title);

      if (this.__objUrl) {
        URL.revokeObjectURL(this.__objUrl);
        this.__objUrl = null;
      }

      var uri;
      if (song.localFile) {
        this.__objUrl = URL.createObjectURL(song.localFile);
        uri = this.__objUrl;
      } else {
        uri = qx.util.ResourceManager.getInstance().toUri(song.file);
      }

      try {
        this.__playerEl.stop();
      } catch (e) {
        // ignore
      }
      // src 설정 → 'load' 이벤트에서 start()
      this.__playerEl.src = uri;
    },

    _togglePlay: function() {
      if (!this.__playerEl) {
        // 엔진 준비 전이면 선택곡을 예약 재생
        var pick = this.__songList.getSelection()[0] || this.__songList.getChildren()[0];
        if (pick) {
          this.__songList.setSelection([pick]);
          this._playSong(pick.getModel());
        }
        return;
      }
      if (this.__playing) {
        this.__playerEl.stop();
        return;
      }
      if (this.__currentSong) {
        this.__playerEl.start();
      } else {
        var sel = this.__songList.getSelection()[0] || this.__songList.getChildren()[0];
        if (sel) {
          this.__songList.setSelection([sel]);
          this._playSong(sel.getModel());
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
      for (var i = 0; i < items.length; i++) {
        if (this.__currentSong && items[i].getModel() === this.__currentSong) {
          return i;
        }
        if (this.__currentSong && items[i].getModel().file &&
            items[i].getModel().file === this.__currentSong.file) {
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
      if (this.__objUrl) {
        URL.revokeObjectURL(this.__objUrl);
        this.__objUrl = null;
      }
    }
  }
});
