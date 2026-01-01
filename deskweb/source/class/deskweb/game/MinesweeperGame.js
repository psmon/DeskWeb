/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * Minesweeper Game Logic
 *
 * Implements classic Windows Minesweeper game rules
 */
qx.Class.define("deskweb.game.MinesweeperGame",
{
  extend : qx.core.Object,

  construct : function()
  {
    this.base(arguments);

    console.log("[MinesweeperGame] Initializing...");

    // Default to beginner difficulty
    this.__difficulty = "beginner";
    this.__rows = 9;
    this.__cols = 9;
    this.__mineCount = 10;

    this.__initGame();
  },

  events :
  {
    /** Fired when game state changes */
    "gameStateChange": "qx.event.type.Event",

    /** Fired when game is won */
    "gameWon": "qx.event.type.Event",

    /** Fired when game is lost */
    "gameLost": "qx.event.type.Data",

    /** Fired when timer updates */
    "timerUpdate": "qx.event.type.Data"
  },

  members :
  {
    __difficulty: null,
    __rows: null,
    __cols: null,
    __mineCount: null,
    __board: null,
    __gameState: null,  // 'ready', 'playing', 'won', 'lost'
    __flagCount: null,
    __revealedCount: null,
    __firstClick: true,
    __timer: null,
    __elapsedTime: null,

    /**
     * Initialize or reset the game
     */
    __initGame: function() {
      this.__board = [];
      this.__gameState = "ready";
      this.__flagCount = 0;
      this.__revealedCount = 0;
      this.__firstClick = true;
      this.__elapsedTime = 0;

      // Stop existing timer
      if (this.__timer) {
        this.__timer.stop();
        this.__timer.dispose();
        this.__timer = null;
      }

      // Create empty board
      for (var row = 0; row < this.__rows; row++) {
        this.__board[row] = [];
        for (var col = 0; col < this.__cols; col++) {
          this.__board[row][col] = {
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            isQuestionMarked: false,
            neighborMineCount: 0
          };
        }
      }

      console.log("[MinesweeperGame] Game initialized:", this.__difficulty,
                  this.__rows + "x" + this.__cols, this.__mineCount, "mines");
    },

    /**
     * Place mines on the board (avoiding first click position)
     */
    __placeMines: function(avoidRow, avoidCol) {
      var minesPlaced = 0;

      while (minesPlaced < this.__mineCount) {
        var row = Math.floor(Math.random() * this.__rows);
        var col = Math.floor(Math.random() * this.__cols);

        // Don't place mine on first click or adjacent cells
        if (this.__isAdjacentTo(row, col, avoidRow, avoidCol)) {
          continue;
        }

        // Don't place mine if already there
        if (!this.__board[row][col].isMine) {
          this.__board[row][col].isMine = true;
          minesPlaced++;
        }
      }

      // Calculate neighbor mine counts
      this.__calculateNeighborCounts();

      console.log("[MinesweeperGame] Mines placed:", minesPlaced);
    },

    /**
     * Check if cell is adjacent to target cell (including diagonals)
     */
    __isAdjacentTo: function(row, col, targetRow, targetCol) {
      return Math.abs(row - targetRow) <= 1 && Math.abs(col - targetCol) <= 1;
    },

    /**
     * Calculate neighbor mine counts for all cells
     */
    __calculateNeighborCounts: function() {
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          if (!this.__board[row][col].isMine) {
            this.__board[row][col].neighborMineCount = this.__countNeighborMines(row, col);
          }
        }
      }
    },

    /**
     * Count mines in neighboring cells
     */
    __countNeighborMines: function(row, col) {
      var count = 0;
      var neighbors = this.__getNeighbors(row, col);

      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        if (this.__board[n.row][n.col].isMine) {
          count++;
        }
      }

      return count;
    },

    /**
     * Get all valid neighbor cells (8 directions)
     */
    __getNeighbors: function(row, col) {
      var neighbors = [];
      var directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];

      for (var i = 0; i < directions.length; i++) {
        var newRow = row + directions[i][0];
        var newCol = col + directions[i][1];

        if (newRow >= 0 && newRow < this.__rows && newCol >= 0 && newCol < this.__cols) {
          neighbors.push({row: newRow, col: newCol});
        }
      }

      return neighbors;
    },

    /**
     * Start the game timer
     */
    __startTimer: function() {
      if (this.__timer) {
        return;
      }

      this.__timer = new qx.event.Timer(1000);
      this.__timer.addListener("interval", function() {
        this.__elapsedTime++;
        this.fireDataEvent("timerUpdate", this.__elapsedTime);
      }, this);
      this.__timer.start();

      console.log("[MinesweeperGame] Timer started");
    },

    /**
     * Stop the game timer
     */
    __stopTimer: function() {
      if (this.__timer) {
        this.__timer.stop();
        this.__timer.dispose();
        this.__timer = null;
      }
    },

    /**
     * Reveal a cell (left click)
     */
    revealCell: function(row, col) {
      if (this.__gameState === "won" || this.__gameState === "lost") {
        return false;
      }

      var cell = this.__board[row][col];

      // Can't reveal flagged cells
      if (cell.isFlagged) {
        return false;
      }

      // Already revealed
      if (cell.isRevealed) {
        return false;
      }

      // First click - place mines and start timer
      if (this.__firstClick) {
        this.__placeMines(row, col);
        this.__startTimer();
        this.__firstClick = false;
        this.__gameState = "playing";
      }

      // Reveal the cell
      cell.isRevealed = true;
      this.__revealedCount++;

      console.log("[MinesweeperGame] Cell revealed:", row, col,
                  "Mines nearby:", cell.neighborMineCount);

      // Hit a mine - game over
      if (cell.isMine) {
        this.__gameState = "lost";
        this.__stopTimer();
        this.__revealAllMines();
        this.fireDataEvent("gameLost", {row: row, col: col});
        this.fireEvent("gameStateChange");
        console.log("[MinesweeperGame] Game lost!");
        return true;
      }

      // If cell has no neighbor mines, reveal neighbors recursively
      if (cell.neighborMineCount === 0) {
        this.__revealNeighbors(row, col);
      }

      // Check for win
      this.__checkWinCondition();

      this.fireEvent("gameStateChange");
      return true;
    },

    /**
     * Recursively reveal neighbors (for cells with no nearby mines)
     */
    __revealNeighbors: function(row, col) {
      var neighbors = this.__getNeighbors(row, col);

      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        var cell = this.__board[n.row][n.col];

        if (!cell.isRevealed && !cell.isFlagged && !cell.isMine) {
          cell.isRevealed = true;
          this.__revealedCount++;

          // Continue expanding if this cell also has no neighbors
          if (cell.neighborMineCount === 0) {
            this.__revealNeighbors(n.row, n.col);
          }
        }
      }
    },

    /**
     * Reveal all mines (when game is lost)
     */
    __revealAllMines: function() {
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var cell = this.__board[row][col];
          if (cell.isMine) {
            cell.isRevealed = true;
          }
        }
      }
    },

    /**
     * Toggle flag on a cell (right click)
     */
    toggleFlag: function(row, col) {
      if (this.__gameState === "won" || this.__gameState === "lost") {
        return false;
      }

      var cell = this.__board[row][col];

      // Can't flag revealed cells
      if (cell.isRevealed) {
        return false;
      }

      // Toggle flag state: none -> flag -> question -> none
      if (!cell.isFlagged && !cell.isQuestionMarked) {
        // Place flag
        cell.isFlagged = true;
        this.__flagCount++;
        console.log("[MinesweeperGame] Flag placed:", row, col);
      } else if (cell.isFlagged) {
        // Remove flag, add question mark
        cell.isFlagged = false;
        cell.isQuestionMarked = true;
        this.__flagCount--;
        console.log("[MinesweeperGame] Question mark placed:", row, col);
      } else {
        // Remove question mark
        cell.isQuestionMarked = false;
        console.log("[MinesweeperGame] Mark removed:", row, col);
      }

      this.fireEvent("gameStateChange");
      return true;
    },

    /**
     * Chord operation (double-click or both buttons on revealed cell)
     */
    chordCell: function(row, col) {
      if (this.__gameState === "won" || this.__gameState === "lost") {
        return false;
      }

      var cell = this.__board[row][col];

      // Can only chord revealed cells with numbers
      if (!cell.isRevealed || cell.neighborMineCount === 0) {
        return false;
      }

      // Count flagged neighbors
      var neighbors = this.__getNeighbors(row, col);
      var flaggedCount = 0;

      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        if (this.__board[n.row][n.col].isFlagged) {
          flaggedCount++;
        }
      }

      // Only chord if flagged count matches number
      if (flaggedCount !== cell.neighborMineCount) {
        return false;
      }

      console.log("[MinesweeperGame] Chording cell:", row, col);

      // Reveal all non-flagged neighbors
      var hitMine = false;
      for (var j = 0; j < neighbors.length; j++) {
        var n = neighbors[j];
        var neighborCell = this.__board[n.row][n.col];

        if (!neighborCell.isFlagged && !neighborCell.isRevealed) {
          // This might reveal a mine if flags were wrong
          if (neighborCell.isMine) {
            hitMine = true;
            neighborCell.isRevealed = true;
          } else {
            this.revealCell(n.row, n.col);
          }
        }
      }

      if (hitMine) {
        this.__gameState = "lost";
        this.__stopTimer();
        this.__revealAllMines();
        this.fireDataEvent("gameLost", {row: row, col: col});
        this.fireEvent("gameStateChange");
        console.log("[MinesweeperGame] Game lost by chording!");
      }

      return true;
    },

    /**
     * Check if player has won
     */
    __checkWinCondition: function() {
      // Win condition: all non-mine cells are revealed
      var totalCells = this.__rows * this.__cols;
      var nonMineCells = totalCells - this.__mineCount;

      if (this.__revealedCount === nonMineCells) {
        this.__gameState = "won";
        this.__stopTimer();
        this.__flagAllMines();
        this.fireEvent("gameWon");
        this.fireEvent("gameStateChange");
        console.log("[MinesweeperGame] Game won! Time:", this.__elapsedTime);
      }
    },

    /**
     * Automatically flag all mines when game is won
     */
    __flagAllMines: function() {
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var cell = this.__board[row][col];
          if (cell.isMine && !cell.isFlagged) {
            cell.isFlagged = true;
            this.__flagCount++;
          }
        }
      }
    },

    /**
     * Start a new game with current difficulty
     */
    newGame: function() {
      console.log("[MinesweeperGame] Starting new game");
      this.__initGame();
      this.fireEvent("gameStateChange");
    },

    /**
     * Set difficulty and start new game
     */
    setDifficulty: function(difficulty) {
      this.__difficulty = difficulty;

      switch(difficulty) {
        case "beginner":
          this.__rows = 9;
          this.__cols = 9;
          this.__mineCount = 10;
          break;
        case "intermediate":
          this.__rows = 16;
          this.__cols = 16;
          this.__mineCount = 40;
          break;
        case "expert":
          this.__rows = 16;
          this.__cols = 30;
          this.__mineCount = 99;
          break;
        default:
          console.warn("[MinesweeperGame] Unknown difficulty:", difficulty);
          return;
      }

      console.log("[MinesweeperGame] Difficulty set to:", difficulty);
      this.newGame();
    },

    /**
     * Get current board state
     */
    getBoard: function() {
      return this.__board;
    },

    /**
     * Get cell at position
     */
    getCell: function(row, col) {
      if (row >= 0 && row < this.__rows && col >= 0 && col < this.__cols) {
        return this.__board[row][col];
      }
      return null;
    },

    /**
     * Get current game state
     */
    getGameState: function() {
      return this.__gameState;
    },

    /**
     * Get remaining mine count (total mines - flags placed)
     */
    getRemainingMines: function() {
      return this.__mineCount - this.__flagCount;
    },

    /**
     * Get elapsed time
     */
    getElapsedTime: function() {
      return this.__elapsedTime;
    },

    /**
     * Get board dimensions
     */
    getRows: function() {
      return this.__rows;
    },

    getCols: function() {
      return this.__cols;
    },

    getDifficulty: function() {
      return this.__difficulty;
    }
  },

  destruct : function()
  {
    this.__stopTimer();
    this.__board = null;
  }
});
