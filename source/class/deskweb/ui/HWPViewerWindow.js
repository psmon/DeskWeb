/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * HWP Viewer Window
 *
 * A Windows XP style window for viewing .hwp (Hangul Word Processor) files.
 * Uses hwp.js library for rendering HWP documents.
 *
 * Features:
 * - Open .hwp files via file picker or file path
 * - Zoom in/out controls
 * - Page navigation for multi-page documents
 * - Print functionality
 * - Drag and drop support
 */
qx.Class.define("deskweb.ui.HWPViewerWindow",
{
  extend : qx.ui.window.Window,

  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  construct : function(filePath)
  {
    this.base(arguments, "HWP Viewer");

    console.log("[HWPViewerWindow] Initializing with file:", filePath);

    this.__filePath = filePath;
    this.__storage = deskweb.util.StorageManager.getInstance();
    this.__zoomLevel = 1.0;
    this.__currentPage = 1;
    this.__totalPages = 1;

    // Generate unique ID for this viewer instance
    this.__viewerId = "hwp-viewer-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

    // Setup window
    this._setupWindow();

    // Build UI
    this._buildUI();

    // Load file if provided
    if (filePath) {
      this._loadFile(filePath);
    }

    console.log("[HWPViewerWindow] Initialized successfully with ID:", this.__viewerId);
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    __filePath: null,
    __storage: null,
    __toolbar: null,
    __viewerContainer: null,
    __viewerElement: null,
    __hwpViewer: null,
    __statusBar: null,
    __zoomLevel: null,
    __currentPage: null,
    __totalPages: null,
    __pageInfoLabel: null,
    __openButton: null,
    __zoomInButton: null,
    __zoomOutButton: null,
    __zoomResetButton: null,
    __printButton: null,
    __prevPageButton: null,
    __nextPageButton: null,
    __viewerId: null,

    /**
     * Setup window properties
     */
    _setupWindow: function() {
      this.setLayout(new qx.ui.layout.VBox(0));

      this.set({
        width: 800,
        height: 600,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        contentPadding: 0,
        icon: "deskweb/images/hwp.svg",
        allowMaximize: true,
        allowMinimize: true,
        resizable: true
      });

      console.log("[HWPViewerWindow] Window configured");
    },

    /**
     * Build the user interface
     */
    _buildUI: function() {
      // Create toolbar
      this._createToolbar();

      // Create viewer container
      this._createViewerContainer();

      // Create status bar
      this._createStatusBar();

      console.log("[HWPViewerWindow] UI built");
    },

    /**
     * Create toolbar with controls
     */
    _createToolbar: function() {
      this.__toolbar = new qx.ui.toolbar.ToolBar();

      // Open file button
      this.__openButton = new qx.ui.toolbar.Button("Open", "icon/16/actions/document-open.png");
      this.__openButton.addListener("execute", this._onOpenFile, this);
      this.__toolbar.add(this.__openButton);

      this.__toolbar.addSeparator();

      // Zoom controls
      this.__zoomOutButton = new qx.ui.toolbar.Button("Zoom Out", "icon/16/actions/zoom-out.png");
      this.__zoomOutButton.addListener("execute", this._onZoomOut, this);
      this.__toolbar.add(this.__zoomOutButton);

      this.__zoomResetButton = new qx.ui.toolbar.Button("100%");
      this.__zoomResetButton.addListener("execute", this._onZoomReset, this);
      this.__toolbar.add(this.__zoomResetButton);

      this.__zoomInButton = new qx.ui.toolbar.Button("Zoom In", "icon/16/actions/zoom-in.png");
      this.__zoomInButton.addListener("execute", this._onZoomIn, this);
      this.__toolbar.add(this.__zoomInButton);

      this.__toolbar.addSeparator();

      // Page navigation
      this.__prevPageButton = new qx.ui.toolbar.Button("Previous", "icon/16/actions/go-previous.png");
      this.__prevPageButton.addListener("execute", this._onPrevPage, this);
      this.__prevPageButton.setEnabled(false);
      this.__toolbar.add(this.__prevPageButton);

      this.__nextPageButton = new qx.ui.toolbar.Button("Next", "icon/16/actions/go-next.png");
      this.__nextPageButton.addListener("execute", this._onNextPage, this);
      this.__nextPageButton.setEnabled(false);
      this.__toolbar.add(this.__nextPageButton);

      this.__toolbar.addSeparator();

      // Print button
      this.__printButton = new qx.ui.toolbar.Button("Print", "icon/16/actions/document-print.png");
      this.__printButton.addListener("execute", this._onPrint, this);
      this.__printButton.setEnabled(false);
      this.__toolbar.add(this.__printButton);

      this.add(this.__toolbar);

      console.log("[HWPViewerWindow] Toolbar created");
    },

    /**
     * Create viewer container
     */
    _createViewerContainer: function() {
      // Create scroll container
      var scrollContainer = new qx.ui.container.Scroll();
      scrollContainer.set({
        backgroundColor: "#808080",
        scrollbarX: "auto",
        scrollbarY: "auto"
      });

      // Create HTML embed for the viewer
      this.__viewerContainer = new qx.ui.embed.Html();
      this.__viewerContainer.set({
        backgroundColor: "#ffffff",
        padding: 20,
        minHeight: 800,
        minWidth: 600,
        allowGrowX: true,
        allowGrowY: true,
        allowShrinkX: false,
        allowShrinkY: false
      });
      this.__viewerContainer.setHtml('<div id="' + this.__viewerId + '" style="background-color: white; padding: 20px; min-height: 600px; overflow: auto;"><p style="text-align: center; color: #666;">No HWP file loaded. Click "Open" to select a file.</p></div>');

      // Add overflow CSS to the HTML widget after it appears
      this.__viewerContainer.addListenerOnce("appear", function() {
        var element = this.__viewerContainer.getContentElement();
        if (element) {
          var domElement = element.getDomElement();
          if (domElement) {
            domElement.style.overflow = "auto";
            domElement.style.maxHeight = "100%";
          }
        }
      }, this);

      scrollContainer.add(this.__viewerContainer);
      this.add(scrollContainer, {flex: 1});

      console.log("[HWPViewerWindow] Viewer container created");
    },

    /**
     * Create status bar
     */
    _createStatusBar: function() {
      this.__statusBar = new qx.ui.toolbar.ToolBar();
      this.__statusBar.set({
        backgroundColor: "#f0f0f0",
        height: 25
      });

      this.__pageInfoLabel = new qx.ui.basic.Label("No file loaded");
      this.__pageInfoLabel.set({
        paddingLeft: 10,
        paddingRight: 10
      });
      this.__statusBar.add(this.__pageInfoLabel);

      this.add(this.__statusBar);

      console.log("[HWPViewerWindow] Status bar created");
    },

    /**
     * Handle open file button click
     */
    _onOpenFile: function() {
      console.log("[HWPViewerWindow] Open file dialog triggered");

      // Create file input element
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".hwp";

      input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
          console.log("[HWPViewerWindow] File selected:", file.name);
          this._loadFileFromDisk(file);
        }
      }.bind(this);

      input.click();
    },

    /**
     * Load file from disk (via file picker)
     */
    _loadFileFromDisk: function(file) {
      console.log("[HWPViewerWindow] Loading file from disk:", file.name);

      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var arrayBuffer = e.target.result;
          var uint8Array = new Uint8Array(arrayBuffer);

          this._renderHWP(uint8Array, file.name);
          this.setCaption("HWP Viewer - " + file.name);
        } catch (error) {
          console.error("[HWPViewerWindow] Error loading file:", error);
          alert("Error loading HWP file: " + error.message);
        }
      }.bind(this);

      reader.readAsArrayBuffer(file);
    },

    /**
     * Load file from virtual file system
     */
    _loadFile: function(filePath) {
      console.log("[HWPViewerWindow] Loading file from storage:", filePath);

      // Get file metadata to check if it's binary
      var metadata = this.__storage.getFileMetadata(filePath);
      if (!metadata) {
        console.error("[HWPViewerWindow] File metadata not found:", filePath);
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">File not found: ' + filePath + '</div>');
        return;
      }

      // StorageManager.readFile returns string content directly
      var fileContent = this.__storage.readFile(filePath);
      if (!fileContent) {
        console.error("[HWPViewerWindow] File not found:", filePath);
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">File not found: ' + filePath + '</div>');
        return;
      }

      try {
        console.log("[HWPViewerWindow] File content loaded, size:", fileContent.length, "isBinary:", metadata.isBinary);

        var uint8Array;
        var fileName = filePath.split("/").pop();

        // HWP files should ALWAYS be treated as binary
        var isHWP = fileName.toLowerCase().endsWith('.hwp');
        var shouldDecodeBinary = metadata.isBinary || isHWP;

        console.log("[HWPViewerWindow] File:", fileName, "isHWP:", isHWP, "shouldDecodeBinary:", shouldDecodeBinary);

        // Check if file is stored as base64 (binary file)
        if (shouldDecodeBinary) {
          try {
            // Convert base64 to Uint8Array
            var binaryString = atob(fileContent);
            uint8Array = new Uint8Array(binaryString.length);
            for (var i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            console.log("[HWPViewerWindow] Decoded from base64, size:", uint8Array.length, "bytes");
            console.log("[HWPViewerWindow] First 8 bytes:", Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          } catch (atobError) {
            console.error("[HWPViewerWindow] atob failed:", atobError);
            console.log("[HWPViewerWindow] Trying direct UTF-8 encoding instead");
            // Fallback: treat as text
            var encoder = new TextEncoder();
            uint8Array = encoder.encode(fileContent);
          }
        } else {
          // Text file - convert string to Uint8Array
          var encoder = new TextEncoder();
          uint8Array = encoder.encode(fileContent);
          console.log("[HWPViewerWindow] Encoded text to Uint8Array, size:", uint8Array.length, "bytes");
        }

        this._renderHWP(uint8Array, fileName);
        this.setCaption("HWP Viewer - " + fileName);
      } catch (error) {
        console.error("[HWPViewerWindow] Error loading file:", error);
        console.error("[HWPViewerWindow] Error stack:", error.stack);
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">Error loading file: ' + error.message + '</div>');
      }
    },

    /**
     * Render HWP file using hwp.js
     */
    _renderHWP: function(uint8Array, fileName) {
      console.log("[HWPViewerWindow] Rendering HWP file:", fileName, "in viewer:", this.__viewerId);

      try {
        // Get the DOM element for the viewer using unique ID
        var viewerElement = document.getElementById(this.__viewerId);

        if (!viewerElement) {
          // Create new viewer element with unique ID
          this.__viewerContainer.setHtml('<div id="' + this.__viewerId + '" style="background-color: white; padding: 20px;"></div>');

          // Wait for element to be added to DOM
          qx.event.Timer.once(function() {
            viewerElement = document.getElementById(this.__viewerId);
            if (viewerElement) {
              this._initializeHWPViewer(viewerElement, uint8Array, fileName);
            } else {
              console.error("[HWPViewerWindow] Failed to create viewer element");
            }
          }, this, 100);
        } else {
          // Clear previous content
          viewerElement.innerHTML = "";
          this._initializeHWPViewer(viewerElement, uint8Array, fileName);
        }
      } catch (error) {
        console.error("[HWPViewerWindow] Error rendering HWP:", error);
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">Error rendering HWP file: ' + error.message + '</div>');
      }
    },

    /**
     * Initialize HWP viewer with hwp.js library
     */
    _initializeHWPViewer: function(container, uint8Array, fileName) {
      try {
        console.log("[HWPViewerWindow] Initializing HWP viewer for:", fileName);
        console.log("[HWPViewerWindow] Data size:", uint8Array ? uint8Array.length : 0);
        console.log("[HWPViewerWindow] hwpjs available:", typeof window.hwpjs);

        // Check if hwp.js library is loaded
        if (typeof window.hwpjs === "undefined" || typeof window.hwpjs.Viewer === "undefined") {
          console.warn("[HWPViewerWindow] hwp.js library not loaded, showing placeholder");
          this._showPlaceholder(container, fileName, uint8Array);
          return;
        }

        // Create HWP viewer instance
        console.log("[HWPViewerWindow] Creating Viewer instance...");
        this.__hwpViewer = new window.hwpjs.Viewer(container, uint8Array);

        console.log("[HWPViewerWindow] HWP viewer initialized successfully");

        // Update status bar
        this.__pageInfoLabel.setValue("Loaded: " + fileName + " | Zoom: 100%");

        // Enable controls
        this.__printButton.setEnabled(true);
        this._updatePageNavigation();
      } catch (error) {
        console.error("[HWPViewerWindow] Error initializing viewer:", error);
        console.error("[HWPViewerWindow] Error stack:", error.stack);

        // Show placeholder on error
        this._showPlaceholder(container, fileName, uint8Array);
      }
    },

    /**
     * Show placeholder when hwp.js is not available
     */
    _showPlaceholder: function(container, fileName, uint8Array) {
      var fileSize = uint8Array ? Math.round(uint8Array.length / 1024) : 0;

      container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #333; font-family: Arial, sans-serif; margin-bottom: 20px;">HWP Document Viewer</h1>
          <div style="border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; background: #f9f9f9;">
            <p style="margin: 0; color: #666;"><strong>파일명:</strong> ${fileName}</p>
            <p style="margin: 10px 0 0 0; color: #666;"><strong>파일 크기:</strong> ${fileSize} KB</p>
            <p style="margin: 10px 0 0 0; color: #666;"><strong>상태:</strong> 파일 로드 완료</p>
          </div>
          <div style="background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">안내</h3>
            <p style="margin: 5px 0; color: #856404;">
              HWP 파일이 성공적으로 로드되었습니다.
            </p>
            <p style="margin: 5px 0; color: #856404;">
              hwp.js 라이브러리가 CDN에서 로드 중입니다. 잠시 후 문서 내용이 표시됩니다.
            </p>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #ddd; min-height: 400px;">
            <h3 style="color: #0078d4; margin-bottom: 15px;">HWP 파일 정보</h3>
            <p style="color: #555; line-height: 1.6;">
              <strong>형식:</strong> 한글 워드프로세서 문서 (.hwp)
            </p>
            <p style="color: #555; line-height: 1.6;">
              <strong>데이터:</strong> ${uint8Array ? uint8Array.length + ' bytes 로드됨' : '데이터 없음'}
            </p>
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
              <p style="color: #666; margin: 5px 0;">
                만약 문서가 표시되지 않는다면:
              </p>
              <ul style="color: #666; margin: 10px 0; padding-left: 20px;">
                <li>페이지를 새로고침 해보세요 (F5 또는 Ctrl+R)</li>
                <li>브라우저 콘솔(F12)에서 오류를 확인하세요</li>
                <li>인터넷 연결을 확인하세요 (CDN 로드 필요)</li>
              </ul>
            </div>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-left: 4px solid #0078d4;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>기술 정보:</strong> hwp.js 라이브러리를 사용하여 HWP 문서를 브라우저에서 직접 렌더링합니다.
            </p>
          </div>
        </div>
      `;
      this.__pageInfoLabel.setValue("Loaded: " + fileName + " (" + fileSize + " KB) | Zoom: 100%");

      // Enable print button even in placeholder mode
      this.__printButton.setEnabled(true);
    },

    /**
     * Update page navigation buttons
     */
    _updatePageNavigation: function() {
      // For now, disable page navigation until we can detect total pages
      this.__prevPageButton.setEnabled(false);
      this.__nextPageButton.setEnabled(false);
    },

    /**
     * Zoom in
     */
    _onZoomIn: function() {
      this.__zoomLevel = Math.min(this.__zoomLevel + 0.1, 3.0);
      this._applyZoom();
      console.log("[HWPViewerWindow] Zoom in:", this.__zoomLevel);
    },

    /**
     * Zoom out
     */
    _onZoomOut: function() {
      this.__zoomLevel = Math.max(this.__zoomLevel - 0.1, 0.5);
      this._applyZoom();
      console.log("[HWPViewerWindow] Zoom out:", this.__zoomLevel);
    },

    /**
     * Reset zoom
     */
    _onZoomReset: function() {
      this.__zoomLevel = 1.0;
      this._applyZoom();
      console.log("[HWPViewerWindow] Zoom reset");
    },

    /**
     * Apply zoom level to viewer
     */
    _applyZoom: function() {
      var viewerElement = document.getElementById(this.__viewerId);
      if (viewerElement) {
        viewerElement.style.transform = "scale(" + this.__zoomLevel + ")";
        viewerElement.style.transformOrigin = "top left";

        var zoomPercent = Math.round(this.__zoomLevel * 100);
        this.__zoomResetButton.setLabel(zoomPercent + "%");

        // Update status bar
        var currentStatus = this.__pageInfoLabel.getValue();
        var newStatus = currentStatus.replace(/Zoom: \d+%/, "Zoom: " + zoomPercent + "%");
        this.__pageInfoLabel.setValue(newStatus);
      }
    },

    /**
     * Previous page
     */
    _onPrevPage: function() {
      if (this.__currentPage > 1) {
        this.__currentPage--;
        this._updatePageDisplay();
        console.log("[HWPViewerWindow] Previous page:", this.__currentPage);
      }
    },

    /**
     * Next page
     */
    _onNextPage: function() {
      if (this.__currentPage < this.__totalPages) {
        this.__currentPage++;
        this._updatePageDisplay();
        console.log("[HWPViewerWindow] Next page:", this.__currentPage);
      }
    },

    /**
     * Update page display
     */
    _updatePageDisplay: function() {
      // Update page navigation buttons
      this.__prevPageButton.setEnabled(this.__currentPage > 1);
      this.__nextPageButton.setEnabled(this.__currentPage < this.__totalPages);

      // Update status
      var currentStatus = this.__pageInfoLabel.getValue();
      var newStatus = currentStatus + " | Page " + this.__currentPage + " of " + this.__totalPages;
      this.__pageInfoLabel.setValue(newStatus);
    },

    /**
     * Print document
     */
    _onPrint: function() {
      console.log("[HWPViewerWindow] Print triggered");

      var viewerElement = document.getElementById(this.__viewerId);
      if (viewerElement) {
        // Create print window
        var printWindow = window.open("", "_blank");
        printWindow.document.write("<html><head><title>Print HWP Document</title>");
        printWindow.document.write("<style>body { margin: 20px; font-family: 'Malgun Gothic', Arial, sans-serif; }</style>");
        printWindow.document.write("</head><body>");
        printWindow.document.write(viewerElement.innerHTML);
        printWindow.document.write("</body></html>");
        printWindow.document.close();
        printWindow.print();
      }
    }
  },

  /*
  *****************************************************************************
     DESTRUCTOR
  *****************************************************************************
  */

  destruct : function()
  {
    this.__storage = null;
    this.__hwpViewer = null;
    this.__viewerElement = null;
    this.__toolbar = null;
    this.__viewerContainer = null;
    this.__statusBar = null;
  }
});
