/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * Solitaire Game Window
 *
 * A complete Klondike Solitaire card game implementation
 */
qx.Class.define("deskweb.ui.SolitaireWindow",
{
  extend : qx.ui.window.Window,

  construct : function()
  {
    this.base(arguments, "Solitaire");

    console.log("[SolitaireWindow] Initializing...");

    this.set({
      width: 800,
      height: 600,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 10
    });

    this.setLayout(new qx.ui.layout.VBox(5));

    // Initialize game logic
    this.__game = new deskweb.game.SolitaireGame();
    this.__game.addListener("gameStateChange", this.__onGameStateChange, this);
    this.__game.addListener("gameWon", this.__onGameWon, this);

    // Create UI components
    this.__createToolbar();
    this.__createGameArea();
    this.__createStatusBar();

    // Initial render
    this.__renderGame();

    // Load saved game state
    this.__loadGameState();

    // Auto-save on close
    this.addListener("close", this.__saveGameState, this);

    console.log("[SolitaireWindow] Initialized successfully");
  },

  members :
  {
    __game: null,
    __toolbar: null,
    __gameArea: null,
    __statusBar: null,
    __scoreLabel: null,
    __movesLabel: null,
    __stockContainer: null,
    __wasteContainer: null,
    __foundationContainers: null,
    __tableauContainers: null,
    __dragCard: null,
    __dragSource: null,
    __dragIndex: null,
    __dragCardIndex: null,
    __selectedCard: null,
    __selectedSource: null,
    __selectedIndex: null,
    __selectedCardIndex: null,
    __isDragging: false,
    __draggedWidget: null,
    __dragIndicator: null,
    __dragOffsetX: 0,
    __dragOffsetY: 0,
    __dragOriginalParent: null,
    __dragOriginalLayoutProps: null,
    __dragStartMouseX: 0,
    __dragStartMouseY: 0,
    __dropTargets: null,

    /**
     * Create toolbar with game controls
     */
    __createToolbar: function() {
      this.__toolbar = new qx.ui.toolbar.ToolBar();

      var newGameBtn = new qx.ui.toolbar.Button("New Game");
      newGameBtn.addListener("execute", this.__onNewGame, this);

      var hintBtn = new qx.ui.toolbar.Button("Hint");
      hintBtn.addListener("execute", this.__onHint, this);

      this.__toolbar.add(newGameBtn);
      this.__toolbar.add(hintBtn);
      this.__toolbar.addSpacer();

      this.add(this.__toolbar);
    },

    /**
     * Create main game area
     */
    __createGameArea: function() {
      this.__gameArea = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.__gameArea.setBackgroundColor("#0A7C3E"); // Green felt

      // Click on game area background to deselect
      this.__gameArea.addListener("click", function(e) {
        // Only clear if clicking directly on game area (not bubbled from children)
        if (e.getTarget() === this.__gameArea) {
          console.log("[SolitaireWindow] Game area clicked - clearing selection");
          this.__clearSelection();
          this.__renderGame();
        }
      }, this);

      // Top area: Stock, Waste, and Foundations
      var topArea = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      topArea.setPadding(10);

      // Stock pile
      this.__stockContainer = this.__createCardContainer("stock");
      this.__stockContainer.addListener("tap", this.__onStockClick, this);
      topArea.add(this.__stockContainer);

      // Waste pile
      this.__wasteContainer = this.__createCardContainer("waste");
      topArea.add(this.__wasteContainer);

      // Spacer
      topArea.add(new qx.ui.core.Spacer(20));

      // Four foundation piles
      this.__foundationContainers = [];
      for (var i = 0; i < 4; i++) {
        var foundation = this.__createCardContainer("foundation-" + i);
        foundation.setUserData("foundationIndex", i);
        this.__foundationContainers.push(foundation);
        topArea.add(foundation);
      }

      this.__gameArea.add(topArea);

      // Tableau area: 7 columns
      var tableauArea = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      tableauArea.setPadding([0, 10, 10, 10]);

      this.__tableauContainers = [];
      for (var j = 0; j < 7; j++) {
        var tableau = this.__createTableauColumn(j);
        tableau.setUserData("tableauIndex", j);
        this.__tableauContainers.push(tableau);
        tableauArea.add(tableau, {flex: 1});
      }

      this.__gameArea.add(tableauArea, {flex: 1});

      this.add(this.__gameArea, {flex: 1});
    },

    /**
     * Create a card container
     */
    __createCardContainer: function(id) {
      var container = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      container.set({
        width: 80,
        height: 110,
        decorator: "main",
        backgroundColor: "rgba(255, 255, 255, 0.1)"
      });
      container.setUserData("containerId", id);
      return container;
    },

    /**
     * Create a tableau column
     */
    __createTableauColumn: function(index) {
      var container = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      container.set({
        minWidth: 80,
        minHeight: 400,
        decorator: "main",
        backgroundColor: "rgba(255, 255, 255, 0.1)"
      });
      container.setUserData("containerId", "tableau-" + index);
      return container;
    },

    /**
     * Create status bar
     */
    __createStatusBar: function() {
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.setPadding(5);

      this.__scoreLabel = new qx.ui.basic.Label("Score: 0");
      this.__movesLabel = new qx.ui.basic.Label("Moves: 0");

      this.__statusBar.add(this.__scoreLabel);
      this.__statusBar.add(new qx.ui.core.Spacer(), {flex: 1});
      this.__statusBar.add(this.__movesLabel);

      this.add(this.__statusBar);
    },

    /**
     * Handle stock click
     */
    __onStockClick: function(e) {
      this.__game.drawFromStock();
    },

    /**
     * Handle new game button
     */
    __onNewGame: function(e) {
      if (confirm("Start a new game?")) {
        this.__game.newGame();
        this.__saveGameState();
      }
    },

    /**
     * Handle hint button
     */
    __onHint: function(e) {
      alert("Try moving cards to foundations (top right) when possible!");
    },

    /**
     * Handle game state change
     */
    __onGameStateChange: function(e) {
      this.__renderGame();
      this.__saveGameState();
    },

    /**
     * Handle game won
     */
    __onGameWon: function(e) {
      setTimeout(function() {
        alert("Congratulations! You won!\nScore: " + this.__game.getScore() + "\nMoves: " + this.__game.getMoves());
      }.bind(this), 100);
    },

    /**
     * Render the entire game state
     */
    __renderGame: function() {
      // Update status
      this.__scoreLabel.setValue("Score: " + this.__game.getScore());
      this.__movesLabel.setValue("Moves: " + this.__game.getMoves());

      // Render stock
      this.__renderStock();

      // Render waste
      this.__renderWaste();

      // Render foundations
      this.__renderFoundations();

      // Render tableau
      this.__renderTableau();
    },

    /**
     * Render stock pile
     */
    __renderStock: function() {
      this.__stockContainer.removeAll();

      var stock = this.__game.getStock();
      if (stock.length > 0) {
        var card = this.__createCardWidget({faceUp: false}, "stock-back");
        this.__stockContainer.add(card, {left: 0, top: 0});
      }
    },

    /**
     * Render waste pile
     */
    __renderWaste: function() {
      this.__wasteContainer.removeAll();

      var waste = this.__game.getWaste();
      if (waste.length > 0) {
        var topCard = waste[waste.length - 1];
        var isSelected = (this.__selectedSource === "waste" && this.__selectedCard === topCard);
        var card = this.__createCardWidget(topCard, "waste-top", isSelected);

        // Make card clickable for selection
        card.addListener("click", function(e) {
          e.stopPropagation(); // Prevent container click
          this.__selectCard(topCard, "waste", -1, -1);
        }, this);

        // Double-click to auto-move to foundation
        card.addListener("dblclick", function(e) {
          e.stopPropagation();
          this.__autoMoveToFoundation("waste", -1, -1);
        }, this);

        // Mouse drag events (using mousedown/mousemove/mouseup instead of drag events)
        card.addListener("mousedown", function(e) {
          this.__onCardMouseDown(e, topCard, "waste", -1, -1, card);
        }, this);

        this.__wasteContainer.add(card, {left: 0, top: 0});
      }
    },

    /**
     * Render foundation piles
     */
    __renderFoundations: function() {
      var foundations = this.__game.getFoundations();

      for (var i = 0; i < 4; i++) {
        this.__foundationContainers[i].removeAll();

        var foundation = foundations[i];
        if (foundation.length > 0) {
          var topCard = foundation[foundation.length - 1];
          var card = this.__createCardWidget(topCard, "foundation-" + i);
          this.__foundationContainers[i].add(card, {left: 0, top: 0});
        }

        // Make clickable for dropping cards
        this.__makeClickable(this.__foundationContainers[i], "foundation", i);

        // Make droppable for drag and drop
        this.__makeDroppable(this.__foundationContainers[i], "foundation", i);
      }
    },

    /**
     * Render tableau piles
     */
    __renderTableau: function() {
      var tableau = this.__game.getTableau();

      for (var col = 0; col < 7; col++) {
        this.__tableauContainers[col].removeAll();

        var pile = tableau[col];
        for (var row = 0; row < pile.length; row++) {
          var cardData = pile[row];
          var isSelected = (this.__selectedSource === "tableau" &&
                           this.__selectedIndex === col &&
                           this.__selectedCardIndex === row);
          var card = this.__createCardWidget(cardData, "tableau-" + col + "-" + row, isSelected);

          // Make face-up cards clickable for selection
          if (cardData.faceUp) {
            card.addListener("click", function(colIdx, rowIdx, cardRef) {
              return function(e) {
                e.stopPropagation(); // Prevent container click
                this.__selectCard(cardRef, "tableau", colIdx, rowIdx);
              };
            }.call(this, col, row, cardData), this);

            // Double-click to auto-move to foundation
            card.addListener("dblclick", function(colIdx, rowIdx) {
              return function(e) {
                e.stopPropagation();
                this.__autoMoveToFoundation("tableau", colIdx, rowIdx);
              };
            }.call(this, col, row), this);

            // Mouse drag events
            card.addListener("mousedown", function(colIdx, rowIdx, cardRef, cardWidget) {
              return function(e) {
                this.__onCardMouseDown(e, cardRef, "tableau", colIdx, rowIdx, cardWidget);
              };
            }.call(this, col, row, cardData, card), this);
          }

          // Adjust spacing to show previous card's corner (18px shows rank and suit)
          this.__tableauContainers[col].add(card, {left: 0, top: row * 18});
        }

        // Make clickable for dropping cards
        this.__makeClickable(this.__tableauContainers[col], "tableau", col);

        // Make droppable for drag and drop
        this.__makeDroppable(this.__tableauContainers[col], "tableau", col);
      }
    },

    /**
     * Create a card widget
     */
    __createCardWidget: function(cardData, cardId, isSelected) {
      // Use Canvas layout for positioning card elements
      var card = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      card.set({
        width: 80,
        height: 110,
        allowGrowX: false,
        allowGrowY: false,
        cursor: "pointer"
      });

      if (cardData.faceUp) {
        // Show card face with corners
        var color = cardData.color === "red" ? "#DC143C" : "#000000";

        // Set appearance for playing card with shadow
        var bgColor = isSelected ? "#FFEB3B" : "white";
        card.set({
          decorator: new qx.ui.decoration.Decorator().set({
            width: 1,
            style: "solid",
            color: "#CCCCCC",
            radius: 5,
            backgroundColor: bgColor,
            shadowLength: 2,
            shadowBlurRadius: 3,
            shadowColor: "rgba(0, 0, 0, 0.3)"
          })
        });

        // Top-left corner
        var topLeft = this.__createCardCorner(cardData.rank, cardData.suit, color, false);
        card.add(topLeft, {left: 2, top: 2});

        // Bottom-right corner (rotated)
        var bottomRight = this.__createCardCorner(cardData.rank, cardData.suit, color, true);
        card.add(bottomRight, {right: 2, bottom: 2});

        // Center symbol - display multiple symbols based on rank
        var centerContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
        this.__addCenterSymbols(centerContainer, cardData.rank, cardData.suit, color);
        card.add(centerContainer, {left: 0, right: 0, top: 20, bottom: 20});

      } else {
        // Show card back with elegant pattern
        card.setBackgroundColor("#2C5F9E");
        card.setCursor("default");

        // Add border for card back
        card.set({
          decorator: new qx.ui.decoration.Decorator().set({
            width: 2,
            style: "solid",
            color: "#1A3D6B",
            radius: 5,
            backgroundColor: "#2C5F9E"
          })
        });

        // Create diagonal pattern background
        var pattern = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
        pattern.set({
          backgroundColor: "#2C5F9E"
        });

        // Add decorative elements to card back
        var backPattern = new qx.ui.basic.Label("♠♥♣♦");
        backPattern.set({
          font: qx.bom.Font.fromString("bold 16px Arial"),
          textColor: "#4A7FB8",
          textAlign: "center",
          rich: true
        });
        card.add(backPattern, {left: 0, right: 0, top: 38, bottom: 38});

        // Add corner decorations
        var corner1 = new qx.ui.basic.Label("♦");
        corner1.set({
          font: qx.bom.Font.fromString("10px Arial"),
          textColor: "#8AB4E5"
        });
        card.add(corner1, {left: 5, top: 5});

        var corner2 = new qx.ui.basic.Label("♦");
        corner2.set({
          font: qx.bom.Font.fromString("10px Arial"),
          textColor: "#8AB4E5"
        });
        corner2.addListener("appear", function() {
          var el = corner2.getContentElement().getDomElement();
          if (el) {
            el.style.transform = "rotate(180deg)";
          }
        });
        card.add(corner2, {right: 5, bottom: 5});
      }

      card.setUserData("cardId", cardId);
      card.setUserData("cardData", cardData);

      return card;
    },

    /**
     * Create card corner (rank + suit)
     */
    __createCardCorner: function(rank, suit, color, rotated) {
      var container = new qx.ui.container.Composite(new qx.ui.layout.VBox(-4));
      container.set({
        allowGrowX: false,
        allowGrowY: false,
        padding: 0
      });

      var rankLabel = new qx.ui.basic.Label(rank);
      rankLabel.set({
        font: "card-rank",
        textColor: color,
        rich: true,
        padding: 0
      });

      var suitLabel = new qx.ui.basic.Label(this.__getSuitSymbol(suit));
      suitLabel.set({
        font: qx.bom.Font.fromString("8px Arial"), // 크기를 4px로 줄임 (기존 7px에서 50% 이상 감소)
        textColor: color,
        rich: true,
        padding: 0
      });

      container.add(rankLabel);
      container.add(suitLabel);

      // Rotate if needed (bottom-right corner)
      if (rotated) {
        container.addListener("appear", function() {
          var el = container.getContentElement().getDomElement();
          if (el) {
            el.style.transform = "rotate(180deg)";
          }
        });
      }

      return container;
    },

    /**
     * Get suit symbol
     */
    __getSuitSymbol: function(suit) {
      var symbols = {
        "hearts": "♥",
        "diamonds": "♦",
        "clubs": "♣",
        "spades": "♠"
      };
      return symbols[suit] || "";
    },

    /**
     * Add center symbols to card based on rank
     */
    __addCenterSymbols: function(container, rank, suit, color) {
      var symbol = this.__getSuitSymbol(suit);

      // Create a centered container
      var centerWrapper = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      centerWrapper.set({
        alignX: "center",
        alignY: "middle"
      });

      // For face cards and Ace, show large single symbol
      if (rank === "A" || rank === "J" || rank === "Q" || rank === "K") {
        var centerLabel = new qx.ui.basic.Label(symbol);
        centerLabel.set({
          font: qx.bom.Font.fromString("bold 32px Arial"),
          textColor: color,
          textAlign: "center",
          alignX: "center",
          alignY: "middle"
        });
        centerWrapper.add(centerLabel);
      } else {
        // For number cards, show a simpler center symbol
        var centerLabel = new qx.ui.basic.Label(symbol);
        centerLabel.set({
          font: qx.bom.Font.fromString("28px Arial"),
          textColor: color,
          textAlign: "center",
          alignX: "center",
          alignY: "middle"
        });
        centerWrapper.add(centerLabel);
      }

      container.add(centerWrapper, {left: 0, right: 0, top: 0, bottom: 0});
    },

    /**
     * Select a card
     */
    __selectCard: function(card, source, sourceIndex, cardIndex) {
      // If a card is already selected, this might be a deselection
      if (this.__selectedCard === card) {
        this.__clearSelection();
        console.log("[SolitaireWindow] Card deselected");
        return;
      }

      // Store selection
      this.__selectedCard = card;
      this.__selectedSource = source;
      this.__selectedIndex = sourceIndex;
      this.__selectedCardIndex = cardIndex;

      console.log("[SolitaireWindow] Card selected:", source, sourceIndex, cardIndex);

      // Visual feedback could be added here
      this.__renderGame(); // Re-render to show selection
    },

    /**
     * Clear card selection
     */
    __clearSelection: function() {
      this.__selectedCard = null;
      this.__selectedSource = null;
      this.__selectedIndex = null;
      this.__selectedCardIndex = null;
    },

    /**
     * Auto-move card to foundation (for double-click)
     */
    __autoMoveToFoundation: function(source, sourceIndex, cardIndex) {
      var success = false;

      // Try each foundation pile
      for (var i = 0; i < 4; i++) {
        if (source === "waste") {
          success = this.__game.moveWasteToFoundation(i);
        } else if (source === "tableau") {
          success = this.__game.moveTableauToFoundation(sourceIndex, i);
        }

        if (success) {
          console.log("[SolitaireWindow] Auto-moved to foundation", i);
          this.__clearSelection();
          return;
        }
      }

      console.log("[SolitaireWindow] Cannot auto-move to foundation");
    },

    /**
     * Handle card mouse down (start of drag)
     */
    __onCardMouseDown: function(e, card, source, sourceIndex, cardIndex, widget) {
      // Prevent text selection during drag
      e.preventDefault();
      e.stopPropagation();

      console.log("[SolitaireWindow] Mouse down on card:", source, sourceIndex, cardIndex);

      // Store drag start position
      this.__dragStartMouseX = e.getDocumentLeft();
      this.__dragStartMouseY = e.getDocumentTop();
      this.__dragCard = card;
      this.__dragSource = source;
      this.__dragIndex = sourceIndex;
      this.__dragCardIndex = cardIndex;
      this.__draggedWidget = widget;

      // Calculate mouse offset from card position
      var widgetLocation = widget.getContentLocation();
      if (widgetLocation) {
        this.__dragOffsetX = e.getDocumentLeft() - widgetLocation.left;
        this.__dragOffsetY = e.getDocumentTop() - widgetLocation.top;
      }

      // Store original position for animation back
      var layoutProps = widget.getLayoutProperties();
      this.__dragOriginalLayoutProps = {
        left: layoutProps.left || 0,
        top: layoutProps.top || 0
      };

      // Add global mouse move and mouse up listeners
      var doc = qx.core.Init.getApplication().getRoot();
      doc.addListener("mousemove", this.__onMouseMove, this);
      doc.addListener("mouseup", this.__onMouseUp, this);
      doc.addListener("losecapture", this.__onMouseUp, this);

      // Set cursor
      widget.setCursor("move");
    },

    /**
     * Handle mouse move (dragging)
     */
    __onMouseMove: function(e) {
      if (!this.__dragCard) {
        return;
      }

      var mouseX = e.getDocumentLeft();
      var mouseY = e.getDocumentTop();

      // Check if we've moved enough to start dragging (threshold of 5px)
      var dx = mouseX - this.__dragStartMouseX;
      var dy = mouseY - this.__dragStartMouseY;
      var distance = Math.sqrt(dx * dx + dy * dy);

      if (!this.__isDragging && distance > 5) {
        // Start dragging
        this.__isDragging = true;
        console.log("[SolitaireWindow] Drag started:", this.__dragSource, this.__dragIndex, this.__dragCardIndex);

        // Create drag indicator (visual clone)
        this.__createDragIndicator(this.__draggedWidget);
      }

      if (this.__isDragging && this.__dragIndicator) {
        // Move drag indicator with mouse
        this.__dragIndicator.setDomPosition(mouseX - this.__dragOffsetX, mouseY - this.__dragOffsetY);

        // Check if over valid drop target
        this.__updateDropTargetHighlight(mouseX, mouseY);
      }
    },

    /**
     * Handle mouse up (end of drag)
     */
    __onMouseUp: function(e) {
      // Remove global listeners
      var doc = qx.core.Init.getApplication().getRoot();
      doc.removeListener("mousemove", this.__onMouseMove, this);
      doc.removeListener("mouseup", this.__onMouseUp, this);
      doc.removeListener("losecapture", this.__onMouseUp, this);

      // Restore cursor
      if (this.__draggedWidget) {
        this.__draggedWidget.setCursor("pointer");
      }

      // If we were dragging, try to drop
      if (this.__isDragging) {
        console.log("[SolitaireWindow] Drag end");

        var mouseX = e.getDocumentLeft();
        var mouseY = e.getDocumentTop();

        // Try to drop on target
        var dropSuccess = this.__tryDrop(mouseX, mouseY);

        if (!dropSuccess) {
          console.log("[SolitaireWindow] Invalid drop - animating back");
          this.__animateCardBack();
        } else {
          // Remove drag indicator immediately on success
          this.__removeDragIndicator();
        }

        // Clear drop target highlights
        this.__clearDropTargetHighlights();
      } else {
        // It was just a click, not a drag
        // The click event will handle it
      }

      // Reset drag state
      this.__isDragging = false;
      this.__dragCard = null;
      this.__dragSource = null;
      this.__dragIndex = null;
      this.__dragCardIndex = null;
      this.__draggedWidget = null;
    },

    /**
     * Try to drop card on target
     */
    __tryDrop: function(mouseX, mouseY) {
      if (!this.__dragCard || !this.__dragSource) {
        return false;
      }

      // Find drop target under mouse
      var dropTarget = this.__findDropTarget(mouseX, mouseY);
      if (!dropTarget) {
        return false;
      }

      console.log("[SolitaireWindow] Drop on:", dropTarget.type, dropTarget.index, "Source:", this.__dragSource);

      var success = false;

      // Try to move the dragged card to this container
      if (dropTarget.type === "foundation") {
        if (this.__dragSource === "waste") {
          success = this.__game.moveWasteToFoundation(dropTarget.index);
        } else if (this.__dragSource === "tableau") {
          success = this.__game.moveTableauToFoundation(this.__dragIndex, dropTarget.index);
        }
      } else if (dropTarget.type === "tableau") {
        if (this.__dragSource === "waste") {
          success = this.__game.moveWasteToTableau(dropTarget.index);
        } else if (this.__dragSource === "tableau") {
          success = this.__game.moveTableauToTableau(this.__dragIndex, this.__dragCardIndex, dropTarget.index);
        }
      }

      if (success) {
        console.log("[SolitaireWindow] Card dropped successfully");
      }

      return success;
    },

    /**
     * Find drop target under mouse position
     */
    __findDropTarget: function(mouseX, mouseY) {
      // Check foundation piles
      for (var i = 0; i < 4; i++) {
        if (this.__isMouseOverContainer(mouseX, mouseY, this.__foundationContainers[i])) {
          return {type: "foundation", index: i};
        }
      }

      // Check tableau piles
      for (var j = 0; j < 7; j++) {
        if (this.__isMouseOverContainer(mouseX, mouseY, this.__tableauContainers[j])) {
          return {type: "tableau", index: j};
        }
      }

      return null;
    },

    /**
     * Check if mouse is over a container
     */
    __isMouseOverContainer: function(mouseX, mouseY, container) {
      var location = container.getContentLocation();
      if (!location) {
        return false;
      }

      var bounds = container.getBounds();
      if (!bounds) {
        return false;
      }

      return mouseX >= location.left &&
             mouseX <= location.left + bounds.width &&
             mouseY >= location.top &&
             mouseY <= location.top + bounds.height;
    },

    /**
     * Update drop target highlighting during drag
     */
    __updateDropTargetHighlight: function(mouseX, mouseY) {
      // Clear previous highlights
      this.__clearDropTargetHighlights();

      // Find drop target under mouse
      var dropTarget = this.__findDropTarget(mouseX, mouseY);
      if (!dropTarget) {
        return;
      }

      // Get the container
      var container = null;
      if (dropTarget.type === "foundation") {
        container = this.__foundationContainers[dropTarget.index];
      } else if (dropTarget.type === "tableau") {
        container = this.__tableauContainers[dropTarget.index];
      }

      if (!container) {
        return;
      }

      // Check if this is a valid drop
      var canDrop = this.__canDropHere(dropTarget.type, dropTarget.index);

      // Highlight with appropriate color
      if (canDrop) {
        container.setBackgroundColor("rgba(144, 238, 144, 0.5)"); // Light green
      } else {
        container.setBackgroundColor("rgba(255, 100, 100, 0.5)"); // Light red
      }
    },

    /**
     * Clear all drop target highlights
     */
    __clearDropTargetHighlights: function() {
      // Reset foundation containers
      for (var i = 0; i < 4; i++) {
        this.__foundationContainers[i].setBackgroundColor("rgba(255, 255, 255, 0.1)");
      }

      // Reset tableau containers
      for (var j = 0; j < 7; j++) {
        this.__tableauContainers[j].setBackgroundColor("rgba(255, 255, 255, 0.1)");
      }
    },

    /**
     * Create visual drag indicator
     */
    __createDragIndicator: function(widget) {
      // Get card data and create a clone
      var cardData = widget.getUserData("cardData");
      var cardId = widget.getUserData("cardId");

      // Create a clone using the same card creation method
      this.__dragIndicator = this.__createCardWidget(cardData, cardId + "-drag", false);
      this.__dragIndicator.set({
        opacity: 0.8,
        zIndex: 10000
      });

      // Add to root with absolute positioning
      var doc = qx.core.Init.getApplication().getRoot();
      doc.add(this.__dragIndicator, {left: 0, top: 0});
    },

    /**
     * Remove drag indicator
     */
    __removeDragIndicator: function() {
      if (this.__dragIndicator) {
        var doc = qx.core.Init.getApplication().getRoot();
        doc.remove(this.__dragIndicator);
        this.__dragIndicator.destroy();
        this.__dragIndicator = null;
      }
    },

    /**
     * Make container droppable (no longer needed with mouse events, kept for compatibility)
     */
    __makeDroppable: function(container, type, index) {
      // This method is no longer needed as we handle drops in __tryDrop
      // Keeping it to avoid breaking existing code
    },

    /**
     * Check if card can be dropped here
     */
    __canDropHere: function(type, index) {
      if (!this.__dragCard || !this.__dragSource) {
        return false;
      }

      // Simulate the move check
      if (type === "foundation") {
        var foundations = this.__game.getFoundations();
        var foundation = foundations[index];

        if (foundation.length === 0) {
          return this.__dragCard.rank === "A";
        }

        var topCard = foundation[foundation.length - 1];
        return this.__dragCard.suit === topCard.suit && this.__dragCard.value === topCard.value + 1;
      } else if (type === "tableau") {
        var tableau = this.__game.getTableau();
        var pile = tableau[index];

        if (pile.length === 0) {
          return this.__dragCard.rank === "K";
        }

        var topCard = pile[pile.length - 1];
        return this.__dragCard.color !== topCard.color && this.__dragCard.value === topCard.value - 1;
      }

      return false;
    },

    /**
     * Animate card back to original position on invalid drop
     */
    __animateCardBack: function() {
      if (!this.__dragIndicator) {
        return;
      }

      console.log("[SolitaireWindow] Animating card back to original position");

      // Get current indicator position from DOM
      var indicatorEl = this.__dragIndicator.getContentElement().getDomElement();
      if (!indicatorEl) {
        this.__removeDragIndicator();
        return;
      }

      var startLeft = parseInt(indicatorEl.style.left) || 0;
      var startTop = parseInt(indicatorEl.style.top) || 0;

      // Calculate end position (original card position in screen coordinates)
      if (!this.__draggedWidget || !this.__dragOriginalLayoutProps) {
        this.__removeDragIndicator();
        return;
      }

      var parent = this.__draggedWidget.getLayoutParent();
      if (!parent) {
        this.__removeDragIndicator();
        return;
      }

      var parentLocation = parent.getContentLocation();
      if (!parentLocation) {
        this.__removeDragIndicator();
        return;
      }

      var endLeft = parentLocation.left + this.__dragOriginalLayoutProps.left;
      var endTop = parentLocation.top + this.__dragOriginalLayoutProps.top;

      var duration = 300; // ms
      var startTime = Date.now();

      var self = this;
      var animationTimer = new qx.event.Timer(16); // ~60fps

      animationTimer.addListener("interval", function() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        var eased = 1 - Math.pow(1 - progress, 3);

        var currentLeft = startLeft + (endLeft - startLeft) * eased;
        var currentTop = startTop + (endTop - startTop) * eased;

        if (self.__dragIndicator) {
          self.__dragIndicator.setDomPosition(currentLeft, currentTop);
        }

        if (progress >= 1) {
          animationTimer.stop();
          animationTimer.dispose();
          self.__removeDragIndicator();
        }
      });

      animationTimer.start();
    },

    /**
     * Make container clickable for dropping cards
     */
    __makeClickable: function(container, type, index) {
      container.addListener("click", function(e) {
        console.log("[SolitaireWindow] Container clicked:", type, index, "Selected:", this.__selectedSource);

        // If no card is selected, clicking on empty space does nothing
        if (!this.__selectedCard || !this.__selectedSource) {
          console.log("[SolitaireWindow] No card selected, ignoring click");
          return;
        }

        var success = false;

        // Try to move the selected card to this container
        if (type === "foundation") {
          if (this.__selectedSource === "waste") {
            console.log("[SolitaireWindow] Trying to move waste to foundation", index);
            success = this.__game.moveWasteToFoundation(index);
          } else if (this.__selectedSource === "tableau") {
            console.log("[SolitaireWindow] Trying to move tableau", this.__selectedIndex, "to foundation", index);
            success = this.__game.moveTableauToFoundation(this.__selectedIndex, index);
          }
        } else if (type === "tableau") {
          if (this.__selectedSource === "waste") {
            console.log("[SolitaireWindow] Trying to move waste to tableau", index);
            success = this.__game.moveWasteToTableau(index);
          } else if (this.__selectedSource === "tableau") {
            console.log("[SolitaireWindow] Trying to move tableau", this.__selectedIndex, "card", this.__selectedCardIndex, "to tableau", index);
            success = this.__game.moveTableauToTableau(this.__selectedIndex, this.__selectedCardIndex, index);
          }
        }

        if (success) {
          console.log("[SolitaireWindow] Card moved successfully");
          this.__clearSelection();
        } else {
          console.log("[SolitaireWindow] Invalid move - keeping selection");
        }
      }, this);
    },

    /**
     * Save game state to localStorage
     */
    __saveGameState: function() {
      try {
        var state = this.__game.getGameState();
        localStorage.setItem("solitaire_game_state", JSON.stringify(state));
        console.log("[SolitaireWindow] Game state saved");
      } catch (ex) {
        console.error("[SolitaireWindow] Failed to save game state:", ex);
      }
    },

    /**
     * Load game state from localStorage
     */
    __loadGameState: function() {
      try {
        var stateJson = localStorage.getItem("solitaire_game_state");
        if (stateJson) {
          var state = JSON.parse(stateJson);
          this.__game.setGameState(state);
          console.log("[SolitaireWindow] Game state loaded");
        }
      } catch (ex) {
        console.error("[SolitaireWindow] Failed to load game state:", ex);
      }
    }
  },

  destruct : function()
  {
    this.__game.dispose();
    this.__game = null;
  }
});
