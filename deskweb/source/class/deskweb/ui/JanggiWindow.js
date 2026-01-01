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
      width: 900,
      height: 550,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0,
      resizable: true,
      icon: "deskweb/images/janggi.svg"
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Fullscreen state
    this.__isFullscreen = false;
    this.__savedBounds = null;

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
    __mainContainer: null,
    __gamePanel: null,
    __gameContainer: null,
    __canvasContainer: null,
    __cameraControls: null,
    __sidePanel: null,
    __bottomPanel: null,
    __statusBar: null,
    __statusLabel: null,
    __turnLabel: null,
    __scoreLabel: null,
    __capturedChoLabel: null,
    __capturedHanLabel: null,
    __historyList: null,
    __is3DInitialized: false,
    __analysisWindow: null,
    __aiChatContainer: null,
    __aiChatScroll: null,
    __aiChatList: null,
    __checkEffectLabel: null,
    __helpWindow: null,
    __isFullscreen: false,
    __savedBounds: null,
    __turnIndicator: null,
    __turnAnimationTimer: null,
    __isDragging: false,
    __lastMouseX: 0,
    __lastMouseY: 0,

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

      // Fullscreen button
      var fullscreenBtn = new qx.ui.toolbar.Button("Fullscreen", "deskweb/images/maximize.svg");
      fullscreenBtn.addListener("execute", this.__toggleFullscreen, this);

      // Settings button
      var settingsBtn = new qx.ui.toolbar.Button("Settings", "deskweb/images/settings.svg");
      settingsBtn.addListener("execute", this.__onSettings, this);

      // Help button
      var helpBtn = new qx.ui.toolbar.Button("Help", "deskweb/images/help.svg");
      helpBtn.addListener("execute", this.__onHelp, this);

      this.__toolbar.add(newGameBtn);
      this.__toolbar.add(analysisBtn);
      this.__toolbar.add(fullscreenBtn);
      this.__toolbar.addSpacer();
      this.__toolbar.add(helpBtn);
      this.__toolbar.add(settingsBtn);

      this.add(this.__toolbar);
    },

    /**
     * Create main game content area - Wide layout
     * Left: Game panel, Right: Info panel, Bottom: AI Chat
     */
    __createMainContent: function() {
      // Main container with vertical layout (top: game+info, bottom: chat)
      this.__mainContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      this.__mainContainer.set({
        backgroundColor: "#2d1810",
        padding: 8
      });

      // Top section: Game + Side Panel (horizontal)
      var topSection = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));

      // Left: Game panel (canvas + camera controls)
      this.__gamePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(0));
      this.__gamePanel.set({
        backgroundColor: "#1a0f08"
      });

      // Canvas container - will fill available space
      this.__canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      this.__canvasContainer.set({
        minWidth: 400,
        minHeight: 350,
        backgroundColor: "#1a0f08"
      });

      // In-game camera controls (overlay style)
      this.__createInGameCameraControls();

      // In-game turn indicator (left side)
      this.__createTurnIndicator();

      this.__gamePanel.add(this.__canvasContainer, {flex: 1});

      // Right: Side panel (info + controls)
      this.__sidePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(8));
      this.__sidePanel.set({
        width: 200,
        backgroundColor: "#3d2a1f",
        padding: 10
      });

      this.__createSidePanelContent();

      topSection.add(this.__gamePanel, {flex: 1});
      topSection.add(this.__sidePanel);

      // Bottom: AI Chat panel
      this.__bottomPanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      this.__bottomPanel.set({
        height: 100,
        backgroundColor: "#3d2a1f",
        padding: 8
      });

      this.__createBottomChatPanel();

      this.__mainContainer.add(topSection, {flex: 1});
      this.__mainContainer.add(this.__bottomPanel);

      this.add(this.__mainContainer, {flex: 1});

      // Setup keyboard listener for ESC key
      this.__setupKeyboardListener();
    },

    /**
     * Create in-game camera controls (floating buttons)
     */
    __createInGameCameraControls: function() {
      var self = this;

      // Camera control container (positioned in canvas)
      this.__cameraControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(3));
      this.__cameraControls.set({
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 4,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 4
        }),
        zIndex: 100
      });

      // Rotate left button
      var rotLeftBtn = new qx.ui.form.Button("<");
      rotLeftBtn.set({
        width: 28,
        height: 24,
        padding: 0,
        backgroundColor: "#5a3d2a",
        textColor: "#fff"
      });
      rotLeftBtn.addListener("execute", function() {
        var current = self.__game.getCameraAngleY();
        self.__game.setCameraAngleY(current - 0.15);
      });

      // Reset button
      var resetBtn = new qx.ui.form.Button("R");
      resetBtn.set({
        width: 28,
        height: 24,
        padding: 0,
        backgroundColor: "#5a3d2a",
        textColor: "#fff",
        toolTipText: "Reset camera"
      });
      resetBtn.addListener("execute", function() {
        self.__game.setCameraDistance(15);
        self.__game.setCameraAngleX(0.8);
        self.__game.setCameraAngleY(0);
      });

      // Rotate right button
      var rotRightBtn = new qx.ui.form.Button(">");
      rotRightBtn.set({
        width: 28,
        height: 24,
        padding: 0,
        backgroundColor: "#5a3d2a",
        textColor: "#fff"
      });
      rotRightBtn.addListener("execute", function() {
        var current = self.__game.getCameraAngleY();
        self.__game.setCameraAngleY(current + 0.15);
      });

      // Zoom in button
      var zoomInBtn = new qx.ui.form.Button("+");
      zoomInBtn.set({
        width: 28,
        height: 24,
        padding: 0,
        backgroundColor: "#5a3d2a",
        textColor: "#fff",
        toolTipText: "Zoom in"
      });
      zoomInBtn.addListener("execute", function() {
        var current = self.__game.getCameraDistance();
        self.__game.setCameraDistance(current - 2);
      });

      // Zoom out button
      var zoomOutBtn = new qx.ui.form.Button("-");
      zoomOutBtn.set({
        width: 28,
        height: 24,
        padding: 0,
        backgroundColor: "#5a3d2a",
        textColor: "#fff",
        toolTipText: "Zoom out"
      });
      zoomOutBtn.addListener("execute", function() {
        var current = self.__game.getCameraDistance();
        self.__game.setCameraDistance(current + 2);
      });

      this.__cameraControls.add(rotLeftBtn);
      this.__cameraControls.add(zoomInBtn);
      this.__cameraControls.add(resetBtn);
      this.__cameraControls.add(zoomOutBtn);
      this.__cameraControls.add(rotRightBtn);

      // Add to canvas container with absolute positioning
      this.__canvasContainer.add(this.__cameraControls, {right: 5, top: 5});
    },

    /**
     * Create turn indicator on left side of game view
     */
    __createTurnIndicator: function() {
      this.__turnIndicator = new qx.ui.container.Composite(new qx.ui.layout.VBox(2));
      this.__turnIndicator.set({
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: [8, 12],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 6
        }),
        zIndex: 100
      });

      // Turn text label
      this.__turnIndicator.turnText = new qx.ui.basic.Label("새게임을 시작해주세요");
      this.__turnIndicator.turnText.set({
        textColor: "#d4a574",
        font: qx.bom.Font.fromString("bold 13px Arial"),
        textAlign: "center"
      });

      // Loading dots for AI thinking animation
      this.__turnIndicator.loadingDots = new qx.ui.basic.Label("");
      this.__turnIndicator.loadingDots.set({
        textColor: "#6b9eff",
        font: qx.bom.Font.fromString("bold 14px Arial"),
        textAlign: "center",
        visibility: "excluded"
      });

      this.__turnIndicator.add(this.__turnIndicator.turnText);
      this.__turnIndicator.add(this.__turnIndicator.loadingDots);

      // Add to canvas container (left side)
      this.__canvasContainer.add(this.__turnIndicator, {left: 5, top: 5});
    },

    /**
     * Update turn indicator display
     */
    __updateTurnIndicator: function(isAITurn, isThinking) {
      var self = this;

      if (isThinking) {
        // AI is thinking - show loading animation
        this.__turnIndicator.turnText.setValue("AI 생각중");
        this.__turnIndicator.turnText.setTextColor("#6b9eff");
        this.__turnIndicator.loadingDots.setVisibility("visible");

        // Start loading animation
        this.__startLoadingAnimation();
      } else if (isAITurn) {
        // AI's turn but not thinking yet
        this.__turnIndicator.turnText.setValue("AI 턴");
        this.__turnIndicator.turnText.setTextColor("#6b9eff");
        this.__turnIndicator.loadingDots.setVisibility("excluded");
        this.__stopLoadingAnimation();
      } else {
        // Player's turn
        this.__turnIndicator.turnText.setValue("당신의 턴입니다");
        this.__turnIndicator.turnText.setTextColor("#4CAF50");
        this.__turnIndicator.loadingDots.setVisibility("excluded");
        this.__stopLoadingAnimation();
      }
    },

    /**
     * Start loading dots animation
     */
    __startLoadingAnimation: function() {
      var self = this;
      var dots = ["", ".", "..", "..."];
      var dotIndex = 0;

      // Stop existing animation
      this.__stopLoadingAnimation();

      this.__turnAnimationTimer = setInterval(function() {
        if (self.__turnIndicator && self.__turnIndicator.loadingDots && !self.__turnIndicator.loadingDots.isDisposed()) {
          self.__turnIndicator.loadingDots.setValue(dots[dotIndex]);
          dotIndex = (dotIndex + 1) % dots.length;
        }
      }, 400);
    },

    /**
     * Stop loading animation
     */
    __stopLoadingAnimation: function() {
      if (this.__turnAnimationTimer) {
        clearInterval(this.__turnAnimationTimer);
        this.__turnAnimationTimer = null;
      }
    },

    /**
     * Setup keyboard listener for ESC key (exit fullscreen)
     */
    __setupKeyboardListener: function() {
      var self = this;
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && self.__isFullscreen) {
          self.__exitFullscreen();
        }
      });
    },

    /**
     * Create bottom AI chat panel - Vertical layout with scroll
     */
    __createBottomChatPanel: function() {
      var titleContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));

      var aiChatTitle = new qx.ui.basic.Label("AI 대화");
      aiChatTitle.set({
        textColor: "#6b9eff",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      // Check effect label
      this.__checkEffectLabel = new qx.ui.basic.Label("장군이요!");
      this.__checkEffectLabel.set({
        textColor: "#ff4444",
        font: qx.bom.Font.fromString("bold 14px Arial"),
        backgroundColor: "#ffeeee",
        padding: [3, 10],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 4,
          width: 2,
          color: "#ff0000"
        }),
        visibility: "hidden"
      });

      titleContainer.add(aiChatTitle);
      titleContainer.add(new qx.ui.core.Spacer(), {flex: 1});
      titleContainer.add(this.__checkEffectLabel);

      // Scroll container for AI chat - Vertical scrolling
      this.__aiChatScroll = new qx.ui.container.Scroll();
      this.__aiChatScroll.set({
        backgroundColor: "#2d1810",
        scrollbarY: "auto",
        scrollbarX: "off"
      });

      // Vertical layout for chat messages
      this.__aiChatList = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      this.__aiChatList.set({
        backgroundColor: "#2d1810",
        padding: 5
      });

      this.__aiChatScroll.add(this.__aiChatList);

      // Add initial message
      this.__addAIChatMessage("안녕하세요! 좋은 대국 하겠습니다.", "greeting");

      this.__bottomPanel.add(titleContainer);
      this.__bottomPanel.add(this.__aiChatScroll, {flex: 1});
    },

    /**
     * Create side panel content - Compact version
     */
    __createSidePanelContent: function() {
      // Turn + Score container
      var turnContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      turnContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 8,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5,
          width: 2,
          color: "#d4a574"
        })
      });

      this.__turnLabel = new qx.ui.basic.Label("Cho (Red)");
      this.__turnLabel.set({
        textColor: "#ff6b6b",
        font: qx.bom.Font.fromString("bold 16px Arial"),
        textAlign: "center"
      });

      this.__scoreLabel = new qx.ui.basic.Label("Score: 0 - 0");
      this.__scoreLabel.set({
        textColor: "#d4a574",
        font: qx.bom.Font.fromString("12px Arial"),
        textAlign: "center"
      });

      turnContainer.add(this.__turnLabel);
      turnContainer.add(this.__scoreLabel);

      // Captured pieces - Combined container
      var capturedContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      capturedContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 8,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var capturedTitle = new qx.ui.basic.Label("Captured");
      capturedTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 10px Arial")
      });

      var choRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      var choLabel = new qx.ui.basic.Label("Cho:");
      choLabel.set({ textColor: "#ff6b6b", font: qx.bom.Font.fromString("10px Arial"), width: 35 });
      this.__capturedChoLabel = new qx.ui.basic.Label("-");
      this.__capturedChoLabel.set({
        textColor: "#ff6b6b",
        font: qx.bom.Font.fromString("12px serif")
      });
      choRow.add(choLabel);
      choRow.add(this.__capturedChoLabel);

      var hanRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      var hanLabel = new qx.ui.basic.Label("Han:");
      hanLabel.set({ textColor: "#6b9eff", font: qx.bom.Font.fromString("10px Arial"), width: 35 });
      this.__capturedHanLabel = new qx.ui.basic.Label("-");
      this.__capturedHanLabel.set({
        textColor: "#6b9eff",
        font: qx.bom.Font.fromString("12px serif")
      });
      hanRow.add(hanLabel);
      hanRow.add(this.__capturedHanLabel);

      capturedContainer.add(capturedTitle);
      capturedContainer.add(choRow);
      capturedContainer.add(hanRow);

      // Move history - Compact
      var historyContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      historyContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 8,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var historyTitle = new qx.ui.basic.Label("History");
      historyTitle.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("bold 10px Arial")
      });

      this.__historyList = new qx.ui.form.List();
      this.__historyList.set({
        backgroundColor: "#3d2a1f",
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("10px Arial")
      });

      historyContainer.add(historyTitle);
      historyContainer.add(this.__historyList, {flex: 1});

      // Controls info - Very compact
      var controlsContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(2));
      controlsContainer.set({
        backgroundColor: "#5a3d2a",
        padding: 6,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var controlsInfo = new qx.ui.basic.Label("Click to select | You are Cho (Red)");
      controlsInfo.set({
        textColor: "#a08060",
        font: qx.bom.Font.fromString("9px Arial"),
        textAlign: "center"
      });

      var colorInfo = new qx.ui.basic.Label("Green=Move | Red=Capture");
      colorInfo.set({
        textColor: "#a08060",
        font: qx.bom.Font.fromString("9px Arial"),
        textAlign: "center"
      });

      controlsContainer.add(controlsInfo);
      controlsContainer.add(colorInfo);

      // Add all containers
      this.__sidePanel.add(turnContainer);
      this.__sidePanel.add(capturedContainer);
      this.__sidePanel.add(historyContainer, {flex: 1});
      this.__sidePanel.add(controlsContainer);
    },

    /**
     * Add a message to AI chat (vertical layout with scroll to bottom)
     */
    __addAIChatMessage: function(message, type) {
      var msgLabel = new qx.ui.basic.Label(message);
      var color = "#c4a882";
      var bgColor = "transparent";

      if (type === "tactical") {
        color = "#90EE90";
        bgColor = "rgba(144, 238, 144, 0.15)";
      } else if (type === "comment") {
        color = "#87CEEB";
        bgColor = "rgba(135, 206, 235, 0.15)";
      } else if (type === "warning") {
        color = "#FFB6C1";
        bgColor = "rgba(255, 182, 193, 0.15)";
      } else if (type === "greeting") {
        color = "#DDA0DD";
        bgColor = "rgba(221, 160, 221, 0.15)";
      }

      msgLabel.set({
        textColor: color,
        backgroundColor: bgColor,
        font: qx.bom.Font.fromString("11px Arial"),
        padding: [2, 6],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 3
        })
      });

      // Keep only last 20 messages
      var children = this.__aiChatList.getChildren();
      if (children.length >= 20) {
        this.__aiChatList.removeAt(0);
      }

      this.__aiChatList.add(msgLabel);

      // Scroll to bottom
      var self = this;
      setTimeout(function() {
        if (self.__aiChatScroll && !self.__aiChatScroll.isDisposed()) {
          self.__aiChatScroll.scrollToY(100000);
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

      // Track mouse state for drag detection
      var mouseDownX = 0;
      var mouseDownY = 0;
      var isDragging = false;
      var dragThreshold = 5; // pixels to consider as drag

      // Mouse down - start potential drag
      containerEl.addEventListener('mousedown', function(e) {
        if (e.button === 0) { // Left click only
          mouseDownX = e.clientX;
          mouseDownY = e.clientY;
          self.__lastMouseX = e.clientX;
          self.__lastMouseY = e.clientY;
          self.__isDragging = false;
          isDragging = false;
        }
      });

      // Mouse move - handle drag for camera rotation
      containerEl.addEventListener('mousemove', function(e) {
        if (e.buttons === 1) { // Left button held
          var deltaX = e.clientX - self.__lastMouseX;
          var deltaY = e.clientY - self.__lastMouseY;

          // Check if we've moved enough to consider it a drag
          var totalDeltaX = Math.abs(e.clientX - mouseDownX);
          var totalDeltaY = Math.abs(e.clientY - mouseDownY);

          if (totalDeltaX > dragThreshold || totalDeltaY > dragThreshold) {
            isDragging = true;
            self.__isDragging = true;

            // Rotate camera based on mouse movement
            var currentAngleY = self.__game.getCameraAngleY();
            var currentAngleX = self.__game.getCameraAngleX();

            // Horizontal drag -> Y rotation (left/right)
            self.__game.setCameraAngleY(currentAngleY + deltaX * 0.005);

            // Vertical drag -> X rotation (tilt) - clamped
            var newAngleX = currentAngleX - deltaY * 0.003;
            newAngleX = Math.max(0.3, Math.min(1.4, newAngleX));
            self.__game.setCameraAngleX(newAngleX);
          }

          self.__lastMouseX = e.clientX;
          self.__lastMouseY = e.clientY;
        }
      });

      // Mouse up - handle click only if not dragging
      containerEl.addEventListener('mouseup', function(e) {
        if (e.button === 0 && !isDragging) {
          var rect = containerEl.getBoundingClientRect();
          var x = e.clientX - rect.left;
          var y = e.clientY - rect.top;

          var boardPos = self.__game.screenToBoard(x, y, rect.width, rect.height);
          if (boardPos) {
            self.__game.handleClick(boardPos.row, boardPos.col);
          }
        }
        isDragging = false;
        self.__isDragging = false;
      });

      // Mouse wheel - zoom in/out
      containerEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        var currentDistance = self.__game.getCameraDistance();
        var zoomSpeed = 0.5;

        if (e.deltaY > 0) {
          // Scroll down - zoom out
          self.__game.setCameraDistance(Math.min(30, currentDistance + zoomSpeed));
        } else {
          // Scroll up - zoom in
          self.__game.setCameraDistance(Math.max(8, currentDistance - zoomSpeed));
        }
      }, { passive: false });

      console.log("[JanggiWindow] Click and mouse handlers setup");
    },

    /**
     * Handle window resize - Fill container completely
     */
    __onResize: function() {
      if (!this.__is3DInitialized) return;

      var self = this;

      // Use setTimeout to ensure layout is complete
      setTimeout(function() {
        var bounds = self.__canvasContainer.getBounds();
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          console.log("[JanggiWindow] Resizing renderer to:", bounds.width, "x", bounds.height);
          self.__game.resize(bounds.width, bounds.height);
        }
      }, 50);
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

      // Reset turn indicator to player's turn
      this.__updateTurnIndicator(false, false);
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
        // Update turn indicator - player's turn
        this.__updateTurnIndicator(false, false);
      } else {
        this.__turnLabel.setValue("Han (Blue)");
        this.__turnLabel.setTextColor("#6b9eff");
        // Update turn indicator - AI's turn (not thinking yet)
        this.__updateTurnIndicator(true, false);
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

      // Update status and turn indicator
      if (data.piece.team === "cho") {
        this.__statusLabel.setValue("AI is thinking...");
        // AI will think next, indicator will be updated by __onAIThinking
      } else {
        this.__statusLabel.setValue("Your turn (Cho/Red)");
        // Player's turn
        this.__updateTurnIndicator(false, false);
      }
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
     * Handle game over - Show result and prompt for new game
     */
    __onGameOver: function(e) {
      var self = this;
      var data = e.getData();
      var winner = data.winner === "cho" ? "Cho (Red/You)" : "Han (Blue/AI)";
      var reason = data.reason || "capture";
      var score = data.score || { cho: 0, han: 0 };

      console.log("[JanggiWindow] Game over! Winner:", winner, "Reason:", reason);

      // Update score display
      this.__updateScoreDisplay(score);

      // Determine result message based on reason
      var reasonText = "";
      if (reason === "checkmate") {
        reasonText = "Checkmate! (외통수)";
      } else if (reason === "capture") {
        reasonText = "King Captured! (왕 잡힘)";
      } else if (reason === "stalemate") {
        reasonText = "No moves available! (수 없음)";
      }

      var resultMessage = data.winner === "cho" ? "You Win!" : "AI Wins!";

      this.__statusLabel.setValue("Game Over! " + resultMessage);

      // Show game over dialog
      setTimeout(function() {
        self.__showGameOverDialog(winner, reasonText, score, data.winner === "cho");
      }, 800);
    },

    /**
     * Show game over dialog with new game option
     */
    __showGameOverDialog: function(winner, reason, score, isPlayerWin) {
      var self = this;

      var win = new qx.ui.window.Window("Game Over");
      win.setLayout(new qx.ui.layout.VBox(15));
      win.set({
        width: 320,
        height: 280,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        showClose: false,
        contentPadding: 20,
        backgroundColor: "#2d1810"
      });

      // Result emoji and text
      var resultLabel = new qx.ui.basic.Label(isPlayerWin ? "Victory!" : "Defeat");
      resultLabel.set({
        textColor: isPlayerWin ? "#4CAF50" : "#f44336",
        font: qx.bom.Font.fromString("bold 28px Arial"),
        textAlign: "center"
      });

      // Reason label
      var reasonLabel = new qx.ui.basic.Label(reason);
      reasonLabel.set({
        textColor: "#d4a574",
        font: qx.bom.Font.fromString("14px Arial"),
        textAlign: "center"
      });

      // Winner label
      var winnerLabel = new qx.ui.basic.Label("Winner: " + winner);
      winnerLabel.set({
        textColor: "#c4a882",
        font: qx.bom.Font.fromString("12px Arial"),
        textAlign: "center"
      });

      // Score display
      var scoreLabel = new qx.ui.basic.Label("Session Score: You " + score.cho + " - " + score.han + " AI");
      scoreLabel.set({
        textColor: "#a08060",
        font: qx.bom.Font.fromString("bold 14px Arial"),
        textAlign: "center",
        padding: [10, 0]
      });

      // Button container
      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(15));
      btnContainer.set({ allowGrowX: true });

      // New Game button
      var newGameBtn = new qx.ui.form.Button("New Game");
      newGameBtn.set({
        width: 120,
        height: 35,
        backgroundColor: "#4CAF50",
        textColor: "#fff",
        font: qx.bom.Font.fromString("bold 13px Arial")
      });
      newGameBtn.addListener("execute", function() {
        win.close();
        self.__onNewGame();
      });

      // Close button
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.set({
        width: 120,
        height: 35,
        backgroundColor: "#5a3d2a",
        textColor: "#fff"
      });
      closeBtn.addListener("execute", function() {
        win.close();
      });

      btnContainer.add(new qx.ui.core.Spacer(), {flex: 1});
      btnContainer.add(newGameBtn);
      btnContainer.add(closeBtn);
      btnContainer.add(new qx.ui.core.Spacer(), {flex: 1});

      win.add(resultLabel);
      win.add(reasonLabel);
      win.add(winnerLabel);
      win.add(scoreLabel);
      win.add(new qx.ui.core.Spacer(), {flex: 1});
      win.add(btnContainer);

      var app = qx.core.Init.getApplication();
      app.getRoot().add(win, {left: 100, top: 100});
      win.center();
      win.open();
    },

    /**
     * Update score display
     */
    __updateScoreDisplay: function(score) {
      if (this.__scoreLabel) {
        this.__scoreLabel.setValue("Score: " + score.cho + " - " + score.han);
      }
    },

    /**
     * Handle AI thinking state
     */
    __onAIThinking: function(e) {
      var data = e.getData();
      if (data.thinking) {
        this.__statusLabel.setValue("AI is thinking...");
        this.__turnLabel.setValue("Han (Thinking...)");
        // Update turn indicator with loading animation
        this.__updateTurnIndicator(true, true);
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
     * Toggle fullscreen mode
     */
    __toggleFullscreen: function() {
      if (this.__isFullscreen) {
        this.__exitFullscreen();
      } else {
        this.__enterFullscreen();
      }
    },

    /**
     * Enter fullscreen mode - maintain aspect ratio
     */
    __enterFullscreen: function() {
      var self = this;
      var app = qx.core.Init.getApplication();
      var root = app.getRoot();
      var rootBounds = root.getBounds();

      if (!rootBounds) return;

      // Save current bounds
      this.__savedBounds = this.getBounds();

      // Calculate fullscreen size maintaining aspect ratio
      var screenWidth = rootBounds.width;
      var screenHeight = rootBounds.height;

      // Hide toolbar and side panel in fullscreen
      this.__toolbar.setVisibility("excluded");
      this.__sidePanel.setVisibility("excluded");
      this.__bottomPanel.setHeight(60);
      this.__statusBar.setVisibility("excluded");

      // Set window to fullscreen
      this.set({
        left: 0,
        top: 0,
        width: screenWidth,
        height: screenHeight,
        showMinimize: false,
        showMaximize: false,
        showClose: false,
        movable: false,
        resizable: false
      });

      this.__isFullscreen = true;

      // Update renderer after layout settles
      setTimeout(function() {
        self.__onResize();
      }, 100);

      console.log("[JanggiWindow] Entered fullscreen mode");
    },

    /**
     * Exit fullscreen mode
     */
    __exitFullscreen: function() {
      var self = this;

      if (!this.__savedBounds) return;

      // Restore visibility
      this.__toolbar.setVisibility("visible");
      this.__sidePanel.setVisibility("visible");
      this.__bottomPanel.setHeight(100);
      this.__statusBar.setVisibility("visible");

      // Restore window properties
      this.set({
        left: this.__savedBounds.left,
        top: this.__savedBounds.top,
        width: this.__savedBounds.width,
        height: this.__savedBounds.height,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        movable: true,
        resizable: true
      });

      this.__isFullscreen = false;
      this.__savedBounds = null;

      // Update renderer after layout settles
      setTimeout(function() {
        self.__onResize();
      }, 100);

      console.log("[JanggiWindow] Exited fullscreen mode");
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

    // Stop loading animation timer
    this.__stopLoadingAnimation();

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
