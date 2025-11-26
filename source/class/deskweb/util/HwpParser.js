/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * HWP Parser Module
 *
 * A standalone module for parsing HWP (Hangul Word Processor) files.
 * Returns structured data object that can be used by any renderer.
 *
 * Features:
 * - Parse CFB (Compound File Binary) structure
 * - Extract FileHeader, DocInfo, PrvText
 * - Parse sections (BodyText/ViewText)
 * - Extract paragraphs, tables, and styles
 *
 * Usage:
 *   var parser = deskweb.util.HwpParser.getInstance();
 *   var result = parser.parse(uint8Array);
 *   // result contains: { header, docInfo, sections, prvText }
 */
qx.Class.define("deskweb.util.HwpParser",
{
  extend : qx.core.Object,
  type : "singleton",

  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  construct : function()
  {
    this.base(arguments);
    console.log("[HwpParser] Initialized");
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    /**
     * Parse HWP file and return structured data
     * @param {Uint8Array} uint8Array - The HWP file data
     * @return {Object|null} Parsed HWP data or null if parsing fails
     */
    parse: function(uint8Array) {
      try {
        console.log("[HwpParser] Parsing HWP file...");

        // Check if libraries are loaded
        if (typeof window.CFB === "undefined" || typeof window.pako === "undefined") {
          console.error("[HwpParser] Libraries not loaded (CFB or pako)");
          return null;
        }

        // Parse CFB structure
        var cfb = window.CFB.read(uint8Array, { type: 'array' });
        console.log("[HwpParser] CFB structure parsed");

        // Parse FileHeader
        var fileHeader = this._parseFileHeader(cfb);
        console.log("[HwpParser] FileHeader parsed:", fileHeader);

        // Parse PrvText (preview text)
        var prvText = this._parsePrvText(cfb);
        if (prvText) {
          console.log("[HwpParser] PrvText parsed:", prvText.length, "characters");
        }

        // Parse DocInfo
        var docInfo = this._parseDocInfo(cfb, fileHeader);
        console.log("[HwpParser] DocInfo parsed");

        // Parse sections
        var sections = this._parseSections(cfb, fileHeader, docInfo);
        console.log("[HwpParser] Parsed", sections.length, "sections");

        return {
          header: fileHeader,
          docInfo: docInfo,
          sections: sections,
          prvText: prvText
        };
      } catch (error) {
        console.error("[HwpParser] Error parsing HWP:", error);
        return null;
      }
    },

    /**
     * Parse FileHeader
     * @private
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
     * Parse PrvText (preview text)
     * @private
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
        console.error("[HwpParser] Error parsing PrvText:", error);
        return null;
      }
    },

    /**
     * Parse DocInfo
     * @private
     */
    _parseDocInfo: function(cfb, fileHeader) {
      var data = this._readCFBStream(cfb, 'DocInfo');
      if (!data) {
        return null;
      }

      var records = this._parseRecords(data, fileHeader.flags.compressed);
      console.log("[HwpParser] DocInfo records:", records.length);

      // Debug: log first 30 record tagIds
      console.log("[HwpParser] DocInfo first 30 record tagIds:");
      for (var dbg = 0; dbg < Math.min(30, records.length); dbg++) {
        console.log("[HwpParser]   Record[" + dbg + "]: tagId=" + records[dbg].tagId + " (0x" + records[dbg].tagId.toString(16) + "), size=" + records[dbg].data.length);
      }

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

      console.log("[HwpParser] Parsed", paraShapes.length, "paragraph shapes and", charShapes.length, "character shapes");

      // Debug: log all charShapes with their colors
      console.log("[HwpParser] CharShape colors:");
      for (var ci = 0; ci < charShapes.length; ci++) {
        var cs = charShapes[ci];
        console.log("[HwpParser]   CharShape[" + ci + "]: color=" + cs.color + ", bold=" + cs.bold + ", italic=" + cs.italic);
      }

      return {
        records: records,
        paraShapes: paraShapes,
        charShapes: charShapes
      };
    },

    /**
     * Parse sections
     * @private
     */
    _parseSections: function(cfb, fileHeader, docInfo) {
      var sections = [];

      console.log("[HwpParser] ===== Parsing Sections =====");
      console.log("[HwpParser] File compressed flag:", fileHeader.flags.compressed);

      for (var i = 0; i < 10; i++) {
        var data = this._readSection(cfb, i);
        if (!data) {
          if (i === 0) {
            console.error("[HwpParser] Section0 not found");
          } else {
            console.log("[HwpParser] No more sections after Section" + (i-1));
          }
          break;
        }

        console.log("[HwpParser] --- Section" + i + " ---");
        console.log("[HwpParser] Raw size:", data.length, "bytes");
        console.log("[HwpParser] First 16 bytes:", Array.from(data.slice(0, 16)).map(function(b) { return "0x" + b.toString(16).padStart(2, '0'); }).join(' '));

        // Check if ViewText (uncompressed) or BodyText (compressed)
        var firstByte = data[0];
        var isViewText = firstByte === 0x1c;
        var isCompressed = !isViewText && fileHeader.flags.compressed;

        console.log("[HwpParser] First byte:", "0x" + firstByte.toString(16).padStart(2, '0'));
        console.log("[HwpParser] Is ViewText:", isViewText);
        console.log("[HwpParser] Is Compressed:", isCompressed);

        var records = this._parseRecords(data, isCompressed);
        var paragraphs = this._extractParagraphs(records, docInfo);

        console.log("[HwpParser] Section" + i + " parsed:", records.length, "records,", paragraphs.length, "paragraphs");

        // Log record type statistics
        var recordTypes = {};
        records.forEach(function(r) {
          var key = "0x" + r.tagId.toString(16).padStart(2, '0');
          recordTypes[key] = (recordTypes[key] || 0) + 1;
        });
        console.log("[HwpParser] Record types:", JSON.stringify(recordTypes));

        sections.push({
          index: i,
          records: records,
          paragraphs: paragraphs,
          isViewText: isViewText
        });
      }

      console.log("[HwpParser] ===== Total sections parsed:", sections.length, "=====");

      return sections;
    },

    /**
     * Parse records from data
     * @private
     */
    _parseRecords: function(data, isCompressed) {
      console.log("[HwpParser] Parsing records, compressed:", isCompressed, "size:", data.length);

      // Step 1: Decompress entire stream if compressed
      if (isCompressed && data.length > 0) {
        try {
          console.log("[HwpParser] Attempting stream decompression with pako.inflateRaw...");
          var decompressed = window.pako.inflateRaw(data);
          console.log("[HwpParser] Stream decompressed:", data.length, "->", decompressed.length, "bytes (ratio:", (decompressed.length / data.length).toFixed(2) + "x)");
          data = decompressed;
        } catch (e) {
          console.error("[HwpParser] Decompression failed:", e.message);
          console.log("[HwpParser] Trying pako.inflate instead of inflateRaw...");
          try {
            var decompressed2 = window.pako.inflate(data);
            console.log("[HwpParser] pako.inflate succeeded:", data.length, "->", decompressed2.length, "bytes");
            data = decompressed2;
          } catch (e2) {
            console.error("[HwpParser] pako.inflate also failed:", e2.message);
            console.warn("[HwpParser] Using raw data without decompression");
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
          console.error("[HwpParser] Record parsing error:", error);
          break;
        }
      }

      return records;
    },

    /**
     * Extract paragraphs and tables from records
     * @private
     */
    _extractParagraphs: function(records, docInfo) {
      var paragraphs = [];
      var self = this;

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
          console.log("[EXTRACT-DEBUG] At index", i, "tagId=0x" + record.tagId.toString(16),
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
                  console.log("[EXTRACT] Found outside text from table:", table.outsideText.trim());
                  console.log("[EXTRACT] Outside text paraShapeId:", table.outsideParaShapeId);
                  paragraphs.push({
                    type: 'paragraph',
                    text: table.outsideText.trim(),
                    paraShapeId: table.outsideParaShapeId,
                    recordIndex: table.outsideTextIndex || -1,
                    afterSkipIndex: table.lastRecordIndex || -1,
                    wasSkipped: false,
                    _source: 'table_outside_text'
                  });
                  console.log("[EXTRACT] Added outside text as paragraph, paragraphs count now:", paragraphs.length);
                }

                // Skip all records that belong to this table, INCLUDING the TABLE record itself
                if (table.lastRecordIndex) {
                  if (table.outsideTextIndex && table.outsideText) {
                    skipUntilIndex = table.outsideTextIndex;
                    console.log("[EXTRACT] Table has outsideText, skipping to outsideTextIndex:", skipUntilIndex);
                  } else {
                    skipUntilIndex = table.lastRecordIndex;
                    console.log("[EXTRACT] Skipping records from", i, "to", skipUntilIndex);
                  }
                } else {
                  skipUntilIndex = i + 1;
                  console.log("[EXTRACT] No lastRecordIndex, skipping to", skipUntilIndex);
                }
              }
            } else {
              console.log("[EXTRACT] CTRL_HEADER not followed by TABLE, skipping this CTRL_HEADER");
            }
          }
        }
        // HWPTAG_TABLE standalone (might occur without CTRL_HEADER)
        else if (record.tagId === 0x4D || record.tagId === 77) {
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

              if (table.outsideText && table.outsideText.trim().length > 0) {
                console.log("[EXTRACT] Found outside text from table:", table.outsideText.trim());
                paragraphs.push({
                  type: 'paragraph',
                  text: table.outsideText.trim(),
                  paraShapeId: table.outsideParaShapeId,
                  recordIndex: table.outsideTextIndex || -1,
                  _source: 'table_outside_text'
                });
              }

              if (table.lastRecordIndex) {
                if (table.outsideTextIndex && table.outsideText) {
                  skipUntilIndex = table.outsideTextIndex;
                } else {
                  skipUntilIndex = table.lastRecordIndex;
                }
                console.log("[EXTRACT] Skipping records until index", skipUntilIndex);
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
          for (var j = i + 1; j < Math.min(i + 5, records.length); j++) {
            var nextRec = records[j];

            if (nextRec.tagId === 0x42 || nextRec.tagId === 66) {
              console.log("[PARA] Stopping look-ahead at index", j, "- found next PARA_HEADER");
              break;
            }

            if (nextRec.tagId === 0x43 || nextRec.tagId === 67) {
              if (text.length === 0) {
                text = this._parseParaText(nextRec.data);
                console.log("[PARA] Found PARA_TEXT at index", j, "- text length:", text.length);
                console.log("[PARA] Text preview (first 100 chars):", text.substring(0, 100));
              } else {
                console.log("[PARA] Skipping duplicate PARA_TEXT at index", j, "- already have text");
              }
            } else if (nextRec.tagId === 0x44 || nextRec.tagId === 68) {
              charShapeIds = this._parseParaCharShape(nextRec.data);
              console.log("[PARA] Found PARA_CHAR_SHAPE at index", j);
            }
          }

          if (text.trim().length > 0) {
            var cleanText = text.trim();

            var printableCount = 0;
            var totalChars = cleanText.length;

            for (var k = 0; k < totalChars; k++) {
              var code = cleanText.charCodeAt(k);
              if ((code >= 0xAC00 && code <= 0xD7AF) ||
                  (code >= 0x20 && code <= 0x7E) ||
                  (code >= 0x3000 && code <= 0x9FFF)) {
                printableCount++;
              }
            }
            var printableRatio = totalChars > 0 ? printableCount / totalChars : 0;

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
              console.log("[PARA] SKIPPING garbage paragraph (" + skipReason + "):", cleanText,
                         "char codes:", Array.from(cleanText).map(function(c) { return '0x' + c.charCodeAt(0).toString(16); }).join(' '));
            } else {
              console.log("[PARA] ADDING paragraph to output at position", paragraphs.length);
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
            console.log("[PARA] SKIPPING paragraph (empty text)");
          }
          console.log("[PARA] ========================================");
        }
      }

      console.log("[HwpParser] Extraction summary:");
      console.log("[HwpParser] - PARA_HEADER (0x50) found:", paraHeaderCount);
      console.log("[HwpParser] - PARA_TEXT (0x51) found:", paraTextCount);
      console.log("[HwpParser] - TABLE (0x3D) found:", tableCount);
      console.log("[HwpParser] - Total items extracted:", paragraphs.length);

      // If no paragraphs found, try alternative extraction
      if (paragraphs.length === 0) {
        console.warn("[HwpParser] No PARA_TEXT records found, trying alternative extraction...");
        paragraphs = this._extractParagraphsAlternative(records);
      }

      return paragraphs;
    },

    /**
     * Alternative paragraph extraction (heuristic approach)
     * @private
     */
    _extractParagraphsAlternative: function(records) {
      var paragraphs = [];

      console.log("[HwpParser] Alternative extraction: trying to decode any record as text...");

      for (var i = 0; i < records.length; i++) {
        var record = records[i];

        // Special handling for 0x1c (ViewText header)
        if (record.tagId === 0x1c) {
          console.log("[HwpParser] Found 0x1c record (ViewText), size:", record.data.length);

          var text = this._parseViewTextRecord(record.data);
          if (text && text.length > 0) {
            paragraphs.push({
              type: 'paragraph',
              text: text,
              tagId: "0x1c (ViewText)"
            });
            console.log("[HwpParser] Extracted text from 0x1c record, length:", text.length, "preview:", text.substring(0, 50) + "...");
            continue;
          } else {
            console.log("[HwpParser] 0x1c record too small or no text, trying as regular record");
          }
        }

        // Skip very small records (likely not text)
        if (record.data.length < 10) continue;

        try {
          var text = new TextDecoder('utf-16le').decode(record.data);

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
          var threshold = (record.tagId === 0x1c || record.tagId >= 0x100) ? 0.3 : 0.6;

          if (ratio >= threshold && text.trim().length >= 10) {
            var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
            var meaningfulLength = cleaned.replace(/[^\w가-힣]/g, '').length;

            if (meaningfulLength >= 5) {
              paragraphs.push({
                type: 'paragraph',
                text: cleaned,
                tagId: "0x" + record.tagId.toString(16) + " (heuristic)"
              });

              console.log("[HwpParser] Found text in record 0x" + record.tagId.toString(16).padStart(2, '0') + ", ratio:", ratio.toFixed(2), "meaningful:", meaningfulLength, "text:", cleaned.substring(0, 50) + "...");
            }
          }
        } catch (e) {
          // Skip records that can't be decoded
        }
      }

      console.log("[HwpParser] Alternative extraction found:", paragraphs.length, "text blocks");

      return paragraphs;
    },

    /**
     * Parse ViewText (0x1c) record
     * @private
     */
    _parseViewTextRecord: function(data) {
      try {
        console.log("[HwpParser] Parsing ViewText record, size:", data.length);
        console.log("[HwpParser] First 32 bytes:", Array.from(data.slice(0, 32)).map(function(b) { return "0x" + b.toString(16).padStart(2, '0'); }).join(' '));

        var decompressed = null;

        try {
          console.log("[HwpParser] Attempting to decompress 0x1c record data...");
          decompressed = window.pako.inflateRaw(data);
          console.log("[HwpParser] 0x1c record decompressed:", data.length, "->", decompressed.length, "bytes");
          data = decompressed;
        } catch (e1) {
          console.log("[HwpParser] inflateRaw failed, trying inflate:", e1.message);
          try {
            decompressed = window.pako.inflate(data);
            console.log("[HwpParser] 0x1c record decompressed with inflate:", data.length, "->", decompressed.length, "bytes");
            data = decompressed;
          } catch (e2) {
            console.log("[HwpParser] Decompression failed, trying as uncompressed:", e2.message);
          }
        }

        var possibleOffsets = [0, 4, 8, 12, 16];

        for (var k = 0; k < possibleOffsets.length; k++) {
          var offset = possibleOffsets[k];

          if (offset >= data.length) continue;

          try {
            var textData = data.slice(offset);
            var text = new TextDecoder('utf-16le').decode(textData);

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
            console.log("[HwpParser] Trying offset", offset, "printable ratio:", ratio.toFixed(2));

            if (ratio >= 0.5) {
              var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
              if (cleaned.length > 10) {
                console.log("[HwpParser] Found text at offset", offset, "length:", cleaned.length);
                return cleaned;
              }
            }
          } catch (e) {
            // Try next offset
          }
        }

        console.log("[HwpParser] Could not find text in ViewText record");
        return null;

      } catch (error) {
        console.error("[HwpParser] Error parsing ViewText record:", error);
        return null;
      }
    },

    /**
     * Parse paragraph text
     * @private
     */
    _parseParaText: function(data) {
      try {
        var text = new TextDecoder('utf-16le').decode(data);

        if (/[\u6300-\u7FFF]/.test(text)) {
          console.log("[PARA_TEXT] Before cleaning:", text.substring(0, 50));
          console.log("[PARA_TEXT] Char codes:", Array.from(text.substring(0, 20)).map(function(c) {
            return c + "(0x" + c.charCodeAt(0).toString(16) + ")";
          }).join(" "));
        }

        var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        cleaned = cleaned.replace(/[\u6100-\u7FFF]+/g, '');
        cleaned = cleaned.replace(/^[\u4E00-\u9FFF]+(?=[\uAC00-\uD7AF])/g, '');
        cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
        cleaned = cleaned.replace(/[\uFFF0-\uFFFF]/g, '');

        var printableCount = 0;
        var totalCount = cleaned.length;

        for (var i = 0; i < cleaned.length; i++) {
          var code = cleaned.charCodeAt(i);
          if ((code >= 0xAC00 && code <= 0xD7AF) ||
              (code >= 0x20 && code <= 0x7E) ||
              (code >= 0x3000 && code <= 0x9FFF) ||
              code === 0x20 || code === 0x0A) {
            printableCount++;
          }
        }

        var ratio = totalCount > 0 ? printableCount / totalCount : 0;

        if (ratio < 0.5 && totalCount > 0) {
          console.warn("[HwpParser] Low printable ratio:", ratio.toFixed(2), "for text:", cleaned.substring(0, 50));
          console.warn("[HwpParser] Data length:", data.length, "First 20 bytes:",
                       Array.from(data.slice(0, 20)).map(function(b) { return '0x' + b.toString(16).padStart(2, '0'); }).join(' '));
        }

        return cleaned;
      } catch (e) {
        console.error("[HwpParser] Error decoding PARA_TEXT:", e);
        console.error("[HwpParser] Data length:", data.length, "First bytes:",
                     Array.from(data.slice(0, Math.min(20, data.length))).map(function(b) { return '0x' + b.toString(16).padStart(2, '0'); }).join(' '));
        return '';
      }
    },

    /**
     * Parse PARA_HEADER to extract style IDs
     * @private
     */
    _parseParaHeader: function(data) {
      try {
        if (data.length < 22) {
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;

        offset += 4; // nchars
        offset += 4; // control mask
        var paraShapeId = view.getUint16(offset, true); offset += 2;

        return {
          paraShapeId: paraShapeId
        };
      } catch (e) {
        console.error("[HwpParser] Error parsing PARA_HEADER:", e);
        return null;
      }
    },

    /**
     * Parse PARA_CHAR_SHAPE to extract character shape IDs
     * @private
     */
    _parseParaCharShape: function(data) {
      try {
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
        console.error("[HwpParser] Error parsing PARA_CHAR_SHAPE:", e);
        return [];
      }
    },

    /**
     * Parse table structure
     * @private
     */
    _parseTable: function(data, allRecords, currentIndex) {
      try {
        console.log("[TABLE-PARSE] ========================================");
        console.log("[TABLE-PARSE] Parsing table, data size:", data.length);
        console.log("[TABLE-PARSE] First 32 bytes:", Array.from(data.slice(0, Math.min(32, data.length))).map(function(b) { return "0x" + b.toString(16).padStart(2, '0'); }).join(' '));

        if (data.length < 22) {
          console.warn("[TABLE-PARSE] Table data too small");
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var offset = 0;
        var self = this;

        // Try to find table dimensions by scanning possible offsets
        var found = false;
        for (var tryOffset = 0; tryOffset < Math.min(100, data.length - 22); tryOffset += 4) {
          offset = tryOffset;

          try {
            var props = view.getUint32(offset, true); offset += 4;
            var rows = view.getUint16(offset, true); offset += 2;
            var cols = view.getUint16(offset, true); offset += 2;

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

              var cellCount = 0;
              var currentCell = null;
              var lastProcessedIndex = currentIndex;
              var totalGridPositions = rows * cols;
              var gridPositionsFilled = 0;
              var tableComplete = false;

              var occupiedGrid = [];
              for (var gr = 0; gr < rows; gr++) {
                occupiedGrid[gr] = [];
                for (var gc = 0; gc < cols; gc++) {
                  occupiedGrid[gr][gc] = false;
                }
              }

              var findNextEmptyPos = function() {
                for (var r = 0; r < rows; r++) {
                  for (var c = 0; c < cols; c++) {
                    if (!occupiedGrid[r][c]) {
                      return { row: r, col: c };
                    }
                  }
                }
                return null;
              };

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

                // LIST_HEADER (0x48 = 72)
                if (rec.tagId === 0x48 || rec.tagId === 72) {
                  if (currentCell !== null) {
                    console.log("[TABLE-CELL] Saving cell", cellCount, "at (" + currentCell.row + "," + currentCell.col + ")",
                               "span(" + currentCell.rowSpan + "x" + currentCell.colSpan + "), text:", currentCell.text.substring(0, 30),
                               "| Grid filled:", gridPositionsFilled, "/", totalGridPositions);
                    table.cells.push(currentCell);
                    currentCell = null;

                    if (isGridComplete()) {
                      console.log("[TABLE-CELL] Grid COMPLETE after saving cell! Stopping at index", j);
                      table.lastRecordIndex = j - 1;
                      tableComplete = true;
                      break;
                    }
                  }

                  if (isGridComplete()) {
                    console.log("[TABLE-CELL] Grid is COMPLETE! Stopping at index", j);
                    table.lastRecordIndex = j - 1;
                    tableComplete = true;
                    break;
                  }

                  var nextEmpty = findNextEmptyPos();
                  if (!nextEmpty) {
                    console.log("[TABLE-CELL] No empty grid position available, table is full!");
                    table.lastRecordIndex = j - 1;
                    tableComplete = true;
                    break;
                  }

                  console.log("[TABLE-CELL] ----------------------------------------");
                  console.log("[TABLE-CELL] Found LIST_HEADER (cell", cellCount + 1, ") at index", j);
                  console.log("[TABLE-CELL] Next empty grid position:", nextEmpty.row, ",", nextEmpty.col);

                  var cellCol = nextEmpty.col;
                  var cellRow = nextEmpty.row;
                  var colSpan = 1;
                  var rowSpan = 1;

                  if (rec.data && rec.data.length >= 14) {
                    try {
                      var cellView = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);

                      console.log("[TABLE-CELL] Raw LIST_HEADER data (" + rec.data.length + " bytes):",
                                 Array.from(rec.data.slice(0, Math.min(32, rec.data.length)))
                                 .map(function(b) { return "0x" + b.toString(16).padStart(2, '0'); }).join(' '));

                      var cellAttrOffset = 6;

                      if (cellAttrOffset + 8 <= rec.data.length) {
                        var hwpCol = cellView.getUint16(cellAttrOffset, true);
                        var hwpRow = cellView.getUint16(cellAttrOffset + 2, true);
                        var hwpColSpan = cellView.getUint16(cellAttrOffset + 4, true);
                        var hwpRowSpan = cellView.getUint16(cellAttrOffset + 6, true);

                        var parsedCol = hwpRow;
                        var parsedRow = hwpColSpan;
                        var parsedColSpan = hwpRowSpan >= 1 ? hwpRowSpan : 1;
                        var parsedRowSpan = 1;

                        console.log("[TABLE-CELL] Raw HWP data: hwpCol=" + hwpCol + ", hwpRow=" + hwpRow +
                                   ", hwpColSpan=" + hwpColSpan + ", hwpRowSpan=" + hwpRowSpan);
                        console.log("[TABLE-CELL] NEW mapping: col=" + parsedCol + ", row=" + parsedRow +
                                   ", colSpan=" + parsedColSpan + ", rowSpan=" + parsedRowSpan);

                        var isValidPos = (parsedCol >= 0 && parsedCol < cols &&
                                         parsedRow >= 0 && parsedRow < rows);

                        var isOccupied = isValidPos && occupiedGrid[parsedRow] && occupiedGrid[parsedRow][parsedCol];
                        console.log("[TABLE-CELL] isOccupied check: parsedRow=" + parsedRow + ", parsedCol=" + parsedCol +
                                   ", gridValue=" + (occupiedGrid[parsedRow] ? occupiedGrid[parsedRow][parsedCol] : "N/A") +
                                   ", isOccupied=" + isOccupied);

                        var isValidSpan = (parsedColSpan <= cols && parsedRowSpan <= rows);

                        if (isValidPos && !isOccupied) {
                          cellCol = parsedCol;
                          cellRow = parsedRow;
                          console.log("[TABLE-CELL] Using PARSED position (row=" + cellRow + ", col=" + cellCol + ")");

                          if (isValidSpan) {
                            colSpan = parsedColSpan;
                            rowSpan = parsedRowSpan;
                          }
                        } else if (isValidPos && isOccupied) {
                          console.log("[TABLE-CELL] Parsed position (" + parsedRow + "," + parsedCol + ") is OCCUPIED");

                          var existingCell = null;
                          for (var ec = 0; ec < table.cells.length; ec++) {
                            if (table.cells[ec].row === parsedRow && table.cells[ec].col === parsedCol) {
                              existingCell = table.cells[ec];
                              break;
                            }
                          }

                          if (existingCell) {
                            console.log("[TABLE-CELL] Found existing cell at (" + parsedRow + "," + parsedCol + "), will append text to it");
                            currentCell = existingCell;
                            table.cells.splice(table.cells.indexOf(existingCell), 1);
                            cellCount--;
                            lastProcessedIndex = j;
                            continue;
                          } else {
                            console.log("[TABLE-CELL] No existing cell found, using sequential (row=" + cellRow + ", col=" + cellCol + ")");
                          }
                        } else {
                          console.log("[TABLE-CELL] Parsed position out of range (col=" + parsedCol + " >= cols=" + cols +
                                     " or row=" + parsedRow + " >= rows=" + rows + "), using sequential (row=" + cellRow + ", col=" + cellCol + ")");
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
                    text: '',
                    charShapeIds: []
                  };

                  var immediateGridSize = markOccupied(cellRow, cellCol, rowSpan, colSpan);
                  gridPositionsFilled += immediateGridSize;
                  console.log("[TABLE-CELL] Marked position (" + cellRow + "," + cellCol + ") as occupied IMMEDIATELY",
                             "| Grid filled:", gridPositionsFilled, "/", totalGridPositions);

                  cellCount++;
                  lastProcessedIndex = j;
                }
                // PARA_HEADER inside a cell
                else if ((rec.tagId === 0x42 || rec.tagId === 66) && currentCell !== null) {
                  var cellParaHeader = this._parseParaHeader(rec.data);
                  if (cellParaHeader) {
                    currentCell.lastParaShapeId = cellParaHeader.paraShapeId;
                  }
                  lastProcessedIndex = j;
                }
                // PARA_TEXT - add text to current cell
                else if ((rec.tagId === 0x43 || rec.tagId === 67) && currentCell !== null) {
                  var cellText = this._parseParaText(rec.data);

                  console.log("[TABLE-TEXT] PARA_TEXT at index", j, "for cell", cellCount);
                  console.log("[TABLE-TEXT] Text:", cellText.substring(0, 60) + (cellText.length > 60 ? "..." : ""));

                  var isHeading = /^\d+\.\s+[가-힣\s]+\s*(사항)?$/.test(cellText.trim());
                  var isSignature = /상기\s*기재\s*사항|지원자|년\s*\d+\s*월\s*\d+\s*일|\(인\)/.test(cellText.trim());

                  if (isHeading || isSignature) {
                    console.log("[TABLE-TEXT] Detected heading/signature text:", cellText.trim());

                    var gridFillRatio = gridPositionsFilled / totalGridPositions;
                    console.log("[TABLE-TEXT] Current grid fill ratio:", gridFillRatio.toFixed(2), "cells so far:", table.cells.length);

                    if (table.cells.length >= 1 && currentCell.text.trim().length === 0 && gridFillRatio >= 0.7) {
                      console.log("[TABLE-TEXT] Treating as OUTSIDE text (grid >= 70% full)");

                      var outsideParaShapeId = currentCell.lastParaShapeId;
                      console.log("[TABLE-TEXT] Outside text paraShapeId:", outsideParaShapeId);

                      if (currentCell.text.trim().length > 0) {
                        table.cells.push(currentCell);
                      }
                      currentCell = null;

                      table.outsideText = cellText.trim();
                      table.outsideTextIndex = j;
                      table.outsideParaShapeId = outsideParaShapeId;
                      table.lastRecordIndex = j;
                      tableComplete = true;
                      break;
                    } else {
                      console.log("[TABLE-TEXT] Grid not full enough or cell has content, treating as cell content");
                    }
                  }

                  if (currentCell.text.length > 0) {
                    currentCell.text += '\n';
                  }
                  currentCell.text += cellText.trim();
                  lastProcessedIndex = j;
                }
                // PARA_TEXT outside cell context
                else if ((rec.tagId === 0x43 || rec.tagId === 67) && currentCell === null) {
                  var outsideText = this._parseParaText(rec.data);
                  console.log("[TABLE-TEXT] PARA_TEXT OUTSIDE cell at index", j, ":", outsideText.substring(0, 50));
                  console.log("[TABLE-TEXT] Grid state: filled", gridPositionsFilled, "/", totalGridPositions, "(" + (gridPositionsFilled/totalGridPositions*100).toFixed(1) + "%), cells:", table.cells.length);

                  if (table.cells.length >= 1 && gridPositionsFilled >= Math.floor(totalGridPositions * 0.5)) {
                    console.log("[TABLE-TEXT] Grid is >= 50% full, treating as table end");
                    table.outsideText = outsideText;
                    table.outsideTextIndex = j;
                    table.lastRecordIndex = j;
                    tableComplete = true;
                    break;
                  } else {
                    console.log("[TABLE-TEXT] Grid is < 50% full (" + (gridPositionsFilled/totalGridPositions*100).toFixed(1) + "%), continuing to look for more cells");
                  }
                }
                // PARA_CHAR_SHAPE inside cell
                else if ((rec.tagId === 0x44 || rec.tagId === 68) && currentCell !== null) {
                  var cellCharShapeIds = this._parseParaCharShape(rec.data);
                  if (cellCharShapeIds && cellCharShapeIds.length > 0) {
                    currentCell.charShapeIds = currentCell.charShapeIds.concat(cellCharShapeIds);
                    console.log("[TABLE-CELL] Parsed PARA_CHAR_SHAPE for cell:", cellCharShapeIds.length, "entries");
                  }
                  lastProcessedIndex = j;
                }
                // PARA_LINE_SEG inside cell
                else if ((rec.tagId === 0x45 || rec.tagId === 69) && currentCell !== null) {
                  lastProcessedIndex = j;
                }
                // CTRL_HEADER or TABLE - another structure
                else if ((rec.tagId === 0x47 || rec.tagId === 71) || (rec.tagId === 0x4D || rec.tagId === 77)) {
                  if (j > currentIndex + 5) {
                    console.log("[TABLE-END] Found CTRL_HEADER/TABLE at index", j, "- stopping table parsing");

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

              // Save last cell if exists
              if (currentCell !== null) {
                console.log("[TABLE-END] Saving final cell", cellCount, "with text:", currentCell.text.substring(0, 30));
                table.cells.push(currentCell);
              }

              if (!table.lastRecordIndex) {
                table.lastRecordIndex = lastProcessedIndex;
              }

              console.log("[TABLE-SUMMARY] ========================================");
              console.log("[TABLE-SUMMARY] Extracted", table.cells.length, "cells for", rows, "x", cols, "table");
              console.log("[TABLE-SUMMARY] Grid positions filled:", gridPositionsFilled, "/", totalGridPositions);
              console.log("[TABLE-SUMMARY] Last record index:", table.lastRecordIndex);
              console.log("[TABLE-SUMMARY] ========================================");

              found = true;
              return table;
            }
          } catch (e) {
            // Try next offset
          }
        }

        if (!found) {
          console.warn("[HwpParser] Could not find valid table structure");
        }

        return null;

      } catch (error) {
        console.error("[HwpParser] Error parsing table:", error);
        return null;
      }
    },

    /**
     * Read CFB stream
     * @private
     */
    _readCFBStream: function(cfb, streamName) {
      try {
        var entry = window.CFB.find(cfb, streamName);
        if (!entry) return null;
        return new Uint8Array(entry.content);
      } catch (error) {
        console.error("[HwpParser] Error reading stream", streamName, ":", error);
        return null;
      }
    },

    /**
     * Read section from CFB
     * @private
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
     * Parse PARA_SHAPE from DocInfo
     * @private
     */
    _parseParaShape: function(data) {
      try {
        if (data.length < 54) {
          console.warn("[HwpParser] PARA_SHAPE data too small:", data.length);
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
        console.error("[HwpParser] Error parsing PARA_SHAPE:", e);
        return null;
      }
    },

    /**
     * Parse CHAR_SHAPE from DocInfo
     * @private
     */
    _parseCharShape: function(data) {
      try {
        if (data.length < 68) {
          console.warn("[HwpParser] CHAR_SHAPE data too small:", data.length);
          return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        var offset = 0;
        offset += 14;  // FaceNameID[7]
        offset += 7;   // FontRatio[7]
        offset += 7;   // FontSpacing[7]
        offset += 7;   // FontRelativeSize[7]
        offset += 7;   // FontPosition[7]

        var baseSize = view.getInt32(offset, true); offset += 4;
        var attr = view.getUint32(offset, true); offset += 4;
        offset += 2;  // ShadowGap1 + ShadowGap2

        var textColor = view.getUint32(offset, true); offset += 4;
        var underlineColor = view.getUint32(offset, true); offset += 4;
        var shadeColor = view.getUint32(offset, true); offset += 4;
        var shadowColor = view.getUint32(offset, true); offset += 4;

        var italic = !!(attr & 0x01);
        var bold = !!(attr & 0x02);

        var r = textColor & 0xFF;
        var g = (textColor >> 8) & 0xFF;
        var b = (textColor >> 16) & 0xFF;
        var color = 'rgb(' + r + ',' + g + ',' + b + ')';

        if (r > 0 || g > 0 || b > 0) {
          console.log("[CHAR_SHAPE] Found non-black color:", color, "textColor raw:", "0x" + textColor.toString(16));
        }

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
        console.error("[HwpParser] Error parsing CHAR_SHAPE:", e);
        return null;
      }
    }
  }
});
