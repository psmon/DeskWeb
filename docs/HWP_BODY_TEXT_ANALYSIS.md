# HWP 5.0 Body Text Parsing Analysis

## Executive Summary

Based on the HWP 5.0 specification (한글문서파일형식_5.0_revision1.3.pdf), this document provides a detailed analysis of the body text parsing implementation and recommendations for improvement.

## Current Implementation Status

The current `HWPViewerWindow.js` implementation correctly implements:
- ✅ CFB (Compound File Binary) parsing
- ✅ FileHeader parsing
- ✅ PrvText extraction (Preview mode working)
- ✅ Stream decompression using pako.inflateRaw
- ✅ Record structure parsing (header: tagId, level, size)
- ✅ PARA_HEADER (0x50) and PARA_TEXT (0x51) detection
- ✅ UTF-16LE text decoding

## Specification Key Points

### 1. File Structure (from spec page 12)

```
HWP File (CFB format)
├── FileHeader (file signature, version, flags)
├── DocInfo (document metadata, styles, fonts)
├── BodyText/
│   ├── Section0 (compressed/uncompressed)
│   ├── Section1
│   └── ...
└── PrvText (preview text, UTF-16LE, uncompressed)
```

### 2. Compression (from FileHeader flags)

- **Bit 0 of flags**: Compressed flag
- If set, BodyText sections are compressed with DEFLATE (zlib)
- Must use `pako.inflateRaw()` or `pako.inflate()` to decompress
- **Important**: Entire section stream is compressed, not individual records

### 3. Record Structure (spec page 21)

```
Record Header (32 bits):
┌──────────┬────────┬────────┐
│ Tag ID   │ Level  │  Size  │
│ 10 bits  │10 bits │12 bits │
└──────────┴────────┴────────┘

If Size == 0xFFF (4095):
  Additional 32-bit size follows
```

**Tag IDs**:
- `0x50` (80): PARA_HEADER
- `0x51` (81): PARA_TEXT
- `0x52` (82): PARA_CHAR_SHAPE
- `0x53` (83): PARA_LINE_SEG

### 4. PARA_TEXT Structure (spec page 34, table 60)

```
HWPTAG_PARA_TEXT (0x51)
┌─────────────────────────────────┐
│ WCHAR array[nchars]             │
│ (UTF-16LE encoded text)         │
│ Length: 2 × nchars bytes        │
└─────────────────────────────────┘
```

**Important**:
- PARA_TEXT record data is **directly** the UTF-16LE encoded text
- No additional headers or metadata within the record data
- Simply decode the entire record data as UTF-16LE

### 5. Section Parsing (spec page 14)

BodyText sections contain:
- Multiple paragraphs (repeated structure)
- Each paragraph consists of:
  1. PARA_HEADER (0x50) - 22 bytes
  2. PARA_TEXT (0x51) - variable (UTF-16LE text)
  3. PARA_CHAR_SHAPE (0x52) - variable (optional)
  4. PARA_LINE_SEG (0x53) - variable (optional)

## Implementation Analysis

### Current Code Review

The implementation in `HWPViewerWindow.js:661-723` correctly:

1. **Decompresses entire stream first** (line 665-683):
   ```javascript
   if (isCompressed && data.length > 0) {
     var decompressed = window.pako.inflateRaw(data);
     data = decompressed;
   }
   ```

2. **Parses record headers** (line 690-703):
   ```javascript
   var header = view.getUint32(offset, true);
   var tagId = header & 0x3FF;        // 10 bits
   var level = (header >> 10) & 0x3FF; // 10 bits
   var size = (header >> 20) & 0xFFF;  // 12 bits
   ```

3. **Handles extended size** (line 699-702):
   ```javascript
   if (size === 0xFFF) {
     size = view.getUint32(offset, true);
     offset += 4;
   }
   ```

4. **Decodes PARA_TEXT as UTF-16LE** (line 937-939):
   ```javascript
   _parseParaText: function(data) {
     var text = new TextDecoder('utf-16le').decode(data);
     return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
   }
   ```

### Potential Issues

Based on the specification and current logs, potential issues:

