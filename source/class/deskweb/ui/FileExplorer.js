/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * FileExplorer Component
 *
 * A file browser widget that displays files and directories
 * Supports:
 * - Directory navigation
 * - File/folder icons
 * - Double-click to open files
 * - Context menu operations
 */
qx.Class.define("deskweb.ui.FileExplorer", {
  extend: qx.ui.container.Composite,

  construct: function(currentPath) {
    this.base(arguments, new qx.ui.layout.VBox(5));

    this.__currentPath = currentPath || "/";
    this.__storage = deskweb.util.StorageManager.getInstance();
    this.__registry = deskweb.util.FileExtensionRegistry.getInstance();

    this.set({
      padding: 10
    });

    // Create UI
    this._createToolbar();
    this._createFileList();

    // Load initial directory
    this._loadDirectory(this.__currentPath);

    console.log("[FileExplorer] Created with path:", this.__currentPath);
  },

  events: {
    /** Fired when a file is opened */
    "openFile": "qx.event.type.Data",

    /** Fired when path changes */
    "pathChanged": "qx.event.type.Data"
  },

  members: {
    __storage: null,
    __registry: null,
    __currentPath: null,
    __addressField: null,
    __fileList: null,

    /**
     * Create toolbar with navigation and address bar
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();

      // Back button
      var backBtn = new qx.ui.toolbar.Button(null, "icon/16/actions/go-previous.png");
      backBtn.setToolTipText("Back");
      backBtn.addListener("execute", this._onBack, this);
      toolbar.add(backBtn);

      // Up button
      var upBtn = new qx.ui.toolbar.Button(null, "icon/16/actions/go-up.png");
      upBtn.setToolTipText("Up One Level");
      upBtn.addListener("execute", this._onUp, this);
      toolbar.add(upBtn);

      // Refresh button
      var refreshBtn = new qx.ui.toolbar.Button(null, "icon/16/actions/view-refresh.png");
      refreshBtn.setToolTipText("Refresh");
      refreshBtn.addListener("execute", this._onRefresh, this);
      toolbar.add(refreshBtn);

      toolbar.add(new qx.ui.toolbar.Separator());

      // Address bar label
      toolbar.add(new qx.ui.basic.Label("Address:"));

      // Address field
      this.__addressField = new qx.ui.form.TextField();
      this.__addressField.set({
        marginLeft: 5
      });
      this.__addressField.addListener("keypress", function(e) {
        if (e.getKeyIdentifier() === "Enter") {
          this._navigateToPath(this.__addressField.getValue());
        }
      }, this);
      toolbar.add(this.__addressField, {flex: 1});

      this.add(toolbar);
    },

    /**
     * Create file list
     */
    _createFileList: function() {
      // Create scroll container
      var scrollContainer = new qx.ui.container.Scroll();

      // Create list
      this.__fileList = new qx.ui.form.List();
      this.__fileList.set({
        selectionMode: "single",
        height: null
      });

      // Handle double-click
      this.__fileList.addListener("dblclick", this._onFileDoubleClick, this);

      scrollContainer.add(this.__fileList);
      this.add(scrollContainer, {flex: 1});
    },

    /**
     * Load directory contents
     */
    _loadDirectory: function(path) {
      this.__currentPath = path;
      this.__addressField.setValue(path);

      // Clear current list
      this.__fileList.removeAll();

      // Get directory contents
      var items = this.__storage.listDirectory(path);

      // Sort: directories first, then files
      items.sort(function(a, b) {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      // Add parent directory (..) if not at root
      if (path !== "/" && path !== "") {
        var parentItem = new qx.ui.form.ListItem("..", "icon/16/places/folder.png");
        parentItem.setUserData("path", this._getParentPath(path));
        parentItem.setUserData("type", "parent");
        this.__fileList.add(parentItem);
      }

      // Add items
      items.forEach(function(item) {
        var icon = this._getIconForItem(item);
        var listItem = new qx.ui.form.ListItem(item.name, icon);

        listItem.setUserData("path", item.path);
        listItem.setUserData("type", item.type);
        listItem.setUserData("item", item);

        this.__fileList.add(listItem);
      }, this);

      // Fire path changed event
      this.fireDataEvent("pathChanged", path);

      console.log("[FileExplorer] Loaded directory:", path, "Items:", items.length);
    },

    /**
     * Get icon for file/directory
     */
    _getIconForItem: function(item) {
      if (item.type === 'directory') {
        return "icon/16/places/folder.png";
      }

      // Get extension
      var ext = this.__storage.getFileExtension(item.name);
      if (ext) {
        return this.__registry.getIconForExtension(ext);
      }

      return "icon/16/mimetypes/office-document.png";
    },

    /**
     * Handle file/folder double-click
     */
    _onFileDoubleClick: function(e) {
      var selection = this.__fileList.getSelection();
      if (selection.length === 0) {
        return;
      }

      var item = selection[0];
      var path = item.getUserData("path");
      var type = item.getUserData("type");

      if (type === 'directory' || type === 'parent') {
        // Navigate to directory
        this._navigateToPath(path);
      } else if (type === 'file') {
        // Open file
        this._openFile(path);
      }
    },

    /**
     * Open a file
     */
    _openFile: function(path) {
      console.log("[FileExplorer] Opening file:", path);

      // Fire event for parent to handle
      this.fireDataEvent("openFile", path);
    },

    /**
     * Navigate to path
     */
    _navigateToPath: function(path) {
      // Normalize path
      path = path.replace(/\\/g, '/');
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      this._loadDirectory(path);
    },

    /**
     * Get parent path
     */
    _getParentPath: function(path) {
      if (path === '/' || path === '') {
        return '/';
      }

      var parts = path.split('/').filter(function(p) { return p.length > 0; });
      parts.pop();

      if (parts.length === 0) {
        return '/';
      }

      return '/' + parts.join('/');
    },

    /**
     * Handle back button
     */
    _onBack: function() {
      // TODO: Implement navigation history
      this._onUp();
    },

    /**
     * Handle up button
     */
    _onUp: function() {
      var parentPath = this._getParentPath(this.__currentPath);
      this._navigateToPath(parentPath);
    },

    /**
     * Handle refresh button
     */
    _onRefresh: function() {
      this._loadDirectory(this.__currentPath);
    },

    /**
     * Get current path
     */
    getCurrentPath: function() {
      return this.__currentPath;
    },

    /**
     * Set current path
     */
    setCurrentPath: function(path) {
      this._loadDirectory(path);
    }
  },

  destruct: function() {
    this.__storage = null;
    this.__registry = null;
    this.__addressField = null;
    this.__fileList = null;
  }
});
