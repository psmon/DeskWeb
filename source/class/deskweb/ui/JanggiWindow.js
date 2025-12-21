/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Korean Chess (Janggi) Game Window
 *
 * Windows-style Janggi game with Three.js 3D rendering and AI opponent.
 * Features:
 * - 3D board and piece rendering
 * - AI opponent using LLM
 * - Game replay/analysis
 * - Camera controls
 */
qx.Class.define("deskweb.ui.JanggiWindow",
{
  extend : qx.ui.window.Window,

  construct : function()
  {
    this.base(arguments, "Korean Chess (Janggi)");

    console.log("[JanggiWindow] Initializing...");

    // Generate unique session ID for this window instance
    this.__sessionId = "janggi-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

    this.set({
      width: 750,
      height: 700,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0,
      resizable: true,
      icon: "deskweb/images/janggi.svg"
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Initialize game logic with session ID
    this.__game = new deskweb.game.JanggiGame(this.__sessionId);
    this.__setupGameListeners();

    // Create UI components
    this.__createToolbar();
    this.__createMainContent();
    this.__createStatusBar();

    // Handle window events
    this.addListener("appear", this.__onAppear, this);
    this.addListener("resize", this.__onResize, this);
    this.addListener("close", this.__onClose, this);

    console.log("[JanggiWindow] Initialized successfully with session:", this.__sessionId);
  },

  members :
  {
    __sessionId: null,
    __game: null,
    __toolbar: null,
    __gameContainer: null,
    __canvasContainer: null,
    __sidePanel: null,
    __statusBar: null,
    __statusLabel: null,
    __turnLabel: null,
    __capturedChoLabel: null,
    __capturedHanLabel: null,
    __historyList: null,
    __is3DInitialized: false,
    __cameraSlider: null,
    __analysisWindow: null,
    __aiChatContainer: null,
    __aiChatScroll: null,
    __aiChatList: null,
    __checkEffectLabel: null,
    __helpWindow: null,

    /**
     * Setup game event listeners
     */
    __setupGameListeners: function() {
      this.__game.addListener("gameStateChange", this.__onGameStateChange, this);
      this.__game.addListener("pieceSelected", this.__onPieceSelected, this);
      this.__game.addListener("moveMade", this.__onMoveMade, this);
      this.__game.addListener("gameOver", this.__onGameOver, this);
      this.__game.addListener("aiThinking", this.__onAIThinking, this);
      this.__game.addListener("checkOccurred", this.__onCheckOccurred, this);
      this.__game.addListener("aiMessage", this.__onAIMessage, this);
    },

    /**
     * Create toolbar
     */
    __createToolbar: function() {
      this.__toolbar = new qx.ui.toolbar.ToolBar();
      this.__toolbar.setBackgroundColor("#4a3728");

      // New Game button
      var newGameBtn = new qx.ui.toolbar.Button("New Game", "deskweb/images/play.svg");
      newGameBtn.addListener("execute", this.__onNewGame, this);

      // Analysis button
      var analysisBtn = new qx.ui.toolbar.Button("Analysis", "deskweb/images/settings.svg");
      analysisBtn.addListener("execute", this.__onAnalysis, this);

      // Settings button
      var settingsBtn = new qx.ui.toolbar.Button("Settings", "deskweb/images/settings.svg");
      settingsBtn.addListener("execute", this.__onSettings, this);

      // Help button
      var helpBtn = new qx.ui.toolbar.Button("Help", "deskweb/images/help.svg");
      helpBtn.addListener("execute", this.__onHelp, this);

      this.__toolbar.add(newGameBtn);
      this.__toolbar.add(analysisBtn);
      this.__toolbar.addSpacer();
      this.__toolbar.add(helpBtn);
      this.__toolbar.add(settingsBtn);

      this.add(this.__toolbar);
    },

    /**
     * Create main game content area
     */
    __createMainContent: function() {
      var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      mainContainer.set({
        backgroundColor: "#2d1810",
        padding: 10
      });

      this.__gameContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));

      // 3D Canvas container
      this.__canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      this.__canvasContainer.set({
        width: 500,
        height: 520,
        backgroundColor: "#1a0f08"
      });

      // Side panel
      this.__sidePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.__sidePanel.set({
        width: 200,
        backgroundColor: "#3d2a1f",
        padding: 15
      });

      this.__createSidePanelContent();

      this.__gameContainer.add(this.__canvasContainer, {flex: 1});
      this.__gameContainer.add(this.__sidePanel);

      // Camera rotation slider
      var cameraContainer = this.__createCameraSlider();

      mainContainer.add(this.__gameContainer, {flex: 1});
      mainContainer.add(cameraContainer);

      this.add(mainContainer, {flex: 1});
    },

    /**
     * Create camera rotation slider
     */
    __createCameraSlider: function() {
      var container = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      container.set({
        height: 35,
        backgroundColor: "#3d2a1f",
        padding: [5, 15],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var leftLabel = new qx.ui.basic.Label("Left");
      leftLabel.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("11px Arial"),
        alignY: "middle"
      });

      this.__cameraSlider = new qx.ui.form.Slider();
      this.__cameraSlider.set({
        minimum: -100,
        maximum: 100,
        singleStep: 5,
        value: 0,
        decorator: new qx.ui.decoration.Decorator().set({
          backgroundColor: "#5a3d2a",
          radius: 3
        })
      });
      this.__cameraSlider.addListener("changeValue", function(e) {
        var value = e.getData() / 100;
        this.__game.setCameraAngleY(value);
      }, this);

      var rightLabel = new qx.ui.basic.Label("Right");
      rightLabel.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("11px Arial"),
        alignY: "middle"
      });

      var cameraLabel = new qx.ui.basic.Label("Camera Rotation");
      cameraLabel.set({
        textColor: "#d4a574",
        font: qx.bom.Font.fromString("bold 11px Arial"),
        alignY: "middle"
      });

      container.add(cameraLabel);
      container.add(leftLabel);
      container.add(this.__cameraSlider, {flex: 1});
      container.add(rightLabel);

      return container;
    },

    /**
     * Create side panel content
     */
    __createSidePanelContent: function() {
      // Turn indicator
      var turnContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      turnContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5,
          width: 2,
          color: "#d4a574"
        })
      });

      var turnTitle = new qx.ui.basic.Label("TURN");
      turnTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__turnLabel = new qx.ui.basic.Label("Cho (Red)");
      this.__turnLabel.set({
        textColor: "#ff6b6b",
        font: qx.bom.Font.fromString("bold 18px Arial"),
        textAlign: "center"
      });

      turnContainer.add(turnTitle);
      turnContainer.add(this.__turnLabel);

      // Captured pieces - Cho
      var capturedChoContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      capturedChoContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var capturedChoTitle = new qx.ui.basic.Label("Cho Captured");
      capturedChoTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__capturedChoLabel = new qx.ui.basic.Label("-");
      this.__capturedChoLabel.set({
        textColor: "#ff6b6b",
        font: qx.bom.Font.fromString("14px serif"),
        rich: true
      });

      capturedChoContainer.add(capturedChoTitle);
      capturedChoContainer.add(this.__capturedChoLabel);

      // Captured pieces - Han
      var capturedHanContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      capturedHanContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var capturedHanTitle = new qx.ui.basic.Label("Han Captured");
      capturedHanTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__capturedHanLabel = new qx.ui.basic.Label("-");
      this.__capturedHanLabel.set({
        textColor: "#6b9eff",
        font: qx.bom.Font.fromString("14px serif"),
        rich: true
      });

      capturedHanContainer.add(capturedHanTitle);
      capturedHanContainer.add(this.__capturedHanLabel);

      // Move history
      var historyContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      historyContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var historyTitle = new qx.ui.basic.Label("MOVE HISTORY");
      historyTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__historyList = new qx.ui.form.List();
      this.__historyList.set({
        height: 150,
        backgroundColor: "#3d2a1f",
        textColor: "#c4a882"
      });

      historyContainer.add(historyTitle);
      historyContainer.add(this.__historyList, {flex: 1});

      // AI Chat container
      this.__aiChatContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      this.__aiChatContainer.set({
        backgroundColor: "#4a3d35",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5,
          width: 2,
          color: "#6b9eff"
        })
      });

      var aiChatTitle = new qx.ui.basic.Label("🤖 AI 생각");
      aiChatTitle.set({
        textColor: "#6b9eff",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      // Scroll container for AI chat
      this.__aiChatScroll = new qx.ui.container.Scroll();
      this.__aiChatScroll.set({
        height: 100,
        backgroundColor: "#3d2a1f"
      });

      this.__aiChatList = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      this.__aiChatList.set({
        backgroundColor: "#3d2a1f",
        padding: 5
      });

      this.__aiChatScroll.add(this.__aiChatList);

      // Add initial message
      this.__addAIChatMessage("안녕하세요! 저는 AI입니다. 좋은 대국 하겠습니다.", "greeting");

      this.__aiChatContainer.add(aiChatTitle);
      this.__aiChatContainer.add(this.__aiChatScroll, {flex: 1});

      // Check effect label (hidden by default)
      this.__checkEffectLabel = new qx.ui.basic.Label("⚡ 장군이요! ⚡");
      this.__checkEffectLabel.set({
        textColor: "#ff4444",
        font: qx.bom.Font.fromString("bold 16px Arial"),
        textAlign: "center",
        backgroundColor: "#ffeeee",
        padding: [8, 15],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 8,
          width: 3,
          color: "#ff0000"
        }),
        visibility: "hidden"
      });

      // Controls info
      var controlsContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      controlsContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var controlsTitle = new qx.ui.basic.Label("조작법");
      controlsTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      var controls = [
        "말 클릭 → 선택",
        "초록색 → 이동 가능",
        "빨간색 → 잡기 가능",
        "당신은 초(아래) 입니다"
      ];

      controlsContainer.add(controlsTitle);
      controls.forEach(function(text) {
        var label = new qx.ui.basic.Label(text);
        label.set({
          textColor: "#a08060",
          font: qx.bom.Font.fromString("10px Arial")
        });
        controlsContainer.add(label);
      });

      // Add all containers
      this.__sidePanel.add(turnContainer);
      this.__sidePanel.add(this.__checkEffectLabel);
      this.__sidePanel.add(capturedChoContainer);
      this.__sidePanel.add(capturedHanContainer);
      this.__sidePanel.add(this.__aiChatContainer, {flex: 1});
      this.__sidePanel.add(historyContainer);
      this.__sidePanel.add(controlsContainer);
    },

    /**
     * Add a message to AI chat
     */
    __addAIChatMessage: function(message, type) {
      var msgLabel = new qx.ui.basic.Label(message);
      var color = "#c4a882";

      if (type === "tactical") {
        color = "#90EE90"; // Light green for tactical
      } else if (type === "comment") {
        color = "#87CEEB"; // Light blue for comments
      } else if (type === "warning") {
        color = "#FFB6C1"; // Light pink for warnings
      } else if (type === "greeting") {
        color = "#DDA0DD"; // Plum for greetings
      }

      msgLabel.set({
        textColor: color,
        font: qx.bom.Font.fromString("11px Arial"),
        rich: true,
        wrap: true
      });

      // Keep only last 10 messages
      var children = this.__aiChatList.getChildren();
      if (children.length >= 10) {
        this.__aiChatList.removeAt(0);
      }

      this.__aiChatList.add(msgLabel);

      // Scroll to bottom
      var self = this;
      setTimeout(function() {
        if (self.__aiChatScroll && !self.__aiChatScroll.isDisposed()) {
          self.__aiChatScroll.scrollToY(10000);
        }
      }, 50);
    },

    /**
     * Create status bar
     */
    __createStatusBar: function() {
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.set({
        height: 25,
        backgroundColor: "#4a3728",
        padding: [5, 10]
      });

      this.__statusLabel = new qx.ui.basic.Label("Click New Game to start");
      this.__statusLabel.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("12px Arial")
      });

      this.__statusBar.add(this.__statusLabel);
      this.__statusBar.add(new qx.ui.core.Spacer(), {flex: 1});

      this.add(this.__statusBar);
    },

    /**
     * Initialize 3D rendering when window appears
     */
    __onAppear: function() {
      if (this.__is3DInitialized) return;

      console.log("[JanggiWindow] Window appeared, initializing 3D...");

      qx.event.Timer.once(function() {
        this.__init3DRenderer();
      }, this, 100);
    },

    /**
     * Initialize the 3D renderer
     */
    __init3DRenderer: function() {
      var containerEl = this.__canvasContainer.getContentElement().getDomElement();
      if (!containerEl) {
        console.warn("[JanggiWindow] Container DOM element not ready");
        return;
      }

      var bounds = this.__canvasContainer.getBounds();
      if (!bounds) {
        console.warn("[JanggiWindow] Container bounds not ready");
        return;
      }

      var width = bounds.width || 500;
      var height = bounds.height || 520;

      console.log("[JanggiWindow] Initializing 3D renderer with size:", width, "x", height);

      var success = this.__game.init3D(containerEl, width, height);
      if (success) {
        this.__is3DInitialized = true;
        this.__setupClickHandler(containerEl);
        console.log("[JanggiWindow] 3D renderer initialized successfully");
      } else {
        console.error("[JanggiWindow] Failed to initialize 3D renderer");
      }
    },

    /**
     * Setup click handler for the canvas
     */
    __setupClickHandler: function(containerEl) {
      var self = this;

      containerEl.addEventListener('click', function(e) {
        var rect = containerEl.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        var boardPos = self.__game.screenToBoard(x, y, rect.width, rect.height);
        if (boardPos) {
          self.__game.handleClick(boardPos.row, boardPos.col);
        }
      });

      console.log("[JanggiWindow] Click handler setup");
    },

    /**
     * Handle window resize
     */
    __onResize: function() {
      if (!this.__is3DInitialized) return;

      var bounds = this.__canvasContainer.getBounds();
      if (bounds) {
        this.__game.resize(bounds.width, bounds.height);
      }
    },

    /**
     * Handle window close
     */
    __onClose: function() {
      console.log("[JanggiWindow] Window closing");
    },

    /**
     * Handle new game button
     */
    __onNewGame: function() {
      console.log("[JanggiWindow] Starting new game");

      if (!this.__is3DInitialized) {
        this.__init3DRenderer();
      }

      this.__game.newGame();
      this.__historyList.removeAll();
      this.__capturedChoLabel.setValue("-");
      this.__capturedHanLabel.setValue("-");
      this.__statusLabel.setValue("Game started. Your turn (Cho/Red).");
    },

    /**
     * Handle analysis button
     */
    __onAnalysis: function() {
      var analysis = this.__game.getGameAnalysis();

      if (analysis.moves.length === 0) {
        alert("No moves to analyze. Play some moves first.");
        return;
      }

      this.__showAnalysisWindow(analysis);
    },

    /**
     * Show analysis window
     */
    __showAnalysisWindow: function(analysis) {
      if (this.__analysisWindow && !this.__analysisWindow.isDisposed()) {
        this.__analysisWindow.close();
      }

      var win = new qx.ui.window.Window("Game Analysis");
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 400,
        height: 500,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        contentPadding: 20
      });

      // Summary
      var summaryLabel = new qx.ui.basic.Label(
        "Total Moves: " + analysis.totalMoves + "\n" +
        (analysis.winner ? "Winner: " + (analysis.winner === "cho" ? "Cho (Red)" : "Han (Blue)") : "Game in progress")
      );
      summaryLabel.set({ rich: true, textColor: "#333" });
      win.add(summaryLabel);

      // Move list
      var moveList = new qx.ui.form.List();
      moveList.set({ height: 300 });

      analysis.moves.forEach(function(move, index) {
        var pieceData = deskweb.game.JanggiGame.PIECES[move.piece.type];
        var text = (index + 1) + ". " + (move.piece.team === "cho" ? "Cho" : "Han") + " " +
                   pieceData.name + ": (" + move.from.row + "," + move.from.col + ") -> (" +
                   move.to.row + "," + move.to.col + ")";
        if (move.captured) {
          text += " [Captured " + deskweb.game.JanggiGame.PIECES[move.captured.type].name + "]";
        }
        moveList.add(new qx.ui.form.ListItem(text));
      });

      win.add(moveList, {flex: 1});

      // Close button
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.addListener("execute", function() {
        win.close();
      });
      win.add(closeBtn);

      var app = qx.core.Init.getApplication();
      app.getRoot().add(win, {left: 100, top: 100});
      win.center();
      win.open();

      this.__analysisWindow = win;
    },

    /**
     * Handle settings button
     */
    __onSettings: function() {
      var self = this;
      var win = new qx.ui.window.Window("Janggi Settings");
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 450,
        height: 550,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        contentPadding: 15
      });

      // Camera settings
      var cameraGroup = new qx.ui.groupbox.GroupBox("Camera");
      cameraGroup.setLayout(new qx.ui.layout.VBox(10));

      // Zoom slider
      var zoomContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      var zoomLabel = new qx.ui.basic.Label("Zoom:");
      zoomLabel.set({ width: 80 });
      var zoomSlider = new qx.ui.form.Slider();
      zoomSlider.set({
        minimum: 8,
        maximum: 30,
        singleStep: 1,
        value: Math.round(this.__game.getCameraDistance())
      });
      zoomSlider.addListener("changeValue", function(e) {
        this.__game.setCameraDistance(e.getData());
      }, this);
      zoomContainer.add(zoomLabel);
      zoomContainer.add(zoomSlider, {flex: 1});

      // Tilt slider
      var tiltContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      var tiltLabel = new qx.ui.basic.Label("Tilt:");
      tiltLabel.set({ width: 80 });
      var tiltSlider = new qx.ui.form.Slider();
      tiltSlider.set({
        minimum: 30,
        maximum: 140,
        singleStep: 5,
        value: Math.round(this.__game.getCameraAngleX() * 100)
      });
      tiltSlider.addListener("changeValue", function(e) {
        this.__game.setCameraAngleX(e.getData() / 100);
      }, this);
      tiltContainer.add(tiltLabel);
      tiltContainer.add(tiltSlider, {flex: 1});

      // Reset camera
      var resetCameraBtn = new qx.ui.form.Button("Reset Camera");
      resetCameraBtn.addListener("execute", function() {
        this.__game.setCameraDistance(15);
        this.__game.setCameraAngleX(0.8);
        this.__game.setCameraAngleY(0);
        zoomSlider.setValue(15);
        tiltSlider.setValue(80);
        this.__cameraSlider.setValue(0);
      }, this);

      cameraGroup.add(zoomContainer);
      cameraGroup.add(tiltContainer);
      cameraGroup.add(resetCameraBtn);

      // AI Strategy Settings
      var strategyGroup = new qx.ui.groupbox.GroupBox("AI 전략 설정");
      strategyGroup.setLayout(new qx.ui.layout.VBox(8));

      // Load current strategy
      var strategy = deskweb.game.JanggiAI.loadStrategy();

      // Strategy button to open detailed editor
      var strategyBtn = new qx.ui.form.Button("전략 프롬프트 편집");
      strategyBtn.addListener("execute", function() {
        self.__openStrategyEditor();
      });

      var strategyInfo = new qx.ui.basic.Label(
        "AI의 전략 지침을 수정할 수 있습니다.\n" +
        "초반/중반/종반 전략과 성격을 커스터마이징하세요."
      );
      strategyInfo.set({
        rich: true,
        textColor: "#888",
        font: qx.bom.Font.fromString("11px Arial")
      });

      strategyGroup.add(strategyInfo);
      strategyGroup.add(strategyBtn);

      // Game info
      var infoGroup = new qx.ui.groupbox.GroupBox("Game Info");
      infoGroup.setLayout(new qx.ui.layout.VBox(5));

      var infoLabel = new qx.ui.basic.Label(
        "Korean Chess (Janggi) Rules:\n\n" +
        "- You play as Cho (Red)\n" +
        "- AI plays as Han (Blue)\n" +
        "- Capture the enemy King to win\n" +
        "- Each piece has unique moves\n\n" +
        "Piece Names:\n" +
        "- 궁(楚/漢): King\n" +
        "- 차(車): Car/Rook\n" +
        "- 포(砲): Cannon\n" +
        "- 마(馬): Horse\n" +
        "- 상(象): Elephant\n" +
        "- 사(士): Guard\n" +
        "- 졸/병: Soldier"
      );
      infoLabel.set({
        rich: true,
        textColor: "#666",
        font: qx.bom.Font.fromString("11px Arial")
      });
      infoGroup.add(infoLabel);

      // Close button
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.addListener("execute", function() {
        win.close();
      });

      win.add(cameraGroup);
      win.add(strategyGroup);
      win.add(infoGroup, {flex: 1});
      win.add(closeBtn);

      var app = qx.core.Init.getApplication();
      app.getRoot().add(win, {left: 100, top: 100});
      win.center();
      win.open();
    },

    /**
     * Handle game state change
     */
    __onGameStateChange: function() {
      var state = this.__game.getGameState();
      var currentPlayer = this.__game.getCurrentPlayer();

      if (currentPlayer === "cho") {
        this.__turnLabel.setValue("Cho (Red)");
        this.__turnLabel.setTextColor("#ff6b6b");
      } else {
        this.__turnLabel.setValue("Han (Blue)");
        this.__turnLabel.setTextColor("#6b9eff");
      }

      console.log("[JanggiWindow] Game state changed:", state, "Current player:", currentPlayer);
    },

    /**
     * Handle piece selected
     */
    __onPieceSelected: function(e) {
      var data = e.getData();
      var pieceData = deskweb.game.JanggiGame.PIECES[data.piece.type];
      this.__statusLabel.setValue(
        "Selected: " + pieceData.name + " - " + data.validMoves.length + " valid moves"
      );
    },

    /**
     * Handle move made
     */
    __onMoveMade: function(e) {
      var data = e.getData();
      var pieceData = deskweb.game.JanggiGame.PIECES[data.piece.type];

      // Add to history list
      var history = this.__game.getMoveHistory();
      var moveNum = history.length;
      var text = moveNum + ". " + (data.piece.team === "cho" ? "Cho" : "Han") + " " +
                 pieceData.name + " (" + data.from.row + "," + data.from.col + ") -> (" +
                 data.to.row + "," + data.to.col + ")";

      this.__historyList.add(new qx.ui.form.ListItem(text));

      // Scroll to bottom
      this.__historyList.scrollChildIntoView(
        this.__historyList.getChildren()[this.__historyList.getChildren().length - 1]
      );

      // Update captured pieces display
      this.__updateCapturedDisplay();

      this.__statusLabel.setValue(
        data.piece.team === "cho" ? "AI is thinking..." : "Your turn (Cho/Red)"
      );
    },

    /**
     * Update captured pieces display
     */
    __updateCapturedDisplay: function() {
      var captured = this.__game.getCapturedPieces();

      // Cho captured (pieces Han lost)
      if (captured.cho.length > 0) {
        var choText = captured.cho.map(function(p) {
          return deskweb.game.JanggiGame.PIECES[p.type].name;
        }).join(" ");
        this.__capturedChoLabel.setValue(choText);
      } else {
        this.__capturedChoLabel.setValue("-");
      }

      // Han captured (pieces Cho lost)
      if (captured.han.length > 0) {
        var hanText = captured.han.map(function(p) {
          return deskweb.game.JanggiGame.PIECES[p.type].name;
        }).join(" ");
        this.__capturedHanLabel.setValue(hanText);
      } else {
        this.__capturedHanLabel.setValue("-");
      }
    },

    /**
     * Handle game over
     */
    __onGameOver: function(e) {
      var data = e.getData();
      var winner = data.winner === "cho" ? "Cho (Red)" : "Han (Blue)";

      console.log("[JanggiWindow] Game over! Winner:", winner);

      setTimeout(function() {
        alert("Game Over!\n\nWinner: " + winner + "\n\nClick 'New Game' to play again.");
      }, 500);

      this.__statusLabel.setValue("Game Over! Winner: " + winner);
    },

    /**
     * Handle AI thinking state
     */
    __onAIThinking: function(e) {
      var data = e.getData();
      if (data.thinking) {
        this.__statusLabel.setValue("AI is thinking...");
        this.__turnLabel.setValue("Han (Thinking...)");
        this.__addAIChatMessage("음... 생각 중입니다...", "tactical");
      }
    },

    /**
     * Handle check occurred
     */
    __onCheckOccurred: function(e) {
      var self = this;
      var data = e.getData();

      console.log("[JanggiWindow] Check occurred! Checker:", data.checker);

      // Show check effect
      this.__checkEffectLabel.setVisibility("visible");

      // Add AI message about check
      if (data.checker === "han") {
        this.__addAIChatMessage("⚡ 장군이요! 왕을 피하세요!", "warning");
      } else {
        this.__addAIChatMessage("앗! 장군이네요. 피해야겠습니다.", "warning");
      }

      // Hide after 2 seconds
      setTimeout(function() {
        if (self.__checkEffectLabel && !self.__checkEffectLabel.isDisposed()) {
          self.__checkEffectLabel.setVisibility("hidden");
        }
      }, 2000);
    },

    /**
     * Handle AI message
     */
    __onAIMessage: function(e) {
      var data = e.getData();

      // Show tactical reasoning
      if (data.tactical) {
        this.__addAIChatMessage("💡 " + data.tactical, "tactical");
      }

      // Show comment/taunt
      if (data.comment) {
        this.__addAIChatMessage("💬 " + data.comment, "comment");
      }
    },

    /**
     * Handle Help button click
     */
    __onHelp: function() {
      if (this.__helpWindow && !this.__helpWindow.isDisposed()) {
        this.__helpWindow.open();
        return;
      }

      var win = new qx.ui.window.Window("장기 게임 도움말");
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 450,
        height: 550,
        showMinimize: false,
        showMaximize: false,
        contentPadding: 15
      });

      this.__helpWindow = win;

      var scroll = new qx.ui.container.Scroll();
      var content = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      content.setPadding(10);

      var helpText = `
<h3 style="color:#d4a574;">🎯 게임 목표</h3>
<p>상대방의 <b>왕(장)</b>을 잡아 승리하세요!</p>
<p>상대 왕을 공격할 수 있는 상황을 <b>"장군"</b>이라고 합니다.</p>
<p>왕이 어디로 피해도 장군인 상태를 <b>"외통수(체크메이트)"</b>라고 하며 게임이 끝납니다.</p>

<h3 style="color:#d4a574;">♟️ 장기말 이동 규칙</h3>
<table style="font-size:11px; color:#c4a882;">
<tr><td><b>왕(장)</b></td><td>궁 안에서만 상하좌우 + 대각선 1칸</td></tr>
<tr><td><b>차</b></td><td>상하좌우로 거리 제한 없이 직선 이동</td></tr>
<tr><td><b>포</b></td><td>다른 말 하나를 뛰어넘어 이동/잡기 (포는 포를 못 넘음)</td></tr>
<tr><td><b>마</b></td><td>직선 1칸 + 대각선 1칸 (중간에 말 있으면 불가)</td></tr>
<tr><td><b>상</b></td><td>직선 1칸 + 대각선 2칸 (중간에 말 있으면 불가)</td></tr>
<tr><td><b>사</b></td><td>궁 안에서만 상하좌우 + 대각선 1칸</td></tr>
<tr><td><b>졸/병</b></td><td>앞으로 또는 좌우로 1칸</td></tr>
</table>

<h3 style="color:#d4a574;">🏯 궁(Palace)</h3>
<p>각 진영의 3x3 영역입니다. 왕과 사는 궁 안에서만 이동할 수 있습니다.</p>
<p>궁 안에서는 대각선 이동도 가능합니다.</p>

<h3 style="color:#d4a574;">🎮 조작법</h3>
<ul style="color:#c4a882; font-size:11px;">
<li>말을 <b>클릭</b>하면 선택됩니다</li>
<li><b>초록색</b> 표시 = 이동 가능한 위치</li>
<li><b>빨간색</b> 표시 = 상대 말을 잡을 수 있는 위치</li>
<li>선택된 말을 다시 클릭하면 선택 해제</li>
<li>아래쪽 슬라이더로 <b>카메라 회전</b> 가능</li>
</ul>

<h3 style="color:#d4a574;">🤖 AI 상대</h3>
<p>AI는 <b>한(파란색)</b>으로 플레이합니다.</p>
<p>당신은 <b>초(빨간색)</b>입니다. 먼저 시작하세요!</p>
<p>AI는 LLM(대형언어모델)을 사용하여 수를 선택합니다.</p>

<h3 style="color:#d4a574;">💡 전략 팁</h3>
<ul style="color:#c4a882; font-size:11px;">
<li>초반: 마, 상을 활성화하고 포 자리를 잡으세요</li>
<li>중반: 차와 포를 사용해 상대 왕을 압박하세요</li>
<li>종반: 장군을 연속으로 만들어 외통수를 노리세요</li>
<li>왕 주변의 사를 제거하면 공격이 쉬워집니다</li>
</ul>
`;

      var helpLabel = new qx.ui.basic.Label(helpText);
      helpLabel.set({
        rich: true,
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("12px Arial")
      });

      content.add(helpLabel);
      scroll.add(content);

      var closeBtn = new qx.ui.form.Button("닫기");
      closeBtn.addListener("execute", function() {
        win.close();
      });

      win.add(scroll, {flex: 1});
      win.add(closeBtn);

      var app = qx.core.Init.getApplication();
      app.getRoot().add(win, {left: 100, top: 50});
      win.center();
      win.open();
    },

    /**
     * Open AI Strategy Editor window
     */
    __openStrategyEditor: function() {
      var self = this;

      var win = new qx.ui.window.Window("AI 전략 프롬프트 편집");
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 550,
        height: 600,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        contentPadding: 15
      });

      // Load current strategy
      var strategy = deskweb.game.JanggiAI.loadStrategy();

      var scroll = new qx.ui.container.Scroll();
      var content = new qx.ui.container.Composite(new qx.ui.layout.VBox(15));
      content.setPadding(10);

      // Info label
      var infoLabel = new qx.ui.basic.Label(
        "<b>AI 전략 지침을 수정하세요</b><br>" +
        "<span style='color:#888;'>각 단계별 전략과 AI 성격을 커스터마이징할 수 있습니다.<br>" +
        "게임 진행에 필요한 형식(좌표, 보드 상태 등)은 수정할 수 없습니다.</span>"
      );
      infoLabel.set({
        rich: true,
        textColor: "#c4a882"
      });
      content.add(infoLabel);

      // Opening strategy
      var openingGroup = new qx.ui.groupbox.GroupBox("초반 전략 (Opening)");
      openingGroup.setLayout(new qx.ui.layout.VBox(5));
      var openingArea = new qx.ui.form.TextArea(strategy.opening);
      openingArea.set({ height: 60, wrap: true });
      openingGroup.add(openingArea);
      content.add(openingGroup);

      // Midgame strategy
      var midgameGroup = new qx.ui.groupbox.GroupBox("중반 전략 (Midgame)");
      midgameGroup.setLayout(new qx.ui.layout.VBox(5));
      var midgameArea = new qx.ui.form.TextArea(strategy.midgame);
      midgameArea.set({ height: 60, wrap: true });
      midgameGroup.add(midgameArea);
      content.add(midgameGroup);

      // Endgame strategy
      var endgameGroup = new qx.ui.groupbox.GroupBox("종반 전략 (Endgame)");
      endgameGroup.setLayout(new qx.ui.layout.VBox(5));
      var endgameArea = new qx.ui.form.TextArea(strategy.endgame);
      endgameArea.set({ height: 60, wrap: true });
      endgameGroup.add(endgameArea);
      content.add(endgameGroup);

      // General strategy
      var generalGroup = new qx.ui.groupbox.GroupBox("일반 전략 (Always Applied)");
      generalGroup.setLayout(new qx.ui.layout.VBox(5));
      var generalArea = new qx.ui.form.TextArea(strategy.general);
      generalArea.set({ height: 60, wrap: true });
      generalGroup.add(generalArea);
      content.add(generalGroup);

      // Personality
      var personalityGroup = new qx.ui.groupbox.GroupBox("AI 성격 (Personality)");
      personalityGroup.setLayout(new qx.ui.layout.VBox(5));
      var personalityArea = new qx.ui.form.TextArea(strategy.personality);
      personalityArea.set({ height: 60, wrap: true });
      var personalityHint = new qx.ui.basic.Label("AI가 대화할 때의 어조와 스타일을 정의합니다.");
      personalityHint.set({ textColor: "#888", font: qx.bom.Font.fromString("10px Arial") });
      personalityGroup.add(personalityArea);
      personalityGroup.add(personalityHint);
      content.add(personalityGroup);

      scroll.add(content);

      // Button container
      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));

      // Save button
      var saveBtn = new qx.ui.form.Button("저장");
      saveBtn.set({ width: 80 });
      saveBtn.addListener("execute", function() {
        var newStrategy = {
          opening: openingArea.getValue(),
          midgame: midgameArea.getValue(),
          endgame: endgameArea.getValue(),
          general: generalArea.getValue(),
          personality: personalityArea.getValue()
        };
        deskweb.game.JanggiAI.saveStrategy(newStrategy);
        self.__addAIMessage("전략이 저장되었습니다. 다음 수부터 적용됩니다!", "system");
        win.close();
      });

      // Reset button
      var resetBtn = new qx.ui.form.Button("초기화");
      resetBtn.set({ width: 80 });
      resetBtn.addListener("execute", function() {
        var defaults = deskweb.game.JanggiAI.resetStrategy();
        openingArea.setValue(defaults.opening);
        midgameArea.setValue(defaults.midgame);
        endgameArea.setValue(defaults.endgame);
        generalArea.setValue(defaults.general);
        personalityArea.setValue(defaults.personality);
        self.__addAIMessage("전략이 기본값으로 초기화되었습니다.", "system");
      });

      // Cancel button
      var cancelBtn = new qx.ui.form.Button("취소");
      cancelBtn.set({ width: 80 });
      cancelBtn.addListener("execute", function() {
        win.close();
      });

      btnContainer.add(new qx.ui.core.Spacer(), {flex: 1});
      btnContainer.add(resetBtn);
      btnContainer.add(saveBtn);
      btnContainer.add(cancelBtn);

      win.add(scroll, {flex: 1});
      win.add(btnContainer);

      var app = qx.core.Init.getApplication();
      app.getRoot().add(win, {left: 100, top: 50});
      win.center();
      win.open();
    }
  },

  destruct : function()
  {
    console.log("[JanggiWindow] Disposing...");

    if (this.__game) {
      this.__game.dispose();
      this.__game = null;
    }

    if (this.__analysisWindow && !this.__analysisWindow.isDisposed()) {
      this.__analysisWindow.close();
      this.__analysisWindow.dispose();
      this.__analysisWindow = null;
    }

    if (this.__helpWindow && !this.__helpWindow.isDisposed()) {
      this.__helpWindow.close();
      this.__helpWindow.dispose();
      this.__helpWindow = null;
    }
  }
});
