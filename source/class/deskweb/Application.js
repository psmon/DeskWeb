/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * This is the main application class of "deskweb"
 *
 * @asset(deskweb/*)
 */
qx.Class.define("deskweb.Application",
{
  extend : qx.application.Standalone,



  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    __desktop: null,
    __taskbar: null,
    __startMenu: null,
    __storage: null,
    __registry: null,
    __iconPositionManager: null,

    /**
     * This method contains the initial application code and gets called
     * during startup of the application
     *
     * @lint ignoreDeprecated(alert)
     */
    main : function()
    {
      // Call super class
      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug"))
      {
        // support native logging capabilities, e.g. Firebug for Firefox
        qx.log.appender.Native;
        // support additional cross-browser console. Press F7 to toggle visibility
        qx.log.appender.Console;
      }

      /*
      -------------------------------------------------------------------------
        Windows XP Desktop Application
      -------------------------------------------------------------------------
      */

      console.log("[Application] Starting DeskWeb...");

      // Initialize storage and registry singletons
      this.__storage = deskweb.util.StorageManager.getInstance();
      this.__registry = deskweb.util.FileExtensionRegistry.getInstance();
      this.__iconPositionManager = deskweb.util.IconPositionManager.getInstance();

      console.log("[Application] Storage, registry, and icon position manager initialized");

      var doc = this.getRoot();

      // Create main container with dock layout
      var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.Dock());
      doc.add(mainContainer, {edge: 0});

      // Create desktop area (Desktop automatically uses Canvas layout)
      this.__desktop = new qx.ui.window.Desktop();
      this.__desktop.set({
        appearance: "desktop"
      });

      // Create taskbar
      this.__taskbar = new deskweb.ui.Taskbar();
      this.__taskbar.addListener("startClick", this._onStartClick, this);

      // Add to main container
      mainContainer.add(this.__desktop, {edge: "center"});
      mainContainer.add(this.__taskbar, {edge: "south"});

      // Create Start Menu
      this.__startMenu = new deskweb.ui.StartMenu();
      this.__startMenu.addListener("itemClick", this._onStartMenuItemClick, this);
      doc.add(this.__startMenu);

      // Create desktop icons
      this._createDesktopIcons();

      console.log("[Application] DeskWeb started successfully");
    },

    /**
     * Create desktop icons
     */
    _createDesktopIcons: function() {
      // Define icons with their IDs and default positions
      var iconDefinitions = [
        {
          id: "my-computer",
          label: "My Computer",
          icon: "deskweb/images/computer.svg",
          defaultLeft: 20,
          defaultTop: 20,
          action: function() {
            this._openMyComputerWindow();
          }
        },
        {
          id: "my-documents",
          label: "My Documents",
          icon: "deskweb/images/folder.svg",
          defaultLeft: 20,
          defaultTop: 120,
          action: function() {
            var win = new deskweb.ui.MyComputerWindow("/Documents");
            win.addListener("openFile", this._onFileOpenRequest, this);
            this.__desktop.add(win);
            this.__taskbar.attachWindow(win);
            win.center();
            win.open();
          }
        },
        {
          id: "recycle-bin",
          label: "Recycle Bin",
          icon: "deskweb/images/recyclebin.svg",
          defaultLeft: 20,
          defaultTop: 220,
          action: function() {
            this._openRecycleBinWindow();
          }
        },
        {
          id: "notepad",
          label: "Notepad",
          icon: "deskweb/images/notepad.svg",
          defaultLeft: 20,
          defaultTop: 320,
          action: function() {
            this._openNotepadWindow(null);
          }
        },
        {
          id: "solitaire",
          label: "Solitaire",
          icon: "deskweb/images/cards.svg",
          defaultLeft: 20,
          defaultTop: 420,
          action: function() {
            this._openSolitaireWindow();
          }
        },
        {
          id: "chatbot",
          label: "AI ChatBot",
          icon: "deskweb/images/chatbot.svg",
          defaultLeft: 20,
          defaultTop: 520,
          action: function() {
            this._openChatBotWindow();
          }
        },
        {
          id: "canvas-demo",
          label: "Canvas Demo",
          icon: "deskweb/images/canvas.svg",
          defaultLeft: 20,
          defaultTop: 620,
          action: function() {
            this._openCanvasDemoWindow();
          }
        },
        {
          id: "minesweeper",
          label: "Minesweeper",
          icon: "deskweb/images/minesweeper.svg",
          defaultLeft: 20,
          defaultTop: 720,
          action: function() {
            this._openMinesweeperWindow();
          }
        }
      ];

      // Create each icon
      iconDefinitions.forEach(function(iconDef) {
        // Create icon with unique ID
        var icon = new deskweb.ui.DesktopIcon(iconDef.label, iconDef.icon, iconDef.id);

        // Check if there's a saved position
        var savedPosition = this.__iconPositionManager.getIconPosition(iconDef.id);
        var left = savedPosition ? savedPosition.left : iconDef.defaultLeft;
        var top = savedPosition ? savedPosition.top : iconDef.defaultTop;

        // Set position
        icon.setLayoutProperties({left: left, top: top});

        // Add action listener
        icon.addListener("open", iconDef.action, this);

        // Add to desktop
        this.__desktop.add(icon);

        console.log("[Application] Created icon:", iconDef.id, "at position", left, top);
      }, this);
    },

    /**
     * Handle Start button click
     */
    _onStartClick: function(e) {
      if (this.__startMenu.isVisible()) {
        this.__startMenu.hide();
      } else {
        // Show menu first to ensure it has bounds
        this.__startMenu.show();

        // Get dimensions with fallbacks
        var taskbarHeight = 30; // Default taskbar height
        var menuHeight = 500; // Default from StartMenu

        var taskbarBounds = this.__taskbar.getBounds();
        if (taskbarBounds) {
          taskbarHeight = taskbarBounds.height;
        }

        var menuBounds = this.__startMenu.getBounds();
        if (menuBounds) {
          menuHeight = menuBounds.height;
        }

        var rootBounds = this.getRoot().getBounds();
        if (rootBounds) {
          // Position menu above taskbar at bottom-left
          this.__startMenu.placeToPoint({
            left: 0,
            top: rootBounds.height - taskbarHeight - menuHeight
          });
        }
      }
    },

    /**
     * Handle Start Menu item click
     */
    _onStartMenuItemClick: function(e) {
      var itemId = e.getData();

      switch(itemId) {
        case "mycomputer":
          this._openMyComputerWindow();
          break;
        case "mydocuments":
          // Open My Computer at Documents folder
          var win = new deskweb.ui.MyComputerWindow("/Documents");
          win.addListener("openFile", this._onFileOpenRequest, this);
          this.__desktop.add(win);
          this.__taskbar.attachWindow(win);
          win.center();
          win.open();
          break;
        case "notepad":
          this._openNotepadWindow(null);
          break;
        case "solitaire":
          this._openSolitaireWindow();
          break;
        case "chatbot":
          this._openChatBotWindow();
          break;
        case "canvas-demo":
          this._openCanvasDemoWindow();
          break;
        case "minesweeper":
          this._openMinesweeperWindow();
          break;
        case "controlpanel":
          this._openWindow("Control Panel", "Control Panel settings");
          break;
        case "run":
          this._openWindow("Run", "Type the name of a program to run:");
          break;
      }
    },

    /**
     * Open My Computer window
     */
    _openMyComputerWindow: function() {
      var win = new deskweb.ui.MyComputerWindow("/");

      // Listen for file open events from My Computer
      win.addListener("openFile", this._onFileOpenRequest, this);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();
    },

    /**
     * Open Recycle Bin window
     */
    _openRecycleBinWindow: function() {
      var win = new deskweb.ui.RecycleBinWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();
    },

    /**
     * Handle file open request
     */
    _onFileOpenRequest: function(e) {
      var filePath = e.getData();
      console.log("[Application] File open request:", filePath);

      // Get file extension
      var ext = this.__storage.getFileExtension(filePath);

      // Get handler from registry
      var handler = this.__registry.getHandler(ext);

      if (!handler) {
        console.warn("[Application] No handler for file:", filePath);
        alert("No application associated with this file type.");
        return;
      }

      console.log("[Application] Opening with handler:", handler.appName);

      // Open file with appropriate application
      this._openFileWithApp(filePath, handler.appId);
    },

    /**
     * Open file with specific application
     */
    _openFileWithApp: function(filePath, appId) {
      switch(appId) {
        case "notepad":
          this._openNotepadWindow(filePath);
          break;

        default:
          console.warn("[Application] Unknown app ID:", appId);
          alert("Application not implemented: " + appId);
      }
    },

    /**
     * Open Notepad window
     */
    _openNotepadWindow: function(filePath) {
      var win = new deskweb.ui.NotepadWindow(filePath);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Notepad with file:", filePath);
    },

    /**
     * Open Solitaire window
     */
    _openSolitaireWindow: function() {
      var win = new deskweb.ui.SolitaireWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Solitaire game");
    },

    /**
     * Open ChatBot window
     */
    _openChatBotWindow: function() {
      var win = new deskweb.ui.ChatBotWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened AI ChatBot");
    },

    /**
     * Open Canvas Demo window
     */
    _openCanvasDemoWindow: function() {
      var win = new deskweb.ui.CanvasDemoWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Canvas Demo");
    },

    /**
     * Open Minesweeper window
     */
    _openMinesweeperWindow: function() {
      var win = new deskweb.ui.MinesweeperWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Minesweeper game");
    },

    /**
     * Open a generic window
     */
    _openWindow: function(title, content) {
      var win = new qx.ui.window.Window(title);
      win.setLayout(new qx.ui.layout.VBox(10));
      win.set({
        width: 400,
        height: 300,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        contentPadding: 20
      });

      var label = new qx.ui.basic.Label(content);
      win.add(label);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();
    }
  }
});