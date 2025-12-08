/**
 * Spreadsheet Core Engine
 * Manages cell data, formulas, references, and styles for the Calc application
 *
 * @asset(deskweb/*)
 */
qx.Class.define("deskweb.util.SpreadsheetEngine", {
  extend: qx.core.Object,

  /**
   * Constructor
   */
  construct: function() {
    this.base(arguments);

    // Initialize sheets
    this.__sheets = {};
    this.__activeSheet = "Sheet1";
    this.__sheetOrder = ["Sheet1"];

    // Initialize first sheet
    this.__sheets["Sheet1"] = this._createEmptySheet();

    // Initialize cell dependencies for formula recalculation
    this.__dependencies = {};

    // Initialize formula parser
    this.__formulaParser = new deskweb.util.FormulaParser(this);

    // Undo/Redo stacks
    this.__undoStack = [];
    this.__redoStack = [];
    this.__maxUndoSteps = 50;

    // Selection state
    this.__selection = {
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 }
    };

    // Clipboard
    this.__clipboard = null;
    this.__clipboardMode = null; // "copy" or "cut"

    console.log("[SpreadsheetEngine] Initialized");
  },

  events: {
    /** Fired when cell data changes */
    "cellChange": "qx.event.type.Data",

    /** Fired when selection changes */
    "selectionChange": "qx.event.type.Data",

    /** Fired when sheet changes */
    "sheetChange": "qx.event.type.Data",

    /** Fired when undo/redo state changes */
    "undoStateChange": "qx.event.type.Event"
  },

  members: {
    __sheets: null,
    __activeSheet: null,
    __sheetOrder: null,
    __dependencies: null,
    __formulaParser: null,
    __undoStack: null,
    __redoStack: null,
    __maxUndoSteps: null,
    __selection: null,
    __clipboard: null,
    __clipboardMode: null,

    // Column/Row limits
    MAX_ROWS: 1000,
    MAX_COLS: 26, // A-Z

    /**
     * Create an empty sheet structure
     */
    _createEmptySheet: function() {
      return {
        cells: {},
        columnWidths: {},
        rowHeights: {},
        mergedCells: [],
        defaultColumnWidth: 100,
        defaultRowHeight: 25,
        hiddenRows: {},
        hiddenCols: {},
        filters: {}
      };
    },

    /**
     * Get current active sheet data
     */
    getActiveSheet: function() {
      return this.__sheets[this.__activeSheet];
    },

    /**
     * Get active sheet name
     */
    getActiveSheetName: function() {
      return this.__activeSheet;
    },

    /**
     * Get all sheet names in order
     */
    getSheetNames: function() {
      return this.__sheetOrder.slice();
    },

    /**
     * Set active sheet
     */
    setActiveSheet: function(sheetName) {
      if (this.__sheets[sheetName]) {
        this.__activeSheet = sheetName;
        this.fireDataEvent("sheetChange", sheetName);
        console.log("[SpreadsheetEngine] Active sheet changed to:", sheetName);
      }
    },

    /**
     * Add new sheet
     */
    addSheet: function(name) {
      if (!name) {
        // Generate unique name
        var num = this.__sheetOrder.length + 1;
        while (this.__sheets["Sheet" + num]) {
          num++;
        }
        name = "Sheet" + num;
      }

      if (this.__sheets[name]) {
        console.warn("[SpreadsheetEngine] Sheet already exists:", name);
        return null;
      }

      this._saveUndoState("addSheet");

      this.__sheets[name] = this._createEmptySheet();
      this.__sheetOrder.push(name);
      this.fireDataEvent("sheetChange", { action: "add", name: name });

      console.log("[SpreadsheetEngine] Added sheet:", name);
      return name;
    },

    /**
     * Delete sheet
     */
    deleteSheet: function(name) {
      if (this.__sheetOrder.length <= 1) {
        console.warn("[SpreadsheetEngine] Cannot delete last sheet");
        return false;
      }

      if (!this.__sheets[name]) {
        return false;
      }

      this._saveUndoState("deleteSheet");

      delete this.__sheets[name];
      var idx = this.__sheetOrder.indexOf(name);
      this.__sheetOrder.splice(idx, 1);

      if (this.__activeSheet === name) {
        this.__activeSheet = this.__sheetOrder[Math.max(0, idx - 1)];
      }

      this.fireDataEvent("sheetChange", { action: "delete", name: name });

      console.log("[SpreadsheetEngine] Deleted sheet:", name);
      return true;
    },

    /**
     * Rename sheet
     */
    renameSheet: function(oldName, newName) {
      if (!this.__sheets[oldName] || this.__sheets[newName]) {
        return false;
      }

      this._saveUndoState("renameSheet");

      this.__sheets[newName] = this.__sheets[oldName];
      delete this.__sheets[oldName];

      var idx = this.__sheetOrder.indexOf(oldName);
      this.__sheetOrder[idx] = newName;

      if (this.__activeSheet === oldName) {
        this.__activeSheet = newName;
      }

      this.fireDataEvent("sheetChange", { action: "rename", oldName: oldName, newName: newName });

      console.log("[SpreadsheetEngine] Renamed sheet:", oldName, "->", newName);
      return true;
    },

    /**
     * Copy sheet
     */
    copySheet: function(sourceName, newName) {
      if (!this.__sheets[sourceName]) {
        return null;
      }

      if (!newName) {
        newName = sourceName + " (Copy)";
        var num = 1;
        while (this.__sheets[newName]) {
          newName = sourceName + " (Copy " + num + ")";
          num++;
        }
      }

      this._saveUndoState("copySheet");

      this.__sheets[newName] = JSON.parse(JSON.stringify(this.__sheets[sourceName]));
      this.__sheetOrder.push(newName);

      this.fireDataEvent("sheetChange", { action: "copy", name: newName });

      console.log("[SpreadsheetEngine] Copied sheet:", sourceName, "->", newName);
      return newName;
    },

    /**
     * Convert column letter to index (A=0, B=1, etc.)
     */
    colLetterToIndex: function(letter) {
      var result = 0;
      for (var i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
      }
      return result - 1;
    },

    /**
     * Convert column index to letter (0=A, 1=B, etc.)
     */
    colIndexToLetter: function(index) {
      var result = "";
      index++;
      while (index > 0) {
        var remainder = (index - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        index = Math.floor((index - 1) / 26);
      }
      return result;
    },

    /**
     * Parse cell reference (e.g., "A1" -> {row: 0, col: 0})
     */
    parseCellRef: function(ref) {
      var match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
      if (!match) return null;

      return {
        col: this.colLetterToIndex(match[1].toUpperCase()),
        row: parseInt(match[2], 10) - 1,
        absoluteCol: ref.charAt(0) === "$",
        absoluteRow: ref.indexOf("$", 1) > 0
      };
    },

    /**
     * Generate cell reference string
     */
    getCellRef: function(row, col, absoluteRow, absoluteCol) {
      var ref = "";
      if (absoluteCol) ref += "$";
      ref += this.colIndexToLetter(col);
      if (absoluteRow) ref += "$";
      ref += (row + 1);
      return ref;
    },

    /**
     * Get cell key for internal storage
     */
    _getCellKey: function(row, col) {
      return row + ":" + col;
    },

    /**
     * Get cell data
     */
    getCell: function(row, col, sheetName) {
      var sheet = sheetName ? this.__sheets[sheetName] : this.getActiveSheet();
      if (!sheet) return null;

      var key = this._getCellKey(row, col);
      return sheet.cells[key] || null;
    },

    /**
     * Get cell value (computed if formula)
     */
    getCellValue: function(row, col, sheetName) {
      var cell = this.getCell(row, col, sheetName);
      if (!cell) return "";

      if (cell.formula) {
        return cell.computedValue !== undefined ? cell.computedValue : cell.value;
      }
      return cell.value !== undefined ? cell.value : "";
    },

    /**
     * Get cell display value (formatted)
     */
    getCellDisplayValue: function(row, col, sheetName) {
      var cell = this.getCell(row, col, sheetName);
      if (!cell) return "";

      var value = this.getCellValue(row, col, sheetName);

      // Apply number format if specified
      if (cell.style && cell.style.numberFormat && typeof value === "number") {
        return this._formatNumber(value, cell.style.numberFormat);
      }

      return value !== undefined ? String(value) : "";
    },

    /**
     * Format number according to format string
     */
    _formatNumber: function(value, format) {
      switch (format) {
        case "currency":
          return "$" + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        case "percent":
          return (value * 100).toFixed(2) + "%";
        case "date":
          var d = new Date((value - 25569) * 86400 * 1000);
          return d.toLocaleDateString();
        case "number":
          return value.toFixed(2);
        case "integer":
          return Math.round(value).toString();
        default:
          if (format && format.indexOf("#") >= 0) {
            // Custom format like "#,##0.00"
            var decimals = (format.split(".")[1] || "").length;
            return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          }
          return String(value);
      }
    },

    /**
     * Set cell value
     */
    setCell: function(row, col, value, sheetName) {
      var sheet = sheetName ? this.__sheets[sheetName] : this.getActiveSheet();
      if (!sheet) return;

      this._saveUndoState("setCell");

      var key = this._getCellKey(row, col);
      var cell = sheet.cells[key] || {};

      // Clear previous dependencies
      this._clearCellDependencies(row, col);

      // Check if value is a formula
      if (typeof value === "string" && value.startsWith("=")) {
        cell.formula = value;
        cell.value = value;

        // Parse and compute formula
        try {
          var result = this.__formulaParser.evaluate(value.substring(1), row, col);
          cell.computedValue = result.value;
          cell.error = result.error;

          // Register dependencies
          if (result.dependencies) {
            this._registerDependencies(row, col, result.dependencies);
          }
        } catch (e) {
          cell.computedValue = null;
          cell.error = "#ERROR!";
          console.error("[SpreadsheetEngine] Formula error:", e);
        }
      } else {
        delete cell.formula;
        delete cell.computedValue;
        delete cell.error;

        // Try to parse as number
        if (value !== "" && !isNaN(value)) {
          cell.value = parseFloat(value);
        } else {
          cell.value = value;
        }
      }

      sheet.cells[key] = cell;

      // Recalculate dependent cells
      this._recalculateDependents(row, col);

      this.fireDataEvent("cellChange", {
        row: row,
        col: col,
        value: value,
        cell: cell
      });

      console.log("[SpreadsheetEngine] Set cell", this.getCellRef(row, col), "=", value);
    },

    /**
     * Set cell style
     */
    setCellStyle: function(row, col, style, sheetName) {
      var sheet = sheetName ? this.__sheets[sheetName] : this.getActiveSheet();
      if (!sheet) return;

      this._saveUndoState("setCellStyle");

      var key = this._getCellKey(row, col);
      var cell = sheet.cells[key] || {};

      cell.style = Object.assign(cell.style || {}, style);
      sheet.cells[key] = cell;

      this.fireDataEvent("cellChange", {
        row: row,
        col: col,
        style: style
      });
    },

    /**
     * Set style for range of cells
     */
    setRangeStyle: function(startRow, startCol, endRow, endCol, style) {
      this._saveUndoState("setRangeStyle");

      var minRow = Math.min(startRow, endRow);
      var maxRow = Math.max(startRow, endRow);
      var minCol = Math.min(startCol, endCol);
      var maxCol = Math.max(startCol, endCol);

      for (var r = minRow; r <= maxRow; r++) {
        for (var c = minCol; c <= maxCol; c++) {
          var sheet = this.getActiveSheet();
          var key = this._getCellKey(r, c);
          var cell = sheet.cells[key] || {};
          cell.style = Object.assign(cell.style || {}, style);
          sheet.cells[key] = cell;
        }
      }

      this.fireDataEvent("cellChange", {
        range: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol },
        style: style
      });
    },

    /**
     * Get cell style
     */
    getCellStyle: function(row, col, sheetName) {
      var cell = this.getCell(row, col, sheetName);
      return cell ? (cell.style || {}) : {};
    },

    /**
     * Clear cell dependencies
     */
    _clearCellDependencies: function(row, col) {
      var key = this._getCellKey(row, col);
      delete this.__dependencies[key];
    },

    /**
     * Register cell dependencies
     */
    _registerDependencies: function(row, col, dependencies) {
      var key = this._getCellKey(row, col);
      this.__dependencies[key] = dependencies;
    },

    /**
     * Recalculate cells that depend on the given cell
     */
    _recalculateDependents: function(row, col) {
      var changedKey = this._getCellKey(row, col);
      var toRecalc = [];

      // Find cells that depend on the changed cell
      for (var key in this.__dependencies) {
        var deps = this.__dependencies[key];
        for (var i = 0; i < deps.length; i++) {
          var dep = deps[i];
          var depKey = this._getCellKey(dep.row, dep.col);
          if (depKey === changedKey) {
            var parts = key.split(":");
            toRecalc.push({ row: parseInt(parts[0]), col: parseInt(parts[1]) });
            break;
          }
        }
      }

      // Recalculate each dependent cell
      toRecalc.forEach(function(cellRef) {
        var cell = this.getCell(cellRef.row, cellRef.col);
        if (cell && cell.formula) {
          try {
            var result = this.__formulaParser.evaluate(cell.formula.substring(1), cellRef.row, cellRef.col);
            cell.computedValue = result.value;
            cell.error = result.error;

            this.fireDataEvent("cellChange", {
              row: cellRef.row,
              col: cellRef.col,
              cell: cell
            });

            // Recursively recalculate
            this._recalculateDependents(cellRef.row, cellRef.col);
          } catch (e) {
            cell.error = "#ERROR!";
          }
        }
      }, this);
    },

    /**
     * Merge cells
     */
    mergeCells: function(startRow, startCol, endRow, endCol) {
      var sheet = this.getActiveSheet();

      this._saveUndoState("mergeCells");

      var minRow = Math.min(startRow, endRow);
      var maxRow = Math.max(startRow, endRow);
      var minCol = Math.min(startCol, endCol);
      var maxCol = Math.max(startCol, endCol);

      // Check if any cells in range are already merged
      for (var i = 0; i < sheet.mergedCells.length; i++) {
        var merge = sheet.mergedCells[i];
        if (this._rangesOverlap(minRow, minCol, maxRow, maxCol,
            merge.startRow, merge.startCol, merge.endRow, merge.endCol)) {
          console.warn("[SpreadsheetEngine] Cannot merge: overlaps existing merge");
          return false;
        }
      }

      // Get value from top-left cell
      var topLeftCell = this.getCell(minRow, minCol);
      var value = topLeftCell ? topLeftCell.value : "";

      // Clear other cells in range
      for (var r = minRow; r <= maxRow; r++) {
        for (var c = minCol; c <= maxCol; c++) {
          if (r !== minRow || c !== minCol) {
            var key = this._getCellKey(r, c);
            delete sheet.cells[key];
          }
        }
      }

      // Add merge info
      sheet.mergedCells.push({
        startRow: minRow,
        startCol: minCol,
        endRow: maxRow,
        endCol: maxCol
      });

      this.fireDataEvent("cellChange", {
        action: "merge",
        range: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol }
      });

      console.log("[SpreadsheetEngine] Merged cells:", this.getCellRef(minRow, minCol), ":", this.getCellRef(maxRow, maxCol));
      return true;
    },

    /**
     * Unmerge cells
     */
    unmergeCells: function(row, col) {
      var sheet = this.getActiveSheet();

      for (var i = 0; i < sheet.mergedCells.length; i++) {
        var merge = sheet.mergedCells[i];
        if (row >= merge.startRow && row <= merge.endRow &&
            col >= merge.startCol && col <= merge.endCol) {

          this._saveUndoState("unmergeCells");

          sheet.mergedCells.splice(i, 1);

          this.fireDataEvent("cellChange", {
            action: "unmerge",
            range: merge
          });

          console.log("[SpreadsheetEngine] Unmerged cells at:", this.getCellRef(row, col));
          return true;
        }
      }
      return false;
    },

    /**
     * Get merge info for cell
     */
    getMergeInfo: function(row, col) {
      var sheet = this.getActiveSheet();

      for (var i = 0; i < sheet.mergedCells.length; i++) {
        var merge = sheet.mergedCells[i];
        if (row >= merge.startRow && row <= merge.endRow &&
            col >= merge.startCol && col <= merge.endCol) {
          return {
            isMerged: true,
            isTopLeft: row === merge.startRow && col === merge.startCol,
            merge: merge
          };
        }
      }
      return { isMerged: false };
    },

    /**
     * Check if two ranges overlap
     */
    _rangesOverlap: function(r1s, c1s, r1e, c1e, r2s, c2s, r2e, c2e) {
      return !(r1e < r2s || r1s > r2e || c1e < c2s || c1s > c2e);
    },

    /**
     * Insert row
     */
    insertRow: function(rowIndex) {
      var sheet = this.getActiveSheet();

      this._saveUndoState("insertRow");

      // Shift cells down
      var newCells = {};
      for (var key in sheet.cells) {
        var parts = key.split(":");
        var r = parseInt(parts[0]);
        var c = parseInt(parts[1]);

        if (r >= rowIndex) {
          newCells[this._getCellKey(r + 1, c)] = sheet.cells[key];
        } else {
          newCells[key] = sheet.cells[key];
        }
      }
      sheet.cells = newCells;

      // Update merged cells
      sheet.mergedCells.forEach(function(merge) {
        if (merge.startRow >= rowIndex) {
          merge.startRow++;
          merge.endRow++;
        } else if (merge.endRow >= rowIndex) {
          merge.endRow++;
        }
      });

      // Shift row heights
      var newHeights = {};
      for (var rh in sheet.rowHeights) {
        var r = parseInt(rh);
        if (r >= rowIndex) {
          newHeights[r + 1] = sheet.rowHeights[r];
        } else {
          newHeights[r] = sheet.rowHeights[r];
        }
      }
      sheet.rowHeights = newHeights;

      this.fireDataEvent("cellChange", { action: "insertRow", rowIndex: rowIndex });

      console.log("[SpreadsheetEngine] Inserted row at:", rowIndex);
    },

    /**
     * Delete row
     */
    deleteRow: function(rowIndex) {
      var sheet = this.getActiveSheet();

      this._saveUndoState("deleteRow");

      // Shift cells up
      var newCells = {};
      for (var key in sheet.cells) {
        var parts = key.split(":");
        var r = parseInt(parts[0]);
        var c = parseInt(parts[1]);

        if (r === rowIndex) {
          continue; // Delete this row
        } else if (r > rowIndex) {
          newCells[this._getCellKey(r - 1, c)] = sheet.cells[key];
        } else {
          newCells[key] = sheet.cells[key];
        }
      }
      sheet.cells = newCells;

      // Update merged cells
      sheet.mergedCells = sheet.mergedCells.filter(function(merge) {
        if (merge.startRow === rowIndex && merge.endRow === rowIndex) {
          return false;
        }
        if (merge.startRow > rowIndex) {
          merge.startRow--;
          merge.endRow--;
        } else if (merge.endRow >= rowIndex) {
          merge.endRow--;
        }
        return true;
      });

      this.fireDataEvent("cellChange", { action: "deleteRow", rowIndex: rowIndex });

      console.log("[SpreadsheetEngine] Deleted row:", rowIndex);
    },

    /**
     * Insert column
     */
    insertColumn: function(colIndex) {
      var sheet = this.getActiveSheet();

      this._saveUndoState("insertColumn");

      // Shift cells right
      var newCells = {};
      for (var key in sheet.cells) {
        var parts = key.split(":");
        var r = parseInt(parts[0]);
        var c = parseInt(parts[1]);

        if (c >= colIndex) {
          newCells[this._getCellKey(r, c + 1)] = sheet.cells[key];
        } else {
          newCells[key] = sheet.cells[key];
        }
      }
      sheet.cells = newCells;

      // Update merged cells
      sheet.mergedCells.forEach(function(merge) {
        if (merge.startCol >= colIndex) {
          merge.startCol++;
          merge.endCol++;
        } else if (merge.endCol >= colIndex) {
          merge.endCol++;
        }
      });

      this.fireDataEvent("cellChange", { action: "insertColumn", colIndex: colIndex });

      console.log("[SpreadsheetEngine] Inserted column at:", colIndex);
    },

    /**
     * Delete column
     */
    deleteColumn: function(colIndex) {
      var sheet = this.getActiveSheet();

      this._saveUndoState("deleteColumn");

      // Shift cells left
      var newCells = {};
      for (var key in sheet.cells) {
        var parts = key.split(":");
        var r = parseInt(parts[0]);
        var c = parseInt(parts[1]);

        if (c === colIndex) {
          continue;
        } else if (c > colIndex) {
          newCells[this._getCellKey(r, c - 1)] = sheet.cells[key];
        } else {
          newCells[key] = sheet.cells[key];
        }
      }
      sheet.cells = newCells;

      // Update merged cells
      sheet.mergedCells = sheet.mergedCells.filter(function(merge) {
        if (merge.startCol === colIndex && merge.endCol === colIndex) {
          return false;
        }
        if (merge.startCol > colIndex) {
          merge.startCol--;
          merge.endCol--;
        } else if (merge.endCol >= colIndex) {
          merge.endCol--;
        }
        return true;
      });

      this.fireDataEvent("cellChange", { action: "deleteColumn", colIndex: colIndex });

      console.log("[SpreadsheetEngine] Deleted column:", colIndex);
    },

    /**
     * Set column width
     */
    setColumnWidth: function(colIndex, width) {
      var sheet = this.getActiveSheet();
      sheet.columnWidths[colIndex] = width;
      this.fireDataEvent("cellChange", { action: "columnWidth", colIndex: colIndex, width: width });
    },

    /**
     * Get column width
     */
    getColumnWidth: function(colIndex) {
      var sheet = this.getActiveSheet();
      return sheet.columnWidths[colIndex] || sheet.defaultColumnWidth;
    },

    /**
     * Set row height
     */
    setRowHeight: function(rowIndex, height) {
      var sheet = this.getActiveSheet();
      sheet.rowHeights[rowIndex] = height;
      this.fireDataEvent("cellChange", { action: "rowHeight", rowIndex: rowIndex, height: height });
    },

    /**
     * Get row height
     */
    getRowHeight: function(rowIndex) {
      var sheet = this.getActiveSheet();
      return sheet.rowHeights[rowIndex] || sheet.defaultRowHeight;
    },

    /**
     * Hide row
     */
    hideRow: function(rowIndex) {
      var sheet = this.getActiveSheet();
      sheet.hiddenRows[rowIndex] = true;
      this.fireDataEvent("cellChange", { action: "hideRow", rowIndex: rowIndex });
    },

    /**
     * Show row
     */
    showRow: function(rowIndex) {
      var sheet = this.getActiveSheet();
      delete sheet.hiddenRows[rowIndex];
      this.fireDataEvent("cellChange", { action: "showRow", rowIndex: rowIndex });
    },

    /**
     * Hide column
     */
    hideColumn: function(colIndex) {
      var sheet = this.getActiveSheet();
      sheet.hiddenCols[colIndex] = true;
      this.fireDataEvent("cellChange", { action: "hideColumn", colIndex: colIndex });
    },

    /**
     * Show column
     */
    showColumn: function(colIndex) {
      var sheet = this.getActiveSheet();
      delete sheet.hiddenCols[colIndex];
      this.fireDataEvent("cellChange", { action: "showColumn", colIndex: colIndex });
    },

    /**
     * Check if row is hidden
     */
    isRowHidden: function(rowIndex) {
      var sheet = this.getActiveSheet();
      return sheet.hiddenRows[rowIndex] === true;
    },

    /**
     * Check if column is hidden
     */
    isColumnHidden: function(colIndex) {
      var sheet = this.getActiveSheet();
      return sheet.hiddenCols[colIndex] === true;
    },

    /**
     * Set selection
     */
    setSelection: function(startRow, startCol, endRow, endCol) {
      this.__selection = {
        start: { row: startRow, col: startCol },
        end: { row: endRow !== undefined ? endRow : startRow, col: endCol !== undefined ? endCol : startCol }
      };
      this.fireDataEvent("selectionChange", this.__selection);
    },

    /**
     * Get selection
     */
    getSelection: function() {
      return this.__selection;
    },

    /**
     * Get normalized selection (min/max)
     */
    getNormalizedSelection: function() {
      var sel = this.__selection;
      return {
        startRow: Math.min(sel.start.row, sel.end.row),
        startCol: Math.min(sel.start.col, sel.end.col),
        endRow: Math.max(sel.start.row, sel.end.row),
        endCol: Math.max(sel.start.col, sel.end.col)
      };
    },

    /**
     * Copy selection to clipboard
     */
    copy: function() {
      var sel = this.getNormalizedSelection();
      this.__clipboard = [];
      this.__clipboardMode = "copy";

      for (var r = sel.startRow; r <= sel.endRow; r++) {
        var row = [];
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var cell = this.getCell(r, c);
          row.push(cell ? JSON.parse(JSON.stringify(cell)) : null);
        }
        this.__clipboard.push(row);
      }

      console.log("[SpreadsheetEngine] Copied", this.__clipboard.length, "rows to clipboard");
    },

    /**
     * Cut selection to clipboard
     */
    cut: function() {
      this.copy();
      this.__clipboardMode = "cut";

      // Clear original cells
      var sel = this.getNormalizedSelection();
      this._saveUndoState("cut");

      for (var r = sel.startRow; r <= sel.endRow; r++) {
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var sheet = this.getActiveSheet();
          var key = this._getCellKey(r, c);
          delete sheet.cells[key];
        }
      }

      this.fireDataEvent("cellChange", { action: "cut", range: sel });

      console.log("[SpreadsheetEngine] Cut cells to clipboard");
    },

    /**
     * Paste from clipboard
     */
    paste: function() {
      if (!this.__clipboard || this.__clipboard.length === 0) {
        return;
      }

      this._saveUndoState("paste");

      var sel = this.getNormalizedSelection();
      var startRow = sel.startRow;
      var startCol = sel.startCol;

      for (var r = 0; r < this.__clipboard.length; r++) {
        var row = this.__clipboard[r];
        for (var c = 0; c < row.length; c++) {
          var cell = row[c];
          if (cell) {
            var sheet = this.getActiveSheet();
            var key = this._getCellKey(startRow + r, startCol + c);

            // Adjust formula references if pasting
            if (cell.formula && this.__clipboardMode === "copy") {
              cell.formula = this._adjustFormulaReferences(cell.formula, r, c);
            }

            sheet.cells[key] = JSON.parse(JSON.stringify(cell));
          }
        }
      }

      this.fireDataEvent("cellChange", { action: "paste", startRow: startRow, startCol: startCol });

      console.log("[SpreadsheetEngine] Pasted", this.__clipboard.length, "rows from clipboard");
    },

    /**
     * Adjust formula references for paste
     */
    _adjustFormulaReferences: function(formula, rowOffset, colOffset) {
      return formula.replace(/\$?([A-Z]+)\$?(\d+)/gi, function(match, col, row) {
        var absoluteCol = match.charAt(0) === "$";
        var absoluteRow = match.indexOf("$", 1) > 0;

        var colIdx = this.colLetterToIndex(col);
        var rowIdx = parseInt(row, 10) - 1;

        if (!absoluteCol) colIdx += colOffset;
        if (!absoluteRow) rowIdx += rowOffset;

        return this.getCellRef(rowIdx, colIdx, absoluteRow, absoluteCol);
      }.bind(this));
    },

    /**
     * Clear formatting from selection
     */
    clearFormatting: function() {
      var sel = this.getNormalizedSelection();

      this._saveUndoState("clearFormatting");

      for (var r = sel.startRow; r <= sel.endRow; r++) {
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var cell = this.getCell(r, c);
          if (cell) {
            delete cell.style;
          }
        }
      }

      this.fireDataEvent("cellChange", { action: "clearFormatting", range: sel });
    },

    /**
     * Delete content from selection
     */
    deleteContent: function() {
      var sel = this.getNormalizedSelection();

      this._saveUndoState("deleteContent");

      for (var r = sel.startRow; r <= sel.endRow; r++) {
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var sheet = this.getActiveSheet();
          var key = this._getCellKey(r, c);
          var cell = sheet.cells[key];
          if (cell) {
            delete cell.value;
            delete cell.formula;
            delete cell.computedValue;
            delete cell.error;
          }
        }
      }

      this.fireDataEvent("cellChange", { action: "deleteContent", range: sel });
    },

    /**
     * Sort data
     */
    sortData: function(colIndex, ascending) {
      var sel = this.getNormalizedSelection();
      var sheet = this.getActiveSheet();

      this._saveUndoState("sort");

      // Collect rows
      var rows = [];
      for (var r = sel.startRow; r <= sel.endRow; r++) {
        var rowData = {};
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var cell = this.getCell(r, c);
          rowData[c] = cell ? JSON.parse(JSON.stringify(cell)) : null;
        }
        rowData.__originalRow = r;
        rows.push(rowData);
      }

      // Sort
      rows.sort(function(a, b) {
        var aVal = a[colIndex] ? (a[colIndex].computedValue || a[colIndex].value || "") : "";
        var bVal = b[colIndex] ? (b[colIndex].computedValue || b[colIndex].value || "") : "";

        if (typeof aVal === "number" && typeof bVal === "number") {
          return ascending ? aVal - bVal : bVal - aVal;
        }

        aVal = String(aVal);
        bVal = String(bVal);
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

      // Write sorted rows back
      for (var i = 0; i < rows.length; i++) {
        var rowIdx = sel.startRow + i;
        var rowData = rows[i];
        for (var c = sel.startCol; c <= sel.endCol; c++) {
          var key = this._getCellKey(rowIdx, c);
          if (rowData[c]) {
            sheet.cells[key] = rowData[c];
          } else {
            delete sheet.cells[key];
          }
        }
      }

      this.fireDataEvent("cellChange", { action: "sort", range: sel });

      console.log("[SpreadsheetEngine] Sorted by column", this.colIndexToLetter(colIndex), ascending ? "ASC" : "DESC");
    },

    /**
     * Apply filter
     */
    setFilter: function(colIndex, filterValue) {
      var sheet = this.getActiveSheet();
      sheet.filters[colIndex] = filterValue;
      this.fireDataEvent("cellChange", { action: "filter", colIndex: colIndex, filterValue: filterValue });
    },

    /**
     * Clear filter
     */
    clearFilter: function(colIndex) {
      var sheet = this.getActiveSheet();
      if (colIndex !== undefined) {
        delete sheet.filters[colIndex];
      } else {
        sheet.filters = {};
      }
      this.fireDataEvent("cellChange", { action: "clearFilter" });
    },

    /**
     * Save undo state
     */
    _saveUndoState: function(action) {
      var state = {
        action: action,
        sheets: JSON.parse(JSON.stringify(this.__sheets)),
        activeSheet: this.__activeSheet,
        sheetOrder: this.__sheetOrder.slice()
      };

      this.__undoStack.push(state);

      if (this.__undoStack.length > this.__maxUndoSteps) {
        this.__undoStack.shift();
      }

      // Clear redo stack on new action
      this.__redoStack = [];

      this.fireEvent("undoStateChange");
    },

    /**
     * Undo
     */
    undo: function() {
      if (this.__undoStack.length === 0) {
        return false;
      }

      // Save current state to redo stack
      this.__redoStack.push({
        sheets: JSON.parse(JSON.stringify(this.__sheets)),
        activeSheet: this.__activeSheet,
        sheetOrder: this.__sheetOrder.slice()
      });

      // Restore previous state
      var state = this.__undoStack.pop();
      this.__sheets = state.sheets;
      this.__activeSheet = state.activeSheet;
      this.__sheetOrder = state.sheetOrder;

      this.fireDataEvent("cellChange", { action: "undo" });
      this.fireEvent("undoStateChange");

      console.log("[SpreadsheetEngine] Undo:", state.action);
      return true;
    },

    /**
     * Redo
     */
    redo: function() {
      if (this.__redoStack.length === 0) {
        return false;
      }

      // Save current state to undo stack
      this.__undoStack.push({
        sheets: JSON.parse(JSON.stringify(this.__sheets)),
        activeSheet: this.__activeSheet,
        sheetOrder: this.__sheetOrder.slice()
      });

      // Restore redo state
      var state = this.__redoStack.pop();
      this.__sheets = state.sheets;
      this.__activeSheet = state.activeSheet;
      this.__sheetOrder = state.sheetOrder;

      this.fireDataEvent("cellChange", { action: "redo" });
      this.fireEvent("undoStateChange");

      console.log("[SpreadsheetEngine] Redo");
      return true;
    },

    /**
     * Check if undo is available
     */
    canUndo: function() {
      return this.__undoStack.length > 0;
    },

    /**
     * Check if redo is available
     */
    canRedo: function() {
      return this.__redoStack.length > 0;
    },

    /**
     * Export to JSON
     */
    toJSON: function() {
      return {
        sheets: this.__sheets,
        activeSheet: this.__activeSheet,
        sheetOrder: this.__sheetOrder
      };
    },

    /**
     * Import from JSON
     */
    fromJSON: function(data) {
      this.__sheets = data.sheets || {};
      this.__activeSheet = data.activeSheet || "Sheet1";
      this.__sheetOrder = data.sheetOrder || ["Sheet1"];

      // Ensure at least one sheet exists
      if (this.__sheetOrder.length === 0) {
        this.__sheetOrder = ["Sheet1"];
        this.__sheets["Sheet1"] = this._createEmptySheet();
      }

      // Recalculate all formulas
      this._recalculateAll();

      this.fireDataEvent("cellChange", { action: "load" });

      console.log("[SpreadsheetEngine] Loaded from JSON");
    },

    /**
     * Recalculate all formulas
     */
    _recalculateAll: function() {
      for (var sheetName in this.__sheets) {
        var sheet = this.__sheets[sheetName];
        for (var key in sheet.cells) {
          var cell = sheet.cells[key];
          if (cell.formula) {
            var parts = key.split(":");
            var row = parseInt(parts[0]);
            var col = parseInt(parts[1]);

            try {
              var result = this.__formulaParser.evaluate(cell.formula.substring(1), row, col);
              cell.computedValue = result.value;
              cell.error = result.error;
            } catch (e) {
              cell.error = "#ERROR!";
            }
          }
        }
      }
    },

    /**
     * Clear all data
     */
    clear: function() {
      this.__sheets = {};
      this.__activeSheet = "Sheet1";
      this.__sheetOrder = ["Sheet1"];
      this.__sheets["Sheet1"] = this._createEmptySheet();
      this.__dependencies = {};
      this.__undoStack = [];
      this.__redoStack = [];

      this.fireDataEvent("cellChange", { action: "clear" });

      console.log("[SpreadsheetEngine] Cleared all data");
    }
  }
});
