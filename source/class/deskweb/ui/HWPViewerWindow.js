/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * HWP Viewer Window
 *
 * A Windows XP style window for viewing .hwp (Hangul Word Processor) files.
 * Supports dual-mode viewing: Preview mode (PrvText) and Body mode (full document parsing).
 *
 * Features:
 * - Open .hwp files via file picker or file path
 * - Dual-mode viewing: Preview and Body Text
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
    this.__viewMode = "preview"; // "preview" or "body"
    this.__parsedData = null;
    this.__librariesLoaded = false;

    // Generate unique ID for this viewer instance
    this.__viewerId = "hwp-viewer-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

    // Setup window
    this._setupWindow();

    // Build UI
    this._buildUI();

    // Load external libraries
    this._loadExternalLibraries();

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
    __viewMode: null,
    __parsedData: null,
    __librariesLoaded: null,
    __modeToggleButton: null,
    __currentFileName: null,

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

      // View mode toggle
      this.__modeToggleButton = new qx.ui.toolbar.Button("Body View", "icon/16/actions/view-fullscreen.png");
      this.__modeToggleButton.addListener("execute", this._onToggleViewMode, this);
      this.__modeToggleButton.setEnabled(false);
      this.__toolbar.add(this.__modeToggleButton);

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
      console.log("[HWPViewerWindow] ===== Loading file from storage =====");
      console.log("[HWPViewerWindow] File path:", filePath);

      // Get file metadata to check if it's binary
      var metadata = this.__storage.getFileMetadata(filePath);
      if (!metadata) {
        console.error("[HWPViewerWindow] File metadata not found:", filePath);
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">파일 메타데이터를 찾을 수 없습니다: ' + filePath + '</div>');
        return;
      }

      console.log("[HWPViewerWindow] Metadata:", JSON.stringify(metadata));

      // StorageManager.readFile returns string content directly
      var fileContent = this.__storage.readFile(filePath);
      if (!fileContent) {
        console.error("[HWPViewerWindow] File content is empty or null");
        this.__viewerContainer.setHtml('<div style="padding: 20px; text-align: center; color: red;">파일 내용을 읽을 수 없습니다: ' + filePath + '</div>');
        return;
      }

      try {
        var fileName = filePath.split("/").pop();
        var isHWP = fileName.toLowerCase().endsWith('.hwp');

        console.log("[HWPViewerWindow] File name:", fileName);
        console.log("[HWPViewerWindow] Is HWP:", isHWP);
        console.log("[HWPViewerWindow] File content type:", typeof fileContent);
        console.log("[HWPViewerWindow] File content length (string):", fileContent.length);
        console.log("[HWPViewerWindow] Metadata isBinary:", metadata.isBinary);

        var uint8Array;

        // HWP files should ALWAYS be treated as binary
        var shouldDecodeBinary = metadata.isBinary || isHWP;

        console.log("[HWPViewerWindow] Should decode as binary:", shouldDecodeBinary);

        // Check if file is stored as base64 (binary file)
        if (shouldDecodeBinary) {
          try {
            console.log("[HWPViewerWindow] Attempting base64 decode...");
            console.log("[HWPViewerWindow] First 50 chars of content:", fileContent.substring(0, 50));

            // Convert base64 to Uint8Array
            var binaryString = atob(fileContent);
            uint8Array = new Uint8Array(binaryString.length);
            for (var i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }

            console.log("[HWPViewerWindow] ✅ Base64 decode SUCCESS");
            console.log("[HWPViewerWindow] Decoded size:", uint8Array.length, "bytes");
            console.log("[HWPViewerWindow] First 16 bytes (hex):", Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

            // Verify HWP signature (should start with D0 CF 11 E0 for CFB format)
            if (uint8Array.length > 8) {
              var signature = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
              console.log("[HWPViewerWindow] File signature:", signature);

              if (uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF) {
                console.log("[HWPViewerWindow] ✅ Valid CFB (Compound File Binary) signature detected");
              } else {
                console.warn("[HWPViewerWindow] ⚠️ Unexpected file signature - may not be a valid HWP file");
              }
            }

            if (uint8Array.length === 0) {
              throw new Error("Decoded file is empty (0 bytes)");
            }

          } catch (atobError) {
            console.error("[HWPViewerWindow] ❌ Base64 decode FAILED:", atobError);
            console.error("[HWPViewerWindow] atob error details:", atobError.message);

            // Show detailed error to user
            var errorMsg = '<div style="padding: 20px;">';
            errorMsg += '<h3 style="color: red;">파일 디코딩 오류</h3>';
            errorMsg += '<p>파일을 base64에서 디코딩하는데 실패했습니다.</p>';
            errorMsg += '<p><strong>오류:</strong> ' + atobError.message + '</p>';
            errorMsg += '<p><strong>파일 크기 (base64):</strong> ' + fileContent.length + ' chars</p>';
            errorMsg += '<p><strong>제안:</strong> 파일을 다시 업로드해주세요.</p>';
            errorMsg += '</div>';

            this.__viewerContainer.setHtml(errorMsg);
            return;
          }
        } else {
          // Text file - convert string to Uint8Array
          var encoder = new TextEncoder();
          uint8Array = encoder.encode(fileContent);
          console.log("[HWPViewerWindow] Encoded as text to Uint8Array, size:", uint8Array.length, "bytes");
        }

        if (!uint8Array || uint8Array.length === 0) {
          throw new Error("File data is empty after processing");
        }

        console.log("[HWPViewerWindow] ===== File loaded successfully, rendering... =====");
        this._renderHWP(uint8Array, fileName);
        this.setCaption("HWP Viewer - " + fileName);

      } catch (error) {
        console.error("[HWPViewerWindow] ❌ Error loading file:", error);
        console.error("[HWPViewerWindow] Error stack:", error.stack);

        var errorMsg = '<div style="padding: 20px;">';
        errorMsg += '<h3 style="color: red;">파일 로드 오류</h3>';
        errorMsg += '<p><strong>오류:</strong> ' + error.message + '</p>';
        errorMsg += '<p><strong>파일:</strong> ' + filePath + '</p>';
        errorMsg += '<p>브라우저 콘솔(F12)에서 자세한 정보를 확인하세요.</p>';
        errorMsg += '</div>';

        this.__viewerContainer.setHtml(errorMsg);
      }
    },

    /**
     * Load external libraries (CFB.js and pako.js)
     */
    _loadExternalLibraries: function() {
      console.log("[HWPViewerWindow] Loading external libraries...");

      var self = this;
      var librariesLoaded = 0;
      var totalLibraries = 2;

      var checkAllLoaded = function() {
        librariesLoaded++;
        if (librariesLoaded === totalLibraries) {
          self.__librariesLoaded = true;
          console.log("[HWPViewerWindow] All libraries loaded successfully");
        }
      };

      // Load CFB.js
      if (typeof window.CFB === "undefined") {
        var cfbScript = document.createElement("script");
        cfbScript.src = "https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js";
        cfbScript.onload = function() {
          console.log("[HWPViewerWindow] CFB.js loaded");
          checkAllLoaded();
        };
        cfbScript.onerror = function() {
          console.error("[HWPViewerWindow] Failed to load CFB.js");
          checkAllLoaded();
        };
        document.head.appendChild(cfbScript);
      } else {
        checkAllLoaded();
      }

      // Load pako.js
      if (typeof window.pako === "undefined") {
        var pakoScript = document.createElement("script");
        pakoScript.src = "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js";
        pakoScript.onload = function() {
          console.log("[HWPViewerWindow] pako.js loaded");
          checkAllLoaded();
        };
        pakoScript.onerror = function() {
          console.error("[HWPViewerWindow] Failed to load pako.js");
          checkAllLoaded();
        };
        document.head.appendChild(pakoScript);
      } else {
        checkAllLoaded();
      }
    },

    /**
     * Parse HWP file structure
     */
    _parseHWP: function(uint8Array) {
      try {
        console.log("[HWPViewerWindow] Parsing HWP file...");

        // Check if libraries are loaded
        if (typeof window.CFB === "undefined" || typeof window.pako === "undefined") {
          console.error("[HWPViewerWindow] Libraries not loaded");
          return null;
        }

        // Parse CFB structure
        var cfb = window.CFB.read(uint8Array, { type: 'array' });
        console.log("[HWPViewerWindow] CFB structure parsed");

        // Parse FileHeader
        var fileHeader = this._parseFileHeader(cfb);
        console.log("[HWPViewerWindow] FileHeader parsed:", fileHeader);

        // Parse PrvText (preview text)
        var prvText = this._parsePrvText(cfb);
        if (prvText) {
          console.log("[HWPViewerWindow] PrvText parsed:", prvText.length, "characters");
        }

        // Parse DocInfo
        var docInfo = this._parseDocInfo(cfb, fileHeader);
        console.log("[HWPViewerWindow] DocInfo parsed");

        // Store docInfo for later use
        this.__docInfo = docInfo;

        // Parse sections
        var sections = this._parseSections(cfb, fileHeader);
        console.log("[HWPViewerWindow] Parsed", sections.length, "sections");

        return {
          header: fileHeader,
          docInfo: docInfo,
          sections: sections,
          prvText: prvText
        };
      } catch (error) {
        console.error("[HWPViewerWindow] Error parsing HWP:", error);
        return null;
      }
    },

    /**
     * Parse FileHeader
     */
    _parseFileHeader: function(cfb) {
      var data = this._readCFBStream(cfb, 'FileHeader');
      if (!data || data.length < 256) {
        throw new Error('Invalid FileHeader');
      }

      var view = new DataView(data.buffer);
      var signature = new TextDecoder('utf-8').decode(data.slice(0, 32)).replace(/\0/g, '');
      var version = view.getUint32(32, true);
      var flags = view.getUint32(36, true);

      return {
        signature: signature,
        version: {
          raw: version,
          major: (version >> 24) & 0xFF,
          minor: (version >> 16) & 0xFF,
          patch: (version >> 8) & 0xFF,
          revision: version & 0xFF
        },
        flags: {
          compressed: !!(flags & 0x01),
          encrypted: !!(flags & 0x02),
          raw: flags
        }
      };
    },

    /**
     * Parse PrvText
     */
    _parsePrvText: function(cfb) {
      try {
        var data = this._readCFBStream(cfb, 'PrvText');
        if (!data || data.length === 0) {
          return null;
        }

        var text = new TextDecoder('utf-16le').decode(data);
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      } catch (error) {
        console.error("[HWPViewerWindow] Error parsing PrvText:", error);
        return null;
      }
    },

    /**
     * Parse DocInfo
     */
    _parseDocInfo: function(cfb, fileHeader) {
      var data = this._readCFBStream(cfb, 'DocInfo');
      if (!data) {
        return null;
      }

      var records = this._parseRecords(data, fileHeader.flags.compressed);
      console.log("[HWPViewerWindow] DocInfo records:", records.length);

      // Extract paragraph shapes and character shapes
      var paraShapes = [];
      var charShapes = [];

      // Tag IDs (HWPTAG_BEGIN = 0x10)
      // HWPTAG_PARA_SHAPE = 0x10 + 9 = 0x19 (25)
      // HWPTAG_CHAR_SHAPE = 0x10 + 5 = 0x15 (21)
      for (var i = 0; i < records.length; i++) {
        var record = records[i];

        if (record.tagId === 0x19 || record.tagId === 25) {
          // Parse PARA_SHAPE
          var paraShape = this._parseParaShape(record.data);
          if (paraShape) {
            paraShapes.push(paraShape);
          }
        } else if (record.tagId === 0x15 || record.tagId === 21) {
          // Parse CHAR_SHAPE
          var charShape = this._parseCharShape(record.data);
          if (charShape) {
            charShapes.push(charShape);
          }
        }
      }

      console.log("[HWPViewerWindow] Parsed", paraShapes.length, "paragraph shapes and", charShapes.length, "character shapes");

      return {
        records: records,
        paraShapes: paraShapes,
        charShapes: charShapes
      };
    },

    /**
     * Parse sections
     */
    _parseSections: function(cfb, fileHeader) {
      var sections = [];

      console.log("[HWPViewerWindow] ===== Parsing Sections =====");
      console.log("[HWPViewerWindow] File compressed flag:", fileHeader.flags.compressed);

      for (var i = 0; i < 10; i++) {
        var data = this._readSection(cfb, i);
        if (!data) {
          if (i === 0) {
            console.error("[HWPViewerWindow] ❌ Section0 not found");
          } else {
            console.log("[HWPViewerWindow] No more sections after Section" + (i-1));
          }
          break;
        }

        console.log("[HWPViewerWindow] --- Section" + i + " ---");
        console.log("[HWPViewerWindow] Raw size:", data.length, "bytes");
        console.log("[HWPViewerWindow] First 16 bytes:", Array.from(data.slice(0, 16)).map(b => "0x" + b.toString(16).padStart(2, '0')).join(' '));

        // Check if ViewText (uncompressed) or BodyText (compressed)
        var firstByte = data[0];
        var isViewText = firstByte === 0x1c;
        var isCompressed = !isViewText && fileHeader.flags.compressed;

        console.log("[HWPViewerWindow] First byte:", "0x" + firstByte.toString(16).padStart(2, '0'));
        console.log("[HWPViewerWindow] Is ViewText:", isViewText);
        console.log("[HWPViewerWindow] Is Compressed:", isCompressed);

        var records = this._parseRecords(data, isCompressed);
        var paragraphs = this._extractParagraphs(records);

        console.log("[HWPViewerWindow] ✅ Section" + i + " parsed:", records.length, "records,", paragraphs.length, "paragraphs");

        // Log record type statistics
        var recordTypes = {};
        records.forEach(function(r) {
          var key = "0x" + r.tagId.toString(16).padStart(2, '0');
          recordTypes[key] = (recordTypes[key] || 0) + 1;
        });
        console.log("[HWPViewerWindow] Record types:", JSON.stringify(recordTypes));

        sections.push({
          index: i,
          records: records,
          paragraphs: paragraphs,
          isViewText: isViewText
        });
      }

      console.log("[HWPViewerWindow] ===== Total sections parsed:", sections.length, "=====");

      return sections;
    },

    /**
     * Parse records from data
     */
    _parseRecords: function(data, isCompressed) {
      console.log("[HWPViewerWindow] Parsing records, compressed:", isCompressed, "size:", data.length);

      // Step 1: Decompress entire stream if compressed
      if (isCompressed && data.length > 0) {
        try {
          console.log("[HWPViewerWindow] Attempting stream decompression with pako.inflateRaw...");
          var decompressed = window.pako.inflateRaw(data);
          console.log("[HWPViewerWindow] ✅ Stream decompressed:", data.length, "->", decompressed.length, "bytes (ratio:", (decompressed.length / data.length).toFixed(2) + "x)");
          data = decompressed;
        } catch (e) {
          console.error("[HWPViewerWindow] ❌ Decompression failed:", e.message);
          console.log("[HWPViewerWindow] Trying pako.inflate instead of inflateRaw...");
          try {
            var decompressed2 = window.pako.inflate(data);
            console.log("[HWPViewerWindow] ✅ pako.inflate succeeded:", data.length, "->", decompressed2.length, "bytes");
            data = decompressed2;
          } catch (e2) {
            console.error("[HWPViewerWindow] ❌ pako.inflate also failed:", e2.message);
            console.warn("[HWPViewerWindow] Using raw data without decompression");
          }
        }
      }

      // Step 2: Parse records from decompressed data
      var records = [];
      var offset = 0;
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);

      while (offset < data.length - 4) {
        try {
          var header = view.getUint32(offset, true);
          offset += 4;

          var tagId = header & 0x3FF;
          var level = (header >> 10) & 0x3FF;
          var size = (header >> 20) & 0xFFF;

          if (size === 0xFFF) {
            if (offset + 4 > data.length) break;
            size = view.getUint32(offset, true);
            offset += 4;
          }

          if (offset + size > data.length) break;

          var recordData = data.slice(offset, offset + size);
          offset += size;

          records.push({
            tagId: tagId,
            level: level,
            size: size,
            data: recordData
          });
        } catch (error) {
          console.error("[HWPViewerWindow] Record parsing error:", error);
          break;
        }
      }

      return records;
    },

    /**
     * Extract paragraphs and tables from records
     */
    _extractParagraphs: function(records) {
      var paragraphs = [];

      console.log("[EXTRACT] ========================================");
      console.log("[EXTRACT] Extracting paragraphs from", records.length, "records...");

      // Debug: Scan for ALL CTRL_HEADER and TABLE records first
      console.log("[EXTRACT-SCAN] Scanning for ALL CTRL_HEADER(0x47) and TABLE(0x4D) records...");
      var ctrlHeaderIndices = [];
      var tableIndices = [];
      for (var scanIdx = 0; scanIdx < records.length; scanIdx++) {
        var tagId = records[scanIdx].tagId;
        if (tagId === 0x47 || tagId === 71) {
          ctrlHeaderIndices.push(scanIdx);
          console.log("[EXTRACT-SCAN] CTRL_HEADER at index", scanIdx,
                     "next tagId:", (scanIdx + 1 < records.length) ?
                     "0x" + records[scanIdx + 1].tagId.toString(16) : "none");
        }
        if (tagId === 0x4D || tagId === 77) {
          tableIndices.push(scanIdx);
          console.log("[EXTRACT-SCAN] TABLE at index", scanIdx,
                     "prev tagId:", (scanIdx > 0) ?
                     "0x" + records[scanIdx - 1].tagId.toString(16) : "none");
        }
      }
      console.log("[EXTRACT-SCAN] Total CTRL_HEADER found:", ctrlHeaderIndices.length, "at indices:", ctrlHeaderIndices.slice(0, 20).join(", "));
      console.log("[EXTRACT-SCAN] Total TABLE found:", tableIndices.length, "at indices:", tableIndices.slice(0, 20).join(", "));

      // DEBUG: Check which CTRL_HEADER + TABLE pairs exist
      console.log("[EXTRACT-SCAN] Checking CTRL_HEADER + TABLE pairs:");
      for (var pairIdx = 0; pairIdx < ctrlHeaderIndices.length; pairIdx++) {
        var chIdx = ctrlHeaderIndices[pairIdx];
        var nextIdx = chIdx + 1;
        if (nextIdx < records.length) {
          var nextTagId = records[nextIdx].tagId;
          var isTable = (nextTagId === 0x4D || nextTagId === 77);
          console.log("[EXTRACT-SCAN]   CTRL_HEADER[" + chIdx + "] -> next[" + nextIdx + "] tagId=0x" + nextTagId.toString(16) + " isTable=" + isTable);
        }
      }

      var paraHeaderCount = 0;
      var paraTextCount = 0;
      var tableCount = 0;
      var skipUntilIndex = -1; // Track which records to skip (already processed by table)

      console.log("[EXTRACT] Starting main parsing loop with skipUntilIndex =", skipUntilIndex);

      for (var i = 0; i < records.length; i++) {
        // Skip records that were already processed by a table
        if (i <= skipUntilIndex) {
          // But log what we're skipping for debugging
          if (i === skipUntilIndex) {
            console.log("[EXTRACT] Finished skipping table records up to index", skipUntilIndex);
            console.log("[EXTRACT] Next record at index", i + 1, "will be processed normally");
          }
          continue;
        }

        var record = records[i];

        // DEBUG: Log when we encounter potential table-related records
        if (record.tagId === 0x47 || record.tagId === 71 || record.tagId === 0x4D || record.tagId === 77) {
          console.log("[EXTRACT-DEBUG] 📍 At index", i, "tagId=0x" + record.tagId.toString(16),
                     "skipUntilIndex=", skipUntilIndex,
                     "will process:", i > skipUntilIndex);
        }

        // Check for CTRL_HEADER (0x37 = 55) which precedes tables
        // HWPTAG_CTRL_HEADER = HWPTAG_BEGIN + 55 = 16 + 55 = 71 (0x47)
        if (record.tagId === 0x47 || record.tagId === 71) {
          console.log("[EXTRACT] Found CTRL_HEADER (0x47/71) at index", i, ", checking for table...");

          // Check if next record is TABLE
          if (i + 1 < records.length) {
            var nextRecord = records[i + 1];
            console.log("[EXTRACT] Next record after CTRL_HEADER: tagId=0x" + nextRecord.tagId.toString(16));

            // HWPTAG_TABLE = HWPTAG_BEGIN + 61 = 16 + 61 = 77 (0x4D)
            if (nextRecord.tagId === 0x4D || nextRecord.tagId === 77) {
              tableCount++;
              console.log("[EXTRACT] ======== TABLE", tableCount, "========");
              console.log("[EXTRACT] Found TABLE record (0x4D/77), size:", nextRecord.data.length);

              var table = this._parseTable(nextRecord.data, records, i + 1);
              if (table) {
                paragraphs.push({
                  type: 'table',
                  table: table
                });
                console.log("[EXTRACT] Added table:", table.rows, "rows x", table.cols, "cols with", table.cells.length, "cells");
                console.log("[EXTRACT] Table cells detail:");
                for (var ci = 0; ci < table.cells.length; ci++) {
                  var c = table.cells[ci];
                  console.log("[EXTRACT]   Cell " + (ci+1) + ": pos(" + c.row + "," + c.col + ") span(" + c.rowSpan + "x" + c.colSpan + ") text:" + (c.text || "").substring(0, 20));
                }

                // If table parsing found text that belongs outside, add it as a paragraph
                if (table.outsideText && table.outsideText.trim().length > 0) {
                  console.log("[EXTRACT] ✅ Found outside text from table:", table.outsideText.trim());
                  paragraphs.push({
                    type: 'paragraph',
                    text: table.outsideText.trim(),
                    recordIndex: table.outsideTextIndex || -1,
                    afterSkipIndex: table.lastRecordIndex || -1,
                    wasSkipped: false,
                    _source: 'table_outside_text'
                  });
                  console.log("[EXTRACT] Added outside text as paragraph, paragraphs count now:", paragraphs.length);
                }

                // Skip all records that belong to this table, INCLUDING the TABLE record itself
                // If there's outsideText, we set skipUntilIndex to just before the outside text
                // so that the main loop doesn't try to re-parse it
                if (table.lastRecordIndex) {
                  // If outsideText was found, skip to one record before it was found
                  // (the outsideText is already added above)
                  if (table.outsideTextIndex && table.outsideText) {
                    skipUntilIndex = table.outsideTextIndex;
                    console.log("[EXTRACT] Table has outsideText, skipping to outsideTextIndex:", skipUntilIndex);
                  } else {
                    skipUntilIndex = table.lastRecordIndex;
                    console.log("[EXTRACT] Skipping records from", i, "to", skipUntilIndex);
                  }
                } else {
                  // If no lastRecordIndex, at least skip the TABLE record
                  skipUntilIndex = i + 1;
                  console.log("[EXTRACT] No lastRecordIndex, skipping to", skipUntilIndex);
                }
              }
            } else {
              // CTRL_HEADER for something else (not a table)
              console.log("[EXTRACT] CTRL_HEADER not followed by TABLE, skipping this CTRL_HEADER");
            }
          }
        }
        // HWPTAG_TABLE standalone (might occur without CTRL_HEADER)
        // But skip if previous record was CTRL_HEADER to avoid duplicates
        else if (record.tagId === 0x4D || record.tagId === 77) {
          // Check if previous record was CTRL_HEADER
          var prevWasCtrlHeader = (i > 0 && (records[i-1].tagId === 0x47 || records[i-1].tagId === 71));

          if (!prevWasCtrlHeader) {
            tableCount++;
            console.log("[EXTRACT] ======== STANDALONE TABLE", tableCount, "========");
            console.log("[EXTRACT] Found standalone TABLE record (0x4D/77), size:", record.data.length);

            var table = this._parseTable(record.data, records, i);
            if (table) {
              paragraphs.push({
                type: 'table',
                table: table
              });
              console.log("[EXTRACT] Added table:", table.rows, "rows x", table.cols, "cols");

              // If table parsing found text that belongs outside, add it as a paragraph
              if (table.outsideText && table.outsideText.trim().length > 0) {
                console.log("[EXTRACT] ✅ Found outside text from table:", table.outsideText.trim());
                paragraphs.push({
                  type: 'paragraph',
                  text: table.outsideText.trim(),
                  recordIndex: table.outsideTextIndex || -1,
                  _source: 'table_outside_text'
                });
                console.log("[EXTRACT] Added outside text as paragraph");
              }

              // Skip all records that belong to this table
              if (table.lastRecordIndex) {
                if (table.outsideTextIndex && table.outsideText) {
                  skipUntilIndex = table.outsideTextIndex;
                  console.log("[EXTRACT] Table has outsideText, skipping to outsideTextIndex:", skipUntilIndex);
                } else {
                  skipUntilIndex = table.lastRecordIndex;
                  console.log("[EXTRACT] Skipping records until index", skipUntilIndex);
                }
              }
            }
          } else {
            console.log("[EXTRACT] Skipping duplicate TABLE after CTRL_HEADER");
          }
        }
        // PARA_HEADER (0x42 = 66, which is HWPTAG_BEGIN + 50)
        else if (record.tagId === 0x42 || record.tagId === 66) {
          paraHeaderCount++;

          console.log("[PARA] ========================================");
          console.log("[PARA] Found PARA_HEADER at index", i);
          console.log("[PARA] Current skipUntilIndex:", skipUntilIndex);
          console.log("[PARA] This PARA is", i <= skipUntilIndex ? "INSIDE TABLE (should be skipped)" : "OUTSIDE TABLE (will be processed)");

          // Parse paragraph header to get style IDs
          var paraHeader = this._parseParaHeader(record.data);
          var text = '';
          var charShapeIds = [];

          // Look ahead for PARA_TEXT (0x43) and PARA_CHAR_SHAPE (0x44)
          // But stop at next PARA_HEADER to avoid reading text that belongs to next paragraph
          for (var j = i + 1; j < Math.min(i + 5, records.length); j++) {
            var nextRec = records[j];

            // Stop if we hit another PARA_HEADER - that's a different paragraph
            if (nextRec.tagId === 0x42 || nextRec.tagId === 66) {
              console.log("[PARA] Stopping look-ahead at index", j, "- found next PARA_HEADER");
              break;
            }

            if (nextRec.tagId === 0x43 || nextRec.tagId === 67) {
              // PARA_TEXT - only use it if we haven't found text yet
              if (text.length === 0) {
                text = this._parseParaText(nextRec.data);
                console.log("[PARA] Found PARA_TEXT at index", j, "- text length:", text.length);
                console.log("[PARA] Text preview (first 100 chars):", text.substring(0, 100));
              } else {
                console.log("[PARA] Skipping duplicate PARA_TEXT at index", j, "- already have text");
              }
            } else if (nextRec.tagId === 0x44 || nextRec.tagId === 68) {
              // PARA_CHAR_SHAPE - extract character shape IDs
              charShapeIds = this._parseParaCharShape(nextRec.data);
              console.log("[PARA] Found PARA_CHAR_SHAPE at index", j);
            }
          }

          if (text.trim().length > 0) {
            // Filter out garbage control characters that appear as "氠瑢" or similar
            // These are UTF-16LE decoded control bytes that should be skipped
            var cleanText = text.trim();

            // Check if text contains mostly garbage (non-printable or invalid characters)
            var printableCount = 0;
            var totalChars = cleanText.length;

            for (var k = 0; k < totalChars; k++) {
              var code = cleanText.charCodeAt(k);
              if ((code >= 0xAC00 && code <= 0xD7AF) || // Hangul syllables
                  (code >= 0x20 && code <= 0x7E) ||     // ASCII printable
                  (code >= 0x3000 && code <= 0x9FFF)) { // CJK
                printableCount++;
              }
            }
            var printableRatio = totalChars > 0 ? printableCount / totalChars : 0;

            // Skip garbage text:
            // 1. Mostly garbage (less than 30% printable)
            // 2. OR very short non-Korean text (less than 5 chars and no Hangul)
            var hasKorean = false;
            for (var k = 0; k < totalChars; k++) {
              var code = cleanText.charCodeAt(k);
              if (code >= 0xAC00 && code <= 0xD7AF) {
                hasKorean = true;
                break;
              }
            }

            var shouldSkip = false;
            var skipReason = "";

            if (printableRatio < 0.3) {
              shouldSkip = true;
              skipReason = "low printable ratio: " + printableRatio.toFixed(2);
            } else if (totalChars <= 5 && !hasKorean) {
              shouldSkip = true;
              skipReason = "short non-Korean text (" + totalChars + " chars, no Hangul)";
            }

            if (shouldSkip) {
              console.log("[PARA] ⚠️ SKIPPING garbage paragraph (" + skipReason + "):", cleanText,
                         "char codes:", Array.from(cleanText).map(c => '0x' + c.charCodeAt(0).toString(16)).join(' '));
            } else {
              console.log("[PARA] ✅ ADDING paragraph to output at position", paragraphs.length);
              console.log("[PARA] Full text:", cleanText);
              paragraphs.push({
                type: 'paragraph',
                text: cleanText,
                paraShapeId: paraHeader ? paraHeader.paraShapeId : 0,
                charShapeIds: charShapeIds,
                _debugInfo: {
                  recordIndex: i,
                  afterSkipIndex: skipUntilIndex,
                  wasSkipped: i <= skipUntilIndex
                }
              });
            }
          } else {
            console.log("[PARA] ⚠️ SKIPPING paragraph (empty text)");
          }
          console.log("[PARA] ========================================");
        }
      }

      console.log("[HWPViewerWindow] Extraction summary:");
      console.log("[HWPViewerWindow] - PARA_HEADER (0x50) found:", paraHeaderCount);
      console.log("[HWPViewerWindow] - PARA_TEXT (0x51) found:", paraTextCount);
      console.log("[HWPViewerWindow] - TABLE (0x3D) found:", tableCount);
      console.log("[HWPViewerWindow] - Total items extracted:", paragraphs.length);

      // If no paragraphs found, try alternative extraction
      if (paragraphs.length === 0) {
        console.warn("[HWPViewerWindow] ⚠️ No PARA_TEXT records found, trying alternative extraction...");
        paragraphs = this._extractParagraphsAlternative(records);
      }

      return paragraphs;
    },

    /**
     * Alternative paragraph extraction (heuristic approach)
     */
    _extractParagraphsAlternative: function(records) {
      var paragraphs = [];

      console.log("[HWPViewerWindow] Alternative extraction: trying to decode any record as text...");

      for (var i = 0; i < records.length; i++) {
        var record = records[i];

        // Special handling for 0x1c (ViewText header)
        if (record.tagId === 0x1c) {
          console.log("[HWPViewerWindow] Found 0x1c record (ViewText), size:", record.data.length);

          // 0x1c record contains text data starting after header
          // Try to parse the structure
          var text = this._parseViewTextRecord(record.data);
          if (text && text.length > 0) {
            paragraphs.push({
              text: text,
              tagId: "0x1c (ViewText)"
            });
            console.log("[HWPViewerWindow] ✅ Extracted text from 0x1c record, length:", text.length, "preview:", text.substring(0, 50) + "...");
            continue;
          } else {
            console.log("[HWPViewerWindow] 0x1c record too small or no text, trying as regular record");
            // Don't continue, fall through to try as regular record
          }
        }

        // Skip very small records (likely not text)
        if (record.data.length < 10) continue;

        try {
          // Try to decode as UTF-16LE
          var text = new TextDecoder('utf-16le').decode(record.data);

          // Check if looks like valid text (at least 60% printable characters)
          var printableCount = 0;
          var totalCount = Math.min(text.length, 100);

          for (var j = 0; j < totalCount; j++) {
            var code = text.charCodeAt(j);
            if ((code >= 32 && code <= 126) ||  // ASCII printable
                (code >= 0xAC00 && code <= 0xD7A3) ||  // Korean
                code === 10 || code === 13 || code === 9) {  // Whitespace
              printableCount++;
            }
          }

          var ratio = printableCount / totalCount;

          // Lower threshold for ViewText records (they might have more metadata)
          var threshold = (record.tagId === 0x1c || record.tagId >= 0x100) ? 0.3 : 0.6;

          if (ratio >= threshold && text.trim().length >= 10) {
            // Clean up control characters
            var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();

            // Additional validation: check if meaningful text exists
            var meaningfulLength = cleaned.replace(/[^\w가-힣]/g, '').length;

            if (meaningfulLength >= 5) {
              paragraphs.push({
                text: cleaned,
                tagId: "0x" + record.tagId.toString(16) + " (heuristic)"
              });

              console.log("[HWPViewerWindow] Found text in record 0x" + record.tagId.toString(16).padStart(2, '0') + ", ratio:", ratio.toFixed(2), "meaningful:", meaningfulLength, "text:", cleaned.substring(0, 50) + "...");
            }
          }
        } catch (e) {
          // Skip records that can't be decoded
        }
      }

      console.log("[HWPViewerWindow] Alternative extraction found:", paragraphs.length, "text blocks");

      return paragraphs;
    },

    /**
     * Parse ViewText (0x1c) record
     */
    _parseViewTextRecord: function(data) {
      try {
        console.log("[HWPViewerWindow] Parsing ViewText record, size:", data.length);
        console.log("[HWPViewerWindow] First 32 bytes:", Array.from(data.slice(0, 32)).map(b => "0x" + b.toString(16).padStart(2, '0')).join(' '));

        // ViewText record data is often compressed
        // Try decompressing first
        var decompressed = null;

        try {
          console.log("[HWPViewerWindow] Attempting to decompress 0x1c record data...");
          decompressed = window.pako.inflateRaw(data);
          console.log("[HWPViewerWindow] ✅ 0x1c record decompressed:", data.length, "->", decompressed.length, "bytes");
          data = decompressed;
        } catch (e1) {
          console.log("[HWPViewerWindow] inflateRaw failed, trying inflate:", e1.message);
          try {
            decompressed = window.pako.inflate(data);
            console.log("[HWPViewerWindow] ✅ 0x1c record decompressed with inflate:", data.length, "->", decompressed.length, "bytes");
            data = decompressed;
          } catch (e2) {
            console.log("[HWPViewerWindow] Decompression failed, trying as uncompressed:", e2.message);
            // Continue with original data
          }
        }

        // Now try to decode as UTF-16LE from various offsets
        var possibleOffsets = [0, 4, 8, 12, 16];

        for (var k = 0; k < possibleOffsets.length; k++) {
          var offset = possibleOffsets[k];

          if (offset >= data.length) continue;

          try {
            var textData = data.slice(offset);
            var text = new TextDecoder('utf-16le').decode(textData);

            // Check if this looks like valid text
            var printableCount = 0;
            var totalCount = Math.min(text.length, 100);

            for (var j = 0; j < totalCount; j++) {
              var code = text.charCodeAt(j);
              if ((code >= 32 && code <= 126) ||
                  (code >= 0xAC00 && code <= 0xD7A3) ||
                  code === 10 || code === 13 || code === 9) {
                printableCount++;
              }
            }

            var ratio = printableCount / totalCount;
            console.log("[HWPViewerWindow] Trying offset", offset, "printable ratio:", ratio.toFixed(2));

            if (ratio >= 0.5) {
              // Found valid text
              var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
              if (cleaned.length > 10) {
                console.log("[HWPViewerWindow] ✅ Found text at offset", offset, "length:", cleaned.length);
                return cleaned;
              }
            }
          } catch (e) {
            // Try next offset
          }
        }

        console.log("[HWPViewerWindow] ⚠️ Could not find text in ViewText record");
        return null;

      } catch (error) {
        console.error("[HWPViewerWindow] Error parsing ViewText record:", error);
        return null;
      }
    },

    /**
     * Parse paragraph text
     */
    _parseParaText: function(data) {
      try {
        // PARA_TEXT should be UTF-16LE encoded
        var text = new TextDecoder('utf-16le').decode(data);

        // Remove control characters
        var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // Check if text looks valid (mostly printable characters)
        var printableCount = 0;
        var totalCount = cleaned.length;

        for (var i = 0; i < cleaned.length; i++) {
          var code = cleaned.charCodeAt(i);
          // Check for valid Korean (Hangul), ASCII, or common Unicode
          if ((code >= 0xAC00 && code <= 0xD7AF) || // Hangul syllables
              (code >= 0x20 && code <= 0x7E) ||     // ASCII printable
              (code >= 0x3000 && code <= 0x9FFF) || // CJK
              code === 0x20 || code === 0x0A) {     // Space, newline
            printableCount++;
          }
        }

        var ratio = totalCount > 0 ? printableCount / totalCount : 0;

        if (ratio < 0.5 && totalCount > 0) {
          console.warn("[HWPViewerWindow] Low printable ratio:", ratio.toFixed(2), "for text:", cleaned.substring(0, 50));
          console.warn("[HWPViewerWindow] Data length:", data.length, "First 20 bytes:",
                       Array.from(data.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        }

        return cleaned;
      } catch (e) {
        console.error("[HWPViewerWindow] Error decoding PARA_TEXT:", e);
        console.error("[HWPViewerWindow] Data length:", data.length, "First bytes:",
                     Array.from(data.slice(0, Math.min(20, data.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        return '';
      }
    },

    /**
     * Parse PARA_HEADER to extract style IDs
     */
    _parseParaHeader: function(data) {
      try {
        if (data.length < 22) {
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;

        // Skip some fields
        offset += 4; // nchars
        offset += 4; // control mask
        var paraShapeId = view.getUint16(offset, true); offset += 2;

        return {
          paraShapeId: paraShapeId
        };
      } catch (e) {
        console.error("[HWPViewerWindow] Error parsing PARA_HEADER:", e);
        return null;
      }
    },

    /**
     * Parse PARA_CHAR_SHAPE to extract character shape IDs
     */
    _parseParaCharShape: function(data) {
      try {
        // PARA_CHAR_SHAPE contains pairs of (position, charShapeId)
        // Each pair is 8 bytes: UINT32 position + UINT32 charShapeId
        var charShapeIds = [];
        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        for (var offset = 0; offset + 8 <= data.length; offset += 8) {
          var position = view.getUint32(offset, true);
          var charShapeId = view.getUint32(offset + 4, true);
          charShapeIds.push({
            position: position,
            charShapeId: charShapeId
          });
        }

        return charShapeIds;
      } catch (e) {
        console.error("[HWPViewerWindow] Error parsing PARA_CHAR_SHAPE:", e);
        return [];
      }
    },

    /**
     * Parse table structure
     *
     * HWP 표 구조 (표 74~80 참조):
     * - HWPTAG_TABLE: 개체 공통 속성 + 표 개체 속성
     * - LIST_HEADER: 문단 리스트 헤더 (6바이트) + 셀 속성 (26바이트)
     * - 셀 속성 (표 80): Column주소(2) + Row주소(2) + 열병합개수(2) + 행병합개수(2) + ...
     *
     * 개선 사항:
     * - 셀 위치 파싱 로직 강화 (LIST_HEADER 오프셋 6에서 시작하는 셀 속성)
     * - 그리드 기반 셀 위치 추적 (순차 배치 + 병합 셀 처리)
     * - 표 경계 감지 개선 (그리드 완성 시 즉시 종료)
     * - 표 외부 텍스트 감지 강화
     */
    _parseTable: function(data, allRecords, currentIndex) {
      try {
        console.log("[TABLE-PARSE] ========================================");
        console.log("[TABLE-PARSE] Parsing table, data size:", data.length);
        console.log("[TABLE-PARSE] First 32 bytes:", Array.from(data.slice(0, Math.min(32, data.length))).map(b => "0x" + b.toString(16).padStart(2, '0')).join(' '));

        if (data.length < 22) {
          console.warn("[TABLE-PARSE] Table data too small");
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;

        // Try to find table dimensions by scanning possible offsets
        var found = false;
        for (var tryOffset = 0; tryOffset < Math.min(100, data.length - 22); tryOffset += 4) {
          offset = tryOffset;

          try {
            var props = view.getUint32(offset, true); offset += 4;
            var rows = view.getUint16(offset, true); offset += 2;
            var cols = view.getUint16(offset, true); offset += 2;

            // Sanity check: rows and cols should be reasonable (1-100)
            if (rows >= 1 && rows <= 100 && cols >= 1 && cols <= 100) {
              console.log("[TABLE-PARSE] ========================================");
              console.log("[TABLE-PARSE] Found table at offset", tryOffset, ":", rows, "rows x", cols, "cols");
              console.log("[TABLE-PARSE] Table record index:", currentIndex);
              console.log("[TABLE-PARSE] Expected total cells (with merging):", rows, "*", cols, "=", rows * cols, "grid positions");

              var table = {
                rows: rows,
                cols: cols,
                properties: props,
                cells: []
              };

              // Extract cells from LIST_HEADER records
              var cellCount = 0;
              var currentCell = null;
              var lastProcessedIndex = currentIndex;
              var totalGridPositions = rows * cols;
              var gridPositionsFilled = 0;
              var tableComplete = false;

              // Create a grid to track occupied positions
              var occupiedGrid = [];
              for (var gr = 0; gr < rows; gr++) {
                occupiedGrid[gr] = [];
                for (var gc = 0; gc < cols; gc++) {
                  occupiedGrid[gr][gc] = false;
                }
              }

              // Helper: find next empty position in grid (left-to-right, top-to-bottom)
              var findNextEmptyPos = function() {
                for (var r = 0; r < rows; r++) {
                  for (var c = 0; c < cols; c++) {
                    if (!occupiedGrid[r][c]) {
                      return { row: r, col: c };
                    }
                  }
                }
                return null; // Grid is full
              };

              // Helper: mark grid positions as occupied
              var markOccupied = function(row, col, rowSpan, colSpan) {
                var count = 0;
                for (var r = row; r < row + rowSpan && r < rows; r++) {
                  for (var c = col; c < col + colSpan && c < cols; c++) {
                    if (!occupiedGrid[r][c]) {
                      occupiedGrid[r][c] = true;
                      count++;
                    }
                  }
                }
                return count;
              };

              // Helper: check if grid is complete
              var isGridComplete = function() {
                for (var r = 0; r < rows; r++) {
                  for (var c = 0; c < cols; c++) {
                    if (!occupiedGrid[r][c]) {
                      return false;
                    }
                  }
                }
                return true;
              };

              console.log("[TABLE-PARSE] Scanning records from index", currentIndex + 1);

              for (var j = currentIndex + 1; j < Math.min(currentIndex + 500, allRecords.length); j++) {
                var rec = allRecords[j];

                // LIST_HEADER (0x48 = 72) marks the start of a cell
                if (rec.tagId === 0x48 || rec.tagId === 72) {
                  // Save previous cell if exists
                  if (currentCell !== null) {
                    // Note: markOccupied was already called when cell was created (IMMEDIATELY)
                    // So we just save the cell without calling markOccupied again
                    console.log("[TABLE-CELL] Saving cell", cellCount, "at (" + currentCell.row + "," + currentCell.col + ")",
                               "span(" + currentCell.rowSpan + "x" + currentCell.colSpan + "), text:", currentCell.text.substring(0, 30),
                               "| Grid filled:", gridPositionsFilled, "/", totalGridPositions);
                    table.cells.push(currentCell);
                    currentCell = null;

                    // Check if grid is complete AFTER saving the cell
                    if (isGridComplete()) {
                      console.log("[TABLE-CELL] ✅ Grid COMPLETE after saving cell! Stopping at index", j);
                      console.log("[TABLE-CELL] This LIST_HEADER belongs to NEXT table");
                      table.lastRecordIndex = j - 1;
                      tableComplete = true;
                      break;
                    }
                  }

                  // Double-check: if grid is complete, stop immediately
                  if (isGridComplete()) {
                    console.log("[TABLE-CELL] ✅ Grid is COMPLETE! Stopping at index", j);
                    console.log("[TABLE-CELL] This LIST_HEADER belongs to NEXT table or other structure");
                    table.lastRecordIndex = j - 1;
                    tableComplete = true;
                    break;
                  }

                  // Find next empty position for this cell
                  var nextEmpty = findNextEmptyPos();
                  if (!nextEmpty) {
                    console.log("[TABLE-CELL] ⚠️ No empty grid position available, table is full!");
                    table.lastRecordIndex = j - 1;
                    tableComplete = true;
                    break;
                  }

                  console.log("[TABLE-CELL] ----------------------------------------");
                  console.log("[TABLE-CELL] Found LIST_HEADER (cell", cellCount + 1, ") at index", j);
                  console.log("[TABLE-CELL] Next empty grid position:", nextEmpty.row, ",", nextEmpty.col);

                  // Parse cell attributes from LIST_HEADER data
                  // Structure: 문단 리스트 헤더 (6 bytes) + 셀 속성 (26+ bytes)
                  // 셀 속성 at offset 6: col(2) + row(2) + colSpan(2) + rowSpan(2) + ...
                  var cellCol = nextEmpty.col;
                  var cellRow = nextEmpty.row;
                  var colSpan = 1;
                  var rowSpan = 1;

                  // Try to parse cell attributes from LIST_HEADER data
                  // Structure: 문단 리스트 헤더 (6 bytes) + 셀 속성 (26+ bytes)
                  // 셀 속성 (표 80): col(2) + row(2) + colSpan(2) + rowSpan(2) + ...
                  //
                  // IMPORTANT: Use SEQUENTIAL position as primary, and only use parsed SPAN values
                  // The parsed col/row values are often unreliable or have different meaning
                  if (rec.data && rec.data.length >= 14) {
                    try {
                      var cellView = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);

                      // Log raw data for debugging
                      console.log("[TABLE-CELL] Raw LIST_HEADER data (" + rec.data.length + " bytes):",
                                 Array.from(rec.data.slice(0, Math.min(32, rec.data.length)))
                                 .map(function(b) { return "0x" + b.toString(16).padStart(2, '0'); }).join(' '));

                      // Standard offset for cell attributes is 6 (after 6-byte list header)
                      var cellAttrOffset = 6;

                      if (cellAttrOffset + 8 <= rec.data.length) {
                        // HWP 셀 속성 구조 분석 (실제 로그 기반):
                        //
                        // 로그에서 관찰된 패턴:
                        // - 1행 셀들: hwpCol=0, hwpRow=0,1,2,3, hwpColSpan=0
                        // - 2행 셀들: hwpCol=0, hwpRow=0,1,2,3, hwpColSpan=1
                        // - 3행 셀들: hwpCol=0, hwpRow=0,1,2,3, hwpColSpan=2
                        //
                        // 결론:
                        // - hwpCol: 항상 0 (의미 불명확, 사용하지 않음)
                        // - hwpRow: 실제 열(col) 인덱스
                        // - hwpColSpan: 실제 행(row) 인덱스
                        // - hwpRowSpan: 열 병합 수 (colSpan)
                        //
                        var hwpCol = cellView.getUint16(cellAttrOffset, true);
                        var hwpRow = cellView.getUint16(cellAttrOffset + 2, true);
                        var hwpColSpan = cellView.getUint16(cellAttrOffset + 4, true);
                        var hwpRowSpan = cellView.getUint16(cellAttrOffset + 6, true);

                        // 실제 매핑 (로그 분석 기반):
                        // hwpRow = 실제 col (열 인덱스)
                        // hwpColSpan = 실제 row (행 인덱스)
                        // hwpRowSpan = 실제 colSpan (열 병합)
                        // rowSpan은 HWP에서 직접 제공하지 않음 - 기본값 1 사용
                        var parsedCol = hwpRow;      // hwpRow가 실제 열 인덱스
                        var parsedRow = hwpColSpan;  // hwpColSpan이 실제 행 인덱스
                        var parsedColSpan = hwpRowSpan >= 1 ? hwpRowSpan : 1;  // 열 병합
                        var parsedRowSpan = 1;  // 행 병합은 기본값 1 (나중에 개선 가능)

                        console.log("[TABLE-CELL] Raw HWP data: hwpCol=" + hwpCol + ", hwpRow=" + hwpRow +
                                   ", hwpColSpan=" + hwpColSpan + ", hwpRowSpan=" + hwpRowSpan);
                        console.log("[TABLE-CELL] NEW mapping: col=" + parsedCol + ", row=" + parsedRow +
                                   ", colSpan=" + parsedColSpan + ", rowSpan=" + parsedRowSpan);

                        // Use parsed col/row if they are within valid range
                        var isValidPos = (parsedCol >= 0 && parsedCol < cols &&
                                         parsedRow >= 0 && parsedRow < rows);

                        // Check if the parsed position is already occupied
                        var isOccupied = isValidPos && occupiedGrid[parsedRow] && occupiedGrid[parsedRow][parsedCol];
                        console.log("[TABLE-CELL] isOccupied check: parsedRow=" + parsedRow + ", parsedCol=" + parsedCol +
                                   ", gridValue=" + (occupiedGrid[parsedRow] ? occupiedGrid[parsedRow][parsedCol] : "N/A") +
                                   ", isOccupied=" + isOccupied);

                        // span 값 검증
                        var isValidSpan = (parsedColSpan <= cols && parsedRowSpan <= rows);

                        // Check if parsed position is occupied - if so, use sequential
                        // Note: sequential position (nextEmpty) is always unoccupied by definition
                        if (isValidPos && !isOccupied) {
                          // Use parsed position from HWP data
                          cellCol = parsedCol;
                          cellRow = parsedRow;
                          console.log("[TABLE-CELL] ✅ Using PARSED position (row=" + cellRow + ", col=" + cellCol + ")");

                          // Use span values from HWP data
                          if (isValidSpan) {
                            colSpan = parsedColSpan;
                            rowSpan = parsedRowSpan;
                          }
                        } else if (isValidPos && isOccupied) {
                          // Position is occupied - find the existing cell and reuse it
                          console.log("[TABLE-CELL] ⚠️ Parsed position (" + parsedRow + "," + parsedCol + ") is OCCUPIED");

                          // Find existing cell at this position
                          var existingCell = null;
                          for (var ec = 0; ec < table.cells.length; ec++) {
                            if (table.cells[ec].row === parsedRow && table.cells[ec].col === parsedCol) {
                              existingCell = table.cells[ec];
                              break;
                            }
                          }

                          if (existingCell) {
                            console.log("[TABLE-CELL] Found existing cell at (" + parsedRow + "," + parsedCol + "), will append text to it");
                            // Set currentCell to existing cell so text will be appended
                            currentCell = existingCell;
                            // Remove from array (will be re-added when saved)
                            table.cells.splice(table.cells.indexOf(existingCell), 1);
                            cellCount--; // Adjust count since we're reusing
                            lastProcessedIndex = j;
                            continue; // Skip creating new cell
                          } else {
                            // No existing cell found, use sequential position
                            console.log("[TABLE-CELL] No existing cell found, using sequential (row=" + cellRow + ", col=" + cellCol + ")");
                          }
                        } else {
                          console.log("[TABLE-CELL] ⚠️ Parsed position out of range (col=" + parsedCol + " >= cols=" + cols +
                                     " or row=" + parsedRow + " >= rows=" + rows + "), using sequential (row=" + cellRow + ", col=" + cellCol + ")");
                          // Keep sequential position and default span (1x1)
                        }

                        console.log("[TABLE-CELL] Final: position (row=" + cellRow + ", col=" + cellCol + ") with span(rowSpan=" + rowSpan + ", colSpan=" + colSpan + ")");
                      } else {
                        console.log("[TABLE-CELL] Data too short for cell attributes (need 14, have " + rec.data.length + ")");
                        console.log("[TABLE-CELL] Using sequential position (" + cellRow + "," + cellCol + ") with span(1x1)");
                      }
                    } catch (e) {
                      console.log("[TABLE-CELL] Error parsing cell attributes:", e.message);
                      console.log("[TABLE-CELL] Using sequential position (" + cellRow + "," + cellCol + ") with span(1x1)");
                    }
                  } else {
                    console.log("[TABLE-CELL] LIST_HEADER data too small (" + (rec.data ? rec.data.length : 0) + " bytes)");
                    console.log("[TABLE-CELL] Using sequential position (" + cellRow + "," + cellCol + ") with span(1x1)");
                  }

                  currentCell = {
                    row: cellRow,
                    col: cellCol,
                    colSpan: colSpan,
                    rowSpan: rowSpan,
                    text: ''
                  };

                  // IMPORTANT: Mark this cell's position as occupied IMMEDIATELY
                  // This prevents subsequent cells from being assigned the same position
                  // when isOccupied check is performed for the next cell
                  var immediateGridSize = markOccupied(cellRow, cellCol, rowSpan, colSpan);
                  gridPositionsFilled += immediateGridSize;
                  console.log("[TABLE-CELL] 📍 Marked position (" + cellRow + "," + cellCol + ") as occupied IMMEDIATELY",
                             "| Grid filled:", gridPositionsFilled, "/", totalGridPositions);

                  cellCount++;
                  lastProcessedIndex = j;
                }
                // PARA_HEADER (0x42 = 66) inside a cell
                else if ((rec.tagId === 0x42 || rec.tagId === 66) && currentCell !== null) {
                  lastProcessedIndex = j;
                }
                // PARA_TEXT (0x43 = 67) - add text to current cell
                else if ((rec.tagId === 0x43 || rec.tagId === 67) && currentCell !== null) {
                  var cellText = this._parseParaText(rec.data);

                  console.log("[TABLE-TEXT] PARA_TEXT at index", j, "for cell", cellCount);
                  console.log("[TABLE-TEXT] Text:", cellText.substring(0, 60) + (cellText.length > 60 ? "..." : ""));

                  // Check if this text looks like a section heading (should be outside table)
                  var isHeading = /^\d+\.\s+[가-힣\s]+\s*(사항)?$/.test(cellText.trim());

                  // Also check for signature/date lines that appear at end of resume
                  var isSignature = /상기\s*기재\s*사항|지원자|년\s*\d+\s*월\s*\d+\s*일|\(인\)/.test(cellText.trim());

                  if (isHeading || isSignature) {
                    console.log("[TABLE-TEXT] ⚠️ Detected heading/signature text:", cellText.trim());

                    // Check how full the grid is - if mostly full, this is likely outside text
                    var gridFillRatio = gridPositionsFilled / totalGridPositions;
                    console.log("[TABLE-TEXT] Current grid fill ratio:", gridFillRatio.toFixed(2), "cells so far:", table.cells.length);

                    // Only treat as outside text if grid is sufficiently filled (>= 70%)
                    // AND current cell has no text AND we have at least one cell already
                    // This prevents early termination for tables with merged cells
                    if (table.cells.length >= 1 && currentCell.text.trim().length === 0 && gridFillRatio >= 0.7) {
                      console.log("[TABLE-TEXT] Treating as OUTSIDE text (grid >= 70% full)");

                      // If current cell has text, save it first (markOccupied was already called when cell was created)
                      if (currentCell.text.trim().length > 0) {
                        table.cells.push(currentCell);
                      }
                      currentCell = null;

                      table.outsideText = cellText.trim();
                      table.outsideTextIndex = j;
                      table.lastRecordIndex = j;
                      tableComplete = true;
                      break;
                    } else {
                      console.log("[TABLE-TEXT] Grid not full enough or cell has content, treating as cell content");
                    }
                  }

                  // Regular cell text
                  if (currentCell.text.length > 0) {
                    currentCell.text += '\n';
                  }
                  currentCell.text += cellText.trim();
                  lastProcessedIndex = j;
                }
                // PARA_TEXT outside cell context - should NOT happen in table
                else if ((rec.tagId === 0x43 || rec.tagId === 67) && currentCell === null) {
                  var outsideText = this._parseParaText(rec.data);
                  console.log("[TABLE-TEXT] ⚠️ PARA_TEXT OUTSIDE cell at index", j, ":", outsideText.substring(0, 50));
                  console.log("[TABLE-TEXT] Grid state: filled", gridPositionsFilled, "/", totalGridPositions, "(" + (gridPositionsFilled/totalGridPositions*100).toFixed(1) + "%), cells:", table.cells.length);
                  console.log("[TABLE-TEXT] Current occupiedGrid state:");
                  for (var dbgR = 0; dbgR < rows; dbgR++) {
                    var dbgRow = "  Row " + dbgR + ": ";
                    for (var dbgC = 0; dbgC < cols; dbgC++) {
                      dbgRow += occupiedGrid[dbgR][dbgC] ? "■ " : "□ ";
                    }
                    console.log("[TABLE-TEXT]" + dbgRow);
                  }

                  // Only treat as table end if we have at least some cells and grid is partially filled
                  // This prevents early termination for tables with merged cells
                  if (table.cells.length >= 1 && gridPositionsFilled >= Math.floor(totalGridPositions * 0.5)) {
                    // This is likely text after the table
                    console.log("[TABLE-TEXT] Grid is >= 50% full, treating as table end");
                    table.outsideText = outsideText;
                    table.outsideTextIndex = j;
                    table.lastRecordIndex = j;
                    tableComplete = true;
                    break;
                  } else {
                    // Grid not full enough, this might be text inside a merged cell or structure issue
                    console.log("[TABLE-TEXT] Grid is < 50% full (" + (gridPositionsFilled/totalGridPositions*100).toFixed(1) + "%), continuing to look for more cells");
                    // Don't break, continue parsing
                  }
                }
                // PARA_CHAR_SHAPE, PARA_LINE_SEG inside cell
                else if (((rec.tagId === 0x44 || rec.tagId === 68) || (rec.tagId === 0x45 || rec.tagId === 69)) && currentCell !== null) {
                  lastProcessedIndex = j;
                }
                // CTRL_HEADER (0x47 = 71) or TABLE (0x4D = 77) - another structure
                else if ((rec.tagId === 0x47 || rec.tagId === 71) || (rec.tagId === 0x4D || rec.tagId === 77)) {
                  if (j > currentIndex + 5) {
                    console.log("[TABLE-END] Found CTRL_HEADER/TABLE at index", j, "- stopping table parsing");

                    // Save current cell if exists (markOccupied was already called when cell was created)
                    if (currentCell !== null) {
                      table.cells.push(currentCell);
                      currentCell = null;
                    }

                    table.lastRecordIndex = j - 1;
                    tableComplete = true;
                    break;
                  }
                }
                // PARA_HEADER outside cell - table has ended
                else if ((rec.tagId === 0x42 || rec.tagId === 66) && currentCell === null && cellCount > 0) {
                  console.log("[TABLE-END] PARA_HEADER outside cell at index", j, "- table ended");
                  table.lastRecordIndex = j - 1;
                  tableComplete = true;
                  break;
                }
              }

              // Save last cell if exists (markOccupied was already called when cell was created)
              if (currentCell !== null) {
                console.log("[TABLE-END] Saving final cell", cellCount, "with text:", currentCell.text.substring(0, 30));
                table.cells.push(currentCell);
              }

              // Ensure lastRecordIndex is set
              if (!table.lastRecordIndex) {
                table.lastRecordIndex = lastProcessedIndex;
              }

              console.log("[TABLE-SUMMARY] ========================================");
              console.log("[TABLE-SUMMARY] Extracted", table.cells.length, "cells for", rows, "x", cols, "table");
              console.log("[TABLE-SUMMARY] Grid positions filled:", gridPositionsFilled, "/", totalGridPositions);
              console.log("[TABLE-SUMMARY] Last record index:", table.lastRecordIndex);
              console.log("[TABLE-SUMMARY] Grid state:");
              for (var gr = 0; gr < rows; gr++) {
                var rowStr = "  Row " + gr + ": ";
                for (var gc = 0; gc < cols; gc++) {
                  rowStr += occupiedGrid[gr][gc] ? "■ " : "□ ";
                }
                console.log("[TABLE-SUMMARY]" + rowStr);
              }
              console.log("[TABLE-SUMMARY] Cell contents:");
              for (var di = 0; di < table.cells.length; di++) {
                var dc = table.cells[di];
                console.log("[TABLE-SUMMARY]   [" + di + "] (" + dc.row + "," + dc.col + ") span(" + dc.rowSpan + "x" + dc.colSpan + "):",
                           dc.text.substring(0, 40) + (dc.text.length > 40 ? "..." : ""));
              }
              if (table.outsideText) {
                console.log("[TABLE-SUMMARY] Outside text:", table.outsideText);
              }
              console.log("[TABLE-SUMMARY] ========================================");

              found = true;
              return table;
            }
          } catch (e) {
            // Try next offset
          }
        }

        if (!found) {
          console.warn("[HWPViewerWindow] Could not find valid table structure");
        }

        return null;

      } catch (error) {
        console.error("[HWPViewerWindow] Error parsing table:", error);
        return null;
      }
    },

    /**
     * Read CFB stream
     */
    _readCFBStream: function(cfb, streamName) {
      try {
        var entry = window.CFB.find(cfb, streamName);
        if (!entry) return null;
        return new Uint8Array(entry.content);
      } catch (error) {
        console.error("[HWPViewerWindow] Error reading stream", streamName, ":", error);
        return null;
      }
    },

    /**
     * Read section from CFB
     */
    _readSection: function(cfb, index) {
      var paths = [
        'BodyText/Section' + index,
        'ViewText/Section' + index,
        'Section' + index
      ];

      for (var i = 0; i < paths.length; i++) {
        var data = this._readCFBStream(cfb, paths[i]);
        if (data) return data;
      }

      return null;
    },

    /**
     * Toggle view mode
     */
    _onToggleViewMode: function() {
      if (!this.__parsedData) return;

      this.__viewMode = this.__viewMode === "preview" ? "body" : "preview";
      this.__modeToggleButton.setLabel(this.__viewMode === "preview" ? "Body View" : "Preview");

      console.log("[HWPViewerWindow] Switched to", this.__viewMode, "mode");

      this._renderParsedData();
    },

    /**
     * Render parsed HWP data
     */
    _renderParsedData: function() {
      if (!this.__parsedData) return;

      var viewerElement = document.getElementById(this.__viewerId);
      if (!viewerElement) return;

      viewerElement.innerHTML = '';

      if (this.__viewMode === "preview") {
        this._renderPreviewMode(viewerElement);
      } else {
        this._renderBodyMode(viewerElement);
      }

      // Update status
      this._updateStatusBar();
    },

    /**
     * Render preview mode
     */
    _renderPreviewMode: function(container) {
      var prvText = this.__parsedData.prvText;

      if (!prvText || prvText.trim().length === 0) {
        container.innerHTML = '<p style="color: #999; padding: 20px;">미리보기 텍스트가 없습니다.</p>';
        return;
      }

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'background: #fffbf0; border-left: 4px solid #ffa500; padding: 20px; margin: 20px;';

      var title = document.createElement('h3');
      title.style.cssText = 'color: #ff8c00; margin: 0 0 15px 0;';
      title.textContent = '문서 미리보기 (PrvText)';
      wrapper.appendChild(title);

      var content = document.createElement('pre');
      content.style.cssText = 'white-space: pre-wrap; line-height: 1.8; font-family: "Malgun Gothic", sans-serif; margin: 0;';
      content.textContent = prvText;
      wrapper.appendChild(content);

      container.appendChild(wrapper);
    },

    /**
     * Render PrvText as fallback in body mode
     */
    _renderPrvTextFallback: function(container) {
      var prvText = this.__parsedData.prvText;

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'background: white; padding: 40px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

      var notice = document.createElement('div');
      notice.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;';

      var noticeTitle = document.createElement('h4');
      noticeTitle.style.cssText = 'color: #856404; margin: 0 0 10px 0;';
      noticeTitle.textContent = '⚠️ 알림';
      notice.appendChild(noticeTitle);

      var noticeText = document.createElement('p');
      noticeText.style.cssText = 'color: #856404; margin: 0; line-height: 1.6;';
      noticeText.textContent = '이 문서는 본문 문단 구조를 찾을 수 없습니다. 대신 미리보기 텍스트를 표시합니다.';
      notice.appendChild(noticeText);

      wrapper.appendChild(notice);

      var content = document.createElement('div');
      content.style.cssText = 'white-space: pre-wrap; line-height: 1.8; font-family: "Malgun Gothic", sans-serif;';
      content.textContent = prvText;
      wrapper.appendChild(content);

      container.appendChild(wrapper);
    },

    /**
     * Render body mode
     */
    _renderBodyMode: function(container) {
      var sections = this.__parsedData.sections;

      if (!sections || sections.length === 0) {
        // Fallback to PrvText if no sections
        if (this.__parsedData.prvText) {
          this._renderPrvTextFallback(container);
        } else {
          container.innerHTML = '<p style="color: #999; padding: 20px;">본문 데이터가 없습니다.</p>';
        }
        return;
      }

      var totalParagraphs = 0;
      sections.forEach(function(section) {
        totalParagraphs += section.paragraphs.length;
      });

      if (totalParagraphs === 0) {
        // Fallback to PrvText if no paragraphs found
        if (this.__parsedData.prvText) {
          this._renderPrvTextFallback(container);
        } else {
          container.innerHTML = '<p style="color: #999; padding: 20px;">본문 문단을 찾을 수 없습니다. 미리보기 모드를 사용해주세요.</p>';
        }
        return;
      }

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'background: white; padding: 40px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

      // Render each section
      sections.forEach(function(section, idx) {
        if (section.paragraphs.length === 0) return;

        console.log("[RENDER] ========================================");
        console.log("[RENDER] Rendering Section", idx + 1, "with", section.paragraphs.length, "items");

        // Section header
        var sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = 'color: #666; font-size: 0.9rem; padding: 10px 0; border-bottom: 1px solid #ddd; margin-bottom: 15px;';
        sectionHeader.textContent = 'Page ' + (idx + 1);
        wrapper.appendChild(sectionHeader);

        // Paragraphs and tables
        section.paragraphs.forEach(function(item, itemIdx) {
          if (item.type === 'table') {
            // Render table
            console.log("[RENDER] Item", itemIdx, "- TABLE:", item.table.rows, "x", item.table.cols);
            var table = this._renderTable(item.table);
            wrapper.appendChild(table);
          } else {
            // Render paragraph with styles
            console.log("[RENDER] Item", itemIdx, "- PARAGRAPH:");
            console.log("[RENDER]   Text:", item.text);
            if (item._debugInfo) {
              console.log("[RENDER]   Debug Info:", JSON.stringify(item._debugInfo));
            }
            var p = this._renderParagraph(item);
            wrapper.appendChild(p);
          }
        }, this);

        console.log("[RENDER] Section", idx + 1, "rendering complete");
        console.log("[RENDER] ========================================");

        // Page break
        if (idx < sections.length - 1) {
          var pageBreak = document.createElement('hr');
          pageBreak.style.cssText = 'border: none; border-top: 2px dashed #ccc; margin: 30px 0;';
          wrapper.appendChild(pageBreak);
        }
      }, this);

      container.appendChild(wrapper);

      // Update page navigation
      this.__totalPages = sections.length;
      this._updatePageNavigation();
    },

    /**
     * Render paragraph with styles
     */
    _renderParagraph: function(item) {
      var p = document.createElement('p');
      var styles = [];

      // Get paragraph shape from DocInfo
      var paraShape = null;
      if (this.__docInfo && this.__docInfo.paraShapes && item.paraShapeId !== undefined) {
        paraShape = this.__docInfo.paraShapes[item.paraShapeId];
      }

      // Apply paragraph styles
      if (paraShape) {
        // Alignment
        if (paraShape.alignment) {
          styles.push('text-align: ' + paraShape.alignment);
        }

        // Indentation (convert HWPUNIT to px, approximately 1 HWPUNIT = 0.01mm)
        if (paraShape.indent) {
          var indentPx = Math.round(paraShape.indent / 7200 * 25.4 / 0.254); // rough conversion
          styles.push('text-indent: ' + indentPx + 'px');
        }

        // Spacing
        if (paraShape.spacingTop) {
          var spacingTopPx = Math.round(paraShape.spacingTop / 7200 * 25.4 / 0.254);
          styles.push('margin-top: ' + spacingTopPx + 'px');
        }
        if (paraShape.spacingBottom) {
          var spacingBottomPx = Math.round(paraShape.spacingBottom / 7200 * 25.4 / 0.254);
          styles.push('margin-bottom: ' + spacingBottomPx + 'px');
        }
      } else {
        // Default styles
        styles.push('margin: 0 0 12px 0');
        styles.push('text-align: left');
      }

      styles.push('line-height: 1.8');

      // Get character shape - use first one if available
      var charShape = null;
      if (this.__docInfo && this.__docInfo.charShapes && item.charShapeIds && item.charShapeIds.length > 0) {
        var firstCharShapeId = item.charShapeIds[0].charShapeId;
        charShape = this.__docInfo.charShapes[firstCharShapeId];
      }

      // Apply character styles
      if (charShape) {
        if (charShape.bold) {
          styles.push('font-weight: bold');
        }
        if (charShape.italic) {
          styles.push('font-style: italic');
        }
        if (charShape.color) {
          styles.push('color: ' + charShape.color);
        }
      }

      p.style.cssText = styles.join('; ');
      p.textContent = item.text || '';

      return p;
    },

    /**
     * Render table as HTML with colspan/rowspan support
     *
     * 셀 위치가 잘못 파싱된 경우에도 순차적으로 빈 위치에 배치하여
     * 표가 올바르게 렌더링되도록 합니다.
     */
    _renderTable: function(tableData) {
      var table = document.createElement('table');
      table.style.cssText = 'border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #ddd;';

      console.log("[RENDER-TABLE] ========================================");
      console.log("[RENDER-TABLE] Rendering table:", tableData.rows, "x", tableData.cols, "with", tableData.cells.length, "cells");
      console.log("[RENDER-TABLE] Input cell data:");
      for (var debugIdx = 0; debugIdx < tableData.cells.length; debugIdx++) {
        var debugCell = tableData.cells[debugIdx];
        console.log("[RENDER-TABLE]   Cell", debugIdx + 1, "at (" + debugCell.row + "," + debugCell.col + ")",
                   "span(" + debugCell.rowSpan + "x" + debugCell.colSpan + "):",
                   (debugCell.text || "(empty)").substring(0, 30));
      }

      // Create a grid to track which positions are occupied by merged cells
      var grid = [];
      for (var i = 0; i < tableData.rows; i++) {
        grid[i] = [];
        for (var j = 0; j < tableData.cols; j++) {
          grid[i][j] = null; // null = empty, can be filled
        }
      }

      // Helper function to find next empty position in grid
      var findNextEmptyPosition = function(startRow, startCol) {
        for (var r = startRow; r < tableData.rows; r++) {
          var colStart = (r === startRow) ? startCol : 0;
          for (var c = colStart; c < tableData.cols; c++) {
            if (grid[r][c] === null) {
              return { row: r, col: c };
            }
          }
        }
        return null; // Grid is full
      };

      // First pass: place all cells in the grid
      // If parsed position is already occupied, find next empty position
      var currentRow = 0;
      var currentCol = 0;

      for (var i = 0; i < tableData.cells.length; i++) {
        var cellData = tableData.cells[i];
        var rowSpan = cellData.rowSpan || 1;
        var colSpan = cellData.colSpan || 1;

        // Find position for this cell
        var targetRow = cellData.row;
        var targetCol = cellData.col;

        // Check if parsed position is valid and empty
        var positionValid = targetRow >= 0 && targetRow < tableData.rows &&
                           targetCol >= 0 && targetCol < tableData.cols &&
                           grid[targetRow][targetCol] === null;

        // If parsed position is occupied or invalid, find next empty position
        if (!positionValid) {
          var nextPos = findNextEmptyPosition(currentRow, currentCol);
          if (nextPos) {
            console.log("[RENDER-TABLE] Cell", i + 1, ": Position (" + targetRow + "," + targetCol + ") invalid/occupied, using (" + nextPos.row + "," + nextPos.col + ")");
            targetRow = nextPos.row;
            targetCol = nextPos.col;
          } else {
            console.warn("[RENDER-TABLE] Cell", i + 1, ": No empty position found, skipping");
            continue;
          }
        }

        // Mark all grid positions occupied by this cell
        for (var r = targetRow; r < Math.min(targetRow + rowSpan, tableData.rows); r++) {
          for (var c = targetCol; c < Math.min(targetCol + colSpan, tableData.cols); c++) {
            if (r === targetRow && c === targetCol) {
              // Create a copy of cellData with corrected position
              grid[r][c] = {
                row: targetRow,
                col: targetCol,
                rowSpan: rowSpan,
                colSpan: colSpan,
                text: cellData.text
              };
            } else {
              grid[r][c] = 'occupied';
            }
          }
        }

        // Update current position for next cell
        currentRow = targetRow;
        currentCol = targetCol + colSpan;
        if (currentCol >= tableData.cols) {
          currentCol = 0;
          currentRow++;
        }
      }

      // Debug: show final grid state
      console.log("[RENDER-TABLE] Final grid state:");
      for (var r = 0; r < tableData.rows; r++) {
        var rowState = "";
        for (var c = 0; c < tableData.cols; c++) {
          if (grid[r][c] === null) {
            rowState += "[empty] ";
          } else if (grid[r][c] === 'occupied') {
            rowState += "[span ] ";
          } else {
            rowState += "[cell ] ";
          }
        }
        console.log("[RENDER-TABLE]   Row " + r + ": " + rowState);
      }

      // Second pass: render the table using the grid
      for (var row = 0; row < tableData.rows; row++) {
        var tr = document.createElement('tr');

        for (var col = 0; col < tableData.cols; col++) {
          var cellData = grid[row][col];

          // Skip positions occupied by rowspan/colspan from previous cells
          if (cellData === 'occupied') {
            continue;
          }

          var td = document.createElement('td');
          td.style.cssText = 'border: 1px solid #ccc; padding: 8px; vertical-align: top; min-width: 50px; min-height: 30px;';

          if (cellData !== null) {
            // Set text
            td.textContent = cellData.text || '';

            // Apply colspan/rowspan if present
            if (cellData.colSpan && cellData.colSpan > 1) {
              td.setAttribute('colspan', cellData.colSpan);
            }
            if (cellData.rowSpan && cellData.rowSpan > 1) {
              td.setAttribute('rowspan', cellData.rowSpan);
            }
          } else {
            // Empty cell
            td.innerHTML = '&nbsp;';
          }

          tr.appendChild(td);
        }

        table.appendChild(tr);
      }

      console.log("[RENDER-TABLE] Table rendering complete");
      console.log("[RENDER-TABLE] ========================================");

      return table;
    },

    /**
     * Parse PARA_SHAPE (문단 모양) from DocInfo
     */
    _parseParaShape: function(data) {
      try {
        if (data.length < 54) {
          console.warn("[HWPViewerWindow] PARA_SHAPE data too small:", data.length);
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;

        var attr1 = view.getUint32(offset, true); offset += 4;
        var leftMargin = view.getInt32(offset, true); offset += 4;
        var rightMargin = view.getInt32(offset, true); offset += 4;
        var indent = view.getInt32(offset, true); offset += 4;
        var spacingTop = view.getInt32(offset, true); offset += 4;
        var spacingBottom = view.getInt32(offset, true); offset += 4;
        var lineSpacing = view.getInt32(offset, true); offset += 4;

        // Extract alignment from attr1 (bits 2-4)
        var alignType = (attr1 >> 2) & 0x07;
        var alignments = ['justify', 'left', 'right', 'center', 'distribute', 'divide'];
        var alignment = alignments[alignType] || 'left';

        return {
          alignment: alignment,
          leftMargin: leftMargin,
          rightMargin: rightMargin,
          indent: indent,
          spacingTop: spacingTop,
          spacingBottom: spacingBottom,
          lineSpacing: lineSpacing,
          attr1: attr1
        };
      } catch (e) {
        console.error("[HWPViewerWindow] Error parsing PARA_SHAPE:", e);
        return null;
      }
    },

    /**
     * Parse CHAR_SHAPE (글자 모양) from DocInfo
     */
    _parseCharShape: function(data) {
      try {
        if (data.length < 72) {
          console.warn("[HWPViewerWindow] CHAR_SHAPE data too small:", data.length);
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;

        // Skip language-specific font IDs (14 bytes)
        offset += 14;
        // Skip language-specific ratios and spacing (28 bytes)
        offset += 28;

        var baseSize = view.getInt32(offset, true); offset += 4;
        var attr = view.getUint32(offset, true); offset += 4;

        // Skip shadow spacing
        offset += 2;

        var textColor = view.getUint32(offset, true); offset += 4;
        var underlineColor = view.getUint32(offset, true); offset += 4;
        var shadeColor = view.getUint32(offset, true); offset += 4;
        var shadowColor = view.getUint32(offset, true); offset += 4;

        // Extract attributes
        var italic = !!(attr & 0x01);
        var bold = !!(attr & 0x02);

        // Convert COLORREF (0x00BBGGRR) to CSS color
        var r = textColor & 0xFF;
        var g = (textColor >> 8) & 0xFF;
        var b = (textColor >> 16) & 0xFF;
        var color = 'rgb(' + r + ',' + g + ',' + b + ')';

        return {
          baseSize: baseSize,
          italic: italic,
          bold: bold,
          color: color,
          textColor: textColor,
          underlineColor: underlineColor,
          shadeColor: shadeColor,
          shadowColor: shadowColor,
          attr: attr
        };
      } catch (e) {
        console.error("[HWPViewerWindow] Error parsing CHAR_SHAPE:", e);
        return null;
      }
    },

    /**
     * Update status bar
     */
    _updateStatusBar: function() {
      var mode = this.__viewMode === "preview" ? "미리보기" : "본문보기";
      var zoom = Math.round(this.__zoomLevel * 100);
      var status = "모드: " + mode + " | Zoom: " + zoom + "%";

      if (this.__currentFileName) {
        status = this.__currentFileName + " | " + status;
      }

      if (this.__viewMode === "body" && this.__totalPages > 1) {
        status += " | Page " + this.__currentPage + " of " + this.__totalPages;
      }

      this.__pageInfoLabel.setValue(status);
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
     * Initialize HWP viewer with new parser
     */
    _initializeHWPViewer: function(container, uint8Array, fileName) {
      try {
        console.log("[HWPViewerWindow] Initializing HWP viewer for:", fileName);
        console.log("[HWPViewerWindow] Data size:", uint8Array ? uint8Array.length : 0);

        // Store filename
        this.__currentFileName = fileName;

        // Check if libraries are loaded
        if (!this.__librariesLoaded) {
          console.warn("[HWPViewerWindow] Libraries not loaded yet, waiting...");
          container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">라이브러리 로딩 중... 잠시만 기다려주세요.</div>';

          // Retry after 1 second
          qx.event.Timer.once(function() {
            this._initializeHWPViewer(container, uint8Array, fileName);
          }, this, 1000);
          return;
        }

        // Parse HWP file
        this.__parsedData = this._parseHWP(uint8Array);

        if (!this.__parsedData) {
          throw new Error('HWP 파일 파싱 실패');
        }

        console.log("[HWPViewerWindow] HWP parsed successfully");

        // Render preview mode by default
        this.__viewMode = "preview";
        this._renderParsedData();

        // Enable controls
        this.__printButton.setEnabled(true);
        this.__modeToggleButton.setEnabled(true);
        this._updateStatusBar();

        console.log("[HWPViewerWindow] HWP viewer initialized successfully");
      } catch (error) {
        console.error("[HWPViewerWindow] Error initializing viewer:", error);
        console.error("[HWPViewerWindow] Error stack:", error.stack);

        // Show error message
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">HWP 파일 로딩 오류: ' + error.message + '</div>';
      }
    },

    /**
     * Update page navigation buttons
     */
    _updatePageNavigation: function() {
      if (this.__viewMode === "body" && this.__totalPages > 1) {
        this.__prevPageButton.setEnabled(this.__currentPage > 1);
        this.__nextPageButton.setEnabled(this.__currentPage < this.__totalPages);
      } else {
        this.__prevPageButton.setEnabled(false);
        this.__nextPageButton.setEnabled(false);
      }
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
