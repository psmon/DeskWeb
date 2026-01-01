/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * Klondike Solitaire Game Logic
 *
 * This class handles the game state and logic for Klondike Solitaire
 */
qx.Class.define("deskweb.game.SolitaireGame",
{
  extend : qx.core.Object,

  construct : function()
  {
    this.base(arguments);
    this.__initializeGame();
  },

  events : {
    /** Fired when the game state changes */
    "gameStateChange" : "qx.event.type.Event",

    /** Fired when a move is made */
    "moveComplete" : "qx.event.type.Data",

    /** Fired when the game is won */
    "gameWon" : "qx.event.type.Event"
  },

  properties : {
    /** Current score */
    score : {
      check : "Number",
      init : 0,
      event : "changeScore"
    },

    /** Number of moves */
    moves : {
      check : "Number",
      init : 0,
      event : "changeMoves"
    }
  },

  members :
  {
    __deck: null,           // Complete deck
    __stock: null,          // Stock pile (cards to draw from)
    __waste: null,          // Waste pile (drawn cards)
    __foundations: null,    // 4 foundation piles (Ace to King)
    __tableau: null,        // 7 tableau piles

    /**
     * Initialize the game
     */
    __initializeGame: function() {
      this.__deck = this.__createDeck();
      this.__shuffle(this.__deck);

      this.__stock = [];
      this.__waste = [];
      this.__foundations = [[], [], [], []]; // 4 suits
      this.__tableau = [[], [], [], [], [], [], []]; // 7 columns

      this.setScore(0);
      this.setMoves(0);

      this.__dealCards();

      console.log("[SolitaireGame] Game initialized");
    },

    /**
     * Create a standard 52-card deck
     */
    __createDeck: function() {
      var suits = ["hearts", "diamonds", "clubs", "spades"];
      var ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      var deck = [];

      for (var s = 0; s < suits.length; s++) {
        for (var r = 0; r < ranks.length; r++) {
          deck.push({
            suit: suits[s],
            rank: ranks[r],
            value: r + 1, // A=1, 2=2, ..., K=13
            color: (suits[s] === "hearts" || suits[s] === "diamonds") ? "red" : "black",
            faceUp: false
          });
        }
      }

      return deck;
    },

    /**
     * Shuffle the deck using Fisher-Yates algorithm
     */
    __shuffle: function(deck) {
      for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
      }
    },

    /**
     * Deal cards to tableau and stock
     */
    __dealCards: function() {
      // Deal to tableau: 1, 2, 3, 4, 5, 6, 7 cards
      for (var col = 0; col < 7; col++) {
        for (var row = 0; row <= col; row++) {
          var card = this.__deck.pop();
          if (row === col) {
            card.faceUp = true; // Top card is face up
          }
          this.__tableau[col].push(card);
        }
      }

      // Remaining cards go to stock
      while (this.__deck.length > 0) {
        this.__stock.push(this.__deck.pop());
      }

      console.log("[SolitaireGame] Cards dealt - Stock:", this.__stock.length, "Tableau:", this.__tableau);
    },

    /**
     * Draw a card from stock to waste
     */
    drawFromStock: function() {
      if (this.__stock.length > 0) {
        var card = this.__stock.pop();
        card.faceUp = true;
        this.__waste.push(card);
        this.setMoves(this.getMoves() + 1);
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Drew card from stock:", card);
        return true;
      } else if (this.__waste.length > 0) {
        // Reset stock from waste
        while (this.__waste.length > 0) {
          var wasteCard = this.__waste.pop();
          wasteCard.faceUp = false;
          this.__stock.push(wasteCard);
        }
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Reset stock from waste");
        return true;
      }
      return false;
    },

    /**
     * Get the top card of waste pile
     */
    getWasteTop: function() {
      return this.__waste.length > 0 ? this.__waste[this.__waste.length - 1] : null;
    },

    /**
     * Move card from waste to foundation
     */
    moveWasteToFoundation: function(foundationIndex) {
      if (this.__waste.length === 0) return false;

      var card = this.__waste[this.__waste.length - 1];
      if (this.__canMoveToFoundation(card, foundationIndex)) {
        this.__waste.pop();
        this.__foundations[foundationIndex].push(card);
        this.setScore(this.getScore() + 10);
        this.setMoves(this.getMoves() + 1);
        this.__checkWin();
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Moved waste to foundation", foundationIndex);
        return true;
      }
      return false;
    },

    /**
     * Move card from waste to tableau
     */
    moveWasteToTableau: function(tableauIndex) {
      if (this.__waste.length === 0) return false;

      var card = this.__waste[this.__waste.length - 1];
      if (this.__canMoveToTableau(card, tableauIndex)) {
        this.__waste.pop();
        this.__tableau[tableauIndex].push(card);
        this.setScore(this.getScore() + 5);
        this.setMoves(this.getMoves() + 1);
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Moved waste to tableau", tableauIndex);
        return true;
      }
      return false;
    },

    /**
     * Move cards within tableau
     */
    moveTableauToTableau: function(fromIndex, cardIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= 7 || toIndex < 0 || toIndex >= 7) return false;

      var fromPile = this.__tableau[fromIndex];
      if (cardIndex >= fromPile.length) return false;

      var cards = fromPile.slice(cardIndex);
      var topCard = cards[0];

      if (this.__canMoveToTableau(topCard, toIndex)) {
        // Remove cards from source
        this.__tableau[fromIndex] = fromPile.slice(0, cardIndex);

        // Flip top card if exists
        if (this.__tableau[fromIndex].length > 0) {
          this.__tableau[fromIndex][this.__tableau[fromIndex].length - 1].faceUp = true;
        }

        // Add cards to destination
        this.__tableau[toIndex] = this.__tableau[toIndex].concat(cards);

        this.setScore(this.getScore() + 3);
        this.setMoves(this.getMoves() + 1);
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Moved tableau to tableau", fromIndex, "->", toIndex);
        return true;
      }
      return false;
    },

    /**
     * Move card from tableau to foundation
     */
    moveTableauToFoundation: function(tableauIndex, foundationIndex) {
      var pile = this.__tableau[tableauIndex];
      if (pile.length === 0) return false;

      var card = pile[pile.length - 1];
      if (this.__canMoveToFoundation(card, foundationIndex)) {
        pile.pop();

        // Flip top card if exists
        if (pile.length > 0) {
          pile[pile.length - 1].faceUp = true;
        }

        this.__foundations[foundationIndex].push(card);
        this.setScore(this.getScore() + 10);
        this.setMoves(this.getMoves() + 1);
        this.__checkWin();
        this.fireEvent("gameStateChange");
        console.log("[SolitaireGame] Moved tableau to foundation", tableauIndex, "->", foundationIndex);
        return true;
      }
      return false;
    },

    /**
     * Check if card can be moved to foundation
     */
    __canMoveToFoundation: function(card, foundationIndex) {
      var foundation = this.__foundations[foundationIndex];

      if (foundation.length === 0) {
        return card.rank === "A";
      }

      var topCard = foundation[foundation.length - 1];
      return card.suit === topCard.suit && card.value === topCard.value + 1;
    },

    /**
     * Check if card can be moved to tableau
     */
    __canMoveToTableau: function(card, tableauIndex) {
      var pile = this.__tableau[tableauIndex];

      if (pile.length === 0) {
        return card.rank === "K"; // Only Kings on empty piles
      }

      var topCard = pile[pile.length - 1];
      return card.color !== topCard.color && card.value === topCard.value - 1;
    },

    /**
     * Check if game is won
     */
    __checkWin: function() {
      for (var i = 0; i < 4; i++) {
        if (this.__foundations[i].length !== 13) {
          return false;
        }
      }

      console.log("[SolitaireGame] Game won!");
      this.fireEvent("gameWon");
      return true;
    },

    /**
     * Get game state for saving/loading
     */
    getGameState: function() {
      return {
        stock: this.__stock,
        waste: this.__waste,
        foundations: this.__foundations,
        tableau: this.__tableau,
        score: this.getScore(),
        moves: this.getMoves()
      };
    },

    /**
     * Set game state from saved data
     */
    setGameState: function(state) {
      if (!state) return;

      this.__stock = state.stock || [];
      this.__waste = state.waste || [];
      this.__foundations = state.foundations || [[], [], [], []];
      this.__tableau = state.tableau || [[], [], [], [], [], [], []];
      this.setScore(state.score || 0);
      this.setMoves(state.moves || 0);

      this.fireEvent("gameStateChange");
      console.log("[SolitaireGame] Game state loaded");
    },

    /**
     * Reset game
     */
    newGame: function() {
      this.__initializeGame();
      this.fireEvent("gameStateChange");
      console.log("[SolitaireGame] New game started");
    },

    /**
     * Get stock pile
     */
    getStock: function() {
      return this.__stock;
    },

    /**
     * Get waste pile
     */
    getWaste: function() {
      return this.__waste;
    },

    /**
     * Get foundation piles
     */
    getFoundations: function() {
      return this.__foundations;
    },

    /**
     * Get tableau piles
     */
    getTableau: function() {
      return this.__tableau;
    }
  }
});
