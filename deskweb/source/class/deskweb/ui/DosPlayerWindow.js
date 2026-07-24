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
      },
      {
        id: "wolf3d",
        title: "Wolfenstein 3D",
        year: "1992",
        genre: "FPS",
        desc: "FPS 장르의 원조. 나치 요새를 탈출하라.",
        resource: "deskweb/bundles/wolf3d.jsdos"
      },
      {
        id: "doom2",
        title: "DOOM II: Hell on Earth",
        year: "1994",
        genre: "FPS",
        desc: "지구를 침공한 지옥 군세와 싸우는 DOOM 후속작.",
        resource: "deskweb/bundles/doom2.jsdos"
      },
      {
        id: "duke3d",
        title: "Duke Nukem 3D",
        year: "1996",
        genre: "FPS",
        desc: "액션영화 한 편 같은 사이다 FPS. Duke의 대명사.",
        resource: "deskweb/bundles/duke3d.jsdos"
      },
      {
        id: "heretic",
        title: "Heretic",
        year: "1994",
        genre: "FPS",
        desc: "판타지 세계관의 DOOM. 마법 아이템 인벤토리 지원.",
        resource: "deskweb/bundles/heretic.jsdos"
      },
      {
        id: "keen4",
        title: "Commander Keen 4",
        year: "1991",
        genre: "플랫폼",
        desc: "id 소프트웨어의 대표 횡스크롤 플랫포머.",
        resource: "deskweb/bundles/keen4.jsdos"
      },
      {
        id: "dave",
        title: "Dangerous Dave: Haunted Mansion",
        year: "1991",
        genre: "플랫폼",
        desc: "샷건 하나로 유령 저택을 헤쳐가는 플랫포머.",
        resource: "deskweb/bundles/dave.jsdos"
      },
      {
        id: "jazz",
        title: "Jazz Jackrabbit",
        year: "1994",
        genre: "플랫폼",
        desc: "에픽게임즈의 초고속 토끼 액션 플랫포머.",
        resource: "deskweb/bundles/jazz.jsdos"
      },
      {
        id: "prehistorik2",
        title: "Prehistorik 2",
        year: "1993",
        genre: "플랫폼",
        desc: "원시인 몽둥이 액션. 국내 오락실 세대의 추억.",
        resource: "deskweb/bundles/prehistorik2.jsdos"
      },
      {
        id: "aladdin",
        title: "Disney's Aladdin",
        year: "1993",
        genre: "플랫폼",
        desc: "디즈니 애니메이션 그대로 움직이는 명작 플랫포머.",
        resource: "deskweb/bundles/aladdin.jsdos"
      },
      {
        id: "lionking",
        title: "The Lion King",
        year: "1994",
        genre: "플랫폼",
        desc: "심바의 성장기를 그린 디즈니 플랫포머.",
        resource: "deskweb/bundles/lionking.jsdos"
      },
      {
        id: "earthwormjim",
        title: "Earthworm Jim",
        year: "1994",
        genre: "플랫폼",
        desc: "우주복 입은 지렁이의 엽기 액션 플랫포머.",
        resource: "deskweb/bundles/earthwormjim.jsdos"
      },
      {
        id: "lostvikings",
        title: "The Lost Vikings",
        year: "1993",
        genre: "퍼즐플랫폼",
        desc: "바이킹 3인의 능력을 조합해 퍼즐을 푸는 블리자드 초기작.",
        resource: "deskweb/bundles/lostvikings.jsdos"
      },
      {
        id: "flashback",
        title: "Flashback",
        year: "1992",
        genre: "액션어드벤처",
        desc: "로토스코핑 애니메이션의 시네마틱 플랫포머.",
        resource: "deskweb/bundles/flashback.jsdos"
      },
      {
        id: "goldenaxe",
        title: "Golden Axe",
        year: "1989",
        genre: "벨트스크롤",
        desc: "세가의 판타지 벨트스크롤 액션.",
        resource: "deskweb/bundles/goldenaxe.jsdos"
      },
      {
        id: "mk1",
        title: "Mortal Kombat",
        year: "1993",
        genre: "격투",
        desc: "페이탈리티의 원조 대전격투.",
        resource: "deskweb/bundles/mk1.jsdos"
      },
      {
        id: "sf2",
        title: "Street Fighter II",
        year: "1994",
        genre: "격투",
        desc: "대전격투의 교과서. 류/켄과 함께.",
        resource: "deskweb/bundles/sf2.jsdos"
      },
      {
        id: "omf2097",
        title: "One Must Fall 2097",
        year: "1994",
        genre: "격투",
        desc: "로봇 대전격투의 명작. 셰어웨어 시절 인기작.",
        resource: "deskweb/bundles/omf2097.jsdos"
      },
      {
        id: "civ1",
        title: "Civilization",
        year: "1991",
        genre: "턴제전략",
        desc: "시드 마이어의 문명 1편. '한 턴만 더'의 시작.",
        resource: "deskweb/bundles/civ1.jsdos"
      },
      {
        id: "dune2",
        title: "Dune II",
        year: "1992",
        genre: "RTS",
        desc: "실시간 전략 장르의 문법을 만든 게임.",
        resource: "deskweb/bundles/dune2.jsdos"
      },
      {
        id: "simcity2000",
        title: "SimCity 2000",
        year: "1993",
        genre: "시뮬레이션",
        desc: "도시 건설 시뮬레이션의 완성형.",
        resource: "deskweb/bundles/simcity2000.jsdos"
      },
      {
        id: "xcom1",
        title: "X-COM: UFO Defense",
        year: "1994",
        genre: "턴제전략",
        desc: "외계인 침공에 맞서는 턴제 전술의 전설.",
        resource: "deskweb/bundles/xcom1.jsdos"
      },
      {
        id: "cannonfodder",
        title: "Cannon Fodder",
        year: "1993",
        genre: "액션전략",
        desc: "마우스로 분대를 지휘하는 블랙코미디 전쟁 액션.",
        resource: "deskweb/bundles/cannonfodder.jsdos"
      },
      {
        id: "battlechess",
        title: "Battle Chess",
        year: "1988",
        genre: "보드",
        desc: "말들이 실제로 싸우는 애니메이션 체스.",
        resource: "deskweb/bundles/battlechess.jsdos"
      },
      {
        id: "scorched",
        title: "Scorched Earth",
        year: "1991",
        genre: "포격전략",
        desc: "탱크 포격 대전의 원조. 웜즈의 조상님.",
        resource: "deskweb/bundles/scorched.jsdos"
      },
      {
        id: "oregontrail",
        title: "The Oregon Trail Deluxe",
        year: "1992",
        genre: "시뮬레이션",
        desc: "서부 개척 생존 시뮬레이션의 고전.",
        resource: "deskweb/bundles/oregontrail.jsdos"
      },
      {
        id: "monkeyisland",
        title: "The Secret of Monkey Island",
        year: "1990",
        genre: "어드벤처",
        desc: "루카스아츠 포인트앤클릭 어드벤처의 정점.",
        resource: "deskweb/bundles/monkeyisland.jsdos"
      },
      {
        id: "nfs",
        title: "The Need for Speed",
        year: "1994",
        genre: "레이싱",
        desc: "니드포스피드 시리즈의 1편. (용량 큼: 46MB)",
        resource: "deskweb/bundles/nfs.jsdos"
      },
      {
        id: "deathrally",
        title: "Death Rally",
        year: "1996",
        genre: "레이싱",
        desc: "무기 달린 탑뷰 레이싱. 레메디 데뷔작. (용량 큼: 41MB)",
        resource: "deskweb/bundles/deathrally.jsdos"
      },
      {
        id: "stunts",
        title: "Stunts",
        year: "1990",
        genre: "레이싱",
        desc: "루프/점프 곡예 트랙의 3D 레이싱.",
        resource: "deskweb/bundles/stunts.jsdos"
      },
      {
        id: "skyroads",
        title: "SkyRoads",
        year: "1993",
        genre: "레이싱",
        desc: "우주 활주로를 달리는 점프 액션 레이싱.",
        resource: "deskweb/bundles/skyroads.jsdos"
      },
      {
        id: "wackywheels",
        title: "Wacky Wheels",
        year: "1994",
        genre: "레이싱",
        desc: "동물 친구들의 카트 레이싱. 마리오카트 스타일.",
        resource: "deskweb/bundles/wackywheels.jsdos"
      },
      {
        id: "tyrian2000",
        title: "Tyrian 2000",
        year: "1999",
        genre: "슈팅",
        desc: "종스크롤 슈팅의 명작. 공식 프리웨어.",
        resource: "deskweb/bundles/tyrian2000.jsdos"
      },
      {
        id: "supaplex",
        title: "Supaplex",
        year: "1991",
        genre: "퍼즐",
        desc: "볼더대시 계열 두뇌 퍼즐. 111개 레벨.",
        resource: "deskweb/bundles/supaplex.jsdos"
      },
      {
        id: "bomberman",
        title: "Dyna Blaster (Bomberman)",
        year: "1992",
        genre: "아케이드",
        desc: "봄버맨의 PC판. 폭탄으로 길을 뚫어라.",
        resource: "deskweb/bundles/bomberman.jsdos"
      },
      {
        id: "arkanoid",
        title: "Arkanoid",
        year: "1987",
        genre: "아케이드",
        desc: "벽돌깨기의 대명사.",
        resource: "deskweb/bundles/arkanoid.jsdos"
      },
      {
        id: "tetris",
        title: "Tetris Classic",
        year: "1992",
        genre: "퍼즐",
        desc: "스펙트럼 홀로바이트의 정식 테트리스.",
        resource: "deskweb/bundles/tetris.jsdos"
      },
      {
        id: "epicpinball",
        title: "Epic Pinball",
        year: "1993",
        genre: "핀볼",
        desc: "에픽게임즈의 명작 핀볼.",
        resource: "deskweb/bundles/epicpinball.jsdos"
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
    __gameCards: null,
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
        "게임 번들은 실행 시 동적으로 내려받습니다. 최초 실행 시 다운로드에 잠시 시간이 걸립니다."
      );
      subHeader.set({rich: true, wrap: true, textColor: "#666666"});
      container.add(subHeader);

      // 검색 필터
      var searchRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
      var searchField = new qx.ui.form.TextField();
      searchField.setPlaceholder("게임 이름/장르 검색... (예: FPS, 레이싱, doom)");
      searchRow.add(searchField, {flex: 1});

      var countLabel = new qx.ui.basic.Label(
        deskweb.ui.DosPlayerWindow.GAMES.length + "개"
      );
      countLabel.set({alignY: "middle", textColor: "#666666"});
      searchRow.add(countLabel);
      container.add(searchRow);

      // 큐레이션 게임 카드
      this.__gameCards = [];
      deskweb.ui.DosPlayerWindow.GAMES.forEach(function(game) {
        var card = this._createGameCard(game);
        this.__gameCards.push({card: card, game: game});
        container.add(card);
      }, this);

      // 검색어 입력 시 카드 필터링
      searchField.addListener("input", function(e) {
        var query = (e.getData() || "").toLowerCase().trim();
        var visible = 0;
        this.__gameCards.forEach(function(entry) {
          var text = (entry.game.title + " " + entry.game.genre + " " + entry.game.year).toLowerCase();
          var match = !query || text.indexOf(query) !== -1;
          entry.card.setVisibility(match ? "visible" : "excluded");
          if (match) {
            visible++;
          }
        });
        countLabel.setValue(visible + "개");
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
