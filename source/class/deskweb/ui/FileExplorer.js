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
    __contextMenu: null,
    __selectedItem: null,

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

      // Handle right-click context menu
      this.__fileList.addListener("contextmenu", this._onContextMenu, this);

      scrollContainer.add(this.__fileList);
      this.add(scrollContainer, {flex: 1});

      // Create context menu
      this._createContextMenu();

      // Setup drag and drop for file upload
      this._setupDragAndDrop();
    },

    /**
     * Setup drag and drop for file upload from PC
     */
    _setupDragAndDrop: function() {
      var elem = this.getContentElement().getDomElement();

      // Note: DOM element might not be available immediately
      this.addListenerOnce("appear", function() {
        elem = this.getContentElement().getDomElement();

        // Prevent default drag over behavior
        elem.addEventListener("dragover", function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
        });

        // Prevent default drag enter behavior
        elem.addEventListener("dragenter", function(e) {
          e.preventDefault();
          e.stopPropagation();
        });

        // Handle file drop
        elem.addEventListener("drop", function(e) {
          e.preventDefault();
          e.stopPropagation();

          var files = e.dataTransfer.files;
          if (files.length > 0) {
            this._handleFileUpload(files);
          }
        }.bind(this));

        console.log("[FileExplorer] Drag and drop enabled");
      }, this);
    },

    /**
     * Handle file upload from drag and drop
     */
    _handleFileUpload: function(files) {
      console.log("[FileExplorer] Uploading", files.length, "file(s)");

      var uploadedCount = 0;
      var totalFiles = files.length;

      // Process each file
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var reader = new FileReader();

        reader.onload = function(fileName) {
          return function(e) {
            var content = e.target.result;

            // Create file path
            var filePath = this.__currentPath;
            if (!filePath.endsWith('/')) {
              filePath += '/';
            }
            filePath += fileName;

            // Write file to storage
            this.__storage.writeFile(filePath, content);
            uploadedCount++;

            console.log("[FileExplorer] Uploaded file:", filePath);

            // Refresh list when all files are uploaded
            if (uploadedCount === totalFiles) {
              this._loadDirectory(this.__currentPath);
              this._showUploadNotification(totalFiles);
            }
          }.bind(this);
        }.bind(this)(file.name);

        // Read file as text
        reader.readAsText(file);
      }
    },

    /**
     * Show upload notification
     */
    _showUploadNotification: function(count) {
      var message = count === 1 ? "1 file uploaded" : count + " files uploaded";

      // Create notification dialog
      var dialog = new qx.ui.window.Window("Upload Complete");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 300,
        modal: false,
        showMinimize: false,
        showMaximize: false,
        showClose: true
      });

      dialog.add(new qx.ui.basic.Label(message));

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));
      var okBtn = new qx.ui.form.Button("OK");
      okBtn.addListener("execute", function() {
        dialog.close();
      });
      btnContainer.add(okBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();

      // Auto-close after 2 seconds
      qx.event.Timer.once(function() {
        if (!dialog.isDisposed()) {
          dialog.close();
        }
      }, this, 2000);

      console.log("[FileExplorer] Upload notification shown:", message);
    },

    /**
     * Create context menu
     */
    _createContextMenu: function() {
      this.__contextMenu = new qx.ui.menu.Menu();

      // New Folder button
      var newFolderBtn = new qx.ui.menu.Button("New Folder", "icon/16/places/folder.png");
      newFolderBtn.addListener("execute", this._onNewFolder, this);
      this.__contextMenu.add(newFolderBtn);

      this.__contextMenu.add(new qx.ui.menu.Separator());

      // Delete button
      var deleteBtn = new qx.ui.menu.Button("Delete", "icon/16/actions/edit-delete.png");
      deleteBtn.addListener("execute", this._onDelete, this);
      this.__contextMenu.add(deleteBtn);

      // Rename button
      var renameBtn = new qx.ui.menu.Button("Rename", "icon/16/actions/document-properties.png");
      renameBtn.addListener("execute", this._onRename, this);
      this.__contextMenu.add(renameBtn);

      this.__contextMenu.add(new qx.ui.menu.Separator());

      // Download button
      var downloadBtn = new qx.ui.menu.Button("Download", "icon/16/actions/document-save.png");
      downloadBtn.addListener("execute", this._onDownload, this);
      this.__contextMenu.add(downloadBtn);

      this.__contextMenu.add(new qx.ui.menu.Separator());

      // Properties button
      var propertiesBtn = new qx.ui.menu.Button("Properties", "icon/16/actions/document-properties.png");
      propertiesBtn.addListener("execute", this._onProperties, this);
      this.__contextMenu.add(propertiesBtn);
    },

    /**
     * Handle context menu
     */
    _onContextMenu: function(e) {
      var selection = this.__fileList.getSelection();

      // Store selected item
      if (selection.length > 0) {
        this.__selectedItem = selection[0];
      } else {
        this.__selectedItem = null;
      }

      // Show/hide menu items based on selection
      var hasSelection = this.__selectedItem !== null;
      var isParent = hasSelection && this.__selectedItem.getUserData("type") === "parent";

      // Get menu buttons
      var items = this.__contextMenu.getChildren();
      var newFolderBtn = items[0];
      var deleteBtn = items[2];
      var renameBtn = items[3];
      var downloadBtn = items[5];
      var propertiesBtn = items[7];

      // New Folder: always visible
      newFolderBtn.setEnabled(true);

      // Delete, Rename, Properties: only when item selected (not parent)
      deleteBtn.setEnabled(hasSelection && !isParent);
      renameBtn.setEnabled(hasSelection && !isParent);
      propertiesBtn.setEnabled(hasSelection && !isParent);

      // Download: only for files
      var isFile = hasSelection && this.__selectedItem.getUserData("type") === "file";
      downloadBtn.setEnabled(isFile);

      // Show context menu
      this.__contextMenu.placeToPointer(e);
      this.__contextMenu.show();

      e.preventDefault();
      e.stop();
    },

    /**
     * Handle New Folder
     */
    _onNewFolder: function() {
      console.log("[FileExplorer] Creating new folder");

      // Prompt for folder name
      var dialog = new qx.ui.window.Window("New Folder");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 300,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      dialog.add(new qx.ui.basic.Label("Enter folder name:"));

      var nameField = new qx.ui.form.TextField();
      nameField.setValue("New Folder");
      dialog.add(nameField);

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var okBtn = new qx.ui.form.Button("OK");
      okBtn.addListener("execute", function() {
        var folderName = nameField.getValue().trim();
        if (folderName) {
          var newPath = this.__currentPath;
          if (!newPath.endsWith('/')) {
            newPath += '/';
          }
          newPath += folderName;

          this.__storage.createDirectory(newPath);
          this._loadDirectory(this.__currentPath);
          console.log("[FileExplorer] Created folder:", newPath);
        }
        dialog.close();
      }, this);

      var cancelBtn = new qx.ui.form.Button("Cancel");
      cancelBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(okBtn);
      btnContainer.add(cancelBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();

      // Auto-select text
      nameField.focus();
      nameField.selectAllText();
    },

    /**
     * Handle Delete - Move to Recycle Bin
     */
    _onDelete: function() {
      if (!this.__selectedItem) {
        return;
      }

      var path = this.__selectedItem.getUserData("path");
      var type = this.__selectedItem.getUserData("type");
      var name = this.__selectedItem.getLabel();

      console.log("[FileExplorer] Moving to trash:", path, type);

      // Confirm deletion
      var dialog = new qx.ui.window.Window("Move to Recycle Bin");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 350,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      var message = "Are you sure you want to move '" + name + "' to the Recycle Bin?";

      dialog.add(new qx.ui.basic.Label(message));

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var yesBtn = new qx.ui.form.Button("Yes");
      yesBtn.addListener("execute", function() {
        // Move to trash instead of permanent delete
        this.__storage.moveToTrash(path);
        this._loadDirectory(this.__currentPath);
        dialog.close();
        console.log("[FileExplorer] Moved to trash:", path);
      }, this);

      var noBtn = new qx.ui.form.Button("No");
      noBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(yesBtn);
      btnContainer.add(noBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();
    },

    /**
     * Handle Rename
     */
    _onRename: function() {
      if (!this.__selectedItem) {
        return;
      }

      var oldPath = this.__selectedItem.getUserData("path");
      var oldName = this.__selectedItem.getLabel();
      var type = this.__selectedItem.getUserData("type");

      console.log("[FileExplorer] Renaming:", oldPath);

      // Prompt for new name
      var dialog = new qx.ui.window.Window("Rename");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 300,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      dialog.add(new qx.ui.basic.Label("Enter new name:"));

      var nameField = new qx.ui.form.TextField();
      nameField.setValue(oldName);
      dialog.add(nameField);

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var okBtn = new qx.ui.form.Button("OK");
      okBtn.addListener("execute", function() {
        var newName = nameField.getValue().trim();
        if (newName && newName !== oldName) {
          // Build new path
          var parentPath = this._getParentPath(oldPath);
          if (!parentPath.endsWith('/')) {
            parentPath += '/';
          }
          var newPath = parentPath + newName;

          this.__storage.renameFile(oldPath, newPath);
          this._loadDirectory(this.__currentPath);
          console.log("[FileExplorer] Renamed:", oldPath, "->", newPath);
        }
        dialog.close();
      }, this);

      var cancelBtn = new qx.ui.form.Button("Cancel");
      cancelBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(okBtn);
      btnContainer.add(cancelBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();

      // Auto-select text (without extension for files)
      nameField.focus();
      if (type === "file") {
        var lastDot = oldName.lastIndexOf('.');
        if (lastDot > 0) {
          nameField.setTextSelection(0, lastDot);
        } else {
          nameField.selectAllText();
        }
      } else {
        nameField.selectAllText();
      }
    },

    /**
     * Handle Download
     */
    _onDownload: function() {
      if (!this.__selectedItem) {
        return;
      }

      var path = this.__selectedItem.getUserData("path");
      var type = this.__selectedItem.getUserData("type");

      if (type !== "file") {
        return;
      }

      console.log("[FileExplorer] Downloading:", path);

      // Read file content
      var content = this.__storage.readFile(path);
      if (content === null) {
        console.error("[FileExplorer] Failed to read file for download:", path);
        return;
      }

      // Create blob and download
      var fileName = path.substring(path.lastIndexOf('/') + 1);
      var blob = new Blob([content], {type: 'text/plain'});
      var url = URL.createObjectURL(blob);

      // Create temporary link and trigger download
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("[FileExplorer] Downloaded:", fileName);
    },

    /**
     * Handle Properties
     */
    _onProperties: function() {
      if (!this.__selectedItem) {
        return;
      }

      var path = this.__selectedItem.getUserData("path");
      var name = this.__selectedItem.getLabel();
      var type = this.__selectedItem.getUserData("type");
      var item = this.__selectedItem.getUserData("item");

      console.log("[FileExplorer] Showing properties:", path);

      // Create properties dialog
      var dialog = new qx.ui.window.Window("Properties - " + name);
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      // Create grid layout for properties
      var grid = new qx.ui.container.Composite(new qx.ui.layout.Grid(10, 5));
      grid.setPadding(10);

      var row = 0;

      // Name
      grid.add(new qx.ui.basic.Label("Name:").set({font: "bold"}), {row: row, column: 0});
      grid.add(new qx.ui.basic.Label(name), {row: row, column: 1});
      row++;

      // Type
      grid.add(new qx.ui.basic.Label("Type:").set({font: "bold"}), {row: row, column: 0});
      grid.add(new qx.ui.basic.Label(type === "directory" ? "Folder" : "File"), {row: row, column: 1});
      row++;

      // Path
      grid.add(new qx.ui.basic.Label("Path:").set({font: "bold"}), {row: row, column: 0});
      grid.add(new qx.ui.basic.Label(path), {row: row, column: 1});
      row++;

      // Metadata for files
      if (type === "file" && item && item.metadata) {
        var metadata = item.metadata;

        // Size
        grid.add(new qx.ui.basic.Label("Size:").set({font: "bold"}), {row: row, column: 0});
        grid.add(new qx.ui.basic.Label(metadata.size + " bytes"), {row: row, column: 1});
        row++;

        // Created
        if (metadata.created) {
          grid.add(new qx.ui.basic.Label("Created:").set({font: "bold"}), {row: row, column: 0});
          grid.add(new qx.ui.basic.Label(new Date(metadata.created).toLocaleString()), {row: row, column: 1});
          row++;
        }

        // Modified
        if (metadata.modified) {
          grid.add(new qx.ui.basic.Label("Modified:").set({font: "bold"}), {row: row, column: 0});
          grid.add(new qx.ui.basic.Label(new Date(metadata.modified).toLocaleString()), {row: row, column: 1});
          row++;
        }

        // File type
        if (metadata.type) {
          grid.add(new qx.ui.basic.Label("File Type:").set({font: "bold"}), {row: row, column: 0});
          grid.add(new qx.ui.basic.Label(metadata.type), {row: row, column: 1});
          row++;
        }
      }

      dialog.add(grid);

      // Close button
      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.addListener("execute", function() {
        dialog.close();
      });
      btnContainer.add(closeBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();
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
