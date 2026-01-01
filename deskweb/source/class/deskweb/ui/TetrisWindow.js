/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * 3D Tetris Game Window
 *
 * Windows-style Tetris game with Three.js 3D rendering
 * Features:
 * - 3D block rendering with rotation effects
 * - 10 stages with increasing difficulty
 * - 3D spatial sound effects
 * - Camera controls (zoom, angle adjustment)
 * - Graphics acceleration options (WebGL/Canvas)
 */
qx.Class.define("deskweb.ui.TetrisWindow",
{
  extend : qx.ui.window.Window,

  construct : function()
  {
    this.base(arguments, "3D Tetris");

    console.log("[TetrisWindow] Initializing...");

    this.set({
      width: 700,
      height: 650,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0,
      resizable: true
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Initialize game logic
    this.__game = new deskweb.game.TetrisGame();
    this.__setupGameListeners();

    // Create UI components
    this.__createToolbar();
    this.__createMainContent();
    this.__createStatusBar();

    // Handle window events
    this.addListener("appear", this.__onAppear, this);
    this.addListener("resize", this.__onResize, this);
    this.addListener("close", this.__onClose, this);

    // Setup keyboard controls
    this.__setupKeyboardControls();

    console.log("[TetrisWindow] Initialized successfully");
  },

  members :
  {
    __game: null,
    __toolbar: null,
    __gameContainer: null,
    __canvasContainer: null,
    __sidePanel: null,
    __statusBar: null,
    __scoreLabel: null,
    __linesLabel: null,
    __levelLabel: null,
    __stageLabel: null,
    __nextPieceCanvas: null,
    __settingsWindow: null,
    __is3DInitialized: false,
    __cameraSlider: null,

    /**
     * Setup game event listeners
     */
    __setupGameListeners: function() {
      this.__game.addListener("gameStateChange", this.__onGameStateChange, this);
      this.__game.addListener("scoreUpdate", this.__onScoreUpdate, this);
      this.__game.addListener("linesCleared", this.__onLinesCleared, this);
      this.__game.addListener("levelChange", this.__onLevelChange, this);
      this.__game.addListener("stageChange", this.__onStageChange, this);
      this.__game.addListener("gameOver", this.__onGameOver, this);
    },

    /**
     * Create toolbar
     */
    __createToolbar: function() {
      this.__toolbar = new qx.ui.toolbar.ToolBar();
      this.__toolbar.setBackgroundColor("#2d2d2d");

      // New Game button
      var newGameBtn = new qx.ui.toolbar.Button("New Game", "deskweb/images/play.svg");
      newGameBtn.addListener("execute", this.__onNewGame, this);

      // Pause button
      var pauseBtn = new qx.ui.toolbar.Button("Pause", "deskweb/images/pause.svg");
      pauseBtn.addListener("execute", this.__onPause, this);

      // Settings button
      var settingsBtn = new qx.ui.toolbar.Button("Settings", "deskweb/images/settings.svg");
      settingsBtn.addListener("execute", this.__onSettings, this);

      this.__toolbar.add(newGameBtn);
      this.__toolbar.add(pauseBtn);
      this.__toolbar.addSpacer();
      this.__toolbar.add(settingsBtn);

      this.add(this.__toolbar);
    },

    /**
     * Create main game content area
     */
    __createMainContent: function() {
      // Main vertical container for game area and camera slider
      var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      mainContainer.set({
        backgroundColor: "#1a1a2e",
        padding: 10
      });

      this.__gameContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));

      // 3D Canvas container
      this.__canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      this.__canvasContainer.set({
        width: 450,
        height: 460,
        backgroundColor: "#0f0f1a"
      });

      // Side panel for score, next piece, etc.
      this.__sidePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.__sidePanel.set({
        width: 180,
        backgroundColor: "#16213e",
        padding: 15
      });

      this.__createSidePanelContent();

      this.__gameContainer.add(this.__canvasContainer, {flex: 1});
      this.__gameContainer.add(this.__sidePanel);

      // Camera rotation slider below game area
      var cameraContainer = this.__createCameraSlider();

      mainContainer.add(this.__gameContainer, {flex: 1});
      mainContainer.add(cameraContainer);

      this.add(mainContainer, {flex: 1});
    },

    /**
     * Create camera rotation slider below game area
     */
    __createCameraSlider: function() {
      var container = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      container.set({
        height: 35,
        backgroundColor: "#16213e",
        padding: [5, 15],
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var leftLabel = new qx.ui.basic.Label("Left");
      leftLabel.set({
        textColor: "#94a3b8",
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
          backgroundColor: "#0f3460",
          radius: 3
        })
      });
      this.__cameraSlider.addListener("changeValue", function(e) {
        var value = e.getData() / 100;  // Convert to radians range (-1 to 1)
        this.__game.setCameraAngleY(value);
      }, this);

      var rightLabel = new qx.ui.basic.Label("Right");
      rightLabel.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("11px Arial"),
        alignY: "middle"
      });

      var cameraLabel = new qx.ui.basic.Label("Camera Rotation");
      cameraLabel.set({
        textColor: "#6366f1",
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
      // Stage display
      var stageContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      stageContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5,
          width: 1,
          color: "#6366f1"
        })
      });

      var stageTitle = new qx.ui.basic.Label("STAGE");
      stageTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__stageLabel = new qx.ui.basic.Label("1");
      this.__stageLabel.set({
        textColor: "#f59e0b",
        font: qx.bom.Font.fromString("bold 36px Arial"),
        textAlign: "center"
      });

      stageContainer.add(stageTitle);
      stageContainer.add(this.__stageLabel);

      // Score display
      var scoreContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      scoreContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5,
          width: 1,
          color: "#6366f1"
        })
      });

      var scoreTitle = new qx.ui.basic.Label("SCORE");
      scoreTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__scoreLabel = new qx.ui.basic.Label("0");
      this.__scoreLabel.set({
        textColor: "#22c55e",
        font: qx.bom.Font.fromString("bold 24px monospace")
      });

      scoreContainer.add(scoreTitle);
      scoreContainer.add(this.__scoreLabel);

      // Lines display
      var linesContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      linesContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var linesTitle = new qx.ui.basic.Label("LINES");
      linesTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__linesLabel = new qx.ui.basic.Label("0");
      this.__linesLabel.set({
        textColor: "#3b82f6",
        font: qx.bom.Font.fromString("bold 20px monospace")
      });

      linesContainer.add(linesTitle);
      linesContainer.add(this.__linesLabel);

      // Level display
      var levelContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      levelContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var levelTitle = new qx.ui.basic.Label("LEVEL");
      levelTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      this.__levelLabel = new qx.ui.basic.Label("1");
      this.__levelLabel.set({
        textColor: "#a855f7",
        font: qx.bom.Font.fromString("bold 20px monospace")
      });

      levelContainer.add(levelTitle);
      levelContainer.add(this.__levelLabel);

      // Next piece preview
      var nextContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      nextContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var nextTitle = new qx.ui.basic.Label("NEXT");
      nextTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      // Canvas for next piece preview
      this.__nextPieceCanvas = new qx.ui.embed.Html();
      this.__nextPieceCanvas.set({
        width: 100,
        height: 80,
        backgroundColor: "#1a1a2e"
      });

      nextContainer.add(nextTitle);
      nextContainer.add(this.__nextPieceCanvas);

      // Controls info
      var controlsContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
      controlsContainer.set({
        backgroundColor: "#0f3460",
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 5
        })
      });

      var controlsTitle = new qx.ui.basic.Label("CONTROLS");
      controlsTitle.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("bold 11px Arial")
      });

      var controls = [
        { key: "Arrow Keys", action: "Move" },
        { key: "Up / Z", action: "Rotate" },
        { key: "Space", action: "Drop" },
        { key: "P", action: "Pause" }
      ];

      controlsContainer.add(controlsTitle);
      controls.forEach(function(ctrl) {
        var row = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
        var keyLabel = new qx.ui.basic.Label(ctrl.key);
        keyLabel.set({
          textColor: "#60a5fa",
          font: qx.bom.Font.fromString("10px monospace"),
          width: 70
        });
        var actionLabel = new qx.ui.basic.Label(ctrl.action);
        actionLabel.set({
          textColor: "#cbd5e1",
          font: qx.bom.Font.fromString("10px Arial")
        });
        row.add(keyLabel);
        row.add(actionLabel);
        controlsContainer.add(row);
      });

      // Add all containers to side panel
      this.__sidePanel.add(stageContainer);
      this.__sidePanel.add(scoreContainer);
      this.__sidePanel.add(linesContainer);
      this.__sidePanel.add(levelContainer);
      this.__sidePanel.add(nextContainer);
      this.__sidePanel.add(new qx.ui.core.Spacer(), {flex: 1});
      this.__sidePanel.add(controlsContainer);
    },

    /**
     * Create status bar
     */
    __createStatusBar: function() {
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.set({
        height: 25,
        backgroundColor: "#2d2d2d",
        padding: [5, 10]
      });

      var statusLabel = new qx.ui.basic.Label("Press New Game to start");
      statusLabel.set({
        textColor: "#94a3b8",
        font: qx.bom.Font.fromString("12px Arial")
      });

      var graphicsLabel = new qx.ui.basic.Label("WebGL");
      graphicsLabel.set({
        textColor: "#22c55e",
        font: qx.bom.Font.fromString("12px Arial")
      });

      this.__statusBar.add(statusLabel);
      this.__statusBar.add(new qx.ui.core.Spacer(), {flex: 1});
      this.__statusBar.add(graphicsLabel);

      this.add(this.__statusBar);
    },

    /**
     * Setup keyboard controls
     */
    __setupKeyboardControls: function() {
      // Focus the window content for keyboard events
      this.addListener("activate", function() {
        this.focus();
      }, this);

      this.addListener("keydown", function(e) {
        if (this.__game.getGameState() !== "playing" && e.getKeyIdentifier() !== "P") {
          return;
        }

        switch(e.getKeyIdentifier()) {
          case "Left":
            this.__game.moveLeft();
            e.preventDefault();
            break;
          case "Right":
            this.__game.moveRight();
            e.preventDefault();
            break;
          case "Down":
            this.__game.moveDown();
            e.preventDefault();
            break;
          case "Up":
          case "Z":
            this.__game.rotate();
            e.preventDefault();
            break;
          case "Space":
            this.__game.hardDrop();
            e.preventDefault();
            break;
          case "P":
            this.__onPause();
            e.preventDefault();
            break;
        }
      }, this);
    },

    /**
     * Initialize 3D rendering when window appears
     */
    __onAppear: function() {
      if (this.__is3DInitialized) return;

      console.log("[TetrisWindow] Window appeared, initializing 3D...");

      // Delay to ensure container is fully rendered
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
        console.warn("[TetrisWindow] Container DOM element not ready");
        return;
      }

      var bounds = this.__canvasContainer.getBounds();
      if (!bounds) {
        console.warn("[TetrisWindow] Container bounds not ready");
        return;
      }

      var width = bounds.width || 450;
      var height = bounds.height || 500;

      console.log("[TetrisWindow] Initializing 3D renderer with size:", width, "x", height);

      var success = this.__game.init3D(containerEl, width, height);
      if (success) {
        this.__is3DInitialized = true;
        console.log("[TetrisWindow] 3D renderer initialized successfully");
      } else {
        console.error("[TetrisWindow] Failed to initialize 3D renderer");
      }
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
      console.log("[TetrisWindow] Window closing");
      if (this.__game) {
        this.__game.pause();
      }
    },

    /**
     * Handle new game button
     */
    __onNewGame: function() {
      console.log("[TetrisWindow] Starting new game");

      if (!this.__is3DInitialized) {
        this.__init3DRenderer();
      }

      this.__game.newGame();
      this.focus();
    },

    /**
     * Handle pause button
     */
    __onPause: function() {
      var state = this.__game.getGameState();
      if (state === "playing") {
        this.__game.pause();
      } else if (state === "paused") {
        this.__game.resume();
      }
    },

    /**
     * Handle settings button
     */
    __onSettings: function() {
      if (this.__settingsWindow && !this.__settingsWindow.isDisposed()) {
        this.__settingsWindow.open();
        return;
      }

      this.__settingsWindow = this.__createSettingsWindow();
      this.__settingsWindow.open();
    },

    /**
     * Create settings window
     */
    __createSettingsWindow: function() {
      var win = new qx.ui.window.Window("Tetris Settings");
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 380,
        height: 580,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        showClose: true,
        contentPadding: 20
      });

      // Graphics settings
      var graphicsGroup = new qx.ui.groupbox.GroupBox("Graphics");
      graphicsGroup.setLayout(new qx.ui.layout.VBox(10));

      // WebGL toggle
      var webglCheck = new qx.ui.form.CheckBox("Enable WebGL Acceleration");
      webglCheck.setValue(this.__game.getUseWebGL());
      webglCheck.addListener("changeValue", function(e) {
        this.__game.setUseWebGL(e.getData());
      }, this);

      graphicsGroup.add(webglCheck);

      // Material selection
      var materialGroup = new qx.ui.groupbox.GroupBox("Block Material");
      materialGroup.setLayout(new qx.ui.layout.VBox(10));

      var materialSelect = new qx.ui.form.SelectBox();
      var materials = [
        { label: "Glossy (Default)", value: "glossy" },
        { label: "Metallic", value: "metallic" },
        { label: "Glass", value: "glass" },
        { label: "Plastic", value: "plastic" },
        { label: "Matte", value: "matte" }
      ];

      materials.forEach(function(mat) {
        var item = new qx.ui.form.ListItem(mat.label);
        item.setUserData("value", mat.value);
        materialSelect.add(item);

        // Set current selection
        if (mat.value === this.__game.getMaterialType()) {
          materialSelect.setSelection([item]);
        }
      }, this);

      materialSelect.addListener("changeSelection", function(e) {
        var selection = e.getData()[0];
        if (selection) {
          var materialType = selection.getUserData("value");
          this.__game.setMaterialType(materialType);
        }
      }, this);

      var materialDesc = new qx.ui.basic.Label(
        "Glossy: Shiny plastic look\n" +
        "Metallic: Metal-like reflection\n" +
        "Glass: Transparent with shine\n" +
        "Plastic: Standard plastic\n" +
        "Matte: No shine, diffuse"
      );
      materialDesc.set({
        rich: true,
        textColor: "#888",
        font: qx.bom.Font.fromString("10px Arial")
      });

      materialGroup.add(materialSelect);
      materialGroup.add(materialDesc);

      // Camera settings
      var cameraGroup = new qx.ui.groupbox.GroupBox("Camera");
      cameraGroup.setLayout(new qx.ui.layout.VBox(10));

      // Zoom slider
      var zoomContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      var zoomLabel = new qx.ui.basic.Label("Zoom:");
      zoomLabel.set({ width: 80 });
      var zoomSlider = new qx.ui.form.Slider();
      zoomSlider.set({
        minimum: 15,
        maximum: 50,
        singleStep: 1,
        value: Math.round(this.__game.getCameraDistance())
      });
      zoomSlider.addListener("changeValue", function(e) {
        this.__game.setCameraDistance(e.getData());
      }, this);
      zoomContainer.add(zoomLabel);
      zoomContainer.add(zoomSlider, {flex: 1});

      // Angle X slider (up/down)
      var angleXContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      var angleXLabel = new qx.ui.basic.Label("Tilt (Up/Down):");
      angleXLabel.set({ width: 80 });
      var angleXSlider = new qx.ui.form.Slider();
      angleXSlider.set({
        minimum: -80,
        maximum: 80,
        singleStep: 5,
        value: Math.round(this.__game.getCameraAngleX() * 100)
      });
      angleXSlider.addListener("changeValue", function(e) {
        this.__game.setCameraAngleX(e.getData() / 100);
      }, this);
      angleXContainer.add(angleXLabel);
      angleXContainer.add(angleXSlider, {flex: 1});

      // Angle Y slider (left/right)
      var angleYContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      var angleYLabel = new qx.ui.basic.Label("Rotation:");
      angleYLabel.set({ width: 80 });
      var angleYSlider = new qx.ui.form.Slider();
      angleYSlider.set({
        minimum: -180,
        maximum: 180,
        singleStep: 10,
        value: Math.round(this.__game.getCameraAngleY() * 100)
      });
      angleYSlider.addListener("changeValue", function(e) {
        this.__game.setCameraAngleY(e.getData() / 100);
      }, this);
      angleYContainer.add(angleYLabel);
      angleYContainer.add(angleYSlider, {flex: 1});

      // Reset camera button
      var resetCameraBtn = new qx.ui.form.Button("Reset Camera");
      resetCameraBtn.addListener("execute", function() {
        this.__game.setCameraDistance(25);
        this.__game.setCameraAngleX(0.3);
        this.__game.setCameraAngleY(0);
        zoomSlider.setValue(25);
        angleXSlider.setValue(30);
        angleYSlider.setValue(0);
      }, this);

      cameraGroup.add(zoomContainer);
      cameraGroup.add(angleXContainer);
      cameraGroup.add(angleYContainer);
      cameraGroup.add(resetCameraBtn);

      // Stage info
      var stageGroup = new qx.ui.groupbox.GroupBox("Stage Info");
      stageGroup.setLayout(new qx.ui.layout.VBox(5));

      var stageInfo = new qx.ui.basic.Label(
        "Stage 1-2: Basic colors\n" +
        "Stage 3-4: Enhanced colors\n" +
        "Stage 5-6: Vivid colors\n" +
        "Stage 7-8: Neon colors\n" +
        "Stage 9-10: Rainbow colors\n\n" +
        "Speed increases with each stage!"
      );
      stageInfo.set({
        rich: true,
        textColor: "#666",
        font: qx.bom.Font.fromString("12px Arial")
      });
      stageGroup.add(stageInfo);

      // Close button
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.addListener("execute", function() {
        win.close();
      });

      win.add(graphicsGroup);
      win.add(materialGroup);
      win.add(cameraGroup);
      win.add(stageGroup);
      win.add(new qx.ui.core.Spacer(), {flex: 1});
      win.add(closeBtn);

      // Add to desktop
      var app = qx.core.Init.getApplication();
      var root = app.getRoot();
      root.add(win, {left: 100, top: 100});
      win.center();

      return win;
    },

    /**
     * Handle game state change
     */
    __onGameStateChange: function() {
      var state = this.__game.getGameState();
      console.log("[TetrisWindow] Game state changed:", state);

      // Update next piece preview
      this.__updateNextPiecePreview();
    },

    /**
     * Handle score update
     */
    __onScoreUpdate: function(e) {
      var data = e.getData();
      this.__scoreLabel.setValue(String(data.score));
      this.__linesLabel.setValue(String(data.lines));
    },

    /**
     * Handle lines cleared
     */
    __onLinesCleared: function(e) {
      var count = e.getData();
      console.log("[TetrisWindow] Lines cleared:", count);
    },

    /**
     * Handle level change
     */
    __onLevelChange: function(e) {
      var level = e.getData();
      this.__levelLabel.setValue(String(level));
    },

    /**
     * Handle stage change
     */
    __onStageChange: function(e) {
      var stage = e.getData();
      this.__stageLabel.setValue(String(stage));
      console.log("[TetrisWindow] Stage changed to:", stage);
    },

    /**
     * Handle game over
     */
    __onGameOver: function(e) {
      var data = e.getData();
      console.log("[TetrisWindow] Game over!");

      setTimeout(function() {
        var message = "Game Over!\n\n" +
          "Score: " + data.score + "\n" +
          "Lines: " + data.lines + "\n" +
          "Level: " + data.level + "\n" +
          "Stage: " + data.stage;
        alert(message);
      }, 500);
    },

    /**
     * Update next piece preview
     */
    __updateNextPiecePreview: function() {
      var nextPiece = this.__game.getNextPiece();
      if (!nextPiece) return;

      var containerEl = this.__nextPieceCanvas.getContentElement().getDomElement();
      if (!containerEl) return;

      // Create or get canvas
      var canvas = containerEl.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 80;
        containerEl.appendChild(canvas);
      }

      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var shape = nextPiece.shape;
      var color = nextPiece.color;
      var blockSize = 16;

      // Center the piece
      var offsetX = (canvas.width - shape[0].length * blockSize) / 2;
      var offsetY = (canvas.height - shape.length * blockSize) / 2;

      // Draw the piece
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;

      for (var row = 0; row < shape.length; row++) {
        for (var col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            var x = offsetX + col * blockSize;
            var y = offsetY + row * blockSize;

            ctx.fillRect(x, y, blockSize - 1, blockSize - 1);
            ctx.strokeRect(x, y, blockSize - 1, blockSize - 1);

            // Add 3D effect
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(x, y, blockSize - 1, 3);
            ctx.fillRect(x, y, 3, blockSize - 1);

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + blockSize - 4, y, 3, blockSize - 1);
            ctx.fillRect(x, y + blockSize - 4, blockSize - 1, 3);

            ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
          }
        }
      }
    }
  },

  destruct : function()
  {
    console.log("[TetrisWindow] Disposing...");

    if (this.__game) {
      this.__game.dispose();
      this.__game = null;
    }

    if (this.__settingsWindow && !this.__settingsWindow.isDisposed()) {
      this.__settingsWindow.close();
      this.__settingsWindow.dispose();
      this.__settingsWindow = null;
    }
  }
});
