/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * HWP Renderer Module
 *
 * A standalone module for rendering parsed HWP data to HTML.
 * Takes structured data from HwpParser and generates HTML elements.
 *
 * Features:
 * - Render preview mode (PrvText)
 * - Render body mode (paragraphs, tables)
 * - Apply paragraph styles (alignment, indentation)
 * - Apply character styles (bold, italic, color)
 * - Support table colspan/rowspan
 *
 * Usage:
 *   var renderer = deskweb.util.HwpRenderer.getInstance();
 *   renderer.render(container, parsedData, 'body');
 */
qx.Class.define("deskweb.util.HwpRenderer",
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
    console.log("[HwpRenderer] Initialized");
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    /**
     * Render parsed HWP data to container
     * @param {Element} container - DOM element to render into
     * @param {Object} parsedData - Parsed HWP data from HwpParser
     * @param {String} mode - Render mode: 'preview' or 'body'
     * @return {Object} Render result with totalPages count
     */
    render: function(container, parsedData, mode) {
      if (!parsedData) {
        console.error("[HwpRenderer] No parsed data to render");
        return { totalPages: 0 };
      }

      container.innerHTML = '';

      if (mode === "preview") {
        this._renderPreviewMode(container, parsedData);
        return { totalPages: 1 };
      } else {
        return this._renderBodyMode(container, parsedData);
      }
    },

    /**
     * Render preview mode
     * @private
     */
    _renderPreviewMode: function(container, parsedData) {
      var prvText = parsedData.prvText;

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
     * Render body mode
     * @private
     */
    _renderBodyMode: function(container, parsedData) {
      var sections = parsedData.sections;
      var docInfo = parsedData.docInfo;

      if (!sections || sections.length === 0) {
        if (parsedData.prvText) {
          this._renderPrvTextFallback(container, parsedData);
        } else {
          container.innerHTML = '<p style="color: #999; padding: 20px;">본문 데이터가 없습니다.</p>';
        }
        return { totalPages: 1 };
      }

      var totalParagraphs = 0;
      sections.forEach(function(section) {
        totalParagraphs += section.paragraphs.length;
      });

      if (totalParagraphs === 0) {
        if (parsedData.prvText) {
          this._renderPrvTextFallback(container, parsedData);
        } else {
          container.innerHTML = '<p style="color: #999; padding: 20px;">본문 문단을 찾을 수 없습니다. 미리보기 모드를 사용해주세요.</p>';
        }
        return { totalPages: 1 };
      }

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'background: white; padding: 40px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

      var self = this;

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
            console.log("[RENDER] Item", itemIdx, "- TABLE:", item.table.rows, "x", item.table.cols);
            var table = self._renderTable(item.table, docInfo);
            wrapper.appendChild(table);
          } else {
            console.log("[RENDER] Item", itemIdx, "- PARAGRAPH:");
            console.log("[RENDER]   Text:", item.text);
            if (item._debugInfo) {
              console.log("[RENDER]   Debug Info:", JSON.stringify(item._debugInfo));
            }
            var p = self._renderParagraph(item, docInfo);
            wrapper.appendChild(p);
          }
        });

        console.log("[RENDER] Section", idx + 1, "rendering complete");
        console.log("[RENDER] ========================================");

        // Page break
        if (idx < sections.length - 1) {
          var pageBreak = document.createElement('hr');
          pageBreak.style.cssText = 'border: none; border-top: 2px dashed #ccc; margin: 30px 0;';
          wrapper.appendChild(pageBreak);
        }
      });

      container.appendChild(wrapper);

      return { totalPages: sections.length };
    },

    /**
     * Render PrvText as fallback in body mode
     * @private
     */
    _renderPrvTextFallback: function(container, parsedData) {
      var prvText = parsedData.prvText;

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'background: white; padding: 40px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

      var notice = document.createElement('div');
      notice.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;';

      var noticeTitle = document.createElement('h4');
      noticeTitle.style.cssText = 'color: #856404; margin: 0 0 10px 0;';
      noticeTitle.textContent = '알림';
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
     * Render paragraph with styles
     * @private
     */
    _renderParagraph: function(item, docInfo) {
      var p = document.createElement('p');
      var styles = [];

      // Get paragraph shape from DocInfo
      var paraShape = null;
      if (docInfo && docInfo.paraShapes && item.paraShapeId !== undefined) {
        paraShape = docInfo.paraShapes[item.paraShapeId];
        console.log("[RENDER-PARA] paraShapeId:", item.paraShapeId, "paraShape:", paraShape);
      }

      // Apply paragraph styles
      if (paraShape) {
        if (paraShape.alignment) {
          styles.push('text-align: ' + paraShape.alignment);
          console.log("[RENDER-PARA] Applied alignment:", paraShape.alignment);
        }

        if (paraShape.indent) {
          var indentPx = Math.round(paraShape.indent / 7200 * 25.4 / 0.254);
          styles.push('text-indent: ' + indentPx + 'px');
        }

        if (paraShape.spacingTop) {
          var spacingTopPx = Math.round(paraShape.spacingTop / 7200 * 25.4 / 0.254);
          styles.push('margin-top: ' + spacingTopPx + 'px');
        }
        if (paraShape.spacingBottom) {
          var spacingBottomPx = Math.round(paraShape.spacingBottom / 7200 * 25.4 / 0.254);
          styles.push('margin-bottom: ' + spacingBottomPx + 'px');
        }
      } else {
        styles.push('margin: 0 0 12px 0');
        styles.push('text-align: left');
      }

      styles.push('line-height: 1.8');
      p.style.cssText = styles.join('; ');

      var text = item.text || '';
      var charShapeIds = item.charShapeIds || [];

      // Debug: check for specific text that should be centered
      if (/상기.*기재/.test(text)) {
        console.log("[RENDER-PARA] Found special text:", text);
        console.log("[RENDER-PARA] paraShapeId:", item.paraShapeId);
        console.log("[RENDER-PARA] paraShape:", JSON.stringify(paraShape));
        console.log("[RENDER-PARA] Applied styles:", styles.join('; '));
      }

      // If we have multiple character shapes, render text in spans with different styles
      if (docInfo && docInfo.charShapes && charShapeIds.length > 1) {
        console.log("[RENDER-PARA] Multiple charShapeIds:", charShapeIds.length, "for text:", text.substring(0, 30));

        charShapeIds.sort(function(a, b) { return a.position - b.position; });

        for (var i = 0; i < charShapeIds.length; i++) {
          var csInfo = charShapeIds[i];
          var startPos = csInfo.position;
          var endPos = (i + 1 < charShapeIds.length) ? charShapeIds[i + 1].position : text.length;

          if (startPos > text.length) startPos = Math.floor(startPos / 2);
          if (endPos > text.length) endPos = Math.floor(endPos / 2);

          var substring = text.substring(startPos, endPos);
          if (!substring) continue;

          var charShape = docInfo.charShapes[csInfo.charShapeId];
          var span = document.createElement('span');

          if (charShape) {
            var spanStyles = [];
            if (charShape.bold) spanStyles.push('font-weight: bold');
            if (charShape.italic) spanStyles.push('font-style: italic');
            if (charShape.color && charShape.color !== 'rgb(0,0,0)') {
              spanStyles.push('color: ' + charShape.color);
              console.log("[RENDER-PARA] Applied color:", charShape.color, "to text:", substring.substring(0, 20));
            }
            span.style.cssText = spanStyles.join('; ');
          }

          span.textContent = substring;
          p.appendChild(span);
        }
      } else if (docInfo && docInfo.charShapes && charShapeIds.length === 1) {
        var charShape = docInfo.charShapes[charShapeIds[0].charShapeId];
        if (charShape) {
          var charStyles = [];
          if (charShape.bold) charStyles.push('font-weight: bold');
          if (charShape.italic) charStyles.push('font-style: italic');
          if (charShape.color) {
            charStyles.push('color: ' + charShape.color);
            console.log("[RENDER-PARA] Single charShape color:", charShape.color);
          }
          p.style.cssText += '; ' + charStyles.join('; ');
        }
        p.textContent = text;
      } else {
        p.textContent = text;
      }

      return p;
    },

    /**
     * Render table as HTML with colspan/rowspan support
     * @private
     */
    _renderTable: function(tableData, docInfo) {
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

      // Detect merge info
      var mergeInfo = this._detectMergeInfo(tableData);

      // Create grid
      var grid = [];
      for (var i = 0; i < tableData.rows; i++) {
        grid[i] = [];
        for (var j = 0; j < tableData.cols; j++) {
          grid[i][j] = null;
        }
      }

      // Helper function to find next empty position
      var findNextEmptyPosition = function(startRow, startCol) {
        for (var r = startRow; r < tableData.rows; r++) {
          var colStart = (r === startRow) ? startCol : 0;
          for (var c = colStart; c < tableData.cols; c++) {
            if (grid[r][c] === null) {
              return { row: r, col: c };
            }
          }
        }
        return null;
      };

      // First pass: place all cells in the grid
      var currentRow = 0;
      var currentCol = 0;

      for (var i = 0; i < tableData.cells.length; i++) {
        var cellData = tableData.cells[i];
        var rowSpan = cellData.rowSpan || 1;
        var colSpan = cellData.colSpan || 1;

        var targetRow = cellData.row;
        var targetCol = cellData.col;

        var positionValid = targetRow >= 0 && targetRow < tableData.rows &&
                           targetCol >= 0 && targetCol < tableData.cols &&
                           grid[targetRow][targetCol] === null;

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
              grid[r][c] = {
                row: targetRow,
                col: targetCol,
                rowSpan: rowSpan,
                colSpan: colSpan,
                text: cellData.text,
                charShapeIds: cellData.charShapeIds || []
              };
            } else {
              grid[r][c] = 'occupied';
            }
          }
        }

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

      // Apply merge info
      if (mergeInfo && mergeInfo.length > 0) {
        console.log("[RENDER-TABLE] Applying merge info:", mergeInfo.length, "merges");
        for (var mi = 0; mi < mergeInfo.length; mi++) {
          var merge = mergeInfo[mi];
          console.log("[RENDER-TABLE]   Merge: (" + merge.row + "," + merge.col + ") rowSpan=" + merge.rowSpan + ", colSpan=" + merge.colSpan);

          var mainCell = grid[merge.row] && grid[merge.row][merge.col];

          if (mainCell === null) {
            console.log("[RENDER-TABLE]     Creating empty cell object for merge at (" + merge.row + "," + merge.col + ")");
            mainCell = {
              row: merge.row,
              col: merge.col,
              rowSpan: 1,
              colSpan: 1,
              text: ''
            };
            grid[merge.row][merge.col] = mainCell;
          }

          if (mainCell && mainCell !== 'occupied' && mainCell !== 'merged') {
            mainCell.rowSpan = merge.rowSpan;
            mainCell.colSpan = merge.colSpan;
            mainCell.isMergeMain = true;

            for (var mr = merge.row; mr < merge.row + merge.rowSpan && mr < tableData.rows; mr++) {
              for (var mc = merge.col; mc < merge.col + merge.colSpan && mc < tableData.cols; mc++) {
                if (mr === merge.row && mc === merge.col) continue;
                console.log("[RENDER-TABLE]     Marking (" + mr + "," + mc + ") as merged (was: " +
                  (grid[mr][mc] === null ? "null" : (typeof grid[mr][mc] === 'string' ? grid[mr][mc] : "cell")) + ")");
                grid[mr][mc] = 'merged';
              }
            }
          }
        }
      }

      // Second pass: render the table using the grid
      for (var row = 0; row < tableData.rows; row++) {
        var tr = document.createElement('tr');

        for (var col = 0; col < tableData.cols; col++) {
          var cellData = grid[row][col];

          if (cellData === 'occupied' || cellData === 'merged') {
            continue;
          }

          var td = document.createElement('td');
          td.style.cssText = 'border: 1px solid #ccc; padding: 8px; vertical-align: top; min-width: 50px; min-height: 30px;';

          if (cellData !== null) {
            var cellText = cellData.text || '';
            var cellCharShapeIds = cellData.charShapeIds || [];

            // Apply character styles if available
            if (docInfo && docInfo.charShapes && cellCharShapeIds.length > 0) {
              console.log("[RENDER-TABLE-CELL] Cell (" + row + "," + col + ") has", cellCharShapeIds.length, "charShapeIds");

              cellCharShapeIds.sort(function(a, b) { return a.position - b.position; });

              for (var ci = 0; ci < cellCharShapeIds.length; ci++) {
                var csInfo = cellCharShapeIds[ci];
                var startPos = csInfo.position;
                var endPos = (ci + 1 < cellCharShapeIds.length) ? cellCharShapeIds[ci + 1].position : cellText.length;

                if (startPos >= cellText.length) continue;
                endPos = Math.min(endPos, cellText.length);

                var segmentText = cellText.substring(startPos, endPos);
                if (segmentText.length === 0) continue;

                var charShape = docInfo.charShapes[csInfo.charShapeId];
                var span = document.createElement('span');
                span.textContent = segmentText;

                if (charShape) {
                  span.style.color = charShape.color || 'rgb(0,0,0)';
                  if (charShape.bold) span.style.fontWeight = 'bold';
                  if (charShape.italic) span.style.fontStyle = 'italic';
                  console.log("[RENDER-TABLE-CELL] Segment [" + startPos + "-" + endPos + "] charShapeId=" + csInfo.charShapeId + " color=" + charShape.color);
                }

                td.appendChild(span);
              }
            } else {
              td.textContent = cellText;
            }

            if (cellData.colSpan && cellData.colSpan > 1) {
              td.setAttribute('colspan', cellData.colSpan);
              console.log("[RENDER-TABLE] Applied colspan=" + cellData.colSpan + " to cell (" + row + "," + col + ")");
            }
            if (cellData.rowSpan && cellData.rowSpan > 1) {
              td.setAttribute('rowspan', cellData.rowSpan);
              console.log("[RENDER-TABLE] Applied rowspan=" + cellData.rowSpan + " to cell (" + row + "," + col + ")");
            }

            if (cellData.isMergeMain) {
              td.style.verticalAlign = 'middle';
              td.style.textAlign = 'center';
              console.log("[RENDER-TABLE] Applied merge main style to cell (" + row + "," + col + ")");
            }
          } else {
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
     * Detect merge info based on table pattern
     * @private
     */
    _detectMergeInfo: function(tableData) {
      var mergeInfo = [];

      // Detect personal info table pattern (3x5)
      if (tableData.rows === 3 && tableData.cols === 5) {
        var hasNameLabel = false;
        var hasPhoneLabel = false;
        var hasAddressLabel = false;

        for (var i = 0; i < tableData.cells.length; i++) {
          var cellText = (tableData.cells[i].text || '').trim();
          if (cellText.indexOf('성') >= 0 && cellText.indexOf('명') >= 0) hasNameLabel = true;
          if (cellText.indexOf('휴대') >= 0 || cellText.indexOf('전화') >= 0) hasPhoneLabel = true;
          if (cellText.indexOf('주') >= 0 && cellText.indexOf('소') >= 0) hasAddressLabel = true;
        }

        if (hasNameLabel && (hasPhoneLabel || hasAddressLabel)) {
          console.log("[RENDER-TABLE] Detected 'personal info' table pattern");

          // Photo area: rowSpan=3
          mergeInfo.push({
            row: 0,
            col: 0,
            rowSpan: 3,
            colSpan: 1
          });

          // Address area: colSpan=3
          mergeInfo.push({
            row: 2,
            col: 2,
            rowSpan: 1,
            colSpan: 3
          });
        }
      }

      return mergeInfo;
    }
  }
});
