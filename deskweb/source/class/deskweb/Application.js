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
    __customApps: null,
    __desktopContextMenu: null,
    __selectedIcon: null,
    __desktopIcons: null,

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

      // Initialize custom apps array and icon tracking
      this.__customApps = [];
      this.__desktopIcons = [];
      this._loadCustomApps();

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

      // Setup desktop context menu for adding apps
      this._setupDesktopContextMenu();

      // Click on desktop background to deselect all icons
      this.__desktop.addListener("click", this._deselectAllIcons, this);

      // Register with AppController for AIOS
      var appController = deskweb.util.AppController.getInstance();
      appController.setApplication(this);

      console.log("[Application] DeskWeb started successfully");
    },

    /**
     * Get the desktop instance (used by AppController)
     * @return {qx.ui.window.Desktop}
     */
    getDesktop: function() {
      return this.__desktop;
    },

    /**
     * Get the taskbar instance (used by AppController)
     * @return {deskweb.ui.Taskbar}
     */
    getTaskbar: function() {
      return this.__taskbar;
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
        },
        {
          id: "hwpviewer",
          label: "HWP Viewer",
          icon: "deskweb/images/hwp.svg",
          defaultLeft: 120,
          defaultTop: 20,
          action: function() {
            this._openHWPViewerWindow(null);
          }
        },
        {
          id: "askbot",
          label: "ASK BOT",
          icon: "deskweb/images/askbot.svg",
          defaultLeft: 20,
          defaultTop: 820,
          action: function() {
            this._openAskBotWindow();
          }
        },
        {
          id: "tetris",
          label: "3D Tetris",
          icon: "deskweb/images/tetris.svg",
          defaultLeft: 120,
          defaultTop: 120,
          action: function() {
            this._openTetrisWindow();
          }
        },
        {
          id: "calc",
          label: "Calc",
          icon: "deskweb/images/calc.svg",
          defaultLeft: 120,
          defaultTop: 220,
          action: function() {
            this._openCalcWindow();
          }
        },
        {
          id: "janggi",
          label: "Janggi",
          icon: "deskweb/images/janggi.svg",
          defaultLeft: 120,
          defaultTop: 320,
          action: function() {
            this._openJanggiWindow();
          }
        },
        {
          id: "whiteboard",
          label: "WhiteBoard",
          icon: "deskweb/images/whiteboard.svg",
          defaultLeft: 120,
          defaultTop: 420,
          action: function() {
            this._openWhiteBoardWindow(null);
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

        // Add selection listener
        icon.addListener("iconSelect", function() {
          this._selectIcon(icon);
        }, this);

        // Track icon
        this.__desktopIcons.push(icon);

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
        case "askbot":
          this._openAskBotWindow();
          break;
        case "hwpviewer":
          this._openHWPViewerWindow(null);
          break;
        case "tetris":
          this._openTetrisWindow();
          break;
        case "calc":
          this._openCalcWindow();
          break;
        case "janggi":
          this._openJanggiWindow();
          break;
        case "whiteboard":
          this._openWhiteBoardWindow(null);
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

        case "hwpviewer":
          this._openHWPViewerWindow(filePath);
          break;

        case "calc":
          this._openCalcWindow(filePath);
          break;

        case "whiteboard":
          this._openWhiteBoardWindow(filePath);
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
     * Open AskBot window
     */
    _openAskBotWindow: function() {
      var win = new deskweb.ui.AskBotWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened ASK BOT");
    },

    /**
     * Open HWP Viewer window
     */
    _openHWPViewerWindow: function(filePath) {
      var win = new deskweb.ui.HWPViewerWindow(filePath);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened HWP Viewer with file:", filePath);
    },

    /**
     * Open 3D Tetris window
     */
    _openTetrisWindow: function() {
      var win = new deskweb.ui.TetrisWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened 3D Tetris game");
    },

    /**
     * Open Calc window
     */
    _openCalcWindow: function(filePath) {
      var win = new deskweb.ui.CalcWindow(filePath);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Calc spreadsheet");
    },

    /**
     * Open Janggi window
     */
    _openJanggiWindow: function() {
      var win = new deskweb.ui.JanggiWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened Janggi game");
    },

    /**
     * Open WhiteBoard window
     */
    _openWhiteBoardWindow: function(filePath) {
      var win = new deskweb.ui.WhiteBoardWindow(filePath);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened WhiteBoard with file:", filePath);
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
    },

    /**
     * Setup desktop context menu for adding custom apps
     */
    _setupDesktopContextMenu: function() {
      // Create context menu
      this.__desktopContextMenu = new qx.ui.menu.Menu();

      // Add "Add App" button
      var addAppButton = new qx.ui.menu.Button("Add App...");
      addAppButton.addListener("execute", this._onAddAppClick, this);
      this.__desktopContextMenu.add(addAppButton);

      // Attach context menu to desktop
      this.__desktop.setContextMenu(this.__desktopContextMenu);

      console.log("[Application] Desktop context menu setup");
    },

    /**
     * Handle Add App button click
     */
    _onAddAppClick: function() {
      // Create dialog window
      var dialog = new qx.ui.window.Window("Add Custom App");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400,
        height: 200,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        showClose: true,
        contentPadding: 20
      });

      // App name input
      var nameContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      nameContainer.add(new qx.ui.basic.Label("App Name:").set({width: 80, alignY: "middle"}));
      var nameInput = new qx.ui.form.TextField();
      nameInput.setPlaceholder("e.g., ASK BOT");
      nameContainer.add(nameInput, {flex: 1});
      dialog.add(nameContainer);

      // URL input
      var urlContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      urlContainer.add(new qx.ui.basic.Label("URL:").set({width: 80, alignY: "middle"}));
      var urlInput = new qx.ui.form.TextField();
      urlInput.setPlaceholder("e.g., https://example.com");
      urlContainer.add(urlInput, {flex: 1});
      dialog.add(urlContainer);

      // Buttons
      var buttonContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10, "right"));

      var cancelButton = new qx.ui.form.Button("Cancel");
      cancelButton.addListener("execute", function() {
        dialog.close();
      });
      buttonContainer.add(cancelButton);

      var addButton = new qx.ui.form.Button("Add");
      addButton.addListener("execute", function() {
        var appName = nameInput.getValue();
        var appUrl = urlInput.getValue();

        if (!appName || !appUrl) {
          alert("Please enter both app name and URL.");
          return;
        }

        // Validate URL
        if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
          alert("URL must start with http:// or https://");
          return;
        }

        // Add custom app
        this._addCustomApp(appName, appUrl);
        dialog.close();
      }, this);
      buttonContainer.add(addButton);

      dialog.add(buttonContainer);

      // Show dialog
      this.__desktop.add(dialog);
      dialog.center();
      dialog.open();

      console.log("[Application] Add App dialog opened");
    },

    /**
     * Add a custom app to the desktop
     */
    _addCustomApp: function(appName, appUrl) {
      // Generate unique ID
      var appId = "custom-app-" + Date.now();

      // Find next available position
      var topPosition = 220; // Start after built-in apps
      this.__customApps.forEach(function(app) {
        if (app.defaultTop >= topPosition) {
          topPosition = app.defaultTop + 100;
        }
      });

      // Create app definition
      var appDef = {
        id: appId,
        label: appName,
        icon: "deskweb/images/askbot.svg", // Default icon for now
        url: appUrl,
        defaultLeft: 20,
        defaultTop: topPosition,
        isCustom: true
      };

      // Add to custom apps array
      this.__customApps.push(appDef);

      // Save to localStorage
      this._saveCustomApps();

      // Create icon on desktop
      this._createCustomAppIcon(appDef);

      console.log("[Application] Added custom app:", appName, appUrl);
    },

    /**
     * Create icon for custom app
     */
    _createCustomAppIcon: function(appDef) {
      // For favicon mode, create without default icon to prevent overlap
      var isFavicon = appDef.url && (!appDef.iconType || appDef.iconType === "favicon");
      var iconImage = isFavicon ? null : appDef.icon;
      var icon = new deskweb.ui.DesktopIcon(appDef.label, iconImage, appDef.id);

      // Check if there's a saved position
      var savedPosition = this.__iconPositionManager.getIconPosition(appDef.id);
      var left = savedPosition ? savedPosition.left : appDef.defaultLeft;
      var top = savedPosition ? savedPosition.top : appDef.defaultTop;

      // Set position
      icon.setLayoutProperties({left: left, top: top});

      // Add action listener to open custom app
      icon.addListener("open", function() {
        this._openCustomApp(appDef);
      }, this);

      // Add selection listener
      icon.addListener("iconSelect", function() {
        this._selectIcon(icon);
      }, this);

      // Add context menu for custom apps (delete + change icon)
      if (appDef.isCustom) {
        var contextMenu = new qx.ui.menu.Menu();

        var changeIconButton = new qx.ui.menu.Button("Change Icon...");
        changeIconButton.addListener("execute", function() {
          this._showIconChooser(appDef, icon);
        }, this);
        contextMenu.add(changeIconButton);

        contextMenu.add(new qx.ui.menu.Separator());

        var deleteButton = new qx.ui.menu.Button("Delete App");
        deleteButton.addListener("execute", function() {
          this._deleteCustomApp(appDef.id);
        }, this);
        contextMenu.add(deleteButton);

        icon.setContextMenu(contextMenu);
      }

      // Apply favicon if iconType is favicon or no iconType set (try favicon by default)
      if (appDef.url && (!appDef.iconType || appDef.iconType === "favicon")) {
        icon.setFaviconFromUrl(appDef.url);
      }

      // Track icon
      this.__desktopIcons.push(icon);

      // Add to desktop
      this.__desktop.add(icon);

      console.log("[Application] Created custom app icon:", appDef.id, "at position", left, top);

      return icon;
    },

    /**
     * Open custom app window
     */
    _openCustomApp: function(appDef) {
      var iconForWindow = appDef.icon;

      // For favicon type, compute the favicon URL from the app URL
      if (!appDef.iconType || appDef.iconType === "favicon") {
        try {
          var urlObj = new URL(appDef.url);
          var domain = urlObj.hostname;
          iconForWindow = "https://www.google.com/s2/favicons?domain=" + domain + "&sz=64";
        } catch (err) {
          console.warn("[Application] Invalid URL for favicon:", appDef.url);
        }
      }

      var win = new deskweb.ui.AskBotWindow(appDef.url, appDef.label, iconForWindow);

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();

      console.log("[Application] Opened custom app:", appDef.label);
    },

    /**
     * Delete custom app
     */
    _deleteCustomApp: function(appId) {
      if (!confirm("Are you sure you want to delete this app?")) {
        return;
      }

      // Remove from custom apps array
      this.__customApps = this.__customApps.filter(function(app) {
        return app.id !== appId;
      });

      // Save to localStorage
      this._saveCustomApps();

      // Find and remove icon from desktop
      var children = this.__desktop.getChildren();
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child instanceof deskweb.ui.DesktopIcon) {
          if (child.getIconId() === appId) {
            this.__desktop.remove(child);
            // Remove from tracked icons
            var idx = this.__desktopIcons.indexOf(child);
            if (idx >= 0) {
              this.__desktopIcons.splice(idx, 1);
            }
            child.dispose();
            break;
          }
        }
      }

      // Remove saved position
      this.__iconPositionManager.clearIconPosition(appId);

      console.log("[Application] Deleted custom app:", appId);
    },

    /**
     * Load custom apps from localStorage
     */
    _loadCustomApps: function() {
      try {
        var stored = localStorage.getItem("deskweb.customApps");
        if (stored) {
          this.__customApps = JSON.parse(stored);
          console.log("[Application] Loaded custom apps:", this.__customApps.length);

          // Create icons for custom apps
          this.__customApps.forEach(function(appDef) {
            // Defer creation until after desktop is ready
            qx.event.Timer.once(function() {
              this._createCustomAppIcon(appDef);
            }, this, 100);
          }, this);
        }
      } catch (error) {
        console.error("[Application] Failed to load custom apps:", error);
        this.__customApps = [];
      }
    },

    /**
     * Select an icon and deselect others
     */
    _selectIcon: function(targetIcon) {
      // Deselect all icons
      this.__desktopIcons.forEach(function(icon) {
        icon.deselect();
      });
      // Select the target
      targetIcon.select();
      this.__selectedIcon = targetIcon;
    },

    /**
     * Deselect all icons
     */
    _deselectAllIcons: function(e) {
      this.__desktopIcons.forEach(function(icon) {
        icon.deselect();
      });
      this.__selectedIcon = null;
    },

    /**
     * Show icon chooser dialog for custom apps
     */
    _showIconChooser: function(appDef, iconWidget) {
      var dialog = new qx.ui.window.Window("Change Icon");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 360,
        height: 320,
        modal: true,
        showMinimize: false,
        showMaximize: false,
        showClose: true,
        contentPadding: 15
      });

      dialog.add(new qx.ui.basic.Label("Select an icon:").set({
        font: "bold"
      }));

      // Icon options grid
      var grid = new qx.ui.container.Composite(new qx.ui.layout.Flow(8, 8));

      var iconOptions = [
        { type: "favicon", label: "Favicon", icon: null },
        { type: "preset", label: "Web", icon: "deskweb/images/askbot.svg" },
        { type: "preset", label: "Chat", icon: "deskweb/images/chatbot.svg" },
        { type: "preset", label: "Document", icon: "deskweb/images/notepad.svg" },
        { type: "preset", label: "Computer", icon: "deskweb/images/computer.svg" },
        { type: "preset", label: "Folder", icon: "deskweb/images/folder.svg" },
        { type: "preset", label: "Canvas", icon: "deskweb/images/canvas.svg" },
        { type: "preset", label: "Settings", icon: "deskweb/images/settings.svg" },
        { type: "preset", label: "Calc", icon: "deskweb/images/calc.svg" },
        { type: "preset", label: "Help", icon: "deskweb/images/help.svg" },
        { type: "preset", label: "Game", icon: "deskweb/images/cards.svg" },
        { type: "preset", label: "HWP", icon: "deskweb/images/hwp.svg" }
      ];

      var selectedOption = { type: appDef.iconType || "favicon" };

      iconOptions.forEach(function(opt) {
        var btn = new qx.ui.form.Button(null);
        btn.set({
          width: 60,
          height: 60,
          toolTipText: opt.label
        });

        if (opt.type === "favicon") {
          btn.setLabel("Fav");
          btn.addListenerOnce("appear", function() {
            var el = btn.getContentElement().getDomElement();
            if (el && appDef.url) {
              try {
                var urlObj = new URL(appDef.url);
                var domain = urlObj.hostname;
                var favUrl = "https://www.google.com/s2/favicons?domain=" + domain + "&sz=64";
                var img = document.createElement("img");
                img.src = favUrl;
                img.style.width = "28px";
                img.style.height = "28px";
                img.style.display = "block";
                img.style.margin = "2px auto";
                img.style.objectFit = "contain";
                img.onerror = function() {
                  img.style.display = "none";
                };
                el.insertBefore(img, el.firstChild);
              } catch(err) {}
            }
          });
        } else {
          btn.setIcon(opt.icon);
        }

        // Highlight currently selected type
        if ((opt.type === "favicon" && (!appDef.iconType || appDef.iconType === "favicon")) ||
            (opt.type === "preset" && appDef.icon === opt.icon && appDef.iconType === "preset")) {
          btn.getContentElement().setStyle("border", "2px solid #0054E3");
        }

        btn.addListener("execute", function() {
          selectedOption = opt;
          // Update visual selection
          var btns = grid.getChildren();
          btns.forEach(function(b) {
            b.getContentElement().setStyle("border", "");
          });
          btn.getContentElement().setStyle("border", "2px solid #0054E3");
        });

        grid.add(btn);
      }, this);

      dialog.add(grid, {flex: 1});

      // Buttons
      var buttonContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10, "right"));

      var cancelButton = new qx.ui.form.Button("Cancel");
      cancelButton.addListener("execute", function() {
        dialog.close();
      });
      buttonContainer.add(cancelButton);

      var applyButton = new qx.ui.form.Button("Apply");
      applyButton.addListener("execute", function() {
        if (selectedOption.type === "favicon") {
          appDef.iconType = "favicon";
          appDef.icon = "deskweb/images/askbot.svg";
          iconWidget.changeToPresetIcon(appDef.icon);
          iconWidget.setFaviconFromUrl(appDef.url);
        } else {
          appDef.iconType = "preset";
          appDef.icon = selectedOption.icon;
          iconWidget.changeToPresetIcon(selectedOption.icon);
        }
        this._saveCustomApps();
        dialog.close();
      }, this);
      buttonContainer.add(applyButton);

      dialog.add(buttonContainer);

      this.__desktop.add(dialog);
      dialog.center();
      dialog.open();
    },

    /**
     * Save custom apps to localStorage
     */
    _saveCustomApps: function() {
      try {
        localStorage.setItem("deskweb.customApps", JSON.stringify(this.__customApps));
        console.log("[Application] Saved custom apps");
      } catch (error) {
        console.error("[Application] Failed to save custom apps:", error);
      }
    }
  }
});