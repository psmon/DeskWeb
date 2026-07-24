/**
 * MIDI Player - 미디 연주악단
 *
 * MIDI 파일 재생 시 곡에 등장하는 악기(GM 프로그램)에 매칭되는 연주자 스프라이트가
 * 무대에 등장해 실제 노트에 맞춰 연주 애니메이션을 한다.
 * 스프라이트가 없는 악기는 유사 악기 연주자로 매핑한다.
 * 노트 이벤트 기반 스펙트럼 이펙트를 무대 뒤에 표현한다.
 *
 * 재생 엔진: html-midi-player (magenta SoundFont 신디사이저, CDN 동적 로드)
 * 연주자 스프라이트: 192x192 4프레임 시트 (idle/play), agent-band 리소스 유래
 *
 * @ignore(Image)
 * @ignore(fetch)
 * @ignore(requestAnimationFrame)
 * @ignore(cancelAnimationFrame)
 * @ignore(performance.now)
 * @asset(deskweb/midi/*)
 * @asset(deskweb/band/*)
 */
qx.Class.define("deskweb.ui.MidiPlayerWindow", {
  extend: qx.ui.window.Window,

  statics: {
    __libPromise: null,

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
    }
  },

  construct: function() {
    this.base(arguments, "MIDI Player", "deskweb/images/midiplayer.svg");

    this.set({
      width: 940,
      height: 640,
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

    this._createUI();
    this._loadSongList();

    this.addListener("close", this._shutdown, this);
  },

  destruct: function() {
    this._shutdown();
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

    // ─────────────────────────────────── UI

    _createUI: function() {
      var root = new qx.ui.container.Composite(new qx.ui.layout.HBox());

      // ── 좌측: 곡 목록 패널
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

      this.__statusLabel = new qx.ui.basic.Label("곡을 선택하세요 (더블클릭 = 연주)");
      this.__statusLabel.set({wrap: true, textColor: "#555555", font: qx.bom.Font.fromString("11px Tahoma")});
      left.add(this.__statusLabel);

      root.add(left);

      // ── 우측: 무대 + 재생 컨트롤
      var right = new qx.ui.container.Composite(new qx.ui.layout.VBox());

      this.__stageHtml = new qx.ui.embed.Html();
      this.__stageHtml.set({backgroundColor: "#0A0A14", overflowX: "hidden", overflowY: "hidden"});
      this.__stageHtml.addListenerOnce("appear", this._initStage, this);
      right.add(this.__stageHtml, {flex: 1});

      this.__playerHost = new qx.ui.embed.Html();
      this.__playerHost.set({height: 70, backgroundColor: "#1A1A2A"});
      right.add(this.__playerHost);

      root.add(right, {flex: 1});
      this.add(root, {flex: 1});
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
        var item = new qx.ui.form.ListItem("[" + song.genre + "] " + song.title);
        item.setModel(song);
        this.__songList.add(item);
      }, this);
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

    // ─────────────────────────────────── 무대 렌더링

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

    // ─────────────────────────────────── 재생 제어

    _playSong: function(song) {
      var self = this;
      this.__currentSong = song;
      this.__statusLabel.setValue("로딩중: " + song.title);

      deskweb.ui.MidiPlayerWindow.loadLib().then(function() {
        var host = self.__playerHost.getContentElement().getDomElement();
        if (!host) {
          return;
        }

        // 새 곡 - 악단 리셋
        self._resetBand();

        if (!self.__playerEl) {
          host.innerHTML = "";
          var el = document.createElement("midi-player");
          el.setAttribute("sound-font", deskweb.ui.MidiPlayerWindow.SOUND_FONT);
          el.style.width = "100%";
          el.style.margin = "14px 8px";
          host.appendChild(el);
          self.__playerEl = el;

          el.addEventListener("note", function(e) {
            var note = e.detail && (e.detail.note || e.detail);
            if (note && typeof note.pitch === "number") {
              self._onNote(note);
            }
          });
          el.addEventListener("load", function() {
            self.__statusLabel.setValue("연주중: " + (self.__currentSong ? self.__currentSong.title : ""));
            el.start();
          });
          el.addEventListener("stop", function(e) {
            // 곡이 끝까지 재생되면 다음 곡 자동 연주
            if (e.detail && e.detail.finished) {
              self._playNext();
            }
          });
        } else if (self.__playerEl.playing) {
          self.__playerEl.stop();
        }

        var uri = qx.util.ResourceManager.getInstance().toUri(song.file);
        self.__playerEl.src = uri;
      }).catch(function(e) {
        console.error("[MidiPlayer] play failed:", e);
        self.__statusLabel.setValue("재생 실패: " + e.message);
      });
    },

    _playNext: function() {
      var items = this.__songList.getChildren();
      if (!items.length) {
        return;
      }
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (this.__currentSong && items[i].getModel().file === this.__currentSong.file) {
          idx = i;
          break;
        }
      }
      var next = items[(idx + 1) % items.length];
      this.__songList.setSelection([next]);
      this._playSong(next.getModel());
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
    }
  }
});
