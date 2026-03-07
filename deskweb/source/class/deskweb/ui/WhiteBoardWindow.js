/**
 * WhiteBoard Window - Fabric.js based whiteboard application
 * Ported from ShapeUp Whiteboard project
 *
 * @asset(deskweb/images/whiteboard.svg)
 * @ignore(fabric.*)
 */
qx.Class.define("deskweb.ui.WhiteBoardWindow", {
  extend: qx.ui.window.Window,

  construct: function(filePath) {
    this.base(arguments, "WhiteBoard", "deskweb/images/whiteboard.svg");

    this.__filePath = filePath || null;
    this.__boardName = "Untitled Board";
    this.__isDirty = false;

    this.set({
      width: 1000,
      height: 700,
      showMinimize: true,
      showMaximize: true,
      allowMaximize: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox());

    this._createToolbar();
    this._createMainArea();
    this._createStatusBar();

    this.addListener("appear", this._onAppear, this);
    this.addListener("resize", this._onResize, this);
    this.addListener("close", this._onClose, this);
  },

  members: {
    __engine: null,
    __canvasWidget: null,
    __canvasId: null,
    __filePath: null,
    __boardName: null,
    __isDirty: null,
    __zoomLabel: null,
    __toolButtons: null,
    __statusLabel: null,
    __fillColorBtn: null,
    __strokeColorBtn: null,

    /**
     * Create toolbar
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();
      toolbar.set({ spacing: 2 });

      // File operations
      var filePart = new qx.ui.toolbar.Part();

      var newBtn = new qx.ui.toolbar.Button("New", null);
      newBtn.setToolTipText("New Board (Clear)");
      newBtn.addListener("execute", this._onNewBoard, this);
      filePart.add(newBtn);

      var saveBtn = new qx.ui.toolbar.Button("Save", null);
      saveBtn.setToolTipText("Save to file system (.board)");
      saveBtn.addListener("execute", this._onSaveBoard, this);
      filePart.add(saveBtn);

      var openBtn = new qx.ui.toolbar.Button("Open", null);
      openBtn.setToolTipText("Open .board file");
      openBtn.addListener("execute", this._onOpenBoard, this);
      filePart.add(openBtn);

      toolbar.add(filePart);
      toolbar.addSeparator();

      // Drawing tools
      var drawPart = new qx.ui.toolbar.Part();
      this.__toolButtons = {};

      var tools = [
        { id: "select", label: "Select" },
        { id: "rect", label: "Rect" },
        { id: "circle", label: "Circle" },
        { id: "line", label: "Line" },
        { id: "arrow", label: "Arrow" },
        { id: "text", label: "Text" },
        { id: "pan", label: "Pan" }
      ];

      var self = this;
      tools.forEach(function(tool) {
        var btn = new qx.ui.toolbar.RadioButton(tool.label);
        btn.setUserData("toolId", tool.id);
        btn.addListener("execute", function() {
          if (self.__engine) {
            self.__engine.setTool(tool.id);
          }
        });
        drawPart.add(btn);
        self.__toolButtons[tool.id] = btn;
      });

      // Select the "select" tool by default
      this.__toolButtons["select"].setValue(true);

      toolbar.add(drawPart);
      toolbar.addSeparator();

      // Color & stroke properties
      var propPart = new qx.ui.toolbar.Part();

      // Fill color
      var fillLabel = new qx.ui.basic.Label("Fill:");
      fillLabel.set({ paddingTop: 4, paddingRight: 4 });
      propPart.add(fillLabel);

      this.__fillColorInput = this._createColorButton("#ffffff", function(color) {
        if (self.__engine) self.__engine.setFillColor(color);
      });
      propPart.add(this.__fillColorInput);

      // Stroke color
      var strokeLabel = new qx.ui.basic.Label("Stroke:");
      strokeLabel.set({ paddingTop: 4, paddingLeft: 8, paddingRight: 4 });
      propPart.add(strokeLabel);

      this.__strokeColorInput = this._createColorButton("#333333", function(color) {
        if (self.__engine) self.__engine.setStrokeColor(color);
      });
      propPart.add(this.__strokeColorInput);

      toolbar.add(propPart);
      toolbar.addSeparator();

      // Edit operations
      var editPart = new qx.ui.toolbar.Part();

      var deleteBtn = new qx.ui.toolbar.Button("Delete");
      deleteBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.deleteSelected();
      });
      editPart.add(deleteBtn);

      var groupBtn = new qx.ui.toolbar.Button("Group");
      groupBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.groupSelected();
      });
      editPart.add(groupBtn);

      var ungroupBtn = new qx.ui.toolbar.Button("Ungroup");
      ungroupBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.ungroupSelected();
      });
      editPart.add(ungroupBtn);

      toolbar.add(editPart);
      toolbar.addSeparator();

      // Export
      var exportPart = new qx.ui.toolbar.Part();

      var pngBtn = new qx.ui.toolbar.Button("PNG");
      pngBtn.setToolTipText("Export as PNG");
      pngBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.exportToPNG();
      });
      exportPart.add(pngBtn);

      var svgBtn = new qx.ui.toolbar.Button("SVG");
      svgBtn.setToolTipText("Export as SVG");
      svgBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.exportToSVG();
      });
      exportPart.add(svgBtn);

      toolbar.add(exportPart);

      // Spacer
      toolbar.addSpacer();

      // Zoom controls
      var zoomPart = new qx.ui.toolbar.Part();

      var zoomOutBtn = new qx.ui.toolbar.Button("-");
      zoomOutBtn.setToolTipText("Zoom Out");
      zoomOutBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.zoomOut();
      });
      zoomPart.add(zoomOutBtn);

      this.__zoomLabel = new qx.ui.basic.Label("100%");
      this.__zoomLabel.set({ paddingTop: 4, paddingLeft: 4, paddingRight: 4, width: 45, textAlign: "center" });
      zoomPart.add(this.__zoomLabel);

      var zoomInBtn = new qx.ui.toolbar.Button("+");
      zoomInBtn.setToolTipText("Zoom In");
      zoomInBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.zoomIn();
      });
      zoomPart.add(zoomInBtn);

      var resetZoomBtn = new qx.ui.toolbar.Button("Reset");
      resetZoomBtn.setToolTipText("Reset Zoom");
      resetZoomBtn.addListener("execute", function() {
        if (self.__engine) self.__engine.resetZoom();
      });
      zoomPart.add(resetZoomBtn);

      toolbar.add(zoomPart);

      this.add(toolbar);
    },

    /**
     * Create a color picker button using native HTML input[type=color]
     */
    _createColorButton: function(defaultColor, onChange) {
      var container = new qx.ui.embed.Html(
        '<input type="color" value="' + defaultColor + '" ' +
        'style="width:28px;height:22px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;background:none;" />'
      );
      container.set({ width: 32, height: 26 });

      container.addListenerOnce("appear", function() {
        var el = container.getContentElement().getDomElement();
        if (el) {
          var input = el.querySelector("input");
          if (input) {
            input.addEventListener("input", function() {
              onChange(input.value);
            });
          }
        }
      });

      return container;
    },

    /**
     * Create main drawing area
     */
    _createMainArea: function() {
      // Generate unique canvas ID
      this.__canvasId = "wb-canvas-" + Math.random().toString(36).substr(2, 9);

      this.__canvasWidget = new qx.ui.embed.Html(
        '<div style="width:100%;height:100%;position:relative;background:#e9ecef;overflow:hidden;" id="' + this.__canvasId + '-container">' +
        '<canvas id="' + this.__canvasId + '"></canvas>' +
        '</div>'
      );
      this.__canvasWidget.set({
        cssClass: "whiteboard-canvas-area"
      });

      // Setup context menu on canvas
      this.__canvasWidget.addListener("appear", this._onCanvasAppear, this);

      this.add(this.__canvasWidget, { flex: 1 });
    },

    /**
     * Create status bar
     */
    _createStatusBar: function() {
      var statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      statusBar.set({
        height: 24,
        backgroundColor: "#f0f0f0",
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 2
      });

      this.__statusLabel = new qx.ui.basic.Label("Ready");
      this.__statusLabel.set({ textColor: "#666", font: "small" });
      statusBar.add(this.__statusLabel);

      statusBar.add(new qx.ui.core.Spacer(), { flex: 1 });

      var boardNameLabel = new qx.ui.basic.Label(this.__boardName);
      boardNameLabel.set({ textColor: "#888", font: "small" });
      this.__boardNameLabel = boardNameLabel;
      statusBar.add(boardNameLabel);

      this.add(statusBar);
    },

    /**
     * Handle window appear
     */
    _onAppear: function() {
      // Delay to ensure DOM is ready
      qx.event.Timer.once(function() {
        this._initEngine();
      }, this, 200);
    },

    /**
     * Handle canvas widget appear
     */
    _onCanvasAppear: function() {
      // Setup right-click context menu on the canvas container
      var self = this;
      qx.event.Timer.once(function() {
        var container = document.getElementById(self.__canvasId + "-container");
        if (container) {
          container.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            self._showContextMenu(e.clientX, e.clientY);
          });
        }
      }, this, 300);
    },

    /**
     * Initialize the WhiteBoard engine
     */
    _initEngine: function() {
      var container = document.getElementById(this.__canvasId + "-container");
      if (!container) {
        console.error("[WhiteBoardWindow] Canvas container not found");
        return;
      }

      var width = container.clientWidth || 800;
      var height = container.clientHeight || 500;

      this.__engine = new deskweb.util.WhiteBoardEngine();
      this.__engine.init(this.__canvasId, width, height);

      // Listen for engine events
      var self = this;
      this.__engine.addListener("zoomChanged", function(e) {
        self.__zoomLabel.setValue(e.getData() + "%");
      });

      this.__engine.addListener("toolChanged", function(e) {
        var tool = e.getData();
        for (var id in self.__toolButtons) {
          self.__toolButtons[id].setValue(id === tool);
        }
      });

      // Attach keyboard handler
      var domElement = container.closest(".qx-window") || document;
      this.__engine.attachKeyHandler(document);

      // Load file if provided
      if (this.__filePath) {
        this._loadFromFile(this.__filePath);
      }

      this.__statusLabel.setValue("Ready - Use tools to draw");
      console.log("[WhiteBoardWindow] Engine initialized");
    },

    /**
     * Handle window resize
     */
    _onResize: function() {
      if (!this.__engine) return;
      qx.event.Timer.once(function() {
        var container = document.getElementById(this.__canvasId + "-container");
        if (container) {
          this.__engine.resize(container.clientWidth, container.clientHeight);
        }
      }, this, 100);
    },

    /**
     * Handle window close
     */
    _onClose: function() {
      if (this.__engine) {
        this.__engine.detachKeyHandler(document);
        this.__engine.dispose();
        this.__engine = null;
      }
    },

    /**
     * Show context menu
     */
    _showContextMenu: function(x, y) {
      if (!this.__engine) return;

      // Create qooxdoo context menu
      var menu = new qx.ui.menu.Menu();
      var self = this;

      var canvas = this.__engine.getCanvas();
      var activeObjects = canvas.getActiveObjects();
      var activeObject = canvas.getActiveObject();

      // Properties (placeholder)
      var propsBtn = new qx.ui.menu.Button("Properties");
      propsBtn.setEnabled(activeObjects.length > 0);
      propsBtn.addListener("execute", function() {
        self._showPropertyDialog();
      });
      menu.add(propsBtn);

      menu.add(new qx.ui.menu.Separator());

      // Group
      var groupBtn = new qx.ui.menu.Button("Group");
      groupBtn.setEnabled(activeObjects.length >= 2);
      groupBtn.addListener("execute", function() {
        self.__engine.groupSelected();
      });
      menu.add(groupBtn);

      // Ungroup
      var ungroupBtn = new qx.ui.menu.Button("Ungroup");
      ungroupBtn.setEnabled(activeObject && activeObject.type === "group" && !activeObject.connectionInfo);
      ungroupBtn.addListener("execute", function() {
        self.__engine.ungroupSelected();
      });
      menu.add(ungroupBtn);

      menu.add(new qx.ui.menu.Separator());

      // Bring to Front
      var frontBtn = new qx.ui.menu.Button("Bring to Front");
      frontBtn.setEnabled(activeObjects.length > 0);
      frontBtn.addListener("execute", function() {
        self.__engine.bringToFront();
      });
      menu.add(frontBtn);

      // Send to Back
      var backBtn = new qx.ui.menu.Button("Send to Back");
      backBtn.setEnabled(activeObjects.length > 0);
      backBtn.addListener("execute", function() {
        self.__engine.sendToBack();
      });
      menu.add(backBtn);

      menu.add(new qx.ui.menu.Separator());

      // Delete
      var deleteBtn = new qx.ui.menu.Button("Delete");
      deleteBtn.setEnabled(activeObjects.length > 0);
      deleteBtn.addListener("execute", function() {
        self.__engine.deleteSelected();
      });
      menu.add(deleteBtn);

      // Templates submenu
      menu.add(new qx.ui.menu.Separator());
      var templatesMenu = new qx.ui.menu.Menu();
      var templates = [
        { id: "problem", label: "Problem Board" },
        { id: "breadboard", label: "Breadboard" },
        { id: "fat-marker", label: "Fat Marker Sketch" },
        { id: "risk", label: "Risk Board" },
        { id: "pitch", label: "Pitch Board" }
      ];
      templates.forEach(function(tpl) {
        var tplBtn = new qx.ui.menu.Button(tpl.label);
        tplBtn.addListener("execute", function() {
          self.__engine.addBoardTemplate(tpl.id);
        });
        templatesMenu.add(tplBtn);
      });
      var templatesBtn = new qx.ui.menu.Button("Add Template", null, null, templatesMenu);
      menu.add(templatesBtn);

      // Show menu at mouse position
      menu.placeToPoint({ left: x, top: y });
      menu.show();
    },

    /**
     * Show property dialog for selected object
     */
    _showPropertyDialog: function() {
      if (!this.__engine) return;

      var canvas = this.__engine.getCanvas();
      var activeObj = canvas.getActiveObject();
      if (!activeObj) return;

      var dialog = new qx.ui.window.Window("Properties");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 300, height: 350, modal: true,
        showMinimize: false, showMaximize: false,
        contentPadding: 15
      });

      var self = this;

      // Fill color
      var fillRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      fillRow.add(new qx.ui.basic.Label("Fill Color:"));
      var fillInput = this._createColorButton(
        (activeObj.fill && typeof activeObj.fill === "string" && activeObj.fill.startsWith("#")) ? activeObj.fill : "#ffffff",
        function(color) { self.__engine.updateSelectedFill(color); }
      );
      fillRow.add(fillInput);
      dialog.add(fillRow);

      // Stroke color
      var strokeRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      strokeRow.add(new qx.ui.basic.Label("Stroke Color:"));
      var strokeInput = this._createColorButton(
        (activeObj.stroke && typeof activeObj.stroke === "string" && activeObj.stroke.startsWith("#")) ? activeObj.stroke : "#333333",
        function(color) { self.__engine.updateSelectedStroke(color); }
      );
      strokeRow.add(strokeInput);
      dialog.add(strokeRow);

      // Stroke width
      var swRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      swRow.add(new qx.ui.basic.Label("Stroke Width:"));
      var swSpinner = new qx.ui.form.Spinner(1, activeObj.strokeWidth || 2, 20);
      swSpinner.addListener("changeValue", function(e) {
        self.__engine.updateSelectedStrokeWidth(e.getData());
      });
      swRow.add(swSpinner);
      dialog.add(swRow);

      // Text properties if text is selected
      var textObj = this.__engine.getTextObjectFromSelection(activeObj);
      if (textObj) {
        dialog.add(new qx.ui.basic.Label("--- Text Properties ---"));

        // Text size
        var sizeRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
        sizeRow.add(new qx.ui.basic.Label("Size:"));
        var sizeSelect = new qx.ui.form.SelectBox();
        [{ label: "H1 (32px)", value: 32 }, { label: "H2 (24px)", value: 24 },
         { label: "H3 (18px)", value: 18 }, { label: "Normal (14px)", value: 14 }].forEach(function(s) {
          var item = new qx.ui.form.ListItem(s.label);
          item.setUserData("size", s.value);
          sizeSelect.add(item);
          if (textObj.fontSize >= s.value) sizeSelect.setSelection([item]);
        });
        sizeSelect.addListener("changeSelection", function(e) {
          var size = e.getData()[0].getUserData("size");
          self.__engine.updateTextSize(size);
        });
        sizeRow.add(sizeSelect);
        dialog.add(sizeRow);

        // Text style buttons
        var styleRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
        var boldBtn = new qx.ui.form.ToggleButton("B");
        boldBtn.setValue(textObj.fontWeight === "bold");
        boldBtn.addListener("changeValue", function() { self.__engine.toggleTextStyle("bold"); });
        styleRow.add(boldBtn);

        var italicBtn = new qx.ui.form.ToggleButton("I");
        italicBtn.setValue(textObj.fontStyle === "italic");
        italicBtn.addListener("changeValue", function() { self.__engine.toggleTextStyle("italic"); });
        styleRow.add(italicBtn);

        var underlineBtn = new qx.ui.form.ToggleButton("U");
        underlineBtn.setValue(textObj.underline === true);
        underlineBtn.addListener("changeValue", function() { self.__engine.toggleTextStyle("underline"); });
        styleRow.add(underlineBtn);
        dialog.add(styleRow);

        // Alignment
        var alignRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
        ["left", "center", "right"].forEach(function(align) {
          var btn = new qx.ui.form.Button(align.charAt(0).toUpperCase() + align.slice(1));
          btn.addListener("execute", function() { self.__engine.updateTextAlign(align); });
          alignRow.add(btn);
        });
        dialog.add(alignRow);
      }

      // Close button
      var closeBtn = new qx.ui.form.Button("Close");
      closeBtn.addListener("execute", function() { dialog.close(); dialog.destroy(); });
      dialog.add(new qx.ui.core.Spacer(), { flex: 1 });
      dialog.add(closeBtn);

      var desktop = this.getLayoutParent();
      if (desktop) {
        desktop.add(dialog);
        dialog.center();
        dialog.open();
      }
    },

    // ========== File Operations ==========

    _onNewBoard: function() {
      if (this.__engine) {
        this.__engine.clearCanvas();
        this.__boardName = "Untitled Board";
        this.__filePath = null;
        this.__isDirty = false;
        this._updateTitle();
        this.__statusLabel.setValue("New board created");
      }
    },

    _onSaveBoard: function() {
      if (!this.__engine) return;

      var self = this;

      // Show save dialog
      var dialog = new qx.ui.window.Window("Save Board");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400, height: 200, modal: true,
        showMinimize: false, showMaximize: false,
        contentPadding: 20
      });

      dialog.add(new qx.ui.basic.Label("Board Name:"));
      var nameField = new qx.ui.form.TextField(this.__boardName);
      nameField.set({ width: 350 });
      dialog.add(nameField);

      dialog.add(new qx.ui.basic.Label("Save Location:"));
      var pathField = new qx.ui.form.TextField(this.__filePath || "/Documents/" + this.__boardName + ".board");
      pathField.set({ width: 350 });
      dialog.add(pathField);

      var btnRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      btnRow.set({ marginTop: 10 });

      var saveBtn = new qx.ui.form.Button("Save");
      saveBtn.addListener("execute", function() {
        var name = nameField.getValue();
        var path = pathField.getValue();

        // Ensure .board extension
        if (!path.endsWith(".board")) {
          path += ".board";
        }

        self.__boardName = name;
        self.__filePath = path;

        // Get board data and save to StorageManager
        var boardData = self.__engine.getBoardData(name);
        var storage = deskweb.util.StorageManager.getInstance();
        storage.writeFile(path, boardData);

        self.__isDirty = false;
        self._updateTitle();
        self.__statusLabel.setValue("Saved: " + path);

        dialog.close();
        dialog.destroy();
      });
      btnRow.add(saveBtn);

      var cancelBtn = new qx.ui.form.Button("Cancel");
      cancelBtn.addListener("execute", function() {
        dialog.close();
        dialog.destroy();
      });
      btnRow.add(cancelBtn);

      // Download button - save as local file
      var downloadBtn = new qx.ui.form.Button("Download .board");
      downloadBtn.addListener("execute", function() {
        var name = nameField.getValue();
        var boardData = self.__engine.getBoardData(name);
        var blob = new Blob([boardData], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.download = (name || "whiteboard") + ".board";
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        self.__statusLabel.setValue("Downloaded: " + name + ".board");
        dialog.close();
        dialog.destroy();
      });
      btnRow.add(downloadBtn);

      dialog.add(btnRow);

      var desktop = this.getLayoutParent();
      if (desktop) {
        desktop.add(dialog);
        dialog.center();
        dialog.open();
      }
    },

    _onOpenBoard: function() {
      if (!this.__engine) return;

      var self = this;

      // Show open dialog with two options: from storage or from local file
      var dialog = new qx.ui.window.Window("Open Board");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 450, height: 300, modal: true,
        showMinimize: false, showMaximize: false,
        contentPadding: 20
      });

      dialog.add(new qx.ui.basic.Label("Open from file system:"));

      // List .board files from storage
      var storage = deskweb.util.StorageManager.getInstance();
      var fileList = new qx.ui.form.List();
      fileList.set({ height: 120 });

      // Search for .board files in storage
      var allFiles = this._findBoardFiles(storage);
      allFiles.forEach(function(filePath) {
        var item = new qx.ui.form.ListItem(filePath);
        item.setUserData("path", filePath);
        fileList.add(item);
      });

      if (allFiles.length === 0) {
        var emptyItem = new qx.ui.form.ListItem("(No .board files found)");
        emptyItem.setEnabled(false);
        fileList.add(emptyItem);
      }

      dialog.add(fileList);

      var btnRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      btnRow.set({ marginTop: 10 });

      var openBtn = new qx.ui.form.Button("Open Selected");
      openBtn.addListener("execute", function() {
        var selection = fileList.getSelection();
        if (selection.length > 0) {
          var path = selection[0].getUserData("path");
          if (path) {
            self._loadFromFile(path);
            dialog.close();
            dialog.destroy();
          }
        }
      });
      btnRow.add(openBtn);

      // Upload .board file from local disk
      var uploadBtn = new qx.ui.form.Button("Upload .board File");
      uploadBtn.addListener("execute", function() {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = ".board,.json";
        input.addEventListener("change", function(e) {
          var file = e.target.files[0];
          if (file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
              var meta = self.__engine.loadBoardData(ev.target.result);
              if (meta) {
                self.__boardName = meta.name;
                self.__filePath = null;
                self._updateTitle();
                self.__statusLabel.setValue("Loaded: " + meta.name);
              }
            };
            reader.readAsText(file);
          }
          dialog.close();
          dialog.destroy();
        });
        input.click();
      });
      btnRow.add(uploadBtn);

      var cancelBtn = new qx.ui.form.Button("Cancel");
      cancelBtn.addListener("execute", function() {
        dialog.close();
        dialog.destroy();
      });
      btnRow.add(cancelBtn);

      dialog.add(btnRow);

      var desktop = this.getLayoutParent();
      if (desktop) {
        desktop.add(dialog);
        dialog.center();
        dialog.open();
      }
    },

    /**
     * Find all .board files in storage
     */
    _findBoardFiles: function(storage) {
      var results = [];
      var dirs = ["/", "/Documents", "/Documents/Boards"];

      dirs.forEach(function(dir) {
        try {
          var listing = storage.listDirectory(dir);
          if (listing && listing.files) {
            listing.files.forEach(function(file) {
              if (file.name && file.name.endsWith(".board")) {
                results.push(dir + (dir.endsWith("/") ? "" : "/") + file.name);
              }
            });
          }
        } catch (e) {
          // Directory may not exist
        }
      });

      return results;
    },

    /**
     * Load board from file path in storage
     */
    _loadFromFile: function(filePath) {
      if (!this.__engine) return;

      var storage = deskweb.util.StorageManager.getInstance();
      var content = storage.readFile(filePath);

      if (content) {
        var meta = this.__engine.loadBoardData(content);
        if (meta) {
          this.__boardName = meta.name;
          this.__filePath = filePath;
          this._updateTitle();
          this.__statusLabel.setValue("Loaded: " + filePath);
        } else {
          this.__statusLabel.setValue("Failed to load: " + filePath);
        }
      } else {
        this.__statusLabel.setValue("File not found: " + filePath);
      }
    },

    /**
     * Update window title
     */
    _updateTitle: function() {
      var title = "WhiteBoard - " + this.__boardName;
      if (this.__isDirty) title += " *";
      this.setCaption(title);
      if (this.__boardNameLabel) {
        this.__boardNameLabel.setValue(this.__boardName);
      }
    }
  }
});
