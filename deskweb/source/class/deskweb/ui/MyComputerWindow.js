/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * My Computer Window
 *
 * Displays file explorer for the virtual file system
 */
qx.Class.define("deskweb.ui.MyComputerWindow", {
  extend: qx.ui.window.Window,

  construct: function(initialPath) {
    this.base(arguments, "My Computer");

    this.__initialPath = initialPath || "/";

    this.set({
      width: 700,
      height: 500,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Create file explorer
    this.__fileExplorer = new deskweb.ui.FileExplorer(this.__initialPath);

    // Listen for file open events
    this.__fileExplorer.addListener("openFile", this._onFileOpen, this);

    // Listen for path changes to update title
    this.__fileExplorer.addListener("pathChanged", this._onPathChanged, this);

    this.add(this.__fileExplorer, {flex: 1});

    console.log("[MyComputerWindow] Created with path:", this.__initialPath);
  },

  events: {
    /** Fired when a file should be opened */
    "openFile": "qx.event.type.Data"
  },

  members: {
    __fileExplorer: null,
    __initialPath: null,

    /**
     * Handle file open event from file explorer
     */
    _onFileOpen: function(e) {
      var filePath = e.getData();
      console.log("[MyComputerWindow] File open requested:", filePath);

      // Forward the event to parent (Application)
      this.fireDataEvent("openFile", filePath);
    },

    /**
     * Handle path changed event
     */
    _onPathChanged: function(e) {
      var path = e.getData();

      // Update window title
      if (path === "/" || path === "") {
        this.setCaption("My Computer");
      } else {
        this.setCaption("My Computer - " + path);
      }
    },

    /**
     * Navigate to specific path
     */
    navigateToPath: function(path) {
      this.__fileExplorer.setCurrentPath(path);
    }
  },

  destruct: function() {
    this.__fileExplorer = null;
  }
});
