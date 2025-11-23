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

      return {
        records: records
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
     * Extract paragraphs from records
     */
    _extractParagraphs: function(records) {
      var paragraphs = [];

      console.log("[HWPViewerWindow] Extracting paragraphs from", records.length, "records...");

      var paraHeaderCount = 0;
      var paraTextCount = 0;

      for (var i = 0; i < records.length; i++) {
        var record = records[i];

        // PARA_HEADER (0x50 = 80)
        if (record.tagId === 0x50) {
          paraHeaderCount++;
          var text = '';

          // Check if next record is PARA_TEXT
          if (i + 1 < records.length && records[i + 1].tagId === 0x51) {
            text = this._parseParaText(records[i + 1].data);
            console.log("[HWPViewerWindow] Found PARA_HEADER + PARA_TEXT pair, text length:", text.length);
          } else {
            console.log("[HWPViewerWindow] Found PARA_HEADER without PARA_TEXT");
          }

          if (text.trim().length > 0) {
            paragraphs.push({
              text: text
            });
            console.log("[HWPViewerWindow] Added paragraph:", text.substring(0, 50) + "...");
          }
        }
        // PARA_TEXT (0x51 = 81) standalone
        else if (record.tagId === 0x51) {
          paraTextCount++;
          var text = this._parseParaText(record.data);

          if (text.trim().length > 0) {
            paragraphs.push({
              text: text
            });
            console.log("[HWPViewerWindow] Found standalone PARA_TEXT, length:", text.length, "text:", text.substring(0, 50) + "...");
          }
        }
      }

      console.log("[HWPViewerWindow] Extraction summary:");
      console.log("[HWPViewerWindow] - PARA_HEADER (0x50) found:", paraHeaderCount);
      console.log("[HWPViewerWindow] - PARA_TEXT (0x51) found:", paraTextCount);
      console.log("[HWPViewerWindow] - Total paragraphs extracted:", paragraphs.length);

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

        // ViewText record structure (from reference):
        // Bytes 0-3: Record header (already parsed)
        // After header: text data in UTF-16LE

        // Skip first 4 bytes if they look like a header
        var offset = 0;

        // Try different offsets to find the text
        var possibleOffsets = [0, 4, 8, 12, 16];

        for (var k = 0; k < possibleOffsets.length; k++) {
          offset = possibleOffsets[k];

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
                console.log("[HWPViewerWindow] ✅ Found text at offset", offset);
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
      var text = new TextDecoder('utf-16le').decode(data);
      return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
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

        // Section header
        var sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = 'color: #666; font-size: 0.9rem; padding: 10px 0; border-bottom: 1px solid #ddd; margin-bottom: 15px;';
        sectionHeader.textContent = 'Page ' + (idx + 1);
        wrapper.appendChild(sectionHeader);

        // Paragraphs
        section.paragraphs.forEach(function(para) {
          var p = document.createElement('p');
          p.style.cssText = 'margin: 0 0 12px 0; line-height: 1.8; text-align: justify;';
          p.textContent = para.text || '';
          wrapper.appendChild(p);
        });

        // Page break
        if (idx < sections.length - 1) {
          var pageBreak = document.createElement('hr');
          pageBreak.style.cssText = 'border: none; border-top: 2px dashed #ccc; margin: 30px 0;';
          wrapper.appendChild(pageBreak);
        }
      });

      container.appendChild(wrapper);

      // Update page navigation
      this.__totalPages = sections.length;
      this._updatePageNavigation();
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
