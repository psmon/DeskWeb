/**
 * Formula Parser and Calculator
 * Parses and evaluates spreadsheet formulas with support for:
 * - Basic math operations
 * - Cell references (A1, $A$1, A1:B10)
 * - Functions (SUM, AVERAGE, IF, VLOOKUP, etc.)
 * - Circular reference detection
 *
 * @asset(deskweb/*)
 */
qx.Class.define("deskweb.util.FormulaParser", {
  extend: qx.core.Object,

  /**
   * Constructor
   * @param engine {deskweb.util.SpreadsheetEngine} The spreadsheet engine
   */
  construct: function(engine) {
    this.base(arguments);

    this.__engine = engine;
    this.__evaluating = {}; // For circular reference detection

    // Built-in functions
    this.__functions = {
      // Math functions
      "SUM": this._fnSum.bind(this),
      "AVERAGE": this._fnAverage.bind(this),
      "AVG": this._fnAverage.bind(this),
      "COUNT": this._fnCount.bind(this),
      "COUNTA": this._fnCountA.bind(this),
      "COUNTBLANK": this._fnCountBlank.bind(this),
      "MAX": this._fnMax.bind(this),
      "MIN": this._fnMin.bind(this),
      "ABS": this._fnAbs.bind(this),
      "ROUND": this._fnRound.bind(this),
      "ROUNDUP": this._fnRoundUp.bind(this),
      "ROUNDDOWN": this._fnRoundDown.bind(this),
      "FLOOR": this._fnFloor.bind(this),
      "CEILING": this._fnCeiling.bind(this),
      "POWER": this._fnPower.bind(this),
      "SQRT": this._fnSqrt.bind(this),
      "MOD": this._fnMod.bind(this),
      "INT": this._fnInt.bind(this),
      "RAND": this._fnRand.bind(this),
      "RANDBETWEEN": this._fnRandBetween.bind(this),

      // Statistical functions
      "MEDIAN": this._fnMedian.bind(this),
      "STDEV": this._fnStdev.bind(this),
      "VAR": this._fnVar.bind(this),

      // Logical functions
      "IF": this._fnIf.bind(this),
      "AND": this._fnAnd.bind(this),
      "OR": this._fnOr.bind(this),
      "NOT": this._fnNot.bind(this),
      "IFERROR": this._fnIfError.bind(this),
      "ISBLANK": this._fnIsBlank.bind(this),
      "ISNUMBER": this._fnIsNumber.bind(this),
      "ISTEXT": this._fnIsText.bind(this),

      // Lookup functions
      "VLOOKUP": this._fnVlookup.bind(this),
      "HLOOKUP": this._fnHlookup.bind(this),
      "INDEX": this._fnIndex.bind(this),
      "MATCH": this._fnMatch.bind(this),
      "LOOKUP": this._fnLookup.bind(this),

      // Text functions
      "CONCATENATE": this._fnConcatenate.bind(this),
      "CONCAT": this._fnConcatenate.bind(this),
      "LEFT": this._fnLeft.bind(this),
      "RIGHT": this._fnRight.bind(this),
      "MID": this._fnMid.bind(this),
      "LEN": this._fnLen.bind(this),
      "TRIM": this._fnTrim.bind(this),
      "UPPER": this._fnUpper.bind(this),
      "LOWER": this._fnLower.bind(this),
      "PROPER": this._fnProper.bind(this),
      "SUBSTITUTE": this._fnSubstitute.bind(this),
      "REPLACE": this._fnReplace.bind(this),
      "FIND": this._fnFind.bind(this),
      "SEARCH": this._fnSearch.bind(this),
      "TEXT": this._fnText.bind(this),
      "VALUE": this._fnValue.bind(this),

      // Date functions
      "TODAY": this._fnToday.bind(this),
      "NOW": this._fnNow.bind(this),
      "DATE": this._fnDate.bind(this),
      "YEAR": this._fnYear.bind(this),
      "MONTH": this._fnMonth.bind(this),
      "DAY": this._fnDay.bind(this),
      "HOUR": this._fnHour.bind(this),
      "MINUTE": this._fnMinute.bind(this),
      "SECOND": this._fnSecond.bind(this),
      "WEEKDAY": this._fnWeekday.bind(this),

      // Financial functions
      "PMT": this._fnPmt.bind(this),
      "FV": this._fnFv.bind(this),
      "PV": this._fnPv.bind(this)
    };

    console.log("[FormulaParser] Initialized with", Object.keys(this.__functions).length, "functions");
  },

  members: {
    __engine: null,
    __evaluating: null,
    __functions: null,
    __currentRow: 0,
    __currentCol: 0,
    __dependencies: null,

    /**
     * Evaluate a formula
     * @param formula {String} The formula without leading =
     * @param row {Number} Current cell row
     * @param col {Number} Current cell column
     * @return {Object} { value: result, error: errorMessage, dependencies: [] }
     */
    evaluate: function(formula, row, col) {
      this.__currentRow = row;
      this.__currentCol = col;
      this.__dependencies = [];

      var cellKey = row + ":" + col;

      // Check for circular reference
      if (this.__evaluating[cellKey]) {
        return { value: null, error: "#CIRCULAR!", dependencies: [] };
      }

      this.__evaluating[cellKey] = true;

      try {
        var result = this._parse(formula);
        delete this.__evaluating[cellKey];

        return {
          value: result,
          error: null,
          dependencies: this.__dependencies
        };
      } catch (e) {
        delete this.__evaluating[cellKey];
        console.error("[FormulaParser] Error:", e.message, "in formula:", formula);

        var errorCode = "#ERROR!";
        if (e.message.indexOf("REF") >= 0) errorCode = "#REF!";
        else if (e.message.indexOf("NAME") >= 0) errorCode = "#NAME?";
        else if (e.message.indexOf("VALUE") >= 0) errorCode = "#VALUE!";
        else if (e.message.indexOf("DIV/0") >= 0) errorCode = "#DIV/0!";
        else if (e.message.indexOf("NUM") >= 0) errorCode = "#NUM!";
        else if (e.message.indexOf("N/A") >= 0) errorCode = "#N/A";

        return { value: null, error: errorCode, dependencies: this.__dependencies };
      }
    },

    /**
     * Parse and evaluate expression
     */
    _parse: function(expr) {
      expr = expr.trim();

      // Handle empty expression
      if (!expr) return "";

      // Tokenize
      var tokens = this._tokenize(expr);

      // Parse with operator precedence
      return this._parseExpression(tokens, 0).value;
    },

    /**
     * Tokenize expression
     */
    _tokenize: function(expr) {
      var tokens = [];
      var i = 0;

      while (i < expr.length) {
        var ch = expr[i];

        // Skip whitespace
        if (/\s/.test(ch)) {
          i++;
          continue;
        }

        // String literal
        if (ch === '"') {
          var str = "";
          i++;
          while (i < expr.length && expr[i] !== '"') {
            if (expr[i] === '\\' && i + 1 < expr.length) {
              i++;
              str += expr[i];
            } else {
              str += expr[i];
            }
            i++;
          }
          i++; // Skip closing quote
          tokens.push({ type: "string", value: str });
          continue;
        }

        // Number
        if (/\d/.test(ch) || (ch === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
          var num = "";
          while (i < expr.length && /[\d.]/.test(expr[i])) {
            num += expr[i];
            i++;
          }
          // Handle percentage
          if (i < expr.length && expr[i] === '%') {
            num = parseFloat(num) / 100;
            i++;
          } else {
            num = parseFloat(num);
          }
          tokens.push({ type: "number", value: num });
          continue;
        }

        // Operators
        if ("+-*/%^".indexOf(ch) >= 0) {
          tokens.push({ type: "operator", value: ch });
          i++;
          continue;
        }

        // Comparison operators
        if (ch === '<' || ch === '>' || ch === '=' || ch === '!') {
          var op = ch;
          i++;
          if (i < expr.length && (expr[i] === '=' || expr[i] === '>')) {
            op += expr[i];
            i++;
          }
          tokens.push({ type: "comparison", value: op });
          continue;
        }

        // Parentheses
        if (ch === '(' || ch === ')') {
          tokens.push({ type: "paren", value: ch });
          i++;
          continue;
        }

        // Comma
        if (ch === ',') {
          tokens.push({ type: "comma", value: ch });
          i++;
          continue;
        }

        // Colon (range)
        if (ch === ':') {
          tokens.push({ type: "colon", value: ch });
          i++;
          continue;
        }

        // Cell reference or function name
        if (/[A-Za-z$_]/.test(ch)) {
          var ident = "";
          while (i < expr.length && /[A-Za-z0-9$_]/.test(expr[i])) {
            ident += expr[i];
            i++;
          }

          // Check if it's a function call
          if (i < expr.length && expr[i] === '(') {
            tokens.push({ type: "function", value: ident.toUpperCase() });
          }
          // Boolean values
          else if (ident.toUpperCase() === "TRUE") {
            tokens.push({ type: "boolean", value: true });
          } else if (ident.toUpperCase() === "FALSE") {
            tokens.push({ type: "boolean", value: false });
          }
          // Cell reference
          else {
            tokens.push({ type: "cell", value: ident.toUpperCase() });
          }
          continue;
        }

        // Unknown character
        i++;
      }

      return tokens;
    },

    /**
     * Parse expression with operator precedence
     */
    _parseExpression: function(tokens, pos) {
      return this._parseComparison(tokens, pos);
    },

    /**
     * Parse comparison operators
     */
    _parseComparison: function(tokens, pos) {
      var result = this._parseAddSub(tokens, pos);

      while (result.pos < tokens.length &&
             tokens[result.pos] &&
             tokens[result.pos].type === "comparison") {
        var op = tokens[result.pos].value;
        result.pos++;

        var right = this._parseAddSub(tokens, result.pos);
        result.pos = right.pos;

        var left = result.value;
        var rightVal = right.value;

        switch (op) {
          case "=":
          case "==":
            result.value = left == rightVal;
            break;
          case "<>":
          case "!=":
            result.value = left != rightVal;
            break;
          case "<":
            result.value = left < rightVal;
            break;
          case ">":
            result.value = left > rightVal;
            break;
          case "<=":
            result.value = left <= rightVal;
            break;
          case ">=":
            result.value = left >= rightVal;
            break;
        }
      }

      return result;
    },

    /**
     * Parse addition/subtraction
     */
    _parseAddSub: function(tokens, pos) {
      var result = this._parseMulDiv(tokens, pos);

      while (result.pos < tokens.length &&
             tokens[result.pos] &&
             tokens[result.pos].type === "operator" &&
             (tokens[result.pos].value === "+" || tokens[result.pos].value === "-")) {
        var op = tokens[result.pos].value;
        result.pos++;

        var right = this._parseMulDiv(tokens, result.pos);
        result.pos = right.pos;

        if (op === "+") {
          // Handle string concatenation
          if (typeof result.value === "string" || typeof right.value === "string") {
            result.value = String(result.value) + String(right.value);
          } else {
            result.value = Number(result.value) + Number(right.value);
          }
        } else {
          result.value = Number(result.value) - Number(right.value);
        }
      }

      return result;
    },

    /**
     * Parse multiplication/division
     */
    _parseMulDiv: function(tokens, pos) {
      var result = this._parsePower(tokens, pos);

      while (result.pos < tokens.length &&
             tokens[result.pos] &&
             tokens[result.pos].type === "operator" &&
             (tokens[result.pos].value === "*" ||
              tokens[result.pos].value === "/" ||
              tokens[result.pos].value === "%")) {
        var op = tokens[result.pos].value;
        result.pos++;

        var right = this._parsePower(tokens, result.pos);
        result.pos = right.pos;

        if (op === "*") {
          result.value = Number(result.value) * Number(right.value);
        } else if (op === "/") {
          if (Number(right.value) === 0) {
            throw new Error("DIV/0: Division by zero");
          }
          result.value = Number(result.value) / Number(right.value);
        } else {
          result.value = Number(result.value) % Number(right.value);
        }
      }

      return result;
    },

    /**
     * Parse power operator
     */
    _parsePower: function(tokens, pos) {
      var result = this._parseUnary(tokens, pos);

      while (result.pos < tokens.length &&
             tokens[result.pos] &&
             tokens[result.pos].type === "operator" &&
             tokens[result.pos].value === "^") {
        result.pos++;

        var right = this._parseUnary(tokens, result.pos);
        result.pos = right.pos;

        result.value = Math.pow(Number(result.value), Number(right.value));
      }

      return result;
    },

    /**
     * Parse unary operators
     */
    _parseUnary: function(tokens, pos) {
      if (tokens[pos] && tokens[pos].type === "operator" &&
          (tokens[pos].value === "-" || tokens[pos].value === "+")) {
        var op = tokens[pos].value;
        pos++;

        var result = this._parsePrimary(tokens, pos);

        if (op === "-") {
          result.value = -Number(result.value);
        }

        return result;
      }

      return this._parsePrimary(tokens, pos);
    },

    /**
     * Parse primary expressions
     */
    _parsePrimary: function(tokens, pos) {
      var token = tokens[pos];

      if (!token) {
        return { value: 0, pos: pos };
      }

      // Number
      if (token.type === "number") {
        return { value: token.value, pos: pos + 1 };
      }

      // String
      if (token.type === "string") {
        return { value: token.value, pos: pos + 1 };
      }

      // Boolean
      if (token.type === "boolean") {
        return { value: token.value, pos: pos + 1 };
      }

      // Parentheses
      if (token.type === "paren" && token.value === "(") {
        pos++;
        var result = this._parseExpression(tokens, pos);
        if (tokens[result.pos] && tokens[result.pos].type === "paren" && tokens[result.pos].value === ")") {
          result.pos++;
        }
        return result;
      }

      // Function call
      if (token.type === "function") {
        return this._parseFunction(tokens, pos);
      }

      // Cell reference (possibly range)
      if (token.type === "cell") {
        return this._parseCellOrRange(tokens, pos);
      }

      return { value: 0, pos: pos + 1 };
    },

    /**
     * Parse cell reference or range
     */
    _parseCellOrRange: function(tokens, pos) {
      var startRef = tokens[pos].value;
      pos++;

      // Check for range
      if (tokens[pos] && tokens[pos].type === "colon" && tokens[pos + 1] && tokens[pos + 1].type === "cell") {
        pos++; // Skip colon
        var endRef = tokens[pos].value;
        pos++;

        var range = this._getCellRange(startRef, endRef);
        return { value: range, pos: pos, isRange: true };
      }

      // Single cell reference
      var value = this._getCellValue(startRef);
      return { value: value, pos: pos };
    },

    /**
     * Get cell value by reference
     */
    _getCellValue: function(ref) {
      var parsed = this.__engine.parseCellRef(ref);
      if (!parsed) {
        throw new Error("REF: Invalid cell reference: " + ref);
      }

      // Add dependency
      this.__dependencies.push({ row: parsed.row, col: parsed.col });

      return this.__engine.getCellValue(parsed.row, parsed.col);
    },

    /**
     * Get cell range values
     */
    _getCellRange: function(startRef, endRef) {
      var start = this.__engine.parseCellRef(startRef);
      var end = this.__engine.parseCellRef(endRef);

      if (!start || !end) {
        throw new Error("REF: Invalid range reference");
      }

      var minRow = Math.min(start.row, end.row);
      var maxRow = Math.max(start.row, end.row);
      var minCol = Math.min(start.col, end.col);
      var maxCol = Math.max(start.col, end.col);

      var values = [];

      for (var r = minRow; r <= maxRow; r++) {
        for (var c = minCol; c <= maxCol; c++) {
          this.__dependencies.push({ row: r, col: c });
          values.push(this.__engine.getCellValue(r, c));
        }
      }

      return values;
    },

    /**
     * Parse function call
     */
    _parseFunction: function(tokens, pos) {
      var funcName = tokens[pos].value;
      pos++; // Skip function name

      if (!tokens[pos] || tokens[pos].value !== "(") {
        throw new Error("NAME: Expected ( after function name");
      }
      pos++; // Skip (

      // Parse arguments
      var args = [];
      var argIsRange = [];

      while (tokens[pos] && !(tokens[pos].type === "paren" && tokens[pos].value === ")")) {
        var arg = this._parseExpression(tokens, pos);
        args.push(arg.value);
        argIsRange.push(arg.isRange === true);
        pos = arg.pos;

        // Skip comma
        if (tokens[pos] && tokens[pos].type === "comma") {
          pos++;
        }
      }

      if (tokens[pos] && tokens[pos].value === ")") {
        pos++;
      }

      // Execute function
      var fn = this.__functions[funcName];
      if (!fn) {
        throw new Error("NAME: Unknown function: " + funcName);
      }

      var result = fn(args, argIsRange);
      return { value: result, pos: pos };
    },

    /**
     * Flatten array arguments (for range arguments)
     */
    _flattenArgs: function(args) {
      var result = [];
      for (var i = 0; i < args.length; i++) {
        if (Array.isArray(args[i])) {
          result = result.concat(args[i]);
        } else {
          result.push(args[i]);
        }
      }
      return result;
    },

    /**
     * Get numeric values only
     */
    _getNumericValues: function(args) {
      var flat = this._flattenArgs(args);
      return flat.filter(function(v) {
        return typeof v === "number" && !isNaN(v);
      });
    },

    // ==================== Built-in Functions ====================

    // Math functions
    _fnSum: function(args) {
      var nums = this._getNumericValues(args);
      return nums.reduce(function(a, b) { return a + b; }, 0);
    },

    _fnAverage: function(args) {
      var nums = this._getNumericValues(args);
      if (nums.length === 0) return 0;
      return nums.reduce(function(a, b) { return a + b; }, 0) / nums.length;
    },

    _fnCount: function(args) {
      var nums = this._getNumericValues(args);
      return nums.length;
    },

    _fnCountA: function(args) {
      var flat = this._flattenArgs(args);
      return flat.filter(function(v) {
        return v !== "" && v !== null && v !== undefined;
      }).length;
    },

    _fnCountBlank: function(args) {
      var flat = this._flattenArgs(args);
      return flat.filter(function(v) {
        return v === "" || v === null || v === undefined;
      }).length;
    },

    _fnMax: function(args) {
      var nums = this._getNumericValues(args);
      if (nums.length === 0) return 0;
      return Math.max.apply(null, nums);
    },

    _fnMin: function(args) {
      var nums = this._getNumericValues(args);
      if (nums.length === 0) return 0;
      return Math.min.apply(null, nums);
    },

    _fnAbs: function(args) {
      return Math.abs(Number(args[0]));
    },

    _fnRound: function(args) {
      var num = Number(args[0]);
      var digits = args[1] !== undefined ? Number(args[1]) : 0;
      var factor = Math.pow(10, digits);
      return Math.round(num * factor) / factor;
    },

    _fnRoundUp: function(args) {
      var num = Number(args[0]);
      var digits = args[1] !== undefined ? Number(args[1]) : 0;
      var factor = Math.pow(10, digits);
      return Math.ceil(num * factor) / factor;
    },

    _fnRoundDown: function(args) {
      var num = Number(args[0]);
      var digits = args[1] !== undefined ? Number(args[1]) : 0;
      var factor = Math.pow(10, digits);
      return Math.floor(num * factor) / factor;
    },

    _fnFloor: function(args) {
      return Math.floor(Number(args[0]));
    },

    _fnCeiling: function(args) {
      return Math.ceil(Number(args[0]));
    },

    _fnPower: function(args) {
      return Math.pow(Number(args[0]), Number(args[1]));
    },

    _fnSqrt: function(args) {
      var num = Number(args[0]);
      if (num < 0) throw new Error("NUM: Cannot take square root of negative number");
      return Math.sqrt(num);
    },

    _fnMod: function(args) {
      return Number(args[0]) % Number(args[1]);
    },

    _fnInt: function(args) {
      return Math.floor(Number(args[0]));
    },

    _fnRand: function() {
      return Math.random();
    },

    _fnRandBetween: function(args) {
      var min = Math.ceil(Number(args[0]));
      var max = Math.floor(Number(args[1]));
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Statistical functions
    _fnMedian: function(args) {
      var nums = this._getNumericValues(args).sort(function(a, b) { return a - b; });
      if (nums.length === 0) return 0;

      var mid = Math.floor(nums.length / 2);
      if (nums.length % 2 === 0) {
        return (nums[mid - 1] + nums[mid]) / 2;
      }
      return nums[mid];
    },

    _fnStdev: function(args) {
      var nums = this._getNumericValues(args);
      if (nums.length < 2) return 0;

      var avg = nums.reduce(function(a, b) { return a + b; }, 0) / nums.length;
      var variance = nums.reduce(function(sum, val) {
        return sum + Math.pow(val - avg, 2);
      }, 0) / (nums.length - 1);

      return Math.sqrt(variance);
    },

    _fnVar: function(args) {
      var nums = this._getNumericValues(args);
      if (nums.length < 2) return 0;

      var avg = nums.reduce(function(a, b) { return a + b; }, 0) / nums.length;
      return nums.reduce(function(sum, val) {
        return sum + Math.pow(val - avg, 2);
      }, 0) / (nums.length - 1);
    },

    // Logical functions
    _fnIf: function(args) {
      var condition = args[0];
      var trueValue = args[1] !== undefined ? args[1] : true;
      var falseValue = args[2] !== undefined ? args[2] : false;

      return condition ? trueValue : falseValue;
    },

    _fnAnd: function(args) {
      var flat = this._flattenArgs(args);
      for (var i = 0; i < flat.length; i++) {
        if (!flat[i]) return false;
      }
      return true;
    },

    _fnOr: function(args) {
      var flat = this._flattenArgs(args);
      for (var i = 0; i < flat.length; i++) {
        if (flat[i]) return true;
      }
      return false;
    },

    _fnNot: function(args) {
      return !args[0];
    },

    _fnIfError: function(args) {
      var value = args[0];
      var errorValue = args[1] !== undefined ? args[1] : "";

      if (value === null || value === undefined ||
          (typeof value === "string" && value.startsWith("#"))) {
        return errorValue;
      }
      return value;
    },

    _fnIsBlank: function(args) {
      return args[0] === "" || args[0] === null || args[0] === undefined;
    },

    _fnIsNumber: function(args) {
      return typeof args[0] === "number" && !isNaN(args[0]);
    },

    _fnIsText: function(args) {
      return typeof args[0] === "string";
    },

    // Lookup functions
    _fnVlookup: function(args) {
      var searchValue = args[0];
      var tableArray = args[1];
      var colIndex = Number(args[2]);
      var rangeLookup = args[3] !== undefined ? args[3] : true;

      if (!Array.isArray(tableArray)) {
        throw new Error("VALUE: VLOOKUP requires a range");
      }

      // Determine dimensions (assume rectangular array)
      var cols = colIndex;
      var rows = Math.ceil(tableArray.length / cols);

      for (var r = 0; r < rows; r++) {
        var cellValue = tableArray[r * cols];

        if (rangeLookup) {
          // Approximate match
          if (cellValue === searchValue) {
            var resultIdx = r * cols + (colIndex - 1);
            return tableArray[resultIdx] !== undefined ? tableArray[resultIdx] : "#N/A";
          }
        } else {
          // Exact match
          if (cellValue === searchValue) {
            var resultIdx = r * cols + (colIndex - 1);
            return tableArray[resultIdx] !== undefined ? tableArray[resultIdx] : "#N/A";
          }
        }
      }

      throw new Error("N/A: Value not found");
    },

    _fnHlookup: function(args) {
      var searchValue = args[0];
      var tableArray = args[1];
      var rowIndex = Number(args[2]);
      var rangeLookup = args[3] !== undefined ? args[3] : true;

      // Similar to VLOOKUP but horizontal
      throw new Error("N/A: HLOOKUP not fully implemented");
    },

    _fnIndex: function(args) {
      var array = args[0];
      var rowNum = Number(args[1]) - 1;
      var colNum = args[2] !== undefined ? Number(args[2]) - 1 : 0;

      if (!Array.isArray(array)) {
        return array;
      }

      var idx = rowNum * (colNum + 1) + colNum;
      if (idx >= 0 && idx < array.length) {
        return array[idx];
      }

      throw new Error("REF: Index out of range");
    },

    _fnMatch: function(args) {
      var searchValue = args[0];
      var lookupArray = args[1];
      var matchType = args[2] !== undefined ? Number(args[2]) : 1;

      if (!Array.isArray(lookupArray)) {
        throw new Error("VALUE: MATCH requires a range");
      }

      for (var i = 0; i < lookupArray.length; i++) {
        if (matchType === 0) {
          // Exact match
          if (lookupArray[i] === searchValue) {
            return i + 1;
          }
        } else if (matchType === 1) {
          // Less than or equal
          if (lookupArray[i] === searchValue) {
            return i + 1;
          }
        } else {
          // Greater than or equal
          if (lookupArray[i] === searchValue) {
            return i + 1;
          }
        }
      }

      throw new Error("N/A: No match found");
    },

    _fnLookup: function(args) {
      var searchValue = args[0];
      var lookupVector = args[1];
      var resultVector = args[2] || args[1];

      if (!Array.isArray(lookupVector)) {
        throw new Error("VALUE: LOOKUP requires arrays");
      }

      for (var i = 0; i < lookupVector.length; i++) {
        if (lookupVector[i] === searchValue) {
          if (Array.isArray(resultVector) && resultVector[i] !== undefined) {
            return resultVector[i];
          }
          return lookupVector[i];
        }
      }

      throw new Error("N/A: Value not found");
    },

    // Text functions
    _fnConcatenate: function(args) {
      var flat = this._flattenArgs(args);
      return flat.map(function(v) {
        return v !== undefined && v !== null ? String(v) : "";
      }).join("");
    },

    _fnLeft: function(args) {
      var text = String(args[0] || "");
      var numChars = args[1] !== undefined ? Number(args[1]) : 1;
      return text.substring(0, numChars);
    },

    _fnRight: function(args) {
      var text = String(args[0] || "");
      var numChars = args[1] !== undefined ? Number(args[1]) : 1;
      return text.substring(text.length - numChars);
    },

    _fnMid: function(args) {
      var text = String(args[0] || "");
      var startNum = Number(args[1]) - 1;
      var numChars = Number(args[2]);
      return text.substring(startNum, startNum + numChars);
    },

    _fnLen: function(args) {
      return String(args[0] || "").length;
    },

    _fnTrim: function(args) {
      return String(args[0] || "").trim().replace(/\s+/g, " ");
    },

    _fnUpper: function(args) {
      return String(args[0] || "").toUpperCase();
    },

    _fnLower: function(args) {
      return String(args[0] || "").toLowerCase();
    },

    _fnProper: function(args) {
      var text = String(args[0] || "").toLowerCase();
      return text.replace(/\b\w/g, function(char) {
        return char.toUpperCase();
      });
    },

    _fnSubstitute: function(args) {
      var text = String(args[0] || "");
      var oldText = String(args[1] || "");
      var newText = String(args[2] || "");
      var instance = args[3];

      if (instance !== undefined) {
        var count = 0;
        return text.replace(new RegExp(this._escapeRegExp(oldText), "g"), function(match) {
          count++;
          return count === instance ? newText : match;
        });
      }

      return text.split(oldText).join(newText);
    },

    _fnReplace: function(args) {
      var text = String(args[0] || "");
      var startNum = Number(args[1]) - 1;
      var numChars = Number(args[2]);
      var newText = String(args[3] || "");

      return text.substring(0, startNum) + newText + text.substring(startNum + numChars);
    },

    _fnFind: function(args) {
      var findText = String(args[0] || "");
      var withinText = String(args[1] || "");
      var startNum = args[2] !== undefined ? Number(args[2]) - 1 : 0;

      var pos = withinText.indexOf(findText, startNum);
      if (pos < 0) throw new Error("VALUE: Text not found");
      return pos + 1;
    },

    _fnSearch: function(args) {
      var findText = String(args[0] || "").toLowerCase();
      var withinText = String(args[1] || "").toLowerCase();
      var startNum = args[2] !== undefined ? Number(args[2]) - 1 : 0;

      var pos = withinText.indexOf(findText, startNum);
      if (pos < 0) throw new Error("VALUE: Text not found");
      return pos + 1;
    },

    _fnText: function(args) {
      var value = Number(args[0]);
      var format = String(args[1] || "");

      // Basic format handling
      if (format.indexOf("%") >= 0) {
        return (value * 100).toFixed(0) + "%";
      }
      if (format.indexOf("0.00") >= 0) {
        return value.toFixed(2);
      }
      if (format.indexOf("#,##0") >= 0) {
        return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }

      return String(value);
    },

    _fnValue: function(args) {
      var text = String(args[0] || "").replace(/[,$%]/g, "");
      var num = parseFloat(text);
      if (isNaN(num)) throw new Error("VALUE: Cannot convert to number");
      return num;
    },

    // Date functions
    _fnToday: function() {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return this._dateToSerial(today);
    },

    _fnNow: function() {
      return this._dateToSerial(new Date());
    },

    _fnDate: function(args) {
      var year = Number(args[0]);
      var month = Number(args[1]);
      var day = Number(args[2]);
      return this._dateToSerial(new Date(year, month - 1, day));
    },

    _fnYear: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getFullYear();
    },

    _fnMonth: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getMonth() + 1;
    },

    _fnDay: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getDate();
    },

    _fnHour: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getHours();
    },

    _fnMinute: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getMinutes();
    },

    _fnSecond: function(args) {
      var date = this._serialToDate(Number(args[0]));
      return date.getSeconds();
    },

    _fnWeekday: function(args) {
      var date = this._serialToDate(Number(args[0]));
      var returnType = args[1] !== undefined ? Number(args[1]) : 1;

      var day = date.getDay();

      if (returnType === 1) {
        return day + 1; // Sunday = 1
      } else if (returnType === 2) {
        return day === 0 ? 7 : day; // Monday = 1
      }
      return day;
    },

    /**
     * Convert Date to Excel serial number
     */
    _dateToSerial: function(date) {
      var baseDate = new Date(1899, 11, 30);
      var diff = date.getTime() - baseDate.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },

    /**
     * Convert Excel serial number to Date
     */
    _serialToDate: function(serial) {
      var baseDate = new Date(1899, 11, 30);
      return new Date(baseDate.getTime() + serial * 24 * 60 * 60 * 1000);
    },

    // Financial functions
    _fnPmt: function(args) {
      var rate = Number(args[0]);
      var nper = Number(args[1]);
      var pv = Number(args[2]);
      var fv = args[3] !== undefined ? Number(args[3]) : 0;
      var type = args[4] !== undefined ? Number(args[4]) : 0;

      if (rate === 0) {
        return -(pv + fv) / nper;
      }

      var pvif = Math.pow(1 + rate, nper);
      var pmt = rate * (pv * pvif + fv) / (pvif - 1);

      if (type === 1) {
        pmt = pmt / (1 + rate);
      }

      return -pmt;
    },

    _fnFv: function(args) {
      var rate = Number(args[0]);
      var nper = Number(args[1]);
      var pmt = Number(args[2]);
      var pv = args[3] !== undefined ? Number(args[3]) : 0;
      var type = args[4] !== undefined ? Number(args[4]) : 0;

      if (rate === 0) {
        return -pv - pmt * nper;
      }

      var pvif = Math.pow(1 + rate, nper);
      var fv;

      if (type === 1) {
        fv = -pv * pvif - pmt * (1 + rate) * (pvif - 1) / rate;
      } else {
        fv = -pv * pvif - pmt * (pvif - 1) / rate;
      }

      return fv;
    },

    _fnPv: function(args) {
      var rate = Number(args[0]);
      var nper = Number(args[1]);
      var pmt = Number(args[2]);
      var fv = args[3] !== undefined ? Number(args[3]) : 0;
      var type = args[4] !== undefined ? Number(args[4]) : 0;

      if (rate === 0) {
        return -fv - pmt * nper;
      }

      var pvif = Math.pow(1 + rate, nper);
      var pv;

      if (type === 1) {
        pv = (-fv - pmt * (1 + rate) * (pvif - 1) / rate) / pvif;
      } else {
        pv = (-fv - pmt * (pvif - 1) / rate) / pvif;
      }

      return pv;
    },

    /**
     * Escape special regex characters
     */
    _escapeRegExp: function(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },

    /**
     * Get list of available functions
     */
    getAvailableFunctions: function() {
      return Object.keys(this.__functions).sort();
    },

    /**
     * Get function info for autocomplete
     */
    getFunctionInfo: function(funcName) {
      var funcInfo = {
        "SUM": { syntax: "SUM(number1, [number2], ...)", description: "Adds all numbers in a range" },
        "AVERAGE": { syntax: "AVERAGE(number1, [number2], ...)", description: "Returns the average of numbers" },
        "COUNT": { syntax: "COUNT(value1, [value2], ...)", description: "Counts numbers in a range" },
        "COUNTA": { syntax: "COUNTA(value1, [value2], ...)", description: "Counts non-empty cells" },
        "MAX": { syntax: "MAX(number1, [number2], ...)", description: "Returns the maximum value" },
        "MIN": { syntax: "MIN(number1, [number2], ...)", description: "Returns the minimum value" },
        "IF": { syntax: "IF(logical_test, value_if_true, [value_if_false])", description: "Returns different values based on condition" },
        "VLOOKUP": { syntax: "VLOOKUP(lookup_value, table_array, col_index, [range_lookup])", description: "Searches first column and returns value from specified column" },
        "CONCATENATE": { syntax: "CONCATENATE(text1, [text2], ...)", description: "Joins text strings" },
        "LEFT": { syntax: "LEFT(text, [num_chars])", description: "Returns leftmost characters" },
        "RIGHT": { syntax: "RIGHT(text, [num_chars])", description: "Returns rightmost characters" },
        "LEN": { syntax: "LEN(text)", description: "Returns text length" },
        "TODAY": { syntax: "TODAY()", description: "Returns today's date" },
        "NOW": { syntax: "NOW()", description: "Returns current date and time" },
        "ROUND": { syntax: "ROUND(number, num_digits)", description: "Rounds to specified digits" },
        "ABS": { syntax: "ABS(number)", description: "Returns absolute value" },
        "SQRT": { syntax: "SQRT(number)", description: "Returns square root" },
        "AND": { syntax: "AND(logical1, [logical2], ...)", description: "Returns TRUE if all arguments are TRUE" },
        "OR": { syntax: "OR(logical1, [logical2], ...)", description: "Returns TRUE if any argument is TRUE" },
        "IFERROR": { syntax: "IFERROR(value, value_if_error)", description: "Returns value_if_error if value is an error" }
      };

      return funcInfo[funcName.toUpperCase()] || { syntax: funcName + "(...)", description: "Function" };
    }
  }
});
