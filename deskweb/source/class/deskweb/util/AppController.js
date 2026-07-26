/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * AppController - AI OS Controller for DeskWeb
 *
 * Singleton that provides an API for the AI ChatBot to control desktop apps.
 * Supports opening/closing apps, typing text, keyboard/mouse simulation,
 * window management, and querying app state.
 */
qx.Class.define("deskweb.util.AppController",
{
  extend : qx.core.Object,
  type: "singleton",

  construct : function()
  {
    this.base(arguments);
    this.__app = null;
    this.__actionLog = [];
    console.log("[AppController] Initialized");
  },

  members :
  {
    __app: null,
    __actionLog: null,

    /**
     * Register the main Application instance
     * @param {deskweb.Application} app
     */
    setApplication: function(app) {
      this.__app = app;
      console.log("[AppController] Application registered");
    },

    /**
     * Get registered Application
     * @return {deskweb.Application}
     */
    getApplication: function() {
      return this.__app;
    },

    /**
     * Get list of available apps and their IDs
     * @return {Array}
     */
    getAvailableApps: function() {
      return [
        { id: "notepad", name: "Notepad", description: "Text/Markdown editor" },
        { id: "calc", name: "Calc", description: "Spreadsheet app (Excel-like)" },
        { id: "my-computer", name: "My Computer", description: "File explorer" },
        { id: "my-documents", name: "My Documents", description: "Documents folder" },
        { id: "recycle-bin", name: "Recycle Bin", description: "Deleted files" },
        { id: "chatbot", name: "AI ChatBot", description: "AI chat assistant" },
        { id: "solitaire", name: "Solitaire", description: "Card game" },
        { id: "minesweeper", name: "Minesweeper", description: "Mine sweeping game" },
        { id: "tetris", name: "3D Tetris", description: "3D block game" },
        { id: "janggi", name: "Janggi", description: "Korean chess (3D)" },
        { id: "canvas-demo", name: "Canvas Demo", description: "Canvas graphics demo" },
        { id: "hwpviewer", name: "HWP Viewer", description: "HWP document viewer" },
        { id: "askbot", name: "ASK BOT", description: "Web app viewer (iframe)" },
        { id: "midiplayer", name: "MIDI Player", description: "MIDI 음악 플레이어 (악단 비주얼라이저 + 악보보기). 로컬 카테고리(게임/클래식/바로크/전통음악/캐럴) 재생, BitMidi 온라인 검색/카테고리(인기/게임/영화/애니/팝록/클래식/재즈/캐럴) 재생, 일반/Real 악기 엔진" }
      ];
    },

    /**
     * Execute a command from the AI
     * @param {Object} command - Command object with type and params
     * @return {Object} Result of the command execution
     */
    executeCommand: function(command) {
      if (!this.__app) {
        return { success: false, message: "Application not registered" };
      }

      console.log("[AppController] Executing command:", JSON.stringify(command));

      try {
        var result;
        switch (command.type) {
          case "open_app":
            result = this._openApp(command.app, command.params);
            break;
          case "close_app":
            result = this._closeApp(command.app);
            break;
          case "close_all":
            result = this._closeAllApps();
            break;
          case "list_windows":
            result = this._listOpenWindows();
            break;
          case "type_text":
            result = this._typeText(command.app, command.text);
            break;
          case "key_press":
            result = this._keyPress(command.app, command.key);
            break;
          case "click":
            result = this._click(command.app, command.target, command.x, command.y);
            break;
          case "maximize_window":
            result = this._maximizeWindow(command.app);
            break;
          case "minimize_window":
            result = this._minimizeWindow(command.app);
            break;
          case "restore_window":
            result = this._restoreWindow(command.app);
            break;
          case "move_window":
            result = this._moveWindow(command.app, command.x, command.y);
            break;
          case "resize_window":
            result = this._resizeWindow(command.app, command.width, command.height);
            break;
          case "get_app_state":
            result = this._getAppState(command.app);
            break;
          case "calc_set_cell":
            result = this._calcSetCell(command.cell, command.value);
            break;
          case "calc_get_cell":
            result = this._calcGetCell(command.cell);
            break;
          case "notepad_get_text":
            result = this._notepadGetText();
            break;
          case "notepad_set_text":
            result = this._notepadSetText(command.text);
            break;
          case "janggi_get_state":
            result = this._janggiGetState();
            break;
          case "midi_play":
            result = this._midiPlay(command);
            break;
          case "midi_control":
            result = this._midiControl(command);
            break;
          case "midi_set_engine":
            result = this._midiSetEngine(command);
            break;
          default:
            result = { success: false, message: "Unknown command type: " + command.type };
        }

        // Log action
        this.__actionLog.push({
          time: new Date().toISOString(),
          command: command,
          result: result
        });

        return result;
      } catch (error) {
        console.error("[AppController] Command execution failed:", error);
        return { success: false, message: "Error: " + error.message };
      }
    },

    /**
     * Open an app by ID
     */
    _openApp: function(appId, params) {
      if (!appId) {
        return { success: false, message: "App ID is required" };
      }

      var app = this.__app;
      var desktop = app.getDesktop();
      var taskbar = app.getTaskbar();

      var win = null;
      switch (appId) {
        case "notepad":
          var filePath = params && params.filePath ? params.filePath : null;
          win = new deskweb.ui.NotepadWindow(filePath);
          break;
        case "calc":
          var calcFilePath = params && params.filePath ? params.filePath : null;
          win = new deskweb.ui.CalcWindow(calcFilePath);
          break;
        case "my-computer":
        case "mycomputer":
          win = new deskweb.ui.MyComputerWindow("/");
          break;
        case "my-documents":
        case "mydocuments":
          win = new deskweb.ui.MyComputerWindow("/Documents");
          break;
        case "recycle-bin":
        case "recyclebin":
          win = new deskweb.ui.RecycleBinWindow();
          break;
        case "solitaire":
          win = new deskweb.ui.SolitaireWindow();
          break;
        case "minesweeper":
          win = new deskweb.ui.MinesweeperWindow();
          break;
        case "tetris":
          win = new deskweb.ui.TetrisWindow();
          break;
        case "janggi":
          win = new deskweb.ui.JanggiWindow();
          break;
        case "canvas-demo":
        case "canvasdemo":
          win = new deskweb.ui.CanvasDemoWindow();
          break;
        case "hwpviewer":
          var hwpFilePath = params && params.filePath ? params.filePath : null;
          win = new deskweb.ui.HWPViewerWindow(hwpFilePath);
          break;
        case "askbot":
          win = new deskweb.ui.AskBotWindow();
          break;
        case "midiplayer":
        case "midi":
        case "midi-player":
          win = new deskweb.ui.MidiPlayerWindow();
          break;
        default:
          return { success: false, message: "Unknown app: " + appId };
      }

      if (win) {
        desktop.add(win);
        taskbar.attachWindow(win);
        win.center();
        win.open();
        return { success: true, message: appId + " opened successfully" };
      }

      return { success: false, message: "Failed to open " + appId };
    },

    /**
     * Find open window by app type
     */
    _findWindow: function(appId) {
      var desktop = this.__app.getDesktop();
      var children = desktop.getWindows();
      var targetClass = this._getWindowClass(appId);

      if (!targetClass) return null;

      for (var i = 0; i < children.length; i++) {
        if (children[i] instanceof targetClass && children[i].isVisible()) {
          return children[i];
        }
      }
      return null;
    },

    /**
     * Get window class from app ID
     */
    _getWindowClass: function(appId) {
      var classMap = {
        "notepad": deskweb.ui.NotepadWindow,
        "calc": deskweb.ui.CalcWindow,
        "my-computer": deskweb.ui.MyComputerWindow,
        "mycomputer": deskweb.ui.MyComputerWindow,
        "recycle-bin": deskweb.ui.RecycleBinWindow,
        "recyclebin": deskweb.ui.RecycleBinWindow,
        "solitaire": deskweb.ui.SolitaireWindow,
        "minesweeper": deskweb.ui.MinesweeperWindow,
        "tetris": deskweb.ui.TetrisWindow,
        "janggi": deskweb.ui.JanggiWindow,
        "canvas-demo": deskweb.ui.CanvasDemoWindow,
        "canvasdemo": deskweb.ui.CanvasDemoWindow,
        "hwpviewer": deskweb.ui.HWPViewerWindow,
        "askbot": deskweb.ui.AskBotWindow,
        "chatbot": deskweb.ui.ChatBotWindow,
        "midiplayer": deskweb.ui.MidiPlayerWindow,
        "midi": deskweb.ui.MidiPlayerWindow,
        "midi-player": deskweb.ui.MidiPlayerWindow
      };
      return classMap[appId] || null;
    },

    /**
     * Close an app window
     */
    _closeApp: function(appId) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: appId + " is not open" };
      }
      win.close();
      return { success: true, message: appId + " closed" };
    },

    /**
     * Close all open windows
     */
    _closeAllApps: function() {
      var desktop = this.__app.getDesktop();
      var windows = desktop.getWindows().slice(); // copy
      var closed = 0;
      for (var i = 0; i < windows.length; i++) {
        if (windows[i] instanceof qx.ui.window.Window && windows[i].isVisible()) {
          // Don't close the ChatBot itself
          if (!(windows[i] instanceof deskweb.ui.ChatBotWindow)) {
            windows[i].close();
            closed++;
          }
        }
      }
      return { success: true, message: closed + " windows closed" };
    },

    /**
     * List all open windows
     */
    _listOpenWindows: function() {
      var desktop = this.__app.getDesktop();
      var windows = desktop.getWindows();
      var list = [];
      for (var i = 0; i < windows.length; i++) {
        if (windows[i] instanceof qx.ui.window.Window && windows[i].isVisible()) {
          list.push({
            title: windows[i].getCaption(),
            active: windows[i].isActive(),
            maximized: windows[i].isMaximized()
          });
        }
      }
      return { success: true, windows: list, message: list.length + " windows open" };
    },

    /**
     * Type text into an app's text field
     */
    _typeText: function(appId, text) {
      var win = this._findWindow(appId || "notepad");
      if (!win) {
        return { success: false, message: (appId || "notepad") + " is not open" };
      }

      // For NotepadWindow, set text in the editor
      if (win instanceof deskweb.ui.NotepadWindow) {
        return this._notepadSetText(text);
      }

      return { success: false, message: "type_text not supported for " + appId };
    },

    /**
     * Simulate key press
     */
    _keyPress: function(appId, key) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }

      // For game windows, dispatch keyboard events to the canvas
      if (win instanceof deskweb.ui.TetrisWindow ||
          win instanceof deskweb.ui.MinesweeperWindow ||
          win instanceof deskweb.ui.JanggiWindow) {

        // Find canvas element within the window
        var contentEl = win.getContentElement();
        if (contentEl) {
          var domEl = contentEl.getDomElement();
          if (domEl) {
            var canvas = domEl.querySelector("canvas");
            var target = canvas || domEl;

            var keyEvent = new KeyboardEvent("keydown", {
              key: key,
              code: "Key" + key.toUpperCase(),
              bubbles: true,
              cancelable: true
            });
            target.dispatchEvent(keyEvent);

            var keyUpEvent = new KeyboardEvent("keyup", {
              key: key,
              code: "Key" + key.toUpperCase(),
              bubbles: true,
              cancelable: true
            });
            target.dispatchEvent(keyUpEvent);

            return { success: true, message: "Key '" + key + "' pressed in " + appId };
          }
        }
      }

      return { success: false, message: "key_press not fully supported for " + appId };
    },

    /**
     * Click on an app element
     */
    _click: function(appId, target, x, y) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }

      // For game windows with canvas, click at coordinates
      var contentEl = win.getContentElement();
      if (contentEl) {
        var domEl = contentEl.getDomElement();
        if (domEl) {
          var canvas = domEl.querySelector("canvas");
          if (canvas && x !== undefined && y !== undefined) {
            var rect = canvas.getBoundingClientRect();
            var clickEvent = new MouseEvent("click", {
              clientX: rect.left + x,
              clientY: rect.top + y,
              bubbles: true,
              cancelable: true
            });
            canvas.dispatchEvent(clickEvent);

            return { success: true, message: "Clicked at (" + x + ", " + y + ") in " + appId };
          }

          // For button-based targets
          if (target) {
            var buttons = domEl.querySelectorAll("button, [data-action]");
            for (var i = 0; i < buttons.length; i++) {
              if (buttons[i].textContent.indexOf(target) >= 0) {
                buttons[i].click();
                return { success: true, message: "Clicked button '" + target + "' in " + appId };
              }
            }
          }
        }
      }

      return { success: false, message: "Click target not found in " + appId };
    },

    /**
     * Maximize a window
     */
    _maximizeWindow: function(appId) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }
      win.maximize();
      return { success: true, message: appId + " maximized" };
    },

    /**
     * Minimize a window
     */
    _minimizeWindow: function(appId) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }
      win.minimize();
      return { success: true, message: appId + " minimized" };
    },

    /**
     * Restore a window from maximized/minimized
     */
    _restoreWindow: function(appId) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }
      win.restore();
      return { success: true, message: appId + " restored" };
    },

    /**
     * Move a window to position
     */
    _moveWindow: function(appId, x, y) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }
      win.moveTo(x, y);
      return { success: true, message: appId + " moved to (" + x + ", " + y + ")" };
    },

    /**
     * Resize a window
     */
    _resizeWindow: function(appId, width, height) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }
      if (width) win.setWidth(width);
      if (height) win.setHeight(height);
      return { success: true, message: appId + " resized to " + width + "x" + height };
    },

    /**
     * Get app state/info
     */
    _getAppState: function(appId) {
      var win = this._findWindow(appId);
      if (!win) {
        return { success: false, message: (appId || "unknown") + " is not open" };
      }

      var state = {
        title: win.getCaption(),
        active: win.isActive(),
        maximized: win.isMaximized(),
        visible: win.isVisible()
      };

      var bounds = win.getBounds();
      if (bounds) {
        state.x = bounds.left;
        state.y = bounds.top;
        state.width = bounds.width;
        state.height = bounds.height;
      }

      return { success: true, state: state };
    },

    /**
     * Set a cell value in Calc
     */
    _calcSetCell: function(cellRef, value) {
      var win = this._findWindow("calc");
      if (!win) {
        return { success: false, message: "Calc is not open" };
      }

      // Access the spreadsheet engine via the window
      if (win.setCellValue) {
        win.setCellValue(cellRef, value);
        return { success: true, message: "Set " + cellRef + " = " + value };
      }

      // Try to access via internal spreadsheet engine
      if (win.__spreadsheetEngine || win._spreadsheetEngine) {
        var engine = win.__spreadsheetEngine || win._spreadsheetEngine;
        var parsed = this._parseCellRef(cellRef);
        if (parsed) {
          engine.setCellValue(parsed.row, parsed.col, value);
          return { success: true, message: "Set " + cellRef + " = " + value };
        }
      }

      return { success: false, message: "Cannot access Calc cells" };
    },

    /**
     * Get a cell value from Calc
     */
    _calcGetCell: function(cellRef) {
      var win = this._findWindow("calc");
      if (!win) {
        return { success: false, message: "Calc is not open" };
      }

      if (win.getCellValue) {
        var value = win.getCellValue(cellRef);
        return { success: true, cell: cellRef, value: value };
      }

      return { success: false, message: "Cannot access Calc cells" };
    },

    /**
     * Get text from Notepad
     */
    _notepadGetText: function() {
      var win = this._findWindow("notepad");
      if (!win) {
        return { success: false, message: "Notepad is not open" };
      }

      if (win.getText) {
        return { success: true, text: win.getText() };
      }

      // Try to access text area directly
      var contentEl = win.getContentElement();
      if (contentEl) {
        var domEl = contentEl.getDomElement();
        if (domEl) {
          var textarea = domEl.querySelector("textarea");
          if (textarea) {
            return { success: true, text: textarea.value };
          }
        }
      }

      return { success: false, message: "Cannot access Notepad text" };
    },

    /**
     * Set text in Notepad
     */
    _notepadSetText: function(text) {
      var win = this._findWindow("notepad");
      if (!win) {
        return { success: false, message: "Notepad is not open" };
      }

      if (win.setText) {
        win.setText(text);
        return { success: true, message: "Text set in Notepad" };
      }

      // Try to access text area directly
      var contentEl = win.getContentElement();
      if (contentEl) {
        var domEl = contentEl.getDomElement();
        if (domEl) {
          var textarea = domEl.querySelector("textarea");
          if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            return { success: true, message: "Text set in Notepad" };
          }
        }
      }

      return { success: false, message: "Cannot access Notepad text" };
    },

    /**
     * Get Janggi game state
     */
    _janggiGetState: function() {
      var win = this._findWindow("janggi");
      if (!win) {
        return { success: false, message: "Janggi is not open" };
      }

      if (win.getGameState) {
        return { success: true, state: win.getGameState() };
      }

      return { success: false, message: "Cannot access Janggi game state" };
    },

    /**
     * MIDI Player가 열려있으면 반환, 없으면 열어서 반환
     */
    _openOrGetMidi: function() {
      var win = this._findWindow("midiplayer");
      if (!win) {
        this._openApp("midiplayer");
        win = this._findWindow("midiplayer");
      }
      return win;
    },

    /**
     * 자연어 MIDI 재생: 카테고리/검색/제목/소스/엔진 지정 재생
     */
    _midiPlay: function(cmd) {
      var win = this._openOrGetMidi();
      if (!win || !win.aiPlay) {
        return { success: false, message: "MIDI Player를 열 수 없습니다" };
      }
      win.aiPlay({
        source: cmd.source,
        genre: cmd.genre,
        query: cmd.query,
        title: cmd.title,
        engine: cmd.engine
      });
      var what = cmd.query ? ("검색 '" + cmd.query + "'")
        : cmd.title ? ("'" + cmd.title + "'")
        : cmd.genre ? ("[" + cmd.genre + "] 카테고리")
        : "재생목록";
      var src = cmd.source === "bitmidi" ? "BitMidi 온라인" : "내 라이브러리";
      return {
        success: true,
        message: "MIDI Player 재생: " + what + " (" + src +
          (cmd.engine ? (", " + cmd.engine + " 엔진") : "") + ")"
      };
    },

    /**
     * MIDI 재생 제어: play/pause/stop/next/prev/shuffle/score_on/score_off
     */
    _midiControl: function(cmd) {
      var win = this._findWindow("midiplayer");
      if (!win || !win.aiControl) {
        return { success: false, message: "MIDI Player가 열려있지 않습니다" };
      }
      return win.aiControl(cmd.action);
    },

    /**
     * MIDI 엔진 전환: simple(일반) / real(Real 악기 HQ)
     */
    _midiSetEngine: function(cmd) {
      var win = this._openOrGetMidi();
      if (!win || !win.aiSetEngine) {
        return { success: false, message: "MIDI Player를 열 수 없습니다" };
      }
      win.aiSetEngine(cmd.engine);
      return { success: true, message: "MIDI 엔진: " + cmd.engine };
    },

    /**
     * Parse cell reference like "A1" to {row, col}
     */
    _parseCellRef: function(ref) {
      if (!ref) return null;
      var match = ref.match(/^([A-Z]+)(\d+)$/i);
      if (!match) return null;

      var colStr = match[1].toUpperCase();
      var row = parseInt(match[2]) - 1;
      var col = 0;
      for (var i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
      }
      col -= 1;

      return { row: row, col: col };
    },

    /**
     * Get action log
     * @return {Array}
     */
    getActionLog: function() {
      return this.__actionLog;
    },

    /**
     * Get the AIOS system prompt for the LLM
     * @return {string}
     */
    getSystemPrompt: function() {
      var apps = this.getAvailableApps();
      var appList = apps.map(function(a) {
        return "  - " + a.id + ": " + a.name + " (" + a.description + ")";
      }).join("\n");

      return "You are DeskWeb AIOS - an AI assistant that controls a web desktop environment.\n" +
        "You can open apps, manage windows, type text, and interact with the desktop.\n\n" +
        "## Available Apps:\n" + appList + "\n\n" +
        "## Commands:\n" +
        "When the user asks you to perform an action, respond with your message AND include command blocks.\n" +
        "Command blocks use this format (one per line):\n" +
        "```\n" +
        '[CMD]{"type":"command_type", ...params}[/CMD]\n' +
        "```\n\n" +
        "## Command Types:\n" +
        '- Open app: [CMD]{"type":"open_app","app":"notepad"}[/CMD]\n' +
        '- Open app with file: [CMD]{"type":"open_app","app":"notepad","params":{"filePath":"/Documents/test.txt"}}[/CMD]\n' +
        '- Close app: [CMD]{"type":"close_app","app":"notepad"}[/CMD]\n' +
        '- Close all: [CMD]{"type":"close_all"}[/CMD]\n' +
        '- List windows: [CMD]{"type":"list_windows"}[/CMD]\n' +
        '- Type text in notepad: [CMD]{"type":"notepad_set_text","text":"Hello World"}[/CMD]\n' +
        '- Get notepad text: [CMD]{"type":"notepad_get_text"}[/CMD]\n' +
        '- Set calc cell: [CMD]{"type":"calc_set_cell","cell":"A1","value":"100"}[/CMD]\n' +
        '- Set calc formula: [CMD]{"type":"calc_set_cell","cell":"A3","value":"=SUM(A1:A2)"}[/CMD]\n' +
        '- Get calc cell: [CMD]{"type":"calc_get_cell","cell":"A1"}[/CMD]\n' +
        '- Maximize window: [CMD]{"type":"maximize_window","app":"notepad"}[/CMD]\n' +
        '- Minimize window: [CMD]{"type":"minimize_window","app":"notepad"}[/CMD]\n' +
        '- Restore window: [CMD]{"type":"restore_window","app":"notepad"}[/CMD]\n' +
        '- Move window: [CMD]{"type":"move_window","app":"notepad","x":100,"y":100}[/CMD]\n' +
        '- Resize window: [CMD]{"type":"resize_window","app":"notepad","width":800,"height":600}[/CMD]\n' +
        '- Key press (games): [CMD]{"type":"key_press","app":"tetris","key":"ArrowLeft"}[/CMD]\n' +
        '- Click (games): [CMD]{"type":"click","app":"minesweeper","x":50,"y":50}[/CMD]\n' +
        '- Get app state: [CMD]{"type":"get_app_state","app":"notepad"}[/CMD]\n' +
        '- Get janggi state: [CMD]{"type":"janggi_get_state"}[/CMD]\n' +
        "\n## MIDI Player (음악 재생) Commands:\n" +
        '- 로컬 카테고리 재생: [CMD]{"type":"midi_play","source":"local","genre":"게임"}[/CMD]  (genres: 게임,클래식,바로크,전통음악,캐럴)\n' +
        '- 제목으로 재생(로컬): [CMD]{"type":"midi_play","source":"local","title":"Zelda"}[/CMD]\n' +
        '- 온라인 검색 재생(BitMidi): [CMD]{"type":"midi_play","source":"bitmidi","query":"final fantasy"}[/CMD]\n' +
        '- 온라인 카테고리 재생: [CMD]{"type":"midi_play","source":"bitmidi","genre":"영화"}[/CMD]  (genres: 인기,게임,영화,애니,팝록,클래식,재즈,캐럴)\n' +
        '- Real 악기(HQ) 엔진으로 재생: "engine":"real" 추가 → [CMD]{"type":"midi_play","source":"bitmidi","query":"queen","engine":"real"}[/CMD]\n' +
        '- 재생 제어: [CMD]{"type":"midi_control","action":"next"}[/CMD]  (actions: play,pause,stop,next,prev,shuffle,score_on,score_off)\n' +
        '- 엔진 전환: [CMD]{"type":"midi_set_engine","engine":"real"}[/CMD]  (engine: simple 또는 real)\n\n' +
        "## Rules:\n" +
        "1. Always respond in natural language AND include [CMD] blocks for actions\n" +
        "2. You can include multiple [CMD] blocks in one response for sequential actions\n" +
        "3. When the user asks to play a game, open it and explain controls\n" +
        "4. For calc operations, open calc first if not open, then set cells\n" +
        "5. For notepad, open it first if not open, then set text\n" +
        "6. Respond in the same language as the user (Korean/English)\n" +
        "7. Be concise but helpful\n" +
        "8. 음악/연주 요청(\"...재생해줘\", \"...틀어줘\", \"음악\", \"노래\")은 midi_play 사용. " +
        "로컬 번들 장르(게임/클래식/바로크/전통음악/캐럴)는 source=\"local\", " +
        "그 외(영화/애니/팝/특정 아티스트/특정 곡명)는 source=\"bitmidi\"로 query 검색. " +
        "\"실제 악기\"/\"고음질\" 요청 시 engine=\"real\" 추가. MIDI Player는 자동으로 열림.\n";
    }
  }
});
