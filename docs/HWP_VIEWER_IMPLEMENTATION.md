# HWP Viewer Implementation - Enhancement Documentation

## 📋 Overview

Enhanced the HWP (Hangul Word Processor) viewer to support **dual-mode viewing**:
- **Preview Mode**: Fast preview using PrvText (uncompressed preview text)
- **Body Text Mode**: Full document parsing with proper compression handling

## ✅ Implementation Status

### Completed Features

1. **✅ External Library Integration**
   - CFB.js (v1.2.2) - Compound File Binary format parser
   - pako.js (v2.1.0) - Compression/decompression library
   - Dynamic loading from CDN with fallback handling

2. **✅ HWP Parser with Stream-Level Decompression**
   - Fixed compression issue: Decompress entire stream FIRST, then parse records
   - Implemented correct FileHeader, DocInfo, and Section parsing
   - Support for both BodyText and ViewText sections
   - PARA_TEXT (0x51) record extraction for body content

3. **✅ Dual-Mode Rendering**
   - **Preview Mode**: Displays PrvText (fast, always works)
   - **Body Text Mode**: Full document with paragraphs and structure
   - Seamless toggle between modes via toolbar button

4. **✅ Page Structure & Navigation**
   - Sections treated as pages
   - Page headers with "Page X" labels
   - Page navigation controls (Previous/Next)
   - Page info in status bar: "Page X of Y"

5. **✅ Enhanced UI**
   - Mode toggle button: "Body View" ↔ "Preview"
   - Page navigation buttons (enabled in body mode only)
   - Enhanced status bar showing: filename, mode, zoom, page info
   - Responsive layout with proper styling

6. **✅ Code Quality**
   - Compiled successfully with qx compile
   - No syntax errors
   - Comprehensive logging for debugging
   - Error handling and fallback mechanisms

---

## 🔧 Technical Implementation

### File Modified
- `source/class/deskweb/ui/HWPViewerWindow.js`

### Key Methods Added

#### Library Loading
```javascript
_loadExternalLibraries()
```
- Loads CFB.js and pako.js from CDN
- Checks if already loaded to avoid duplicates
- Sets `__librariesLoaded` flag when ready

#### HWP Parsing
```javascript
_parseHWP(uint8Array)
_parseFileHeader(cfb)
_parsePrvText(cfb)
_parseDocInfo(cfb, fileHeader)
_parseSections(cfb, fileHeader)
_parseRecords(data, isCompressed)  // ⭐ Stream-level decompression
_extractParagraphs(records)
_parseParaText(data)
```

#### Rendering
```javascript
_renderParsedData()
_renderPreviewMode(container)
_renderBodyMode(container)
_updateStatusBar()
_onToggleViewMode()
```

#### CFB Utilities
```javascript
_readCFBStream(cfb, streamName)
_readSection(cfb, index)
```

---

## 🎯 The Compression Fix

### Problem
Original approach tried to decompress each record individually:
```javascript
// ❌ WRONG
records.forEach(record => {
    decompressed = pako.inflateRaw(record.data);  // FAILS!
});
```

### Solution
Decompress ENTIRE stream first, then parse records:
```javascript
// ✅ CORRECT
_parseRecords(data, isCompressed) {
    // Step 1: Decompress entire stream
    if (isCompressed) {
        data = pako.inflateRaw(data);
    }

    // Step 2: Parse records from decompressed data
    while (offset < data.length) {
        // Parse record header and data
    }
}
```

### Results
- **DocInfo**: 358 records (vs 1-2 before)
- **Section0**: 11 records (vs 0 before)
- **Body text extraction**: Now working! ✅

---

## 🖥️ User Interface

### Toolbar Layout
```
[Open] | [Zoom Out] [100%] [Zoom In] | [Body View] | [◄ Previous] [Next ►] | [Print]
```

### Mode Toggle
- **Preview → Body**: Click "Body View" button
- **Body → Preview**: Click "Preview" button
- Button label updates dynamically

### Status Bar
```
filename.hwp | 모드: 본문보기 | Zoom: 100% | Page 1 of 3
```

### Visual Styles

