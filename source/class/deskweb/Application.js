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
    },

    /**
     * Create desktop icons
     */
    _createDesktopIcons: function() {
      // My Computer icon
      var myComputerIcon = new deskweb.ui.DesktopIcon("My Computer", "deskweb/images/computer.svg");
      myComputerIcon.setLayoutProperties({left: 20, top: 20});
      myComputerIcon.addListener("open", function() {
        this._openMyComputerWindow();
      }, this);
      this.__desktop.add(myComputerIcon);

      // My Documents icon
      var myDocumentsIcon = new deskweb.ui.DesktopIcon("My Documents", "deskweb/images/folder.svg");
      myDocumentsIcon.setLayoutProperties({left: 20, top: 120});
      myDocumentsIcon.addListener("open", function() {
        this._openWindow("My Documents", "My Documents folder contents would go here.");
      }, this);
      this.__desktop.add(myDocumentsIcon);

      // Recycle Bin icon
      var recycleBinIcon = new deskweb.ui.DesktopIcon("Recycle Bin", "deskweb/images/recyclebin.svg");
      recycleBinIcon.setLayoutProperties({left: 20, top: 220});
      recycleBinIcon.addListener("open", function() {
        this._openWindow("Recycle Bin", "Recycle Bin is empty.");
      }, this);
      this.__desktop.add(recycleBinIcon);
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
          this._openWindow("My Documents", "My Documents folder");
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
      var win = new deskweb.ui.MyComputerWindow();

      this.__desktop.add(win);
      this.__taskbar.attachWindow(win);

      win.center();
      win.open();
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