/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Notepad Application Window
 *
 * A simple text/markdown editor that saves files to localStorage
 * Supports:
 * - Plain text editing
 * - Markdown preview
 * - Auto-save
 * - File open/save operations
 */
qx.Class.define("deskweb.ui.NotepadWindow", {
  extend: qx.ui.window.Window,

  construct: function(filePath) {
    this.base(arguments, "Notepad");

    this.__filePath = filePath || null;
    this.__isDirty = false;
    this.__autoSaveTimer = null;

    // Get storage manager
    this.__storage = deskweb.util.StorageManager.getInstance();

    this.set({
      width: 700,
      height: 500,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Create UI
    this._createMenuBar();
    this._createToolbar();
    this._createEditorArea();
    this._createStatusBar();

    // Load file if path provided
    if (this.__filePath) {
      this._loadFile();
    }

    // Handle window close
    this.addListener("close", this._onClose, this);

    console.log("[NotepadWindow] Created with file:", filePath);
  },

  members: {
    __storage: null,
    __filePath: null,
    __textArea: null,
    __previewArea: null,
    __isDirty: false,
    __autoSaveTimer: null,
    __statusLabel: null,
    __viewMode: "edit", // "edit" or "preview"
    __fileType: "text", // "text" or "markdown"

    /**
     * Create menu bar
     */
    _createMenuBar: function() {
      var menuBar = new qx.ui.menubar.MenuBar();

      // File menu
      var fileButton = new qx.ui.menubar.Button("File");
      var fileMenu = new qx.ui.menu.Menu();

      var newItem = new qx.ui.menu.Button("New");
      newItem.addListener("execute", this._onNew, this);
      fileMenu.add(newItem);

      var openItem = new qx.ui.menu.Button("Open...");
      openItem.addListener("execute", this._onOpen, this);
      fileMenu.add(openItem);

      var saveItem = new qx.ui.menu.Button("Save");
      saveItem.addListener("execute", this._onSave, this);
      fileMenu.add(saveItem);

      var saveAsItem = new qx.ui.menu.Button("Save As...");
      saveAsItem.addListener("execute", this._onSaveAs, this);
      fileMenu.add(saveAsItem);

      fileButton.setMenu(fileMenu);
      menuBar.add(fileButton);

      // View menu
      var viewButton = new qx.ui.menubar.Button("View");
      var viewMenu = new qx.ui.menu.Menu();

      var editModeItem = new qx.ui.menu.Button("Edit Mode");
      editModeItem.addListener("execute", function() {
        this._setViewMode("edit");
      }, this);
      viewMenu.add(editModeItem);

      var previewModeItem = new qx.ui.menu.Button("Preview Mode");
      previewModeItem.addListener("execute", function() {
        this._setViewMode("preview");
      }, this);
      viewMenu.add(previewModeItem);

      viewButton.setMenu(viewMenu);
      menuBar.add(viewButton);

      this.add(menuBar);
    },

    /**
     * Create toolbar
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();

      // Save button
      var saveBtn = new qx.ui.toolbar.Button("Save", "icon/16/actions/document-save.png");
      saveBtn.addListener("execute", this._onSave, this);
      toolbar.add(saveBtn);

      toolbar.add(new qx.ui.toolbar.Separator());

      // View mode toggle
      var editBtn = new qx.ui.toolbar.Button("Edit", "icon/16/actions/document-edit.png");
      editBtn.addListener("execute", function() {
        this._setViewMode("edit");
      }, this);
      toolbar.add(editBtn);

      var previewBtn = new qx.ui.toolbar.Button("Preview", "icon/16/actions/document-print-preview.png");
      previewBtn.addListener("execute", function() {
        this._setViewMode("preview");
      }, this);
      toolbar.add(previewBtn);

      this.add(toolbar);
    },

    /**
     * Create editor area
     */
    _createEditorArea: function() {
      // Create stack container for switching between edit and preview
      this.__editorStack = new qx.ui.container.Stack();

      // Text area for editing
      this.__textArea = new qx.ui.form.TextArea();
      this.__textArea.set({
        font: qx.bom.Font.fromString("14px monospace"),
        wrap: true
      });

      // Listen for changes
      this.__textArea.addListener("input", this._onTextInput, this);

      // Preview area (HTML widget for markdown)
      this.__previewArea = new qx.ui.embed.Html();
      this.__previewArea.set({
        backgroundColor: "white",
        padding: 10,
        overflowY: "auto"
      });

      this.__editorStack.add(this.__textArea);
      this.__editorStack.add(this.__previewArea);

      this.add(this.__editorStack, {flex: 1});

      // Start in edit mode
      this._setViewMode("edit");
    },

    /**
     * Create status bar
     */
    _createStatusBar: function() {
      var statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      statusBar.set({
        backgroundColor: "#F0F0F0",
        padding: [2, 5],
        height: 24
      });

      this.__statusLabel = new qx.ui.basic.Label("Ready");
      this.__statusLabel.set({
        font: "small"
      });

      statusBar.add(this.__statusLabel, {flex: 1});

      // File type indicator
      this.__fileTypeLabel = new qx.ui.basic.Label("Plain Text");
      this.__fileTypeLabel.set({
        font: "small"
      });
      statusBar.add(this.__fileTypeLabel);

      this.add(statusBar);
    },

    /**
     * Set view mode
     */
    _setViewMode: function(mode) {
      this.__viewMode = mode;

      if (mode === "edit") {
        this.__editorStack.setSelection([this.__textArea]);
      } else {
        this._updatePreview();
        this.__editorStack.setSelection([this.__previewArea]);
      }
    },

    /**
     * Update markdown preview
     */
    _updatePreview: function() {
      var content = this.__textArea.getValue() || "";

      if (this.__fileType === "markdown") {
        // Simple markdown to HTML conversion
        var html = this._markdownToHtml(content);
        this.__previewArea.setHtml(html);
      } else {
        // Plain text - wrap in <pre>
        var escaped = this._escapeHtml(content);
        this.__previewArea.setHtml("<pre>" + escaped + "</pre>");
      }
    },

    /**
     * Simple markdown to HTML converter
     */
    _markdownToHtml: function(md) {
      var html = md;

      // Escape HTML first
      html = this._escapeHtml(html);

      // Headers
      html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

      // Bold
      html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

      // Italic
      html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

      // Links
      html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2">$1</a>');

      // Line breaks
      html = html.replace(/\n/gim, '<br/>');

      return '<div style="font-family: sans-serif; line-height: 1.6;">' + html + '</div>';
    },

    /**
     * Escape HTML entities
     */
    _escapeHtml: function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Handle text input
     */
    _onTextInput: function(e) {
      this.__isDirty = true;
      this._updateTitle();

      // Start auto-save timer
      if (this.__autoSaveTimer) {
        clearTimeout(this.__autoSaveTimer);
      }

      this.__autoSaveTimer = setTimeout(function() {
        this._autoSave();
      }.bind(this), 2000); // Auto-save after 2 seconds of no typing
    },

    /**
     * Auto-save file
     */
    _autoSave: function() {
      if (this.__filePath && this.__isDirty) {
        this._saveFile();
        this._setStatus("Auto-saved at " + new Date().toLocaleTimeString());
      }
    },

    /**
     * Load file
     */
    _loadFile: function() {
      if (!this.__filePath) {
        return;
      }

      var content = this.__storage.readFile(this.__filePath);

      if (content === null) {
        this._setStatus("Error: File not found");
        return;
      }

      this.__textArea.setValue(content);
      this.__isDirty = false;

      // Determine file type
      var ext = this.__storage.getFileExtension(this.__filePath);
      this.__fileType = (ext === 'md') ? 'markdown' : 'text';
      this.__fileTypeLabel.setValue(this.__fileType === 'markdown' ? 'Markdown' : 'Plain Text');

      this._updateTitle();
      this._setStatus("File loaded: " + this.__filePath);

      console.log("[NotepadWindow] Loaded file:", this.__filePath);
    },

    /**
     * Save file
     */
    _saveFile: function() {
      if (!this.__filePath) {
        this._onSaveAs();
        return;
      }

      var content = this.__textArea.getValue() || "";
      var success = this.__storage.writeFile(this.__filePath, content);

      if (success) {
        this.__isDirty = false;
        this._updateTitle();
        this._setStatus("File saved: " + this.__filePath);
        console.log("[NotepadWindow] Saved file:", this.__filePath);
      } else {
        this._setStatus("Error: Failed to save file");
      }
    },

    /**
     * Update window title
     */
    _updateTitle: function() {
      var title = "Notepad";

      if (this.__filePath) {
        var fileName = this.__filePath.substring(this.__filePath.lastIndexOf('/') + 1);
        title = fileName + " - Notepad";

        if (this.__isDirty) {
          title = "*" + title;
        }
      } else if (this.__isDirty) {
        title = "*Untitled - Notepad";
      }

      this.setCaption(title);
    },

    /**
     * Set status message
     */
    _setStatus: function(message) {
      this.__statusLabel.setValue(message);
    },

    /**
     * Handle New command
     */
    _onNew: function() {
      if (this.__isDirty) {
        // TODO: Show confirmation dialog
      }

      this.__filePath = null;
      this.__textArea.setValue("");
      this.__isDirty = false;
      this._updateTitle();
      this._setStatus("New file created");
    },

    /**
     * Handle Open command
     */
    _onOpen: function() {
      // Simple prompt for now - can be replaced with file dialog later
      var path = prompt("Enter file path to open:", "/readme.txt");

      if (path) {
        this.__filePath = path;
        this._loadFile();
      }
    },

    /**
     * Handle Save command
     */
    _onSave: function() {
      this._saveFile();
    },

    /**
     * Handle Save As command
     */
    _onSaveAs: function() {
      // Simple prompt for now - can be replaced with file dialog later
      var defaultPath = this.__filePath || "/untitled.txt";
      var path = prompt("Enter file path to save:", defaultPath);

      if (path) {
        this.__filePath = path;

        // Determine file type from extension
        var ext = this.__storage.getFileExtension(path);
        this.__fileType = (ext === 'md') ? 'markdown' : 'text';
        this.__fileTypeLabel.setValue(this.__fileType === 'markdown' ? 'Markdown' : 'Plain Text');

        this._saveFile();
      }
    },

    /**
     * Handle window close
     */
    _onClose: function() {
      if (this.__isDirty) {
        // Auto-save on close
        if (this.__filePath) {
          this._saveFile();
        }
      }

      // Clear auto-save timer
      if (this.__autoSaveTimer) {
        clearTimeout(this.__autoSaveTimer);
      }
    },

    /**
     * Get current file path
     */
    getFilePath: function() {
      return this.__filePath;
    },

    /**
     * Get editor content
     */
    getContent: function() {
      return this.__textArea.getValue();
    }
  },

  destruct: function() {
    if (this.__autoSaveTimer) {
      clearTimeout(this.__autoSaveTimer);
    }
    this.__storage = null;
    this.__textArea = null;
    this.__previewArea = null;
    this.__statusLabel = null;
    this.__editorStack = null;
  }
});