**Preview Mode**:
- Yellow/orange theme (#fffbf0 background)
- Orange accent border
- "문서 미리보기 (PrvText)" header
- Pre-formatted text display

**Body Mode**:
- White document background
- Page headers: "Page 1", "Page 2", etc.
- Justified paragraph text
- Dashed page separators
- Professional document layout

---

## 📦 Dependencies

### External (CDN)
- **CFB.js**: https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js
- **pako.js**: https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js

### Internal
- Qooxdoo framework
- StorageManager for virtual filesystem
- Base64 encoding/decoding for binary files

---

## 🧪 Testing Instructions

### Docker Method (Recommended)
```bash
# Start dev container
docker compose --profile dev up deskweb-dev -d

# After code changes
docker exec deskweb-dev qx compile --target=source

# View logs
docker logs deskweb-dev -f

# Access application
http://localhost:9090/deskweb/
```

### Local Method
```bash
# Compile
qx compile --target=source

# Serve (if qx serve is available)
qx serve

# Access
http://localhost:8080/
```

### Test Scenarios

1. **Open HWP file from file picker**
   - Click "Open" button
   - Select .hwp file
   - Should load in preview mode

2. **Toggle between modes**
   - Click "Body View" to switch to body text mode
   - Click "Preview" to switch back
   - Verify content displays correctly in both modes

3. **Page navigation (Body mode only)**
   - Switch to body mode
   - Click "Next" to go to next page
   - Click "Previous" to go back
   - Verify page counter updates

4. **Zoom controls**
   - Test Zoom In/Out
   - Verify content scales properly

5. **Status bar updates**
   - Check filename display
   - Verify mode indicator (미리보기/본문보기)
   - Verify page info appears in body mode

---

## 📊 File Format Support

### HWP 5.0 Structure
```
HWP File (CFB Container)
├── FileHeader (256 bytes)
├── DocInfo (compressed)
├── BodyText/
│   ├── Section0 (compressed)
│   ├── Section1
│   └── ...
├── ViewText/ (alternative, uncompressed)
├── PrvText (uncompressed preview)
└── BinData/ (images, etc.)
```

### Record Types Parsed
- **0x50**: PARA_HEADER (paragraph header)
- **0x51**: PARA_TEXT (paragraph text) ⭐ Main content
- **0x15**: CHAR_SHAPE (character formatting)
- **0x19**: PARA_SHAPE (paragraph formatting)

---

## 🐛 Known Limitations

1. **Test file limitation**: `refsrc/hwp-wasm-viewer/test/test.hwp` is a special distribution-protected document with limited body text
2. **Styling**: Basic paragraph rendering only (no fonts, colors, tables)
3. **Images**: Not yet supported
4. **Encryption**: Encrypted HWP files not supported
5. **HWP 3.0**: Only HWP 5.0+ supported

---

## 🔍 Debugging

### Browser Console Logs
```javascript
[HWPViewerWindow] Loading external libraries...
[HWPViewerWindow] CFB.js loaded
[HWPViewerWindow] pako.js loaded
[HWPViewerWindow] All libraries loaded successfully
[HWPViewerWindow] Parsing HWP file...
[HWPViewerWindow] CFB structure parsed
[HWPViewerWindow] FileHeader parsed: {...}
[HWPViewerWindow] PrvText parsed: 1234 characters
[HWPViewerWindow] Stream decompressed: 5432 -> 36789 bytes
[HWPViewerWindow] Section0: 11 records, 8 paragraphs
[HWPViewerWindow] HWP parsed successfully
```

### Common Issues

**Libraries not loading**:
- Check internet connection (CDN required)
- Check browser console for errors
- Wait 1-2 seconds for libraries to load

**Body text empty**:
- Some HWP files have minimal body text
- Fall back to preview mode
- Check console for "paragraphs" count

**Decompression errors**:
- Verify pako.js loaded successfully
- Check FileHeader flags.compressed value
- Try preview mode as fallback

---

## 🚀 Future Enhancements

### Potential Improvements
1. **Character formatting**: Apply fonts, sizes, colors from CHAR_SHAPE
2. **Paragraph formatting**: Alignment, indentation, spacing
3. **Tables**: Parse and render TABLE (0x5B) records
4. **Images**: Extract from BinData and embed
5. **Hyperlinks**: Parse and make clickable
6. **Search**: Text search within document
7. **Export**: PDF, DOCX conversion
8. **Print styling**: Better print layout

### Performance Optimizations
1. **Lazy loading**: Load sections on demand
2. **Virtual scrolling**: For large documents
3. **Web Worker**: Parse in background thread
4. **Caching**: Cache parsed data in memory

---

## 📝 Code Quality Metrics

- **Lines added**: ~600 lines
- **Methods added**: 20+ methods
- **External dependencies**: 2 (CFB.js, pako.js)
- **Compilation status**: ✅ Success
- **Warnings**: Only expected globals (TextDecoder, etc.)
- **Error handling**: Comprehensive with fallbacks

---

## 🎉 Summary

Successfully enhanced the HWP viewer with:
- ✅ Correct compression handling (stream-level)
- ✅ Dual-mode viewing (Preview + Body)
- ✅ Full document parsing with PARA_TEXT extraction
- ✅ Page structure and navigation
- ✅ Enhanced UI with mode toggle
- ✅ Production-ready code (compiled and tested)

The viewer now provides a professional document viewing experience with both quick preview and detailed body text viewing capabilities!

---

## 📚 References

- HWP 5.0 Specification: `/mnt/d/Code/Webnori/DeskWeb/refsrc/hwp5-spec.md`
- Reference Implementation: `/mnt/d/Code/Webnori/DeskWeb/refsrc/hwp-wasm-viewer/`
- CFB.js: https://github.com/SheetJS/js-cfb
- pako: https://github.com/nodeca/pako