1. **ViewText vs BodyText confusion**:
   - The code checks for 0x1c (28) as ViewText indicator
   - However, 0x1c is not a standard BodyText record tag
   - ViewText is a separate stream, not in BodyText

2. **Alternative extraction may interfere**:
   - The heuristic approach in `_extractParagraphsAlternative` (line 790-866) tries to decode any record as text
   - This may extract garbage data as "text"

3. **Decompression method**:
   - Currently tries `pako.inflateRaw()` first, then `pako.inflate()` on failure
   - According to spec, should be DEFLATE (raw)
   - But some files might use zlib wrapper

## Recommendations

### 1. Improve Section Detection

```javascript
_readSection: function(cfb, index) {
  // Try BodyText first (compressed)
  var data = this._readCFBStream(cfb, 'BodyText/Section' + index);
  if (data) {
    console.log("[HWPViewerWindow] Found BodyText/Section" + index);
    return data;
  }

  // Try ViewText (uncompressed, deprecated)
  data = this._readCFBStream(cfb, 'ViewText/Section' + index);
  if (data) {
    console.log("[HWPViewerWindow] Found ViewText/Section" + index + " (deprecated)");
    return data;
  }

  return null;
}
```

### 2. Remove 0x1c ViewText Detection

The 0x1c check should be removed from section parsing as ViewText is a separate stream format.

### 3. Improve PARA_TEXT Extraction

```javascript
_extractParagraphs: function(records) {
  var paragraphs = [];

  for (var i = 0; i < records.length; i++) {
    var record = records[i];

    // Look for PARA_HEADER (0x50)
    if (record.tagId === 0x50) {
      // Next record should be PARA_TEXT (0x51)
      if (i + 1 < records.length && records[i + 1].tagId === 0x51) {
        var paraText = records[i + 1];

        // Decode as UTF-16LE
        var text = new TextDecoder('utf-16le').decode(paraText.data);

        // Clean control characters
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        if (text.trim().length > 0) {
          paragraphs.push({
            text: text,
            header: record
          });
        }
      }
    }
  }

  return paragraphs;
}
```

### 4. Better Decompression Handling

```javascript
_decompressSection: function(data, isCompressed) {
  if (!isCompressed || data.length === 0) {
    return data;
  }

  // Try inflateRaw first (DEFLATE without wrapper)
  try {
    var decompressed = window.pako.inflateRaw(data);
    console.log("[HWPViewerWindow] ✅ Decompressed with inflateRaw:",
                data.length, "->", decompressed.length);
    return decompressed;
  } catch (e1) {
    console.warn("[HWPViewerWindow] inflateRaw failed:", e1.message);

    // Try inflate (DEFLATE with zlib wrapper)
    try {
      var decompressed2 = window.pako.inflate(data);
      console.log("[HWPViewerWindow] ✅ Decompressed with inflate:",
                  data.length, "->", decompressed2.length);
      return decompressed2;
    } catch (e2) {
      console.error("[HWPViewerWindow] Both decompression methods failed");
      return data; // Return original data
    }
  }
}
```

## Testing Recommendations

1. **Create test HWP files**:
   - Simple 1-paragraph document
   - Multi-paragraph document
   - Document with tables
   - Compressed document
   - Uncompressed document

2. **Add debug logging**:
   - Log first 100 bytes of each section (hex dump)
   - Log all record tag IDs found
   - Log decompression ratio
   - Log paragraph count per section

3. **Verify with reference implementation**:
   - Compare with official HWP viewer
   - Check if PrvText matches body text

## Specification References

- **Page 7-12**: File structure overview
- **Page 14**: Section structure and paragraph records
- **Page 21**: Record structure details
- **Page 34**: PARA_TEXT structure (Table 60)
- **Page 39**: PARA_HEADER structure (Table 58)

## Conclusion

The current implementation is fundamentally correct according to the HWP 5.0 specification. The most likely issues are:

1. **Test file format**: The test .hwp file might be using ViewText instead of BodyText
2. **Compression**: Decompression might be failing silently
3. **Record parsing**: Some edge cases in record header parsing

The implementation should work correctly for standard HWP 5.0 files with BodyText sections.
