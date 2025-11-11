/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * Minesweeper Game Window
 *
 * Classic Windows Minesweeper implementation with qooxdoo
 */
qx.Class.define("deskweb.ui.MinesweeperWindow",
{
  extend : qx.ui.window.Window,

  construct : function()
  {
    this.base(arguments, "Minesweeper");

    console.log("[MinesweeperWindow] Initializing...");

    this.set({
      width: 400,
      height: 500,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 10,
      resizable: true
    });

    this.setLayout(new qx.ui.layout.VBox(5));

    // Initialize game logic
    this.__game = new deskweb.game.MinesweeperGame();
    this.__game.addListener("gameStateChange", this.__onGameStateChange, this);
    this.__game.addListener("gameWon", this.__onGameWon, this);
    this.__game.addListener("gameLost", this.__onGameLost, this);
    this.__game.addListener("timerUpdate", this.__onTimerUpdate, this);

    // Create UI components
    this.__createToolbar();
    this.__createStatusBar();
    this.__createGameBoard();

    console.log("[MinesweeperWindow] Initialized successfully");
  },

  members :
  {
    __game: null,
    __toolbar: null,
    __statusBar: null,
    __mineCountLabel: null,
    __timerLabel: null,
    __gameBoard: null,
    __cells: null,
    __cellSize: 30,
    __difficultySelect: null,
    __scrollContainer: null,
    __currentDifficulty: null,
    __isChangingDifficulty: false,

    /**
     * Create toolbar with game controls
     */
    __createToolbar: function() {
      this.__toolbar = new qx.ui.toolbar.ToolBar();

      var newGameBtn = new qx.ui.toolbar.Button("New Game");
      newGameBtn.addListener("execute", this.__onNewGame, this);

      // Create difficulty selector with SelectBox
      var difficultyLabel = new qx.ui.basic.Label("Difficulty:");
      difficultyLabel.setMarginLeft(10);
      difficultyLabel.setAlignY("middle");

      this.__difficultySelect = new qx.ui.form.SelectBox();
      this.__difficultySelect.set({
        width: 200
      });

      // Add difficulty options
      var beginnerItem = new qx.ui.form.ListItem("Beginner (9x9, 10 mines)", null, "beginner");
      var intermediateItem = new qx.ui.form.ListItem("Intermediate (16x16, 40 mines)", null, "intermediate");
      var expertItem = new qx.ui.form.ListItem("Expert (16x30, 99 mines)", null, "expert");

      this.__difficultySelect.add(beginnerItem);
      this.__difficultySelect.add(intermediateItem);
      this.__difficultySelect.add(expertItem);

      // Set default selection
      this.__difficultySelect.setSelection([beginnerItem]);

      // Store current difficulty to detect changes
      this.__currentDifficulty = "beginner";
      this.__isChangingDifficulty = false;

      // Listen for changes
      this.__difficultySelect.addListener("changeSelection", function(e) {
        // Prevent recursive calls
        if (this.__isChangingDifficulty) {
          return;
        }

        var selection = e.getData();
        if (selection && selection.length > 0) {
          var selectedItem = selection[0];
          var difficulty = selectedItem.getModel();

          // Only proceed if difficulty actually changed
          if (difficulty !== this.__currentDifficulty) {
            console.log("[MinesweeperWindow] Difficulty change requested:", difficulty);

            // Check if game is in progress
            var gameState = this.__game.getGameState();
            var shouldChange = true;

            if (gameState === "playing") {
              shouldChange = confirm("Change difficulty? Current game will be lost.");
            }

            if (shouldChange) {
              console.log("[MinesweeperWindow] Changing difficulty to:", difficulty);
              this.__currentDifficulty = difficulty;
              this.__game.setDifficulty(difficulty);
              this.__resizeWindow();
            } else {
              // Revert selection to current difficulty
              console.log("[MinesweeperWindow] Difficulty change cancelled, reverting to:", this.__currentDifficulty);
              this.__isChangingDifficulty = true;

              var items = this.__difficultySelect.getChildren();
              for (var i = 0; i < items.length; i++) {
                if (items[i].getModel() === this.__currentDifficulty) {
                  this.__difficultySelect.setSelection([items[i]]);
                  break;
                }
              }

              // Reset flag after a short delay to ensure event completes
              qx.event.Timer.once(function() {
                this.__isChangingDifficulty = false;
              }, this, 10);
            }
          }
        }
      }, this);

      this.__toolbar.add(newGameBtn);
      this.__toolbar.addSpacer();
      this.__toolbar.add(difficultyLabel);
      this.__toolbar.add(this.__difficultySelect);
      this.__toolbar.addSpacer();

      this.add(this.__toolbar);
    },

    /**
     * Create status bar showing mine count and timer
     */
    __createStatusBar: function() {
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.setPadding(5);
      this.__statusBar.setBackgroundColor("#C0C0C0");

      // Mine count display (digital style)
      var mineCountContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      mineCountContainer.set({
        backgroundColor: "#000000",
        padding: 5,
        decorator: new qx.ui.decoration.Decorator().set({
          width: 2,
          style: "inset",
          color: "#808080"
        })
      });

      this.__mineCountLabel = new qx.ui.basic.Label("010");
      this.__mineCountLabel.set({
        font: qx.bom.Font.fromString("bold 20px monospace"),
        textColor: "#FF0000",
        width: 50,
        textAlign: "right"
      });
      mineCountContainer.add(this.__mineCountLabel);

      // Smiley face button
      var smileyBtn = new qx.ui.form.Button("😊");
      smileyBtn.set({
        font: qx.bom.Font.fromString("20px Arial"),
        padding: 2,
        width: 35,
        height: 35
      });
      smileyBtn.addListener("execute", this.__onNewGame, this);

      // Timer display (digital style)
      var timerContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      timerContainer.set({
        backgroundColor: "#000000",
        padding: 5,
        decorator: new qx.ui.decoration.Decorator().set({
          width: 2,
          style: "inset",
          color: "#808080"
        })
      });

      this.__timerLabel = new qx.ui.basic.Label("000");
      this.__timerLabel.set({
        font: qx.bom.Font.fromString("bold 20px monospace"),
        textColor: "#FF0000",
        width: 50,
        textAlign: "right"
      });
      timerContainer.add(this.__timerLabel);

      this.__statusBar.add(mineCountContainer);
      this.__statusBar.add(new qx.ui.core.Spacer(), {flex: 1});
      this.__statusBar.add(smileyBtn);
      this.__statusBar.add(new qx.ui.core.Spacer(), {flex: 1});
      this.__statusBar.add(timerContainer);

      this.add(this.__statusBar);
    },

    /**
     * Create the game board grid
     */
    __createGameBoard: function() {
      this.__scrollContainer = new qx.ui.container.Scroll();
      this.__scrollContainer.set({
        backgroundColor: "#C0C0C0"
      });

      this.__gameBoard = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      this.__gameBoard.set({
        backgroundColor: "#C0C0C0",
        padding: 10
      });

      this.__scrollContainer.add(this.__gameBoard);
      this.add(this.__scrollContainer, {flex: 1});

      // Listen to window resize events
      this.addListener("resize", this.__onWindowResize, this);

      this.__renderBoard();
    },

    /**
     * Render the game board
     */
    __renderBoard: function() {
      // Clear existing cells
      this.__gameBoard.removeAll();
      this.__cells = [];

      var rows = this.__game.getRows();
      var cols = this.__game.getCols();

      console.log("[MinesweeperWindow] Rendering board:", rows, "x", cols);

      // Set board size
      var boardWidth = cols * this.__cellSize;
      var boardHeight = rows * this.__cellSize;
      this.__gameBoard.set({
        width: boardWidth,
        height: boardHeight
      });

      // Create cells
      for (var row = 0; row < rows; row++) {
        this.__cells[row] = [];
        for (var col = 0; col < cols; col++) {
          var cell = this.__createCell(row, col);
          this.__cells[row][col] = cell;

          var left = col * this.__cellSize;
          var top = row * this.__cellSize;

          this.__gameBoard.add(cell, {left: left, top: top});
        }
      }

      // Update all cell displays
      this.__updateAllCells();
      this.__updateStatus();
    },

    /**
     * Create a single cell widget
     */
    __createCell: function(row, col) {
      var cell = new qx.ui.basic.Label("");
      cell.set({
        width: this.__cellSize,
        height: this.__cellSize,
        backgroundColor: "#C0C0C0",
        textAlign: "center",
        alignY: "middle",
        font: qx.bom.Font.fromString("bold 16px Arial"),
        cursor: "pointer",
        decorator: new qx.ui.decoration.Decorator().set({
          width: 2,
          style: "outset",
          color: "#808080"
        })
      });

      cell.setUserData("row", row);
      cell.setUserData("col", col);

      // Left click - reveal cell
      cell.addListener("click", function(e) {
        this.__onCellClick(row, col, e);
      }, this);

      // Right click - toggle flag
      cell.addListener("contextmenu", function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.__onCellRightClick(row, col);
      }, this);

      // Double click - chord
      cell.addListener("dblclick", function(e) {
        this.__onCellDoubleClick(row, col);
      }, this);

      return cell;
    },

    /**
     * Handle cell left click
     */
    __onCellClick: function(row, col, e) {
      console.log("[MinesweeperWindow] Cell clicked:", row, col);
      this.__game.revealCell(row, col);
    },

    /**
     * Handle cell right click
     */
    __onCellRightClick: function(row, col) {
      console.log("[MinesweeperWindow] Cell right-clicked:", row, col);
      this.__game.toggleFlag(row, col);
    },

    /**
     * Handle cell double click (chord)
     */
    __onCellDoubleClick: function(row, col) {
      console.log("[MinesweeperWindow] Cell double-clicked:", row, col);
      this.__game.chordCell(row, col);
    },

    /**
     * Update display of all cells
     */
    __updateAllCells: function() {
      var rows = this.__game.getRows();
      var cols = this.__game.getCols();

      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          this.__updateCell(row, col);
        }
      }
    },

    /**
     * Update display of a single cell
     */
    __updateCell: function(row, col) {
      var cellData = this.__game.getCell(row, col);
      var cellWidget = this.__cells[row][col];

      if (!cellData || !cellWidget) {
        return;
      }

      if (cellData.isRevealed) {
        // Revealed cell
        cellWidget.set({
          decorator: new qx.ui.decoration.Decorator().set({
            width: 1,
            style: "solid",
            color: "#808080",
            backgroundColor: "#BDBDBD"
          }),
          backgroundColor: "#BDBDBD"
        });

        if (cellData.isMine) {
          // Show mine
          cellWidget.setValue("💣");
          cellWidget.setTextColor("#000000");

          // Highlight the mine that was clicked
          var gameState = this.__game.getGameState();
          if (gameState === "lost") {
            cellWidget.setBackgroundColor("#FF0000");
          }
        } else if (cellData.neighborMineCount > 0) {
          // Show number
          cellWidget.setValue(String(cellData.neighborMineCount));

          // Color code numbers
          var colors = {
            1: "#0000FF", // Blue
            2: "#008000", // Green
            3: "#FF0000", // Red
            4: "#000080", // Dark Blue
            5: "#800000", // Maroon
            6: "#008080", // Cyan
            7: "#000000", // Black
            8: "#808080"  // Gray
          };
          cellWidget.setTextColor(colors[cellData.neighborMineCount] || "#000000");
        } else {
          // Empty cell
          cellWidget.setValue("");
        }
      } else {
        // Unrevealed cell
        cellWidget.set({
          decorator: new qx.ui.decoration.Decorator().set({
            width: 2,
            style: "outset",
            color: "#808080"
          }),
          backgroundColor: "#C0C0C0"
        });

        if (cellData.isFlagged) {
          // Show flag
          cellWidget.setValue("🚩");
        } else if (cellData.isQuestionMarked) {
          // Show question mark
          cellWidget.setValue("❓");
        } else {
          cellWidget.setValue("");
        }
      }
    },

    /**
     * Update status bar (mine count and timer)
     */
    __updateStatus: function() {
      var remaining = this.__game.getRemainingMines();
      var time = this.__game.getElapsedTime();

      // Format with leading zeros
      var mineStr = String(Math.max(0, remaining)).padStart(3, "0");
      var timeStr = String(Math.min(999, time)).padStart(3, "0");

      this.__mineCountLabel.setValue(mineStr);
      this.__timerLabel.setValue(timeStr);
    },

    /**
     * Handle game state change
     */
    __onGameStateChange: function(e) {
      console.log("[MinesweeperWindow] Game state changed");

      // Check if board dimensions changed (difficulty change)
      if (this.__cells && this.__cells.length > 0) {
        var currentRows = this.__cells.length;
        var currentCols = this.__cells[0] ? this.__cells[0].length : 0;
        var newRows = this.__game.getRows();
        var newCols = this.__game.getCols();

        if (currentRows !== newRows || currentCols !== newCols) {
          console.log("[MinesweeperWindow] Board size changed, skipping update (will be handled by resizeWindow)");
          this.__updateStatus();
          return;
        }
      }

      this.__updateAllCells();
      this.__updateStatus();
    },

    /**
     * Handle game won
     */
    __onGameWon: function(e) {
      console.log("[MinesweeperWindow] Game won!");

      setTimeout(function() {
        var time = this.__game.getElapsedTime();
        alert("Congratulations! You won!\nTime: " + time + " seconds");
      }.bind(this), 100);
    },

    /**
     * Handle game lost
     */
    __onGameLost: function(e) {
      console.log("[MinesweeperWindow] Game lost!");

      setTimeout(function() {
        alert("Game Over! You hit a mine.");
      }.bind(this), 100);
    },

    /**
     * Handle timer update
     */
    __onTimerUpdate: function(e) {
      this.__updateStatus();
    },

    /**
     * Handle new game button
     */
    __onNewGame: function(e) {
      console.log("[MinesweeperWindow] New game started");
      this.__game.newGame();
      this.__updateAllCells();
      this.__updateStatus();
    },

    /**
     * Handle window resize event
     */
    __onWindowResize: function(e) {
      if (!this.__scrollContainer || !this.__gameBoard) {
        return;
      }

      // Get available space in scroll container
      var scrollBounds = this.__scrollContainer.getBounds();
      if (!scrollBounds) {
        return;
      }

      var rows = this.__game.getRows();
      var cols = this.__game.getCols();

      // Calculate optimal cell size based on available space
      var availableWidth = scrollBounds.width - 40; // Subtract padding
      var availableHeight = scrollBounds.height - 40;

      var cellWidthByWidth = Math.floor(availableWidth / cols);
      var cellHeightByHeight = Math.floor(availableHeight / rows);

      // Use the smaller size to ensure board fits
      var optimalCellSize = Math.max(15, Math.min(35, Math.min(cellWidthByWidth, cellHeightByHeight)));

      // Only re-render if cell size changed significantly (to avoid too many redraws)
      if (Math.abs(this.__cellSize - optimalCellSize) > 2) {
        console.log("[MinesweeperWindow] Adjusting cell size from", this.__cellSize, "to", optimalCellSize);
        this.__cellSize = optimalCellSize;
        this.__renderBoard();
      }
    },

    /**
     * Resize window based on board size
     */
    __resizeWindow: function() {
      var rows = this.__game.getRows();
      var cols = this.__game.getCols();

      console.log("[MinesweeperWindow] Resizing window for board:", rows, "x", cols);

      // Reset cell size to default
      this.__cellSize = 30;

      // Calculate window size based on board
      var boardWidth = cols * this.__cellSize + 60; // +60 for padding and scrollbar
      var boardHeight = rows * this.__cellSize + 60; // +60 for padding

      // Add height for toolbar and status bar
      var totalHeight = boardHeight + 150;

      // Limit to reasonable sizes
      var maxWidth = 1000;
      var maxHeight = 800;

      var finalWidth = Math.min(boardWidth, maxWidth);
      var finalHeight = Math.min(totalHeight, maxHeight);

      console.log("[MinesweeperWindow] Setting window size to:", finalWidth, "x", finalHeight);

      this.set({
        width: finalWidth,
        height: finalHeight
      });

      // Force a re-render of the board
      console.log("[MinesweeperWindow] Rendering new board...");
      this.__renderBoard();

      this.center();

      console.log("[MinesweeperWindow] Window resize complete for difficulty:", this.__game.getDifficulty());
    }
  },

  destruct : function()
  {
    if (this.__game) {
      this.__game.dispose();
      this.__game = null;
    }

    this.__cells = null;
  }
});
