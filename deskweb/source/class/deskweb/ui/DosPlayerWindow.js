/**
 * DOS Games - js-dos v8 기반 고전게임 에뮬레이터
 *
 * 게임 목록에서 고전 DOS 게임을 선택해 실행한다.
 * 게임 번들(.jsdos)은 저장소에 포함하지 않고 실행 시점에 CDN에서 동적으로 내려받는다.
 * CORS가 막힌 번들은 로컬 .jsdos 파일 열기 또는 커스텀 URL로 실행할 수 있다.
 *
 * @ignore(Dos)
 * @ignore(URL.createObjectURL)
 * @ignore(URL.revokeObjectURL)
 * @asset(deskweb/bundles/*)
 */
qx.Class.define("deskweb.ui.DosPlayerWindow", {
  extend: qx.ui.window.Window,

  statics: {
    /** js-dos v8 스크립트/CSS 로더 (1회만 로드) */
    __jsDosPromise: null,

    JSDOS_JS: "https://v8.js-dos.com/latest/js-dos.js",
    JSDOS_CSS: "https://v8.js-dos.com/latest/js-dos.css",

    /**
     * 큐레이션 게임 목록.
     * - url: CORS 허용이 확인된 외부 CDN 번들
     * - resource: 사이트와 같은 오리진으로 서빙되는 내장 번들 (CORS 제약 없음)
     */
    GAMES: [
      {
        id: "digger",
        title: "Digger",
        year: "1983",
        genre: "아케이드",
        desc: "땅을 파며 에메랄드를 모으는 클래식 아케이드. 방향키로 이동.",
        url: "https://v8.js-dos.com/bundles/digger.jsdos"
      },
      {
        id: "doom",
        title: "DOOM",
        year: "1993",
        genre: "FPS",
        desc: "FPS의 전설. 방향키 이동, Ctrl 발사, Space 문 열기.",
        url: "https://v8.js-dos.com/bundles/doom.jsdos"
      },
      {
        id: "prince",
        title: "Prince of Persia",
        year: "1989",
        genre: "액션",
        desc: "60분 안에 공주를 구하라. 방향키 이동, Shift 잡기/조심걷기.",
        resource: "deskweb/bundles/prince.jsdos"
      },
      {
        id: "lemmings",
        title: "Lemmings",
        year: "1991",
        genre: "퍼즐",
        desc: "레밍 무리를 출구까지 인도하는 명작 퍼즐. 마우스로 조작.",
        resource: "deskweb/bundles/lemmings.jsdos"
      },
      {
        id: "warcraft",
        title: "Warcraft: Orcs & Humans",
        year: "1994",
        genre: "RTS",
        desc: "블리자드 RTS의 시조. 마우스로 유닛 선택/명령.",
        resource: "deskweb/bundles/warcraft.jsdos"
      },
      {
        id: "galaxy",
        title: "Galaxy",
        year: "1982",
        genre: "슈팅",
        desc: "갤럭시안 스타일 고전 슈팅. 방향키 이동, Space 발사.",
        resource: "deskweb/bundles/galaxy.jsdos"
      }
    ],

    loadJsDos: function() {
      var clazz = deskweb.ui.DosPlayerWindow;
      if (clazz.__jsDosPromise) {
        return clazz.__jsDosPromise;
      }

      clazz.__jsDosPromise = new Promise(function(resolve, reject) {
        if (typeof Dos !== "undefined") {
          resolve();
          return;
        }

        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = clazz.JSDOS_CSS;
        document.head.appendChild(link);

        var script = document.createElement("script");
        script.src = clazz.JSDOS_JS;
        script.onload = function() {
          console.log("[DosPlayer] js-dos loaded");
          resolve();
        };
        script.onerror = function() {
          clazz.__jsDosPromise = null;
          reject(new Error("js-dos 스크립트 로드 실패"));
        };
        document.head.appendChild(script);
      });

      return clazz.__jsDosPromise;
    }
  },

  construct: function() {
    this.base(arguments, "DOS Games", "deskweb/images/dosplayer.svg");

    this.set({
      width: 800,
      height: 600,
      showMinimize: true,
      showMaximize: true,
      allowMaximize: true,
      contentPadding: 0
    });
    this.setLayout(new qx.ui.layout.VBox());

    this.__dosProps = null;
    this.__blobUrl = null;

    this._createUI();

    // 창이 닫히면 에뮬레이터 정리
    this.addListener("close", this._stopGame, this);
  },

  destruct: function() {
    this._stopGame();
  },

  members: {
    __stack: null,
    __selectView: null,
    __playerView: null,
    __playerHtml: null,
    __dosProps: null,
    __blobUrl: null,
    __statusLabel: null,
    __backButton: null,
    __titleLabel: null,

    _createUI: function() {
      this._createToolbar();

      this.__stack = new qx.ui.container.Stack();

      this.__selectView = this._createSelectView();
      this.__playerView = this._createPlayerView();

      this.__stack.add(this.__selectView);
      this.__stack.add(this.__playerView);
      this.__stack.setSelection([this.__selectView]);

      this.add(this.__stack, {flex: 1});
    },

    /**
     * 상단 툴바 - 목록으로 돌아가기 + 현재 게임 표시
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();

      this.__backButton = new qx.ui.toolbar.Button("← 게임 목록");
      this.__backButton.setEnabled(false);
      this.__backButton.addListener("execute", function() {
        this._stopGame();
        this.__stack.setSelection([this.__selectView]);
        this.__backButton.setEnabled(false);
        this.__titleLabel.setValue("");
      }, this);
      toolbar.add(this.__backButton);

      toolbar.add(new qx.ui.toolbar.Separator());

      this.__titleLabel = new qx.ui.basic.Label("");
      this.__titleLabel.set({
        alignY: "middle",
        paddingLeft: 8,
        font: "bold"
      });
      toolbar.add(this.__titleLabel);

      this.add(toolbar);
    },

    /**
     * 게임 선택 화면
     */
    _createSelectView: function() {
      var scroll = new qx.ui.container.Scroll();
      var container = new qx.ui.container.Composite(new qx.ui.layout.VBox(12));
      container.set({
        padding: 20,
        backgroundColor: "#FFFFFF"
      });

      // 헤더
      var header = new qx.ui.basic.Label("게임을 선택하세요");
      header.set({
        font: new qx.bom.Font(18, ["Tahoma", "sans-serif"]).set({bold: true}),
        textColor: "#0054E3"
      });
      container.add(header);

      var subHeader = new qx.ui.basic.Label(
        "게임 번들은 실행 시 CDN에서 동적으로 내려받습니다. 최초 실행 시 다운로드에 잠시 시간이 걸립니다."
      );
      subHeader.set({rich: true, wrap: true, textColor: "#666666"});
      container.add(subHeader);

      // 큐레이션 게임 카드
      deskweb.ui.DosPlayerWindow.GAMES.forEach(function(game) {
        container.add(this._createGameCard(game));
      }, this);

      // 구분선
      var sep = new qx.ui.core.Widget();
      sep.set({height: 1, backgroundColor: "#D0D7DE", marginTop: 8, marginBottom: 8});
      container.add(sep);

      // 커스텀 URL 실행
      var customHeader = new qx.ui.basic.Label("직접 실행");
      customHeader.set({font: "bold", textColor: "#333333"});
      container.add(customHeader);

      var customDesc = new qx.ui.basic.Label(
        "dos.zone 등에서 구한 .jsdos 번들 URL을 입력하거나, 내려받은 번들 파일을 직접 열 수 있습니다.<br/>" +
        "(URL 실행은 해당 서버가 CORS를 허용해야 합니다. 안 되면 파일을 내려받아 여세요.)"
      );
      customDesc.set({rich: true, wrap: true, textColor: "#666666"});
      container.add(customDesc);

      var urlRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));

      var urlField = new qx.ui.form.TextField();
      urlField.setPlaceholder("https://... .jsdos 번들 URL");
      urlRow.add(urlField, {flex: 1});

      var urlButton = new qx.ui.form.Button("URL 실행");
      urlButton.addListener("execute", function() {
        var url = urlField.getValue();
        if (url && url.trim()) {
          this._startGame({title: "커스텀 번들", url: url.trim()});
        }
      }, this);
      urlRow.add(urlButton);

      var fileButton = new qx.ui.form.Button("파일 열기 (.jsdos)");
      fileButton.addListener("execute", this._openLocalBundle, this);
      urlRow.add(fileButton);

      container.add(urlRow);

      scroll.add(container);
      return scroll;
    },

    /**
     * 게임 카드 한 장
     */
    _createGameCard: function(game) {
      var card = new qx.ui.container.Composite(new qx.ui.layout.HBox(14));
      card.set({
        padding: 14,
        backgroundColor: "#F6F8FA",
        decorator: "main",
        cursor: "pointer"
      });

      // 아이콘 대용 - 장르 뱃지
      var badge = new qx.ui.basic.Label(game.genre);
      badge.set({
        backgroundColor: "#0054E3",
        textColor: "#FFFFFF",
        padding: [6, 10],
        alignY: "middle",
        font: "bold"
      });
      card.add(badge);

      var info = new qx.ui.container.Composite(new qx.ui.layout.VBox(4));
      var title = new qx.ui.basic.Label(game.title + " (" + game.year + ")");
      title.set({font: "bold", textColor: "#000000"});
      info.add(title);

      var desc = new qx.ui.basic.Label(game.desc);
      desc.set({wrap: true, textColor: "#555555"});
      info.add(desc);
      card.add(info, {flex: 1});

      var playButton = new qx.ui.form.Button("▶ 실행");
      playButton.set({alignY: "middle", minWidth: 80});
      card.add(playButton);

      var start = function() {
        this._startGame(game);
      };
      playButton.addListener("execute", start, this);
      card.addListener("dbltap", start, this);

      // 호버 효과
      card.addListener("mouseover", function() {
        card.setBackgroundColor("#E8F0FE");
      });
      card.addListener("mouseout", function() {
        card.setBackgroundColor("#F6F8FA");
      });

      return card;
    },

    /**
     * 에뮬레이터 화면
     */
    _createPlayerView: function() {
      var container = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      container.setBackgroundColor("#000000");

      this.__statusLabel = new qx.ui.basic.Label("");
      this.__statusLabel.set({
        textColor: "#FFFFFF",
        backgroundColor: "#000000",
        padding: 8,
        allowGrowX: true,
        textAlign: "center"
      });
      container.add(this.__statusLabel);

      this.__playerHtml = new qx.ui.embed.Html();
      this.__playerHtml.set({
        backgroundColor: "#000000",
        overflowX: "hidden",
        overflowY: "hidden"
      });
      container.add(this.__playerHtml, {flex: 1});

      return container;
    },

    /**
     * 게임의 번들 URL 결정 - 내장 리소스면 같은 오리진 URI로 변환
     */
    _resolveBundleUrl: function(game) {
      if (game.resource) {
        return qx.util.ResourceManager.getInstance().toUri(game.resource);
      }
      return game.url;
    },

    /**
     * 게임 시작 - js-dos 로드 후 번들 URL을 동적으로 받아 실행
     */
    _startGame: function(game) {
      // 이전 실행 정리
      this._stopGame();

      this.__stack.setSelection([this.__playerView]);
      this.__backButton.setEnabled(true);
      this.__titleLabel.setValue(game.title);
      this.__statusLabel.setValue("js-dos 로딩중...");
      this.__statusLabel.show();

      var self = this;
      var bundleUrl = this._resolveBundleUrl(game);

      deskweb.ui.DosPlayerWindow.loadJsDos().then(function() {
        // DOM 요소가 준비된 뒤 마운트
        var mount = function() {
          var element = self.__playerHtml.getContentElement().getDomElement();
          if (!element) {
            return;
          }

          self.__statusLabel.setValue("게임 번들 다운로드중... (" + game.title + ")");

          // js-dos 마운트용 div 생성
          var dosDiv = document.createElement("div");
          dosDiv.style.width = "100%";
          dosDiv.style.height = "100%";
          element.innerHTML = "";
          element.appendChild(dosDiv);

          try {
            self.__dosProps = Dos(dosDiv, {
              url: bundleUrl,
              autoStart: true,
              noCloud: true,
              onEvent: function(event) {
                if (event === "emu-ready") {
                  self.__statusLabel.exclude();
                }
              }
            });
            console.log("[DosPlayer] Started:", game.title, bundleUrl);
          } catch (e) {
            console.error("[DosPlayer] Failed to start:", e);
            self.__statusLabel.setValue("실행 실패: " + e.message);
          }
        };

        if (self.__playerHtml.getContentElement().getDomElement()) {
          mount();
        } else {
          self.__playerHtml.addListenerOnce("appear", mount);
        }
      }).catch(function(e) {
        console.error("[DosPlayer] js-dos load failed:", e);
        self.__statusLabel.setValue("js-dos 로드 실패 - 네트워크를 확인하세요");
      });
    },

    /**
     * 로컬 .jsdos 번들 파일 열기 (CORS 우회 실행 경로)
     */
    _openLocalBundle: function() {
      var self = this;
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".jsdos,.zip";
      input.onchange = function() {
        var file = input.files && input.files[0];
        if (!file) {
          return;
        }
        var blobUrl = URL.createObjectURL(file);
        self.__blobUrl = blobUrl;
        self._startGame({title: file.name, url: blobUrl});
      };
      input.click();
    },

    /**
     * 에뮬레이터 정지 및 리소스 정리
     */
    _stopGame: function() {
      if (this.__dosProps) {
        try {
          this.__dosProps.stop();
          console.log("[DosPlayer] Stopped emulator");
        } catch (e) {
          console.warn("[DosPlayer] Stop failed:", e);
        }
        this.__dosProps = null;
      }

      if (this.__blobUrl) {
        URL.revokeObjectURL(this.__blobUrl);
        this.__blobUrl = null;
      }

      if (this.__playerHtml) {
        var element = this.__playerHtml.getContentElement().getDomElement();
        if (element) {
          element.innerHTML = "";
        }
      }
    }
  }
});
