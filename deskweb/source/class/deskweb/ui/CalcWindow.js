/**
 * Calc Window - OpenOffice Calc style spreadsheet application
 * Features: Cell editing, formulas, formatting, ODS import/export, tutorials
 *
 * @asset(deskweb/*)
 */
qx.Class.define("deskweb.ui.CalcWindow", {
  extend: qx.ui.window.Window,

  /**
   * Constructor
   * @param filePath {String?} Optional file path to open
   */
  construct: function(filePath) {
    this.base(arguments, "Calc - Untitled");

    this.set({
      width: 1000,
      height: 700,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Initialize storage manager
    this.__storage = deskweb.util.StorageManager.getInstance();

    // Initialize spreadsheet engine
    this.__engine = new deskweb.util.SpreadsheetEngine();
    this.__engine.addListener("cellChange", this._onCellChange, this);
    this.__engine.addListener("selectionChange", this._onSelectionChange, this);
    this.__engine.addListener("sheetChange", this._onSheetChange, this);

    // Tutorial system
    this.__tutorialManager = new deskweb.util.CalcTutorialManager(this);

    // Grid state
    this.__visibleRows = 50;
    this.__visibleCols = 26;
    this.__scrollTop = 0;
    this.__scrollLeft = 0;
    this.__editingCell = null;
    this.__isSelecting = false;
    this.__currentFile = filePath;
    this.__isFormulaMode = false;  // 수식 입력 모드
    this.__formulaStartValue = "";  // 수식 입력 시작 시 값
    this.__canvasId = "calc-grid-canvas-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);  // 고유 캔버스 ID

    // Build UI
    this._createMenuBar();
    this._createToolbar();
    this._createFormulaBar();
    this._createMainArea();
    this._createSheetTabs();
    this._createStatusBar();

    // Initialize grid
    this._initializeGrid();

    // Keyboard shortcuts
    this._setupKeyboardShortcuts();

    // Load file if provided (delay to ensure canvas is ready)
    if (filePath) {
      qx.event.Timer.once(function() {
        this._loadFile(filePath);
      }, this, 100);
    }

    // Check if tutorial should be shown
    qx.event.Timer.once(function() {
      if (!filePath && this.__tutorialManager.shouldShowTutorial()) {
        this.__tutorialManager.startTutorial();
      }
    }, this, 500);

    console.log("[CalcWindow] Initialized");
  },

  members: {
    __engine: null,
    __storage: null,
    __tutorialManager: null,
    __visibleRows: null,
    __visibleCols: null,
    __scrollTop: null,
    __scrollLeft: null,
    __editingCell: null,
    __isSelecting: null,
    __currentFile: null,
    __isFormulaMode: null,
    __formulaStartValue: null,
    __canvasId: null,

    // UI Elements
    __menuBar: null,
    __toolbar: null,
    __formulaBar: null,
    __cellAddressInput: null,
    __formulaInput: null,
    __gridContainer: null,
    __gridCanvas: null,
    __sheetTabs: null,
    __statusBar: null,

    // Grid rendering
    __cellWidth: 100,
    __cellHeight: 25,
    __headerWidth: 50,
    __headerHeight: 25,
    __ctx: null,

    // Style state
    __currentFontFamily: "Arial",
    __currentFontSize: 11,
    __currentFontColor: "#000000",
    __currentBgColor: "#FFFFFF",
    __currentBold: false,
    __currentItalic: false,
    __currentUnderline: false,

    /**
     * Create menu bar
     */
    _createMenuBar: function() {
      this.__menuBar = new qx.ui.menubar.MenuBar();

      // File menu
      var fileMenu = new qx.ui.menu.Menu();
      this._addMenuItem(fileMenu, "New", "Ctrl+N", this._onNew);
      this._addMenuItem(fileMenu, "Open...", "Ctrl+O", this._onOpen);
      this._addMenuItem(fileMenu, "Save", "Ctrl+S", this._onSave);
      this._addMenuItem(fileMenu, "Save As...", "Ctrl+Shift+S", this._onSaveAs);
      fileMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(fileMenu, "Import ODS...", null, this._onImportODS);
      this._addMenuItem(fileMenu, "Export ODS...", null, this._onExportODS);

      var fileButton = new qx.ui.menubar.Button("File", null, fileMenu);
      this.__menuBar.add(fileButton);

      // Edit menu
      var editMenu = new qx.ui.menu.Menu();
      this._addMenuItem(editMenu, "Undo", "Ctrl+Z", this._onUndo);
      this._addMenuItem(editMenu, "Redo", "Ctrl+Y", this._onRedo);
      editMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(editMenu, "Cut", "Ctrl+X", this._onCut);
      this._addMenuItem(editMenu, "Copy", "Ctrl+C", this._onCopy);
      this._addMenuItem(editMenu, "Paste", "Ctrl+V", this._onPaste);
      this._addMenuItem(editMenu, "Delete", "Del", this._onDelete);
      editMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(editMenu, "Select All", "Ctrl+A", this._onSelectAll);

      var editButton = new qx.ui.menubar.Button("Edit", null, editMenu);
      this.__menuBar.add(editButton);

      // Insert menu
      var insertMenu = new qx.ui.menu.Menu();
      this._addMenuItem(insertMenu, "Insert Row", null, this._onInsertRow);
      this._addMenuItem(insertMenu, "Insert Column", null, this._onInsertColumn);
      insertMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(insertMenu, "Insert Sheet", null, this._onInsertSheet);

      var insertButton = new qx.ui.menubar.Button("Insert", null, insertMenu);
      this.__menuBar.add(insertButton);

      // Format menu
      var formatMenu = new qx.ui.menu.Menu();
      this._addMenuItem(formatMenu, "Merge Cells", null, this._onMergeCells);
      this._addMenuItem(formatMenu, "Unmerge Cells", null, this._onUnmergeCells);
      formatMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(formatMenu, "Number Format...", null, this._onNumberFormat);
      this._addMenuItem(formatMenu, "Conditional Formatting...", null, this._onConditionalFormat);
      formatMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(formatMenu, "Clear Formatting", null, this._onClearFormatting);

      var formatButton = new qx.ui.menubar.Button("Format", null, formatMenu);
      this.__menuBar.add(formatButton);

      // Data menu
      var dataMenu = new qx.ui.menu.Menu();
      this._addMenuItem(dataMenu, "Sort Ascending", null, this._onSortAsc);
      this._addMenuItem(dataMenu, "Sort Descending", null, this._onSortDesc);
      dataMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(dataMenu, "Filter...", null, this._onFilter);
      this._addMenuItem(dataMenu, "Clear Filter", null, this._onClearFilter);

      var dataButton = new qx.ui.menubar.Button("Data", null, dataMenu);
      this.__menuBar.add(dataButton);

      // Help menu
      var helpMenu = new qx.ui.menu.Menu();
      this._addMenuItem(helpMenu, "Tutorial", null, this._onShowTutorial);
      this._addMenuItem(helpMenu, "Function Reference", null, this._onFunctionReference);
      helpMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(helpMenu, "About Calc", null, this._onAbout);

      var helpButton = new qx.ui.menubar.Button("Help", null, helpMenu);
      this.__menuBar.add(helpButton);

      this.add(this.__menuBar);
    },

    /**
     * Add menu item helper
     */
    _addMenuItem: function(menu, label, shortcut, handler) {
      var item = new qx.ui.menu.Button(label, null, null, null);
      if (shortcut) {
        item.setLabel(label + "\t" + shortcut);
      }
      item.addListener("execute", handler, this);

      // Add tutorial ID for interactive help
      item.setUserData("tutorialId", label.toLowerCase().replace(/\s+/g, "-"));

      menu.add(item);
      return item;
    },

    /**
     * Create toolbar
     */
    _createToolbar: function() {
      this.__toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(2));
      this.__toolbar.set({
        padding: [2, 5],
        backgroundColor: "#F0F0F0"
      });

      // File operations
      this._addToolbarButton("New", "deskweb/images/notepad.svg", this._onNew, "new-doc");
      this._addToolbarButton("Open", "deskweb/images/folder.svg", this._onOpen, "open-doc");
      this._addToolbarButton("Save", "deskweb/images/notepad.svg", this._onSave, "save-doc");

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Undo/Redo
      this.__undoBtn = this._addToolbarButton("Undo", null, this._onUndo, "undo");
      this.__redoBtn = this._addToolbarButton("Redo", null, this._onRedo, "redo");

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Clipboard
      this._addToolbarButton("Cut", null, this._onCut, "cut");
      this._addToolbarButton("Copy", null, this._onCopy, "copy");
      this._addToolbarButton("Paste", null, this._onPaste, "paste");

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Font formatting
      this.__fontFamilySelect = new qx.ui.form.SelectBox();
      ["Arial", "Times New Roman", "Courier New", "Verdana", "Georgia"].forEach(function(font) {
        this.__fontFamilySelect.add(new qx.ui.form.ListItem(font));
      }, this);
      this.__fontFamilySelect.setWidth(120);
      this.__fontFamilySelect.addListener("changeSelection", this._onFontFamilyChange, this);
      this.__fontFamilySelect.setUserData("tutorialId", "font-family");
      this.__toolbar.add(this.__fontFamilySelect);

      this.__fontSizeSelect = new qx.ui.form.SelectBox();
      [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].forEach(function(size) {
        this.__fontSizeSelect.add(new qx.ui.form.ListItem(String(size)));
      }, this);
      this.__fontSizeSelect.setWidth(60);
      this.__fontSizeSelect.getSelectables()[3].setUserData("selected", true);
      this.__fontSizeSelect.setSelection([this.__fontSizeSelect.getSelectables()[3]]);
      this.__fontSizeSelect.addListener("changeSelection", this._onFontSizeChange, this);
      this.__fontSizeSelect.setUserData("tutorialId", "font-size");
      this.__toolbar.add(this.__fontSizeSelect);

      this.__toolbar.add(new qx.ui.core.Spacer(5));

      // Bold, Italic, Underline
      this.__boldBtn = this._addToolbarToggleButton("B", this._onBoldToggle, "bold");
      this.__boldBtn.getChildControl("label").setFont(new qx.bom.Font(11, ["Arial"]).set({ bold: true }));

      this.__italicBtn = this._addToolbarToggleButton("I", this._onItalicToggle, "italic");
      this.__italicBtn.getChildControl("label").setFont(new qx.bom.Font(11, ["Arial"]).set({ italic: true }));

      this.__underlineBtn = this._addToolbarToggleButton("U", this._onUnderlineToggle, "underline");
      this.__underlineBtn.getChildControl("label").getContentElement().setStyle("textDecoration", "underline");

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Alignment
      this.__alignLeftBtn = this._addToolbarButton("Left", null, function() { this._setAlignment("left"); }, "align-left");
      this.__alignCenterBtn = this._addToolbarButton("Center", null, function() { this._setAlignment("center"); }, "align-center");
      this.__alignRightBtn = this._addToolbarButton("Right", null, function() { this._setAlignment("right"); }, "align-right");

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Colors
      this.__fontColorBtn = new qx.ui.form.Button("A");
      this.__fontColorBtn.set({ width: 30, height: 26, toolTipText: "Font Color" });
      this.__fontColorBtn.getContentElement().setStyle("color", this.__currentFontColor);
      this.__fontColorBtn.addListener("execute", this._onFontColorClick, this);
      this.__fontColorBtn.setUserData("tutorialId", "font-color");
      this.__toolbar.add(this.__fontColorBtn);

      this.__bgColorBtn = new qx.ui.form.Button("");
      this.__bgColorBtn.set({ width: 30, height: 26, toolTipText: "Background Color" });
      this.__bgColorBtn.setBackgroundColor("#FFFF00");
      this.__bgColorBtn.addListener("execute", this._onBgColorClick, this);
      this.__bgColorBtn.setUserData("tutorialId", "bg-color");
      this.__toolbar.add(this.__bgColorBtn);

      this.__toolbar.add(new qx.ui.core.Spacer(10));

      // Merge cells
      this.__mergeBtn = this._addToolbarButton("Merge", null, this._onMergeCells, "merge-cells");

      // Number format
      this.__currencyBtn = this._addToolbarButton("$", null, function() { this._setNumberFormat("currency"); }, "currency-format");
      this.__percentBtn = this._addToolbarButton("%", null, function() { this._setNumberFormat("percent"); }, "percent-format");

      this.__toolbar.add(new qx.ui.core.Spacer(), { flex: 1 });

      // Sum button
      this.__sumBtn = this._addToolbarButton("Sum", null, this._onAutoSum, "auto-sum");

      this.add(this.__toolbar);
    },

    /**
     * Add toolbar button helper
     */
    _addToolbarButton: function(label, icon, handler, tutorialId) {
      var btn = new qx.ui.form.Button(label, icon);
      btn.set({ width: 30, height: 26, show: icon ? "icon" : "label" });
      if (!icon) {
        btn.setWidth(null);
        btn.setPadding([2, 6]);
      }
      btn.addListener("execute", handler, this);
      btn.setUserData("tutorialId", tutorialId);
      this.__toolbar.add(btn);
      return btn;
    },

    /**
     * Add toolbar toggle button helper
     */
    _addToolbarToggleButton: function(label, handler, tutorialId) {
      var btn = new qx.ui.form.ToggleButton(label);
      btn.set({ width: 30, height: 26 });
      btn.addListener("changeValue", handler, this);
      btn.setUserData("tutorialId", tutorialId);
      this.__toolbar.add(btn);
      return btn;
    },

    /**
     * Create formula bar
     */
    _createFormulaBar: function() {
      this.__formulaBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      this.__formulaBar.set({
        padding: [3, 5],
        backgroundColor: "#FFFFFF",
        decorator: "main"
      });

      // Cell address input
      this.__cellAddressInput = new qx.ui.form.TextField();
      this.__cellAddressInput.set({
        width: 80,
        readOnly: true
      });
      this.__cellAddressInput.setUserData("tutorialId", "cell-address");
      this.__formulaBar.add(this.__cellAddressInput);

      // Function button
      var fxBtn = new qx.ui.form.Button("fx");
      fxBtn.set({ width: 30 });
      fxBtn.addListener("execute", this._onFunctionInsert, this);
      fxBtn.setUserData("tutorialId", "function-insert");
      this.__formulaBar.add(fxBtn);

      // Formula input
      this.__formulaInput = new qx.ui.form.TextField();
      this.__formulaInput.setPlaceholder("Enter value or formula");
      this.__formulaInput.addListener("keypress", this._onFormulaKeyPress, this);
      this.__formulaInput.addListener("input", this._onFormulaInput, this);
      this.__formulaInput.setUserData("tutorialId", "formula-input");
      this.__formulaBar.add(this.__formulaInput, { flex: 1 });

      this.add(this.__formulaBar);
    },

    /**
     * Create main spreadsheet area
     */
    _createMainArea: function() {
      this.__gridContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      this.__gridContainer.set({
        backgroundColor: "#FFFFFF"
      });

      // Create canvas for grid rendering (고유 ID 사용)
      var canvasWidget = new qx.ui.embed.Html();
      canvasWidget.setHtml('<canvas id="' + this.__canvasId + '" style="display:block;"></canvas>');
      canvasWidget.addListener("appear", this._onCanvasAppear, this);

      this.__gridContainer.add(canvasWidget, { edge: 0 });

      // Scrollbars
      this.__vScrollBar = new qx.ui.core.scroll.ScrollBar("vertical");
      this.__vScrollBar.set({
        maximum: this.__engine.MAX_ROWS * this.__cellHeight
      });
      this.__vScrollBar.addListener("scroll", this._onVerticalScroll, this);

      this.__hScrollBar = new qx.ui.core.scroll.ScrollBar("horizontal");
      this.__hScrollBar.set({
        maximum: this.__engine.MAX_COLS * this.__cellWidth
      });
      this.__hScrollBar.addListener("scroll", this._onHorizontalScroll, this);

      // Layout with scrollbars
      var mainArea = new qx.ui.container.Composite(new qx.ui.layout.Dock());
      mainArea.add(this.__gridContainer, { edge: "center" });
      mainArea.add(this.__vScrollBar, { edge: "east" });
      mainArea.add(this.__hScrollBar, { edge: "south" });

      this.add(mainArea, { flex: 1 });
    },

    /**
     * Create sheet tabs
     */
    _createSheetTabs: function() {
      this.__sheetTabs = new qx.ui.container.Composite(new qx.ui.layout.HBox(2));
      this.__sheetTabs.set({
        padding: [2, 5],
        backgroundColor: "#E0E0E0",
        height: 28
      });

      // Add sheet button
      var addSheetBtn = new qx.ui.form.Button("+");
      addSheetBtn.set({ width: 25, height: 22 });
      addSheetBtn.addListener("execute", this._onInsertSheet, this);
      addSheetBtn.setUserData("tutorialId", "add-sheet");
      this.__sheetTabs.add(addSheetBtn);

      // Sheet tabs container
      this.__sheetTabsContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(2));
      this.__sheetTabs.add(this.__sheetTabsContainer, { flex: 1 });

      this._updateSheetTabs();

      this.add(this.__sheetTabs);
    },

    /**
     * Update sheet tabs
     */
    _updateSheetTabs: function() {
      this.__sheetTabsContainer.removeAll();

      var sheets = this.__engine.getSheetNames();
      var activeSheet = this.__engine.getActiveSheetName();

      sheets.forEach(function(sheetName) {
        var tab = new qx.ui.form.Button(sheetName);
        tab.set({
          height: 22,
          padding: [2, 10]
        });

        if (sheetName === activeSheet) {
          tab.setBackgroundColor("#FFFFFF");
        }

        tab.addListener("execute", function() {
          this.__engine.setActiveSheet(sheetName);
          this._updateSheetTabs();
          this._renderGrid();
        }, this);

        // Context menu for sheet tab
        var contextMenu = new qx.ui.menu.Menu();
        this._addMenuItem(contextMenu, "Rename", null, function() {
          this._renameSheet(sheetName);
        });
        this._addMenuItem(contextMenu, "Delete", null, function() {
          this._deleteSheet(sheetName);
        });
        this._addMenuItem(contextMenu, "Copy", null, function() {
          this.__engine.copySheet(sheetName);
          this._updateSheetTabs();
        });
        tab.setContextMenu(contextMenu);

        this.__sheetTabsContainer.add(tab);
      }, this);
    },

    /**
     * Create status bar
     */
    _createStatusBar: function() {
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.set({
        padding: [3, 10],
        backgroundColor: "#F5F5F5",
        height: 24
      });

      this.__statusLabel = new qx.ui.basic.Label("Ready");
      this.__statusBar.add(this.__statusLabel);

      this.__statusBar.add(new qx.ui.core.Spacer(), { flex: 1 });

      // Selection stats
      this.__sumLabel = new qx.ui.basic.Label("");
      this.__statusBar.add(this.__sumLabel);

      this.__avgLabel = new qx.ui.basic.Label("");
      this.__statusBar.add(this.__avgLabel);

      this.__countLabel = new qx.ui.basic.Label("");
      this.__statusBar.add(this.__countLabel);

      this.add(this.__statusBar);
    },

    /**
     * Initialize grid rendering
     */
    _initializeGrid: function() {
      // Set initial selection
      this.__engine.setSelection(0, 0);
      this._updateCellAddressDisplay();
    },

    /**
     * Canvas appear handler
     */
    _onCanvasAppear: function() {
      var canvasElement = document.getElementById(this.__canvasId);
      if (canvasElement) {
        this.__gridCanvas = canvasElement;
        this.__ctx = canvasElement.getContext("2d");

        // 캔버스가 포커스를 받을 수 있도록 설정
        canvasElement.setAttribute("tabindex", "0");
        canvasElement.style.outline = "none";

        // Set canvas size
        this._resizeCanvas();

        // Mouse events
        canvasElement.addEventListener("mousedown", this._onGridMouseDown.bind(this));
        canvasElement.addEventListener("mousemove", this._onGridMouseMove.bind(this));
        canvasElement.addEventListener("mouseup", this._onGridMouseUp.bind(this));
        canvasElement.addEventListener("dblclick", this._onGridDoubleClick.bind(this));
        canvasElement.addEventListener("contextmenu", this._onGridContextMenu.bind(this));

        // Keyboard events on canvas
        canvasElement.addEventListener("keydown", this._onCanvasKeyDown.bind(this));

        // Initial render
        this._renderGrid();

        // 초기 포커스 설정
        canvasElement.focus();

        console.log("[CalcWindow] Canvas initialized");
      }
    },

    /**
     * Resize canvas to fit container
     */
    _resizeCanvas: function() {
      if (!this.__gridCanvas) return;

      var bounds = this.__gridContainer.getBounds();
      if (bounds) {
        this.__gridCanvas.width = bounds.width;
        this.__gridCanvas.height = bounds.height;
        this._renderGrid();
      }
    },

    /**
     * Render the spreadsheet grid
     */
    _renderGrid: function() {
      if (!this.__ctx) {
        console.log("[CalcWindow] _renderGrid: ctx not ready");
        return;
      }

      // 디버그: 현재 시트의 셀 개수 확인
      var sheet = this.__engine.getActiveSheet();
      var cellCount = sheet ? Object.keys(sheet.cells).length : 0;
      console.log("[CalcWindow] _renderGrid: rendering", cellCount, "cells, canvas size:", this.__gridCanvas.width, "x", this.__gridCanvas.height);

      // 셀 데이터 확인
      if (cellCount > 0) {
        console.log("[CalcWindow] Cell keys:", Object.keys(sheet.cells));
        // 첫 번째 셀 내용 확인
        var firstKey = Object.keys(sheet.cells)[0];
        console.log("[CalcWindow] First cell:", firstKey, "=", sheet.cells[firstKey]);
      }

      var ctx = this.__ctx;
      var canvas = this.__gridCanvas;

      // Clear
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      var startRow = Math.floor(this.__scrollTop / this.__cellHeight);
      var startCol = Math.floor(this.__scrollLeft / this.__cellWidth);

      var endRow = Math.min(startRow + Math.ceil(canvas.height / this.__cellHeight) + 1, this.__engine.MAX_ROWS);
      var endCol = Math.min(startCol + Math.ceil(canvas.width / this.__cellWidth) + 1, this.__engine.MAX_COLS);

      var offsetY = -(this.__scrollTop % this.__cellHeight) + this.__headerHeight;
      var offsetX = -(this.__scrollLeft % this.__cellWidth) + this.__headerWidth;

      // Draw cells
      for (var row = startRow; row < endRow; row++) {
        if (this.__engine.isRowHidden(row)) continue;

        var y = offsetY + (row - startRow) * this.__cellHeight;

        for (var col = startCol; col < endCol; col++) {
          if (this.__engine.isColumnHidden(col)) continue;

          var x = offsetX + (col - startCol) * this.__cellWidth;

          this._renderCell(ctx, row, col, x, y);
        }
      }

      // Draw column headers
      ctx.fillStyle = "#F0F0F0";
      ctx.fillRect(this.__headerWidth, 0, canvas.width - this.__headerWidth, this.__headerHeight);

      for (var col = startCol; col < endCol; col++) {
        if (this.__engine.isColumnHidden(col)) continue;

        var x = offsetX + (col - startCol) * this.__cellWidth;

        ctx.strokeStyle = "#CCCCCC";
        ctx.strokeRect(x, 0, this.__cellWidth, this.__headerHeight);

        ctx.fillStyle = "#333333";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.__engine.colIndexToLetter(col), x + this.__cellWidth / 2, this.__headerHeight / 2);
      }

      // Draw row headers
      ctx.fillStyle = "#F0F0F0";
      ctx.fillRect(0, this.__headerHeight, this.__headerWidth, canvas.height - this.__headerHeight);

      for (var row = startRow; row < endRow; row++) {
        if (this.__engine.isRowHidden(row)) continue;

        var y = offsetY + (row - startRow) * this.__cellHeight;

        ctx.strokeStyle = "#CCCCCC";
        ctx.strokeRect(0, y, this.__headerWidth, this.__cellHeight);

        ctx.fillStyle = "#333333";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(row + 1), this.__headerWidth / 2, y + this.__cellHeight / 2);
      }

      // Draw top-left corner
      ctx.fillStyle = "#E0E0E0";
      ctx.fillRect(0, 0, this.__headerWidth, this.__headerHeight);
      ctx.strokeStyle = "#CCCCCC";
      ctx.strokeRect(0, 0, this.__headerWidth, this.__headerHeight);

      // Draw selection
      this._renderSelection(ctx, startRow, startCol, offsetX, offsetY);
    },

    /**
     * Render a single cell
     */
    _renderCell: function(ctx, row, col, x, y) {
      var cell = this.__engine.getCell(row, col);
      var style = cell ? (cell.style || {}) : {};
      var mergeInfo = this.__engine.getMergeInfo(row, col);

      // Skip if this cell is part of a merge but not the top-left
      if (mergeInfo.isMerged && !mergeInfo.isTopLeft) {
        return;
      }

      var width = this.__cellWidth;
      var height = this.__cellHeight;

      // Adjust for merged cells
      if (mergeInfo.isMerged && mergeInfo.isTopLeft) {
        var merge = mergeInfo.merge;
        width = (merge.endCol - merge.startCol + 1) * this.__cellWidth;
        height = (merge.endRow - merge.startRow + 1) * this.__cellHeight;
      }

      // Background
      ctx.fillStyle = style.backgroundColor || "#FFFFFF";
      ctx.fillRect(x, y, width, height);

      // Border
      ctx.strokeStyle = "#E0E0E0";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      // Draw border styles if specified
      if (style.borderTop) {
        ctx.strokeStyle = style.borderTopColor || "#000000";
        ctx.lineWidth = style.borderTopWidth || 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.stroke();
      }
      if (style.borderRight) {
        ctx.strokeStyle = style.borderRightColor || "#000000";
        ctx.lineWidth = style.borderRightWidth || 1;
        ctx.beginPath();
        ctx.moveTo(x + width, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
      }
      if (style.borderBottom) {
        ctx.strokeStyle = style.borderBottomColor || "#000000";
        ctx.lineWidth = style.borderBottomWidth || 1;
        ctx.beginPath();
        ctx.moveTo(x, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
      }
      if (style.borderLeft) {
        ctx.strokeStyle = style.borderLeftColor || "#000000";
        ctx.lineWidth = style.borderLeftWidth || 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + height);
        ctx.stroke();
      }

      // Cell content
      var displayValue = this.__engine.getCellDisplayValue(row, col);

      // 디버그: 셀 내용 확인
      if (displayValue !== "" && displayValue !== undefined && displayValue !== null) {
        console.log("[CalcWindow] Drawing cell", row, col, "value:", displayValue, "at", x, y);
      }

      if (displayValue !== "" && displayValue !== undefined) {
        // Check for error
        if (cell && cell.error) {
          ctx.fillStyle = "#FF0000";
          displayValue = cell.error;
        } else {
          ctx.fillStyle = style.color || "#000000";
        }

        // Font
        var fontStyle = "";
        if (style.bold) fontStyle += "bold ";
        if (style.italic) fontStyle += "italic ";
        var fontSize = style.fontSize || 11;
        var fontFamily = style.fontFamily || "Arial";
        ctx.font = fontStyle + fontSize + "px " + fontFamily;

        // Text alignment
        var textAlign = style.textAlign || "left";
        var textX = x + 3;
        if (textAlign === "center") {
          ctx.textAlign = "center";
          textX = x + width / 2;
        } else if (textAlign === "right") {
          ctx.textAlign = "right";
          textX = x + width - 3;
        } else {
          ctx.textAlign = "left";
        }

        ctx.textBaseline = "middle";

        // Clip text to cell
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, width - 2, height - 2);
        ctx.clip();

        ctx.fillText(String(displayValue), textX, y + height / 2);

        // Underline
        if (style.underline) {
          var textMetrics = ctx.measureText(String(displayValue));
          var underlineY = y + height / 2 + fontSize / 2;
          ctx.beginPath();
          ctx.moveTo(textX, underlineY);
          ctx.lineTo(textX + textMetrics.width, underlineY);
          ctx.strokeStyle = style.color || "#000000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();
      }
    },

    /**
     * Render selection highlight
     */
    _renderSelection: function(ctx, startRow, startCol, offsetX, offsetY) {
      var sel = this.__engine.getNormalizedSelection();

      // Calculate selection rectangle
      var x1 = offsetX + (sel.startCol - startCol) * this.__cellWidth;
      var y1 = offsetY + (sel.startRow - startRow) * this.__cellHeight;
      var x2 = offsetX + (sel.endCol - startCol + 1) * this.__cellWidth;
      var y2 = offsetY + (sel.endRow - startRow + 1) * this.__cellHeight;

      // Selection fill
      ctx.fillStyle = "rgba(51, 153, 51, 0.1)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      // Selection border
      ctx.strokeStyle = "#339933";
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Active cell highlight (thick border)
      var activeRow = this.__engine.getSelection().start.row;
      var activeCol = this.__engine.getSelection().start.col;
      var activeX = offsetX + (activeCol - startCol) * this.__cellWidth;
      var activeY = offsetY + (activeRow - startRow) * this.__cellHeight;

      ctx.strokeStyle = "#006600";
      ctx.lineWidth = 3;
      ctx.strokeRect(activeX, activeY, this.__cellWidth, this.__cellHeight);

      // Fill handle (small square at bottom-right of selection)
      ctx.fillStyle = "#339933";
      ctx.fillRect(x2 - 4, y2 - 4, 6, 6);
    },

    /**
     * Get cell from mouse position
     */
    _getCellFromMouse: function(mouseX, mouseY) {
      var col = Math.floor((mouseX - this.__headerWidth + this.__scrollLeft) / this.__cellWidth);
      var row = Math.floor((mouseY - this.__headerHeight + this.__scrollTop) / this.__cellHeight);

      col = Math.max(0, Math.min(col, this.__engine.MAX_COLS - 1));
      row = Math.max(0, Math.min(row, this.__engine.MAX_ROWS - 1));

      return { row: row, col: col };
    },

    /**
     * Grid mouse down handler
     */
    _onGridMouseDown: function(e) {
      var rect = this.__gridCanvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      // Check if in header area
      if (mouseX < this.__headerWidth || mouseY < this.__headerHeight) {
        return;
      }

      var cell = this._getCellFromMouse(mouseX, mouseY);

      // 수식 모드에서 셀 클릭 시 셀 주소 삽입
      if (this.__isFormulaMode) {
        var cellRef = this.__engine.getCellRef(cell.row, cell.col);
        var currentValue = this.__formulaInput.getValue();

        // 마지막 문자가 연산자이거나 '('이거나 ','이면 셀 주소 추가
        var lastChar = currentValue.charAt(currentValue.length - 1);
        if (lastChar === '=' || lastChar === '+' || lastChar === '-' ||
            lastChar === '*' || lastChar === '/' || lastChar === '(' ||
            lastChar === ',' || lastChar === ':' || lastChar === ' ') {
          this.__formulaInput.setValue(currentValue + cellRef);
        } else {
          // 그 외의 경우 셀 주소로 대체하지 않고 추가
          this.__formulaInput.setValue(currentValue + cellRef);
        }

        this.__formulaInput.focus();
        return;
      }

      // Start selection
      this.__isSelecting = true;
      this.__engine.setSelection(cell.row, cell.col, cell.row, cell.col);

      this._updateCellAddressDisplay();
      this._updateFormulaBar();
      this._renderGrid();

      // 셀 선택 후 캔버스에 포커스를 유지하여 키보드 입력 받을 수 있게
      this.__gridCanvas.focus();
    },

    /**
     * Grid mouse move handler
     */
    _onGridMouseMove: function(e) {
      if (!this.__isSelecting) return;

      var rect = this.__gridCanvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      var cell = this._getCellFromMouse(mouseX, mouseY);
      var sel = this.__engine.getSelection();

      this.__engine.setSelection(sel.start.row, sel.start.col, cell.row, cell.col);
      this._renderGrid();
    },

    /**
     * Grid mouse up handler
     */
    _onGridMouseUp: function() {
      this.__isSelecting = false;
      this._updateSelectionStats();
    },

    /**
     * Canvas keydown handler - 셀 포커스 상태에서 키보드 입력 처리
     */
    _onCanvasKeyDown: function(e) {
      var key = e.key;
      var keyCode = e.keyCode;
      var ctrl = e.ctrlKey || e.metaKey;
      var shift = e.shiftKey;

      // 편집 모드가 아닐 때 키보드 처리
      if (!this.__editingCell) {
        var sel = this.__engine.getSelection();
        var newRow = sel.start.row;
        var newCol = sel.start.col;
        var endRow = sel.end.row;
        var endCol = sel.end.col;

        // 방향키 처리
        switch (key) {
          case "ArrowUp":
            e.preventDefault();
            if (shift) {
              endRow = Math.max(0, endRow - 1);
              this.__engine.setSelection(sel.start.row, sel.start.col, endRow, endCol);
            } else {
              newRow = Math.max(0, newRow - 1);
              this.__engine.setSelection(newRow, newCol);
            }
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "ArrowDown":
            e.preventDefault();
            if (shift) {
              endRow = Math.min(this.__engine.MAX_ROWS - 1, endRow + 1);
              this.__engine.setSelection(sel.start.row, sel.start.col, endRow, endCol);
            } else {
              newRow = Math.min(this.__engine.MAX_ROWS - 1, newRow + 1);
              this.__engine.setSelection(newRow, newCol);
            }
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "ArrowLeft":
            e.preventDefault();
            if (shift) {
              endCol = Math.max(0, endCol - 1);
              this.__engine.setSelection(sel.start.row, sel.start.col, endRow, endCol);
            } else {
              newCol = Math.max(0, newCol - 1);
              this.__engine.setSelection(newRow, newCol);
            }
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "ArrowRight":
            e.preventDefault();
            if (shift) {
              endCol = Math.min(this.__engine.MAX_COLS - 1, endCol + 1);
              this.__engine.setSelection(sel.start.row, sel.start.col, endRow, endCol);
            } else {
              newCol = Math.min(this.__engine.MAX_COLS - 1, newCol + 1);
              this.__engine.setSelection(newRow, newCol);
            }
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "Enter":
            e.preventDefault();
            // Enter로 편집 모드 시작
            this._startEditing(sel.start.row, sel.start.col);
            return;

          case "Delete":
          case "Backspace":
            e.preventDefault();
            this._onDelete();
            return;

          case "F2":
            e.preventDefault();
            this._startEditing(sel.start.row, sel.start.col);
            return;

          case "Tab":
            e.preventDefault();
            if (shift) {
              newCol = Math.max(0, newCol - 1);
            } else {
              newCol = Math.min(this.__engine.MAX_COLS - 1, newCol + 1);
            }
            this.__engine.setSelection(newRow, newCol);
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "Home":
            e.preventDefault();
            if (ctrl) {
              this.__engine.setSelection(0, 0);
            } else {
              this.__engine.setSelection(sel.start.row, 0);
            }
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "PageUp":
            e.preventDefault();
            newRow = Math.max(0, newRow - 20);
            this.__engine.setSelection(newRow, newCol);
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;

          case "PageDown":
            e.preventDefault();
            newRow = Math.min(this.__engine.MAX_ROWS - 1, newRow + 20);
            this.__engine.setSelection(newRow, newCol);
            this._updateCellAddressDisplay();
            this._updateFormulaBar();
            this._renderGrid();
            return;
        }

        // Ctrl 단축키
        if (ctrl) {
          switch (key.toLowerCase()) {
            case "c":
              this._onCopy();
              return;
            case "x":
              this._onCut();
              return;
            case "v":
              this._onPaste();
              return;
            case "z":
              if (shift) {
                this._onRedo();
              } else {
                this._onUndo();
              }
              return;
            case "y":
              this._onRedo();
              return;
            case "a":
              e.preventDefault();
              this._onSelectAll();
              return;
            case "b":
              this.__boldBtn.setValue(!this.__boldBtn.getValue());
              return;
            case "i":
              this.__italicBtn.setValue(!this.__italicBtn.getValue());
              return;
            case "u":
              this.__underlineBtn.setValue(!this.__underlineBtn.getValue());
              return;
          }
        }

        // 일반 문자 입력 시 편집 모드로 전환
        if (!ctrl && key.length === 1) {
          e.preventDefault();
          this._startEditing(sel.start.row, sel.start.col);
          this.__formulaInput.setValue(key);

          // '=' 입력 시 수식 모드 활성화
          if (key === '=') {
            this.__isFormulaMode = true;
            this.__statusLabel.setValue("수식 입력 모드 - 셀을 클릭하여 참조 추가");
          }
        }
      }
    },

    /**
     * Grid double click handler - start editing
     */
    _onGridDoubleClick: function(e) {
      var rect = this.__gridCanvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      if (mouseX < this.__headerWidth || mouseY < this.__headerHeight) {
        return;
      }

      var cell = this._getCellFromMouse(mouseX, mouseY);
      this._startEditing(cell.row, cell.col);
    },

    /**
     * Grid context menu handler
     */
    _onGridContextMenu: function(e) {
      e.preventDefault();

      var contextMenu = new qx.ui.menu.Menu();

      this._addMenuItem(contextMenu, "Cut", "Ctrl+X", this._onCut);
      this._addMenuItem(contextMenu, "Copy", "Ctrl+C", this._onCopy);
      this._addMenuItem(contextMenu, "Paste", "Ctrl+V", this._onPaste);
      contextMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(contextMenu, "Insert Row", null, this._onInsertRow);
      this._addMenuItem(contextMenu, "Insert Column", null, this._onInsertColumn);
      this._addMenuItem(contextMenu, "Delete Row", null, this._onDeleteRow);
      this._addMenuItem(contextMenu, "Delete Column", null, this._onDeleteColumn);
      contextMenu.add(new qx.ui.menu.Separator());
      this._addMenuItem(contextMenu, "Merge Cells", null, this._onMergeCells);
      this._addMenuItem(contextMenu, "Unmerge Cells", null, this._onUnmergeCells);

      contextMenu.openAtPointer(e);
    },

    /**
     * Start cell editing
     */
    _startEditing: function(row, col) {
      this.__editingCell = { row: row, col: col };

      var cellValue = this.__engine.getCell(row, col);
      var editValue = cellValue ? (cellValue.formula || cellValue.value || "") : "";

      this.__formulaInput.setValue(String(editValue));
      this.__formulaInput.focus();
      this.__formulaInput.selectAllText();
    },

    /**
     * Commit cell edit
     */
    _commitEdit: function() {
      if (!this.__editingCell) return;

      var value = this.__formulaInput.getValue();
      this.__engine.setCell(this.__editingCell.row, this.__editingCell.col, value);

      this.__editingCell = null;
      this.__isFormulaMode = false;
      this.__statusLabel.setValue("Ready");
      this._renderGrid();
    },

    /**
     * Cancel cell edit
     */
    _cancelEdit: function() {
      this.__editingCell = null;
      this.__isFormulaMode = false;
      this.__statusLabel.setValue("Ready");
      this._updateFormulaBar();
    },

    /**
     * Update cell address display
     */
    _updateCellAddressDisplay: function() {
      var sel = this.__engine.getSelection();
      var ref = this.__engine.getCellRef(sel.start.row, sel.start.col);
      this.__cellAddressInput.setValue(ref);
    },

    /**
     * Update formula bar with current cell value
     */
    _updateFormulaBar: function() {
      var sel = this.__engine.getSelection();
      var cell = this.__engine.getCell(sel.start.row, sel.start.col);

      if (cell) {
        this.__formulaInput.setValue(cell.formula || String(cell.value || ""));
      } else {
        this.__formulaInput.setValue("");
      }
    },

    /**
     * Update selection statistics in status bar
     */
    _updateSelectionStats: function() {
      var sel = this.__engine.getNormalizedSelection();
      var values = [];

      for (var r = sel.startRow; r <= sel.endRow; r++) {
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var val = this.__engine.getCellValue(r, c);
          if (typeof val === "number") {
            values.push(val);
          }
        }
      }

      if (values.length > 0) {
        var sum = values.reduce(function(a, b) { return a + b; }, 0);
        var avg = sum / values.length;

        this.__sumLabel.setValue("Sum: " + sum.toFixed(2));
        this.__avgLabel.setValue("Avg: " + avg.toFixed(2));
        this.__countLabel.setValue("Count: " + values.length);
      } else {
        this.__sumLabel.setValue("");
        this.__avgLabel.setValue("");
        this.__countLabel.setValue("");
      }
    },

    /**
     * Formula bar key press handler
     */
    _onFormulaKeyPress: function(e) {
      if (e.getKeyIdentifier() === "Enter") {
        this._commitEdit();

        // Move to next row
        var sel = this.__engine.getSelection();
        this.__engine.setSelection(sel.start.row + 1, sel.start.col);
        this._updateCellAddressDisplay();
        this._updateFormulaBar();
        this._renderGrid();

        // 캔버스에 포커스 복원하여 계속 입력 가능하게
        if (this.__gridCanvas) {
          this.__gridCanvas.focus();
        }
      } else if (e.getKeyIdentifier() === "Escape") {
        this._cancelEdit();

        // 캔버스에 포커스 복원
        if (this.__gridCanvas) {
          this.__gridCanvas.focus();
        }
      } else if (e.getKeyIdentifier() === "Tab") {
        e.preventDefault();
        this._commitEdit();

        // Move to next column
        var sel = this.__engine.getSelection();
        this.__engine.setSelection(sel.start.row, sel.start.col + 1);
        this._updateCellAddressDisplay();
        this._updateFormulaBar();
        this._renderGrid();

        // 캔버스에 포커스 복원
        if (this.__gridCanvas) {
          this.__gridCanvas.focus();
        }
      }
    },

    /**
     * Formula input handler
     */
    _onFormulaInput: function(e) {
      var value = this.__formulaInput.getValue();

      // Start editing if not already
      if (!this.__editingCell) {
        var sel = this.__engine.getSelection();
        this.__editingCell = { row: sel.start.row, col: sel.start.col };
      }

      // '=' 로 시작하면 수식 모드 진입
      if (value.startsWith("=") && !this.__isFormulaMode) {
        this.__isFormulaMode = true;
        this.__formulaStartValue = value;
        this.__statusLabel.setValue("수식 입력 모드 - 셀을 클릭하여 참조 추가");
      } else if (!value.startsWith("=") && this.__isFormulaMode) {
        // '='가 없어지면 수식 모드 해제
        this.__isFormulaMode = false;
        this.__statusLabel.setValue("Ready");
      }
    },

    /**
     * Setup keyboard shortcuts
     * 참고: 방향키, 일반 문자 입력은 _onCanvasKeyDown에서 처리
     * 여기서는 Ctrl 단축키와 파일 관련 단축키만 처리
     * 주의: Ctrl+N은 브라우저 새 창 단축키와 충돌하므로 제외
     */
    _setupKeyboardShortcuts: function() {
      this.addListener("keypress", function(e) {
        var key = e.getKeyIdentifier();
        var ctrl = e.isCtrlPressed();
        var shift = e.isShiftPressed();

        // Ctrl shortcuts (파일 저장/열기 등 윈도우 레벨에서 처리 필요한 것들)
        if (ctrl) {
          switch (key) {
            case "S":
              if (shift) {
                this._onSaveAs();
              } else {
                this._onSave();
              }
              e.preventDefault();
              break;
            // Ctrl+O, Ctrl+N은 브라우저 기본 동작과 충돌하므로 메뉴에서만 사용
          }
        }
      }, this);
    },

    /**
     * Scroll handlers
     */
    _onVerticalScroll: function(e) {
      this.__scrollTop = e.getData();
      this._renderGrid();
    },

    _onHorizontalScroll: function(e) {
      this.__scrollLeft = e.getData();
      this._renderGrid();
    },

    /**
     * Cell change handler
     */
    _onCellChange: function(e) {
      this._renderGrid();
    },

    /**
     * Selection change handler
     */
    _onSelectionChange: function(e) {
      this._updateCellAddressDisplay();
      this._updateFormulaBar();
      this._updateSelectionStats();
    },

    /**
     * Sheet change handler
     */
    _onSheetChange: function(e) {
      this._updateSheetTabs();
      this._renderGrid();
    },

    // ==================== Menu Handlers ====================

    _onNew: function() {
      console.log("[CalcWindow] _onNew called");
      if (confirm("Create a new spreadsheet? Unsaved changes will be lost.")) {
        console.log("[CalcWindow] User confirmed new spreadsheet");
        this.__engine.clear();
        this.__currentFile = null;
        this.setCaption("Calc - Untitled");
        this._updateSheetTabs();
        this._updateCellAddressDisplay();
        this._updateFormulaBar();
        this._renderGrid();
        this.__statusLabel.setValue("New spreadsheet created");
        console.log("[CalcWindow] Created new spreadsheet");
      } else {
        console.log("[CalcWindow] User cancelled new spreadsheet");
      }
    },

    _onOpen: function() {
      // TODO: Show file picker
      this.__statusLabel.setValue("Open file dialog...");
    },

    _onSave: function() {
      if (this.__currentFile) {
        // 현재 파일이 있으면 해당 경로에 저장
        try {
          var data = JSON.stringify(this.__engine.toJSON());
          this.__storage.writeFile(this.__currentFile, data);
          var filename = this._getFileName(this.__currentFile);
          this.setCaption("Calc - " + filename);
          this.__statusLabel.setValue("Saved to " + this.__currentFile);
          console.log("[CalcWindow] Saved to storage:", this.__currentFile);
        } catch (e) {
          alert("Error saving file: " + e.message);
        }
      } else {
        this._onSaveAs();
      }
    },

    _onSaveAs: function() {
      var defaultName = this.__currentFile ? this._getFileName(this.__currentFile) : "spreadsheet";
      // 확장자 제거
      if (defaultName.toLowerCase().endsWith(".ods")) {
        defaultName = defaultName.slice(0, -4);
      }
      var filename = prompt("Enter filename (.ods will be added automatically):", defaultName);
      if (filename) {
        // .ods 확장자 자동 추가
        if (!filename.toLowerCase().endsWith(".ods")) {
          filename = filename + ".ods";
        }
        this._saveToStorage(filename);
      }
    },

    /**
     * Get filename from full path
     */
    _getFileName: function(filePath) {
      if (!filePath) return "";
      var parts = filePath.split("/");
      return parts[parts.length - 1];
    },

    /**
     * Save file to storage (내컴퓨터 경로)
     */
    _saveToStorage: function(filename) {
      try {
        var data = JSON.stringify(this.__engine.toJSON());
        // 내컴퓨터 루트 경로에 저장
        var filePath = "/" + filename;
        this.__storage.writeFile(filePath, data);
        this.__currentFile = filePath;
        this.setCaption("Calc - " + filename);
        this.__statusLabel.setValue("Saved to " + filePath);
        console.log("[CalcWindow] Saved to storage:", filePath);
      } catch (e) {
        alert("Error saving file: " + e.message);
      }
    },

    /**
     * Load file from storage
     */
    _loadFile: function(filePath) {
      try {
        console.log("[CalcWindow] Loading file:", filePath);
        var data = this.__storage.readFile(filePath);
        console.log("[CalcWindow] File data:", data ? "found (" + data.length + " bytes)" : "not found");

        if (data) {
          // JSON 데이터인지 확인
          try {
            var jsonData = JSON.parse(data);
            console.log("[CalcWindow] Parsed JSON, sheets:", Object.keys(jsonData.sheets || {}));

            // 엔진에 데이터 로드
            this.__engine.fromJSON(jsonData);
            this.__currentFile = filePath;
            var filename = this._getFileName(filePath);
            this.setCaption("Calc - " + filename);

            // 선택 위치를 A1(0,0)으로 초기화
            this.__engine.setSelection(0, 0);

            // 스크롤 위치 초기화
            this.__scrollTop = 0;
            this.__scrollLeft = 0;

            // UI 전체 업데이트
            this._updateSheetTabs();
            this._updateCellAddressDisplay();
            this._updateFormulaBar();

            // 캔버스가 준비되면 렌더링
            if (this.__ctx) {
              this._renderGrid();
            } else {
              // 캔버스가 아직 준비 안됐으면 약간 딜레이
              qx.event.Timer.once(function() {
                this._renderGrid();
              }, this, 50);
            }

            this.__statusLabel.setValue("Loaded " + filePath);
            console.log("[CalcWindow] Successfully loaded from storage:", filePath);
          } catch (parseError) {
            // JSON이 아니면 CSV로 시도
            console.error("[CalcWindow] JSON parse error:", parseError);
            this.__statusLabel.setValue("File format not supported");
          }
        } else {
          console.warn("[CalcWindow] File not found:", filePath);
          this.__statusLabel.setValue("File not found: " + filePath);
        }
      } catch (e) {
        console.error("[CalcWindow] Error loading file:", e);
        this.__statusLabel.setValue("Error loading file");
      }
    },

    _onImportODS: function() {
      // Create file input
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".ods,.xlsx,.xls,.csv";

      input.addEventListener("change", function(e) {
        var file = e.target.files[0];
        if (file) {
          this._importFile(file);
        }
      }.bind(this));

      input.click();
    },

    _importFile: function(file) {
      var reader = new FileReader();

      reader.onload = function(e) {
        try {
          // Use SheetJS if available
          if (typeof XLSX !== "undefined") {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: "array" });

            this._importWorkbook(workbook);
            this.__statusLabel.setValue("Imported: " + file.name);
          } else {
            console.error("[CalcWindow] SheetJS not loaded");
            alert("SheetJS library not loaded. Please try again.");
          }
        } catch (err) {
          console.error("[CalcWindow] Import error:", err);
          alert("Error importing file: " + err.message);
        }
      }.bind(this);

      reader.readAsArrayBuffer(file);
    },

    _importWorkbook: function(workbook) {
      this.__engine.clear();

      workbook.SheetNames.forEach(function(sheetName, idx) {
        if (idx > 0) {
          this.__engine.addSheet(sheetName);
        } else {
          this.__engine.renameSheet("Sheet1", sheetName);
        }

        this.__engine.setActiveSheet(sheetName);

        var sheet = workbook.Sheets[sheetName];
        var range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        for (var r = range.s.r; r <= range.e.r; r++) {
          for (var c = range.s.c; c <= range.e.c; c++) {
            var cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            var cell = sheet[cellRef];

            if (cell) {
              if (cell.f) {
                this.__engine.setCell(r, c, "=" + cell.f);
              } else {
                this.__engine.setCell(r, c, cell.v);
              }
            }
          }
        }

        // Handle merged cells
        if (sheet["!merges"]) {
          sheet["!merges"].forEach(function(merge) {
            this.__engine.mergeCells(merge.s.r, merge.s.c, merge.e.r, merge.e.c);
          }, this);
        }
      }, this);

      this.__engine.setActiveSheet(workbook.SheetNames[0]);
      this._updateSheetTabs();
      this._renderGrid();
    },

    _onExportODS: function() {
      try {
        if (typeof XLSX === "undefined") {
          alert("SheetJS library not loaded.");
          return;
        }

        var workbook = XLSX.utils.book_new();

        this.__engine.getSheetNames().forEach(function(sheetName) {
          var sheetData = [];
          var sheet = this.__engine.__sheets[sheetName];

          // Find used range
          var maxRow = 0;
          var maxCol = 0;

          for (var key in sheet.cells) {
            var parts = key.split(":");
            var r = parseInt(parts[0]);
            var c = parseInt(parts[1]);
            maxRow = Math.max(maxRow, r);
            maxCol = Math.max(maxCol, c);
          }

          // Build 2D array
          for (var r = 0; r <= maxRow; r++) {
            var row = [];
            for (var c = 0; c <= maxCol; c++) {
              var cell = this.__engine.getCell(r, c, sheetName);
              row.push(cell ? (cell.computedValue || cell.value || "") : "");
            }
            sheetData.push(row);
          }

          var ws = XLSX.utils.aoa_to_sheet(sheetData);

          // Add merged cells
          if (sheet.mergedCells && sheet.mergedCells.length > 0) {
            ws["!merges"] = sheet.mergedCells.map(function(m) {
              return {
                s: { r: m.startRow, c: m.startCol },
                e: { r: m.endRow, c: m.endCol }
              };
            });
          }

          XLSX.utils.book_append_sheet(workbook, ws, sheetName);
        }, this);

        // Export as ODS
        XLSX.writeFile(workbook, (this.__currentFile || "spreadsheet") + ".ods", { bookType: "ods" });
        this.__statusLabel.setValue("Exported as ODS");
      } catch (e) {
        console.error("[CalcWindow] Export error:", e);
        alert("Error exporting file: " + e.message);
      }
    },

    _onUndo: function() {
      this.__engine.undo();
    },

    _onRedo: function() {
      this.__engine.redo();
    },

    _onCut: function() {
      this.__engine.cut();
      this._renderGrid();
    },

    _onCopy: function() {
      this.__engine.copy();
    },

    _onPaste: function() {
      this.__engine.paste();
      this._renderGrid();
    },

    _onDelete: function() {
      this.__engine.deleteContent();
      this._renderGrid();
    },

    _onSelectAll: function() {
      this.__engine.setSelection(0, 0, this.__engine.MAX_ROWS - 1, this.__engine.MAX_COLS - 1);
      this._renderGrid();
    },

    _onInsertRow: function() {
      var sel = this.__engine.getSelection();
      this.__engine.insertRow(sel.start.row);
      this._renderGrid();
    },

    _onInsertColumn: function() {
      var sel = this.__engine.getSelection();
      this.__engine.insertColumn(sel.start.col);
      this._renderGrid();
    },

    _onDeleteRow: function() {
      var sel = this.__engine.getSelection();
      this.__engine.deleteRow(sel.start.row);
      this._renderGrid();
    },

    _onDeleteColumn: function() {
      var sel = this.__engine.getSelection();
      this.__engine.deleteColumn(sel.start.col);
      this._renderGrid();
    },

    _onInsertSheet: function() {
      var name = this.__engine.addSheet();
      this.__engine.setActiveSheet(name);
      this._updateSheetTabs();
      this._renderGrid();
    },

    _renameSheet: function(oldName) {
      var newName = prompt("Enter new sheet name:", oldName);
      if (newName && newName !== oldName) {
        this.__engine.renameSheet(oldName, newName);
        this._updateSheetTabs();
      }
    },

    _deleteSheet: function(name) {
      if (confirm("Delete sheet '" + name + "'?")) {
        this.__engine.deleteSheet(name);
        this._updateSheetTabs();
        this._renderGrid();
      }
    },

    _onMergeCells: function() {
      var sel = this.__engine.getNormalizedSelection();
      this.__engine.mergeCells(sel.startRow, sel.startCol, sel.endRow, sel.endCol);
      this._renderGrid();
    },

    _onUnmergeCells: function() {
      var sel = this.__engine.getSelection();
      this.__engine.unmergeCells(sel.start.row, sel.start.col);
      this._renderGrid();
    },

    _onNumberFormat: function() {
      var format = prompt("Enter number format (currency, percent, date, number):", "number");
      if (format) {
        this._setNumberFormat(format);
      }
    },

    _setNumberFormat: function(format) {
      var sel = this.__engine.getNormalizedSelection();
      this.__engine.setRangeStyle(sel.startRow, sel.startCol, sel.endRow, sel.endCol, {
        numberFormat: format
      });
      this._renderGrid();
    },

    _onConditionalFormat: function() {
      alert("Conditional formatting dialog coming soon!");
    },

    _onClearFormatting: function() {
      this.__engine.clearFormatting();
      this._renderGrid();
    },

    _onSortAsc: function() {
      var sel = this.__engine.getSelection();
      this.__engine.sortData(sel.start.col, true);
      this._renderGrid();
    },

    _onSortDesc: function() {
      var sel = this.__engine.getSelection();
      this.__engine.sortData(sel.start.col, false);
      this._renderGrid();
    },

    _onFilter: function() {
      alert("Filter dialog coming soon!");
    },

    _onClearFilter: function() {
      this.__engine.clearFilter();
      this._renderGrid();
    },

    _onShowTutorial: function() {
      this.__tutorialManager.startTutorial();
    },

    _onFunctionReference: function() {
      var funcs = this.__engine.__formulaParser.getAvailableFunctions();
      alert("Available functions:\n\n" + funcs.join(", "));
    },

    _onAbout: function() {
      alert("Calc - Spreadsheet Application\n\nPart of DeskWeb Desktop Environment\n\nInspired by OpenOffice Calc");
    },

    // ==================== Toolbar Handlers ====================

    _onFontFamilyChange: function(e) {
      var selected = e.getData()[0];
      if (selected) {
        this.__currentFontFamily = selected.getLabel();
        this._applyCurrentStyle();
      }
    },

    _onFontSizeChange: function(e) {
      var selected = e.getData()[0];
      if (selected) {
        this.__currentFontSize = parseInt(selected.getLabel(), 10);
        this._applyCurrentStyle();
      }
    },

    _onBoldToggle: function(e) {
      this.__currentBold = e.getData();
      this._applyCurrentStyle();
    },

    _onItalicToggle: function(e) {
      this.__currentItalic = e.getData();
      this._applyCurrentStyle();
    },

    _onUnderlineToggle: function(e) {
      this.__currentUnderline = e.getData();
      this._applyCurrentStyle();
    },

    _applyCurrentStyle: function() {
      var sel = this.__engine.getNormalizedSelection();
      this.__engine.setRangeStyle(sel.startRow, sel.startCol, sel.endRow, sel.endCol, {
        fontFamily: this.__currentFontFamily,
        fontSize: this.__currentFontSize,
        bold: this.__currentBold,
        italic: this.__currentItalic,
        underline: this.__currentUnderline,
        color: this.__currentFontColor,
        backgroundColor: this.__currentBgColor
      });
      this._renderGrid();
    },

    _setAlignment: function(align) {
      var sel = this.__engine.getNormalizedSelection();
      this.__engine.setRangeStyle(sel.startRow, sel.startCol, sel.endRow, sel.endCol, {
        textAlign: align
      });
      this._renderGrid();
    },

    _onFontColorClick: function() {
      var color = prompt("Enter color (hex or name):", this.__currentFontColor);
      if (color) {
        this.__currentFontColor = color;
        this.__fontColorBtn.getContentElement().setStyle("color", color);
        this._applyCurrentStyle();
      }
    },

    _onBgColorClick: function() {
      var color = prompt("Enter background color (hex or name):", this.__currentBgColor);
      if (color) {
        this.__currentBgColor = color;
        this.__bgColorBtn.setBackgroundColor(color);
        this._applyCurrentStyle();
      }
    },

    _onFunctionInsert: function() {
      var funcs = this.__engine.__formulaParser.getAvailableFunctions();
      var func = prompt("Enter function name:\n\nAvailable: " + funcs.slice(0, 10).join(", ") + "...");

      if (func) {
        var info = this.__engine.__formulaParser.getFunctionInfo(func);
        var currentValue = this.__formulaInput.getValue();

        if (!currentValue.startsWith("=")) {
          currentValue = "=";
        }

        this.__formulaInput.setValue(currentValue + func.toUpperCase() + "(");
        this.__formulaInput.focus();

        // Show syntax hint
        this.__statusLabel.setValue("Syntax: " + info.syntax);
      }
    },

    _onAutoSum: function() {
      var sel = this.__engine.getSelection();

      // Insert SUM formula below selection
      var sumRow = sel.end.row + 1;
      var startRef = this.__engine.getCellRef(sel.start.row, sel.start.col);
      var endRef = this.__engine.getCellRef(sel.end.row, sel.end.col);

      this.__engine.setCell(sumRow, sel.start.col, "=SUM(" + startRef + ":" + endRef + ")");
      this.__engine.setSelection(sumRow, sel.start.col);

      this._updateCellAddressDisplay();
      this._updateFormulaBar();
      this._renderGrid();
    },

    /**
     * Get tutorial manager for external access
     */
    getTutorialManager: function() {
      return this.__tutorialManager;
    }
  },

  destruct: function() {
    if (this.__engine) {
      this.__engine.dispose();
    }
    if (this.__tutorialManager) {
      this.__tutorialManager.dispose();
    }
  }
});
