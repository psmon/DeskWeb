/**
 * WhiteBoard Engine - Fabric.js based canvas drawing engine
 * Ported from ShapeUp Whiteboard project
 *
 * @ignore(fabric.*)
 */
qx.Class.define("deskweb.util.WhiteBoardEngine", {
  extend: qx.core.Object,

  construct: function() {
    this.base(arguments);
    this.__connections = [];
    this.__clipboard = null;
    this.__zoomLevel = 1;
    this.__currentTool = "select";
    this.__isDrawing = false;
    this.__isPanning = false;
    this.__arrowStartShape = null;
    this.__arrowStartAnchor = null;
    this.__arrowPreviewLine = null;
    this.__arrowPreviewHead = null;
    this.__snapDistance = 20;
    this.__fillColor = "#ffffff";
    this.__strokeColor = "#333333";
    this.__strokeWidth = 2;
    this.__svgBoxDrawing = false;
  },

  events: {
    "zoomChanged": "qx.event.type.Data",
    "toolChanged": "qx.event.type.Data",
    "selectionChanged": "qx.event.type.Data"
  },

  members: {
    __canvas: null,
    __connections: null,
    __clipboard: null,
    __zoomLevel: null,
    __currentTool: null,
    __isDrawing: null,
    __isPanning: null,
    __startX: null,
    __startY: null,
    __currentShape: null,
    __lastPosX: null,
    __lastPosY: null,
    __arrowStartShape: null,
    __arrowStartAnchor: null,
    __arrowPreviewLine: null,
    __arrowPreviewHead: null,
    __snapDistance: null,
    __fillColor: null,
    __strokeColor: null,
    __strokeWidth: null,
    __svgBoxDrawing: null,
    __svgBoxStart: null,
    __svgBoxRect: null,

    /**
     * Initialize the Fabric.js canvas
     * @param canvasElement {Element} The canvas DOM element
     * @param width {Number} Canvas width
     * @param height {Number} Canvas height
     */
    init: function(canvasElement, width, height) {
      // Suppress Fabric.js textBaseline warnings
      var origWarn = console.warn;
      console.warn = function() {
        if (arguments[0] && typeof arguments[0] === "string" && arguments[0].indexOf("alphabetical") >= 0) return;
        origWarn.apply(console, arguments);
      };

      // Setup custom property serialization
      this._setupSerialization();

      this.__canvas = new fabric.Canvas(canvasElement, {
        width: width,
        height: height,
        backgroundColor: "#f8f9fa",
        selection: true
      });

      this._setupCanvasEvents();
      this._setupKeyboardShortcuts();

      console.log("[WhiteBoardEngine] Initialized", width, "x", height);
    },

    /**
     * Setup custom Fabric.js serialization
     */
    _setupSerialization: function() {
      var customProperties = ["objectType", "iconId", "svgPath", "connectedArrows",
        "startShape", "endShape", "startAnchor", "endAnchor", "listType", "listNumber"];

      var origToObject = fabric.Object.prototype.toObject;
      fabric.Object.prototype.toObject = function(props) {
        return origToObject.call(this, (props || []).concat(customProperties));
      };

      if (fabric.Group) {
        var origGroupToObject = fabric.Group.prototype.toObject;
        fabric.Group.prototype.toObject = function(props) {
          return origGroupToObject.call(this, (props || []).concat(customProperties));
        };
      }
    },

    /**
     * Setup canvas event handlers
     */
    _setupCanvasEvents: function() {
      var self = this;
      var canvas = this.__canvas;

      // Mouse wheel zoom
      canvas.on("mouse:wheel", function(opt) {
        var delta = opt.e.deltaY;
        var zoom = canvas.getZoom();
        zoom *= Math.pow(0.999, delta);
        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        self.__zoomLevel = zoom;
        self.fireDataEvent("zoomChanged", Math.round(zoom * 100));
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Mouse down
      canvas.on("mouse:down", function(opt) {
        if (opt.e.altKey || opt.e.button === 1 || self.__currentTool === "pan") {
          self.__isPanning = true;
          canvas.selection = false;
          self.__lastPosX = opt.e.clientX;
          self.__lastPosY = opt.e.clientY;
          canvas.defaultCursor = "grabbing";
        } else if (self.__currentTool === "select") {
          if (opt.target) {
            canvas.setActiveObject(opt.target);
            canvas.renderAll();
          } else {
            canvas.discardActiveObject();
            canvas.renderAll();
          }
        } else {
          self._handleDrawStart(opt);
        }
      });

      // Mouse move
      canvas.on("mouse:move", function(opt) {
        if (self.__isPanning) {
          var vpt = canvas.viewportTransform;
          vpt[4] += opt.e.clientX - self.__lastPosX;
          vpt[5] += opt.e.clientY - self.__lastPosY;
          canvas.requestRenderAll();
          self.__lastPosX = opt.e.clientX;
          self.__lastPosY = opt.e.clientY;
        } else if (self.__isDrawing || self.__svgBoxDrawing) {
          self._handleDrawMove(opt);
        }
      });

      // Mouse up
      canvas.on("mouse:up", function(opt) {
        if (self.__isPanning) {
          self.__isPanning = false;
          if (self.__currentTool === "pan") {
            canvas.defaultCursor = "grab";
          } else {
            canvas.selection = true;
          }
        }
        if (self.__isDrawing || self.__svgBoxDrawing) {
          self._handleDrawEnd(opt);
        }
      });

      // Object movement - update connected arrows
      canvas.on("object:moving", function(opt) {
        self._updateConnectedArrows(opt.target);
      });
      canvas.on("object:scaling", function(opt) {
        self._updateConnectedArrows(opt.target);
      });

      // Double-click to edit text inside group
      canvas.on("mouse:dblclick", function(opt) {
        var target = opt.target;
        if (!target) return;
        if (target.type === "group" && !target.connectionInfo) {
          var pointer = canvas.getPointer(opt.e);
          var textObj = self._findTextInGroup(target, pointer);
          if (textObj) {
            self._editTextInGroup(target, textObj);
          }
        }
      });

      // Selection events
      canvas.on("selection:created", function(opt) {
        var activeObj = opt.selected ? opt.selected[0] : canvas.getActiveObject();
        self.fireDataEvent("selectionChanged", self._getSelectionInfo(activeObj));
      });
      canvas.on("selection:updated", function(opt) {
        var activeObj = opt.selected ? opt.selected[0] : canvas.getActiveObject();
        self.fireDataEvent("selectionChanged", self._getSelectionInfo(activeObj));
      });
      canvas.on("selection:cleared", function() {
        self.fireDataEvent("selectionChanged", null);
      });
    },

    /**
     * Setup keyboard shortcuts
     */
    _setupKeyboardShortcuts: function() {
      var self = this;
      this.__keyHandler = function(e) {
        if (e.target.matches && e.target.matches("input, textarea")) return;

        if (e.key === "Delete" || e.key === "Backspace") {
          self.deleteSelected();
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "c") {
          self.copySelected();
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "v") {
          self.pasteSelected();
          e.preventDefault();
        }
      };
    },

    /**
     * Attach keyboard handler to a DOM element
     */
    attachKeyHandler: function(domElement) {
      domElement.addEventListener("keydown", this.__keyHandler);
    },

    /**
     * Detach keyboard handler
     */
    detachKeyHandler: function(domElement) {
      domElement.removeEventListener("keydown", this.__keyHandler);
    },

    // ========== Tool Management ==========

    setTool: function(tool) {
      this.__currentTool = tool;
      var canvas = this.__canvas;
      canvas.isDrawingMode = false;

      if (tool === "pan") {
        canvas.selection = false;
        canvas.defaultCursor = "grab";
        canvas.hoverCursor = "grab";
        canvas.forEachObject(function(obj) {
          obj.selectable = false;
          obj.evented = false;
        });
      } else if (tool === "select") {
        canvas.selection = true;
        canvas.defaultCursor = "default";
        canvas.hoverCursor = "move";
        canvas.forEachObject(function(obj) {
          obj.selectable = true;
          obj.evented = true;
          obj.setCoords();
        });
        canvas.renderAll();
      } else {
        canvas.selection = false;
        canvas.defaultCursor = "crosshair";
        canvas.hoverCursor = "crosshair";
        canvas.forEachObject(function(obj) {
          obj.selectable = false;
          obj.evented = false;
        });
      }
      this.fireDataEvent("toolChanged", tool);
    },

    getTool: function() {
      return this.__currentTool;
    },

    // ========== Drawing Properties ==========

    setFillColor: function(color) { this.__fillColor = color; },
    setStrokeColor: function(color) { this.__strokeColor = color; },
    setStrokeWidth: function(width) { this.__strokeWidth = width; },
    getFillColor: function() { return this.__fillColor; },
    getStrokeColor: function() { return this.__strokeColor; },
    getStrokeWidth: function() { return this.__strokeWidth; },

    // ========== Drawing Functions ==========

    _handleDrawStart: function(opt) {
      if (this.__currentTool === "select") return;

      if (this.__currentTool === "svgbox") {
        this._startSvgBoxDraw(opt);
        return;
      }

      this.__isDrawing = true;
      var pointer = this.__canvas.getPointer(opt.e);
      this.__startX = pointer.x;
      this.__startY = pointer.y;

      var fillColor = this.__fillColor;
      var strokeColor = this.__strokeColor;
      var strokeWidth = this.__strokeWidth;

      switch (this.__currentTool) {
        case "rect":
          this.__currentShape = new fabric.Rect({
            left: this.__startX, top: this.__startY,
            width: 0, height: 0,
            fill: fillColor, stroke: strokeColor,
            strokeWidth: strokeWidth, rx: 8, ry: 8
          });
          break;
        case "circle":
          this.__currentShape = new fabric.Circle({
            left: this.__startX, top: this.__startY,
            radius: 0,
            fill: fillColor, stroke: strokeColor,
            strokeWidth: strokeWidth
          });
          break;
        case "line":
          this.__currentShape = new fabric.Line(
            [this.__startX, this.__startY, this.__startX, this.__startY],
            { stroke: strokeColor, strokeWidth: strokeWidth }
          );
          break;
        case "arrow":
          var snapResult = this._findNearestShapeAnchor(pointer.x, pointer.y);
          if (snapResult) {
            this.__arrowStartShape = snapResult.shape;
            this.__arrowStartAnchor = snapResult.anchor;
            this.__startX = snapResult.point.x;
            this.__startY = snapResult.point.y;
          } else {
            this.__arrowStartShape = null;
            this.__arrowStartAnchor = null;
          }
          this.__arrowPreviewLine = new fabric.Line(
            [this.__startX, this.__startY, this.__startX, this.__startY],
            { stroke: strokeColor, strokeWidth: strokeWidth, selectable: false, evented: false, strokeDashArray: [5, 5] }
          );
          this.__arrowPreviewHead = new fabric.Triangle({
            left: this.__startX, top: this.__startY,
            width: 15, height: 15, fill: strokeColor,
            angle: 0, originX: "center", originY: "center",
            selectable: false, evented: false
          });
          this.__canvas.add(this.__arrowPreviewLine);
          this.__canvas.add(this.__arrowPreviewHead);
          break;
        case "text":
          this.__currentShape = new fabric.IText("", {
            left: this.__startX, top: this.__startY,
            fontSize: 16, fill: strokeColor
          });
          this.__canvas.add(this.__currentShape);
          this.__canvas.setActiveObject(this.__currentShape);
          this.__currentShape.enterEditing();
          this._addListKeyHandler(this.__currentShape);
          var self = this;
          this.__currentShape.on("editing:exited", function() {
            if (this.text.trim() === "") {
              self.__canvas.remove(this);
              self.__canvas.renderAll();
            }
          });
          this.__isDrawing = false;
          this.setTool("select");
          return;
      }

      if (this.__currentShape) {
        this.__canvas.add(this.__currentShape);
      }
    },

    _handleDrawMove: function(opt) {
      if (this.__currentTool === "svgbox" && this.__svgBoxDrawing) {
        this._updateSvgBoxDraw(opt);
        return;
      }
      if (!this.__isDrawing) return;

      var pointer = this.__canvas.getPointer(opt.e);

      switch (this.__currentTool) {
        case "rect":
          if (!this.__currentShape) return;
          var w = pointer.x - this.__startX;
          var h = pointer.y - this.__startY;
          this.__currentShape.set({
            width: Math.abs(w), height: Math.abs(h),
            left: w > 0 ? this.__startX : pointer.x,
            top: h > 0 ? this.__startY : pointer.y
          });
          break;
        case "circle":
          if (!this.__currentShape) return;
          var radius = Math.sqrt(Math.pow(pointer.x - this.__startX, 2) + Math.pow(pointer.y - this.__startY, 2)) / 2;
          this.__currentShape.set({ radius: radius });
          break;
        case "line":
          if (!this.__currentShape) return;
          this.__currentShape.set({ x2: pointer.x, y2: pointer.y });
          break;
        case "arrow":
          if (this.__arrowPreviewLine && this.__arrowPreviewHead) {
            var endX = pointer.x;
            var endY = pointer.y;
            var snap = this._findNearestShapeAnchor(pointer.x, pointer.y);
            if (snap) { endX = snap.point.x; endY = snap.point.y; }
            this.__arrowPreviewLine.set({ x2: endX, y2: endY });
            var angle = Math.atan2(endY - this.__startY, endX - this.__startX);
            this.__arrowPreviewHead.set({
              left: endX, top: endY,
              angle: (angle * 180 / Math.PI) + 90
            });
          }
          break;
      }
      this.__canvas.renderAll();
    },

    _handleDrawEnd: function(opt) {
      if (this.__currentTool === "svgbox" && this.__svgBoxDrawing) {
        this._endSvgBoxDraw(opt);
        return;
      }

      if (this.__currentTool === "arrow") {
        var pointer = this.__canvas.getPointer(opt.e);
        var endX = pointer.x;
        var endY = pointer.y;
        var arrowEndShape = null;
        var arrowEndAnchor = null;

        var snap = this._findNearestShapeAnchor(pointer.x, pointer.y);
        if (snap) {
          arrowEndShape = snap.shape;
          arrowEndAnchor = snap.anchor;
          endX = snap.point.x;
          endY = snap.point.y;
        }

        if (this.__arrowPreviewLine) {
          this.__canvas.remove(this.__arrowPreviewLine);
          this.__arrowPreviewLine = null;
        }
        if (this.__arrowPreviewHead) {
          this.__canvas.remove(this.__arrowPreviewHead);
          this.__arrowPreviewHead = null;
        }

        this._createArrowWithConnection(
          this.__startX, this.__startY, endX, endY,
          this.__arrowStartShape, arrowEndShape,
          this.__arrowStartAnchor, arrowEndAnchor
        );

        this.__arrowStartShape = null;
        this.__arrowStartAnchor = null;
      }

      this.__isDrawing = false;
      this.__currentShape = null;
      this.setTool("select");
    },

    // ========== Arrow Functions ==========

    _createArrowWithConnection: function(x1, y1, x2, y2, fromShape, toShape, fromAnchor, toAnchor) {
      var strokeColor = this.__strokeColor;
      var strokeWidth = this.__strokeWidth;
      var angle = Math.atan2(y2 - y1, x2 - x1);

      var line = new fabric.Line([x1, y1, x2, y2], {
        stroke: strokeColor, strokeWidth: strokeWidth
      });
      var head = new fabric.Triangle({
        left: x2, top: y2, width: 15, height: 15,
        fill: strokeColor, angle: (angle * 180 / Math.PI) + 90,
        originX: "center", originY: "center"
      });
      var group = new fabric.Group([line, head], { selectable: true });
      group.connectionInfo = {
        fromShape: fromShape, toShape: toShape,
        fromAnchor: fromAnchor, toAnchor: toAnchor
      };

      this.__canvas.add(group);

      if (fromShape || toShape) {
        this.__connections.push({
          arrow: group, fromShape: fromShape, toShape: toShape,
          fromAnchor: fromAnchor, toAnchor: toAnchor
        });
      }
    },

    _findNearestShapeAnchor: function(x, y) {
      var objects = this.__canvas.getObjects();
      var nearestResult = null;
      var minDistance = Infinity;

      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (obj.type === "group" && obj.connectionInfo) continue;
        if (obj === this.__arrowPreviewLine || obj === this.__arrowPreviewHead) continue;
        if (obj.type === "line" && !obj.selectable) continue;
        if (obj.type === "triangle" && !obj.selectable) continue;

        var isInside = this._isPointInsideShape(obj, x, y);
        var anchors = this._getShapeAnchors(obj);

        for (var anchorName in anchors) {
          if (anchorName === "center") continue;
          var anchor = anchors[anchorName];
          var distance = Math.sqrt(Math.pow(x - anchor.x, 2) + Math.pow(y - anchor.y, 2));

          if (isInside) {
            if (distance < minDistance) {
              minDistance = distance;
              nearestResult = { shape: obj, anchor: anchorName, point: anchor };
            }
          } else if (distance < this.__snapDistance && distance < minDistance) {
            minDistance = distance;
            nearestResult = { shape: obj, anchor: anchorName, point: anchor };
          }
        }
      }
      return nearestResult;
    },

    _isPointInsideShape: function(obj, x, y) {
      var bound = obj.getBoundingRect(true, true);
      return x >= bound.left && x <= bound.left + bound.width &&
             y >= bound.top && y <= bound.top + bound.height;
    },

    _getShapeAnchors: function(obj) {
      var bound = obj.getBoundingRect(true, true);
      var cx = bound.left + bound.width / 2;
      var cy = bound.top + bound.height / 2;
      return {
        top: { x: cx, y: bound.top },
        bottom: { x: cx, y: bound.top + bound.height },
        left: { x: bound.left, y: cy },
        right: { x: bound.left + bound.width, y: cy },
        center: { x: cx, y: cy }
      };
    },

    _updateConnectedArrows: function(movedShape) {
      if (!movedShape) return;
      var self = this;

      this.__connections.forEach(function(conn) {
        if (conn.fromShape === movedShape || conn.toShape === movedShape) {
          var x1, y1, x2, y2;

          if (conn.fromShape) {
            var fromAnchors = self._getShapeAnchors(conn.fromShape);
            var fromPoint = fromAnchors[conn.fromAnchor] || fromAnchors.right;
            x1 = fromPoint.x; y1 = fromPoint.y;
          }
          if (conn.toShape) {
            var toAnchors = self._getShapeAnchors(conn.toShape);
            var toPoint = toAnchors[conn.toAnchor] || toAnchors.left;
            x2 = toPoint.x; y2 = toPoint.y;
          }

          if (x1 !== undefined && x2 !== undefined) {
            self._updateArrowPosition(conn.arrow, x1, y1, x2, y2);
          }
        }
      });
      this.__canvas.renderAll();
    },

    _updateArrowPosition: function(arrow, x1, y1, x2, y2) {
      if (!arrow || !arrow._objects || arrow._objects.length < 2) return;

      var connInfo = arrow.connectionInfo;
      arrow._restoreObjectsState();
      this.__canvas.remove(arrow);

      var line = arrow._objects[0];
      var head = arrow._objects[1];
      line.set({ x1: x1, y1: y1, x2: x2, y2: y2 });
      line.setCoords();

      var angle = Math.atan2(y2 - y1, x2 - x1);
      head.set({ left: x2, top: y2, angle: (angle * 180 / Math.PI) + 90 });
      head.setCoords();

      var newGroup = new fabric.Group([line, head], { selectable: true });
      newGroup.connectionInfo = connInfo;
      this.__canvas.add(newGroup);

      var connIndex = this.__connections.findIndex(function(c) { return c.arrow === arrow; });
      if (connIndex >= 0) {
        this.__connections[connIndex].arrow = newGroup;
      }
    },

    // ========== SVG Box Functions ==========

    _startSvgBoxDraw: function(opt) {
      var pointer = this.__canvas.getPointer(opt.e);
      this.__svgBoxDrawing = true;
      this.__svgBoxStart = { x: pointer.x, y: pointer.y };
      this.__svgBoxRect = new fabric.Rect({
        left: pointer.x, top: pointer.y, width: 0, height: 0,
        fill: "transparent", stroke: "#667eea", strokeWidth: 1,
        strokeDashArray: [5, 5], selectable: false, evented: false
      });
      this.__canvas.add(this.__svgBoxRect);
    },

    _updateSvgBoxDraw: function(opt) {
      if (!this.__svgBoxRect) return;
      var pointer = this.__canvas.getPointer(opt.e);
      var w = pointer.x - this.__svgBoxStart.x;
      var h = pointer.y - this.__svgBoxStart.y;
      this.__svgBoxRect.set({
        width: Math.abs(w), height: Math.abs(h),
        left: w > 0 ? this.__svgBoxStart.x : pointer.x,
        top: h > 0 ? this.__svgBoxStart.y : pointer.y
      });
      this.__canvas.renderAll();
    },

    _endSvgBoxDraw: function(opt) {
      this.__svgBoxDrawing = false;
      if (this.__svgBoxRect) {
        var x = this.__svgBoxRect.left;
        var y = this.__svgBoxRect.top;
        var w = this.__svgBoxRect.width;
        var h = this.__svgBoxRect.height;
        this.__canvas.remove(this.__svgBoxRect);
        this.__svgBoxRect = null;

        if (w > 10 && h > 10) {
          this.createSvgBox(x, y, w, h);
        }
      }
      this.setTool("select");
    },

    createSvgBox: function(x, y, width, height, pathData) {
      var path = pathData || "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
      var sc = this.__strokeColor;
      var sw = this.__strokeWidth;

      var svgString = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + path + '" fill="none" stroke="' + sc + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      var self = this;
      fabric.loadSVGFromString(svgString, function(objects, options) {
        if (objects && objects.length > 0) {
          var svgGroup = fabric.util.groupSVGElements(objects, options);
          var scaleX = width / 24;
          var scaleY = height / 24;
          var scale = Math.min(scaleX, scaleY) * 0.8;

          svgGroup.set({
            left: x + width / 2, top: y + height / 2,
            scaleX: scale, scaleY: scale,
            originX: "center", originY: "center",
            objectType: "svgbox", svgPath: path
          });

          var frame = new fabric.Rect({
            left: x, top: y, width: width, height: height,
            fill: "transparent", stroke: sc, strokeWidth: 1,
            strokeDashArray: [4, 4], selectable: false, evented: false
          });

          var group = new fabric.Group([frame, svgGroup], {
            left: x, top: y, objectType: "svgbox", svgPath: path
          });

          self.__canvas.add(group);
          self.__canvas.setActiveObject(group);
          self.__canvas.renderAll();
        }
      });
    },

    // ========== Edit Operations ==========

    deleteSelected: function() {
      var canvas = this.__canvas;
      var activeObjects = canvas.getActiveObjects();
      var self = this;
      if (activeObjects.length) {
        activeObjects.forEach(function(obj) {
          var connIndex = self.__connections.findIndex(function(c) { return c.arrow === obj; });
          if (connIndex >= 0) self.__connections.splice(connIndex, 1);
          self.__connections = self.__connections.filter(function(c) {
            return c.fromShape !== obj && c.toShape !== obj;
          });
          canvas.remove(obj);
        });
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    },

    copySelected: function() {
      var activeObject = this.__canvas.getActiveObject();
      if (!activeObject) return;
      var self = this;
      activeObject.clone(function(cloned) {
        self.__clipboard = cloned;
      });
    },

    pasteSelected: function() {
      if (!this.__clipboard) return;
      var canvas = this.__canvas;
      var self = this;

      this.__clipboard.clone(function(clonedObj) {
        canvas.discardActiveObject();
        clonedObj.set({
          left: clonedObj.left + 30, top: clonedObj.top + 30, evented: true
        });

        if (clonedObj.type === "activeSelection") {
          clonedObj.canvas = canvas;
          clonedObj.forEachObject(function(obj) {
            canvas.add(obj);
            obj.selectable = true;
            obj.evented = true;
            obj.setCoords();
          });
          canvas.setActiveObject(clonedObj);
        } else {
          canvas.add(clonedObj);
          clonedObj.selectable = true;
          clonedObj.evented = true;
          clonedObj.setCoords();
          canvas.setActiveObject(clonedObj);
        }

        self.__clipboard.set({
          left: self.__clipboard.left + 30, top: self.__clipboard.top + 30
        });
        canvas.renderAll();
      });
    },

    // ========== Group Functions ==========

    groupSelected: function() {
      var canvas = this.__canvas;
      var activeObjects = canvas.getActiveObjects();
      if (activeObjects.length < 2) return;

      canvas.discardActiveObject();
      var group = new fabric.Group(activeObjects, {
        selectable: true, subTargetCheck: true, interactive: true
      });
      group.isUserGroup = true;

      activeObjects.forEach(function(obj) { canvas.remove(obj); });
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
    },

    ungroupSelected: function() {
      var canvas = this.__canvas;
      var activeObject = canvas.getActiveObject();
      if (!activeObject || activeObject.type !== "group" || activeObject.connectionInfo) return;

      var items = activeObject._objects;
      activeObject._restoreObjectsState();
      canvas.remove(activeObject);

      items.forEach(function(item) {
        item.selectable = true;
        item.evented = true;
        canvas.add(item);
      });
      canvas.discardActiveObject();
      canvas.renderAll();
    },

    bringToFront: function() {
      var obj = this.__canvas.getActiveObject();
      if (obj) { this.__canvas.bringToFront(obj); this.__canvas.renderAll(); }
    },

    sendToBack: function() {
      var obj = this.__canvas.getActiveObject();
      if (obj) { this.__canvas.sendToBack(obj); this.__canvas.renderAll(); }
    },

    // ========== Text Functions ==========

    _findTextInGroup: function(group, pointer) {
      if (!group._objects) return null;

      var groupCenter = group.getCenterPoint();
      var groupAngle = group.angle || 0;
      var groupScaleX = group.scaleX || 1;
      var groupScaleY = group.scaleY || 1;

      var cos = Math.cos(-groupAngle * Math.PI / 180);
      var sin = Math.sin(-groupAngle * Math.PI / 180);
      var dx = pointer.x - groupCenter.x;
      var dy = pointer.y - groupCenter.y;
      var localX = (dx * cos - dy * sin) / groupScaleX;
      var localY = (dx * sin + dy * cos) / groupScaleY;

      var textObjects = [];
      function collectTextObjects(objects) {
        for (var i = 0; i < objects.length; i++) {
          var obj = objects[i];
          if (obj.type === "i-text" || obj.type === "text" || obj.type === "textbox") {
            textObjects.push(obj);
          } else if (obj.type === "group" && obj._objects) {
            collectTextObjects(obj._objects);
          }
        }
      }
      collectTextObjects(group._objects);

      var hitMargin = 10;
      for (var i = 0; i < textObjects.length; i++) {
        var obj = textObjects[i];
        var objBound = obj.getBoundingRect(false, true);
        if (localX >= obj.left - objBound.width / 2 - hitMargin &&
            localX <= obj.left + objBound.width / 2 + hitMargin &&
            localY >= obj.top - objBound.height / 2 - hitMargin &&
            localY <= obj.top + objBound.height / 2 + hitMargin) {
          return obj;
        }
      }

      if (textObjects.length > 0) {
        var closestText = null;
        var minDistance = Infinity;
        for (var i = 0; i < textObjects.length; i++) {
          var dist = Math.sqrt(Math.pow(localX - textObjects[i].left, 2) + Math.pow(localY - textObjects[i].top, 2));
          if (dist < minDistance) { minDistance = dist; closestText = textObjects[i]; }
        }
        if (minDistance < 150) return closestText;
      }
      return null;
    },

    _editTextInGroup: function(group, textObj) {
      var canvas = this.__canvas;
      var groupLeft = group.left;
      var groupTop = group.top;
      var groupAngle = group.angle;
      var groupScaleX = group.scaleX;
      var groupScaleY = group.scaleY;

      var items = group._objects.slice();
      group._restoreObjectsState();
      canvas.remove(group);

      items.forEach(function(item) {
        item.selectable = (item === textObj);
        item.evented = (item === textObj);
        canvas.add(item);
      });

      canvas.setActiveObject(textObj);
      if (textObj.type === "i-text" || textObj.type === "textbox") {
        this._addListKeyHandler(textObj);
        textObj.enterEditing();
        textObj.selectAll();
      }

      textObj.on("editing:exited", function onEditEnd() {
        textObj.off("editing:exited", onEditEnd);
        items.forEach(function(item) { canvas.remove(item); });
        var newGroup = new fabric.Group(items, {
          left: groupLeft, top: groupTop,
          angle: groupAngle, scaleX: groupScaleX, scaleY: groupScaleY,
          selectable: true, subTargetCheck: true, interactive: true
        });
        newGroup.isUserGroup = true;
        canvas.add(newGroup);
        canvas.setActiveObject(newGroup);
        canvas.renderAll();
      });
      canvas.renderAll();
    },

    _addListKeyHandler: function(textObj) {
      if (!textObj || textObj._listKeyHandlerAdded) return;
      textObj._listKeyHandlerAdded = true;
      var canvas = this.__canvas;

      textObj.on("changed", function() {
        var text = this.text || "";
        var lines = text.split("\n");
        var cursorPos = this.selectionStart;

        var charCount = 0;
        var currentLineIndex = 0;
        for (var i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > cursorPos) { currentLineIndex = i; break; }
        }

        if (currentLineIndex > 0 && lines[currentLineIndex] === "") {
          var prevLine = lines[currentLineIndex - 1];
          if (prevLine.match(/^[•\-]\s*.+$/)) {
            lines[currentLineIndex] = "• ";
            this.text = lines.join("\n");
            this.selectionStart = this.selectionEnd = cursorPos + 2;
            canvas.renderAll();
          } else if (prevLine.match(/^\d+\.\s*.+$/)) {
            var prevNum = parseInt(prevLine.match(/^(\d+)\./)[1]);
            lines[currentLineIndex] = (prevNum + 1) + ". ";
            this.text = lines.join("\n");
            this.selectionStart = this.selectionEnd = cursorPos + ((prevNum + 1) + ". ").length;
            canvas.renderAll();
          } else if (prevLine.match(/^[•\-]\s*$/) || prevLine.match(/^\d+\.\s*$/)) {
            lines[currentLineIndex - 1] = "";
            this.text = lines.join("\n");
            this.selectionStart = this.selectionEnd = cursorPos - prevLine.length;
            canvas.renderAll();
          }
        }
      });
    },

    getTextObjectFromSelection: function(activeObj) {
      if (!activeObj) return null;
      if (activeObj.type === "i-text" || activeObj.type === "text" || activeObj.type === "textbox") {
        return activeObj;
      }
      if (activeObj.type === "group") {
        var objs = activeObj.getObjects();
        for (var i = 0; i < objs.length; i++) {
          if (objs[i].type === "i-text" || objs[i].type === "text" || objs[i].type === "textbox") {
            return objs[i];
          }
        }
      }
      return null;
    },

    // ========== Text Property Updates ==========

    updateTextColor: function(color) {
      var textObj = this.getTextObjectFromSelection(this.__canvas.getActiveObject());
      if (textObj) { textObj.set("fill", color); this.__canvas.renderAll(); }
    },

    updateTextSize: function(size) {
      var textObj = this.getTextObjectFromSelection(this.__canvas.getActiveObject());
      if (textObj) { textObj.set("fontSize", size); this.__canvas.renderAll(); }
    },

    updateTextAlign: function(align) {
      var textObj = this.getTextObjectFromSelection(this.__canvas.getActiveObject());
      if (textObj) { textObj.set("textAlign", align); this.__canvas.renderAll(); }
    },

    toggleTextStyle: function(style) {
      var textObj = this.getTextObjectFromSelection(this.__canvas.getActiveObject());
      if (!textObj) return;
      switch (style) {
        case "bold":
          textObj.set("fontWeight", textObj.get("fontWeight") === "bold" ? "normal" : "bold");
          break;
        case "italic":
          textObj.set("fontStyle", textObj.get("fontStyle") === "italic" ? "normal" : "italic");
          break;
        case "underline":
          textObj.set("underline", !textObj.get("underline"));
          break;
      }
      this.__canvas.renderAll();
    },

    insertList: function(type) {
      var textObj = this.getTextObjectFromSelection(this.__canvas.getActiveObject());
      if (!textObj) return;

      var currentText = textObj.get("text") || "";
      var lines = currentText.split("\n");
      var newLines;

      if (type === "ordered") {
        var num = 1;
        newLines = lines.map(function(line) {
          if (line.trim() === "") return line;
          line = line.replace(/^[•\-]\s*/, "");
          return (num++) + ". " + line;
        });
      } else {
        newLines = lines.map(function(line) {
          if (line.trim() === "") return line;
          line = line.replace(/^\d+\.\s*/, "");
          return "• " + line;
        });
      }

      textObj.set("text", newLines.join("\n"));
      this.__canvas.renderAll();
    },

    // ========== Shape Property Updates ==========

    updateSelectedFill: function(color) {
      var obj = this.__canvas.getActiveObject();
      if (obj) { obj.set("fill", color); this.__canvas.renderAll(); }
    },

    updateSelectedStroke: function(color) {
      var obj = this.__canvas.getActiveObject();
      if (obj) { obj.set("stroke", color); this.__canvas.renderAll(); }
    },

    updateSelectedStrokeWidth: function(width) {
      var obj = this.__canvas.getActiveObject();
      if (obj) { obj.set("strokeWidth", width); this.__canvas.renderAll(); }
    },

    // ========== Zoom Functions ==========

    zoomIn: function() {
      this.__zoomLevel = Math.min(5, this.__zoomLevel * 1.2);
      this.__canvas.setZoom(this.__zoomLevel);
      this.fireDataEvent("zoomChanged", Math.round(this.__zoomLevel * 100));
    },

    zoomOut: function() {
      this.__zoomLevel = Math.max(0.1, this.__zoomLevel / 1.2);
      this.__canvas.setZoom(this.__zoomLevel);
      this.fireDataEvent("zoomChanged", Math.round(this.__zoomLevel * 100));
    },

    resetZoom: function() {
      this.__zoomLevel = 1;
      this.__canvas.setZoom(1);
      this.__canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
      this.__canvas.renderAll();
      this.fireDataEvent("zoomChanged", 100);
    },

    // ========== Canvas Operations ==========

    clearCanvas: function() {
      this.__canvas.clear();
      this.__canvas.backgroundColor = "#f8f9fa";
      this.__canvas.renderAll();
      this.__connections = [];
    },

    resize: function(width, height) {
      if (this.__canvas) {
        this.__canvas.setWidth(width);
        this.__canvas.setHeight(height);
        this.__canvas.renderAll();
      }
    },

    // ========== Export Functions ==========

    exportToPNG: function() {
      var dataURL = this.__canvas.toDataURL({
        format: "png", quality: 1.0, multiplier: 2
      });
      var link = document.createElement("a");
      link.download = "whiteboard.png";
      link.href = dataURL;
      link.click();
    },

    exportToSVG: function() {
      var svg = this.__canvas.toSVG();
      var blob = new Blob([svg], { type: "image/svg+xml" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.download = "whiteboard.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    },

    // ========== Board Save/Load (.board format) ==========

    /**
     * Get board data as JSON string for saving
     * @param name {String} Board name
     * @return {String} JSON string in .board format
     */
    getBoardData: function(name) {
      var canvasJSON = this.__canvas.toJSON();
      var boardData = {
        version: "1.0",
        format: "board",
        name: name || "Untitled Board",
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        settings: {
          backgroundColor: this.__canvas.backgroundColor || "#f8f9fa",
          zoomLevel: this.__zoomLevel
        },
        canvas: canvasJSON
      };
      return JSON.stringify(boardData, null, 2);
    },

    /**
     * Load board from JSON string (.board format)
     * @param jsonStr {String} Board JSON string
     * @return {Object} Board metadata (name, created, modified)
     */
    loadBoardData: function(jsonStr) {
      var self = this;
      try {
        var boardData = JSON.parse(jsonStr);

        // Support both raw Fabric.js JSON and .board format
        var canvasData = boardData.canvas || boardData;
        var settings = boardData.settings || {};

        this.__canvas.clear();
        this.__canvas.backgroundColor = settings.backgroundColor || "#f8f9fa";

        this.__canvas.loadFromJSON(canvasData, function() {
          self.__canvas.forEachObject(function(obj) {
            obj.selectable = true;
            obj.evented = true;
            obj.setCoords();
          });
          self.__canvas.renderAll();

          if (settings.zoomLevel && settings.zoomLevel !== 1) {
            self.__zoomLevel = settings.zoomLevel;
            self.__canvas.setZoom(self.__zoomLevel);
            self.fireDataEvent("zoomChanged", Math.round(self.__zoomLevel * 100));
          }
        });

        this.__connections = [];

        return {
          name: boardData.name || "Untitled Board",
          created: boardData.created || null,
          modified: boardData.modified || null,
          version: boardData.version || "1.0"
        };
      } catch (e) {
        console.error("[WhiteBoardEngine] Failed to load board data:", e);
        return null;
      }
    },

    // ========== Selection Info ==========

    _getSelectionInfo: function(activeObj) {
      if (!activeObj) return null;
      var textObj = this.getTextObjectFromSelection(activeObj);
      return {
        hasSelection: true,
        hasText: !!textObj,
        isGroup: activeObj.type === "group",
        type: activeObj.type,
        fill: activeObj.fill,
        stroke: activeObj.stroke,
        strokeWidth: activeObj.strokeWidth,
        textObj: textObj ? {
          fill: textObj.fill,
          fontSize: textObj.fontSize,
          fontWeight: textObj.fontWeight,
          fontStyle: textObj.fontStyle,
          underline: textObj.underline,
          textAlign: textObj.textAlign
        } : null
      };
    },

    getCanvas: function() {
      return this.__canvas;
    },

    // ========== Board Templates ==========

    addBoardTemplate: function(type) {
      var canvas = this.__canvas;
      var colors = {
        "problem": "#667eea",
        "breadboard": "#00c6ff",
        "fat-marker": "#11998e",
        "risk": "#f093fb",
        "pitch": "#ff6b6b"
      };

      var color = colors[type] || "#667eea";
      var centerX = (canvas.width || 800) / 2 - 200;
      var centerY = 100;

      switch (type) {
        case "problem":
          this._addProblemBoard(centerX, centerY, color);
          break;
        case "breadboard":
          this._addBreadboard(centerX, centerY, color);
          break;
        case "fat-marker":
          this._addFatMarkerSketch(centerX, centerY, color);
          break;
        case "risk":
          this._addRiskBoard(centerX, centerY, color);
          break;
        case "pitch":
          this._addPitchBoard(centerX, centerY, color);
          break;
      }
    },

    _addProblemBoard: function(x, y, color) {
      var canvas = this.__canvas;
      var frame = new fabric.Rect({
        left: x, top: y, width: 500, height: 350,
        fill: "white", stroke: color, strokeWidth: 3, rx: 12, ry: 12
      });
      var title = new fabric.IText("PROBLEM DEFINITION", {
        left: x + 20, top: y + 20, fontSize: 22, fontWeight: "bold", fill: color
      });
      var rawIdea = new fabric.IText("Raw Idea:\n(What sparked this?)", {
        left: x + 20, top: y + 70, fontSize: 14, fill: "#555"
      });
      var problem = new fabric.IText("Narrowed Problem:\n(What specifically are we solving?)", {
        left: x + 20, top: y + 140, fontSize: 14, fill: "#555"
      });
      var appetite = new fabric.IText("Appetite: 6 weeks / small batch", {
        left: x + 20, top: y + 230, fontSize: 14, fill: "#888"
      });
      var baseline = new fabric.IText("Baseline:\n(What exists today?)", {
        left: x + 20, top: y + 270, fontSize: 14, fill: "#555"
      });
      canvas.add(frame, title, rawIdea, problem, appetite, baseline);
      canvas.renderAll();
    },

    _addBreadboard: function(x, y, color) {
      var canvas = this.__canvas;
      var frame = new fabric.Rect({
        left: x, top: y, width: 600, height: 300,
        fill: "white", stroke: color, strokeWidth: 3, rx: 12, ry: 12
      });
      var title = new fabric.IText("BREADBOARD", {
        left: x + 20, top: y + 20, fontSize: 22, fontWeight: "bold", fill: color
      });
      var place1 = new fabric.Rect({
        left: x + 30, top: y + 70, width: 150, height: 40,
        fill: "#e8f0fe", stroke: color, strokeWidth: 2, rx: 8, ry: 8
      });
      var place1Text = new fabric.IText("Place 1", {
        left: x + 70, top: y + 80, fontSize: 14, fontWeight: "bold", fill: color
      });
      var place2 = new fabric.Rect({
        left: x + 250, top: y + 70, width: 150, height: 40,
        fill: "#e8f0fe", stroke: color, strokeWidth: 2, rx: 8, ry: 8
      });
      var place2Text = new fabric.IText("Place 2", {
        left: x + 290, top: y + 80, fontSize: 14, fontWeight: "bold", fill: color
      });
      var affordance = new fabric.IText("• Affordance 1\n• Affordance 2\n• Affordance 3", {
        left: x + 30, top: y + 140, fontSize: 13, fill: "#555"
      });
      canvas.add(frame, title, place1, place1Text, place2, place2Text, affordance);
      canvas.renderAll();
    },

    _addFatMarkerSketch: function(x, y, color) {
      var canvas = this.__canvas;
      var frame = new fabric.Rect({
        left: x, top: y, width: 500, height: 350,
        fill: "white", stroke: color, strokeWidth: 3, rx: 12, ry: 12
      });
      var title = new fabric.IText("FAT MARKER SKETCH", {
        left: x + 20, top: y + 20, fontSize: 22, fontWeight: "bold", fill: color
      });
      var box1 = new fabric.Rect({
        left: x + 30, top: y + 70, width: 200, height: 120,
        fill: "#f0f9f4", stroke: color, strokeWidth: 2, rx: 8, ry: 8
      });
      var box1Text = new fabric.IText("Main Area", {
        left: x + 90, top: y + 120, fontSize: 14, fill: color
      });
      var box2 = new fabric.Rect({
        left: x + 260, top: y + 70, width: 200, height: 120,
        fill: "#f0f9f4", stroke: color, strokeWidth: 2, rx: 8, ry: 8
      });
      var box2Text = new fabric.IText("Side Panel", {
        left: x + 320, top: y + 120, fontSize: 14, fill: color
      });
      canvas.add(frame, title, box1, box1Text, box2, box2Text);
      canvas.renderAll();
    },

    _addRiskBoard: function(x, y, color) {
      var canvas = this.__canvas;
      var frame = new fabric.Rect({
        left: x, top: y, width: 500, height: 300,
        fill: "white", stroke: color, strokeWidth: 3, rx: 12, ry: 12
      });
      var title = new fabric.IText("RISKS & RABBIT HOLES", {
        left: x + 20, top: y + 20, fontSize: 22, fontWeight: "bold", fill: color
      });
      var rabbitHoles = new fabric.IText("Rabbit Holes:\n• Avoid over-engineering X\n• Don't build Y from scratch", {
        left: x + 20, top: y + 70, fontSize: 14, fill: "#555"
      });
      var noGos = new fabric.IText("No-Gos:\n• Feature A is out of scope\n• Don't touch system B", {
        left: x + 20, top: y + 180, fontSize: 14, fill: "#555"
      });
      canvas.add(frame, title, rabbitHoles, noGos);
      canvas.renderAll();
    },

    _addPitchBoard: function(x, y, color) {
      var canvas = this.__canvas;
      var frame = new fabric.Rect({
        left: x, top: y, width: 500, height: 400,
        fill: "white", stroke: color, strokeWidth: 3, rx: 12, ry: 12
      });
      var title = new fabric.IText("PITCH", {
        left: x + 20, top: y + 20, fontSize: 22, fontWeight: "bold", fill: color
      });
      var sections = [
        "1. Problem", "2. Appetite", "3. Solution",
        "4. Rabbit Holes", "5. No-Gos"
      ];
      for (var i = 0; i < sections.length; i++) {
        canvas.add(new fabric.IText(sections[i] + "\n(Describe here...)", {
          left: x + 20, top: y + 60 + i * 65, fontSize: 14, fill: "#555"
        }));
      }
      canvas.add(frame, title);
      canvas.renderAll();
    },

    // ========== SVG Icon Library ==========

    getSvgIcons: function() {
      return {
        "arrow-right": "M5 12h14M12 5l7 7-7 7",
        "arrow-left": "M19 12H5M12 19l-7-7 7-7",
        "user": "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "users": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
        "cloud": "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
        "server": "M2 4h20v6H2zM2 14h20v6H2zM6 7h.01M6 17h.01",
        "database": "M12 2C6.48 2 2 4.02 2 6.5v11c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-11c0-2.48-4.48-4.5-10-4.5zM2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5M2 6.5c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5",
        "monitor": "M2 4h20v12H2zM8 20h8M12 16v4",
        "globe": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
        "lock": "M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4M12 15v2",
        "gear": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        "document": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
        "folder": "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
        "star": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
        "heart": "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
        "lightning": "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
        "check": "M20 6L9 17l-5-5",
        "diamond": "M12 2L2 12l10 10 10-10L12 2z"
      };
    },

    /**
     * Dispose of the engine and cleanup
     */
    dispose: function() {
      if (this.__canvas) {
        this.__canvas.dispose();
        this.__canvas = null;
      }
      this.__connections = [];
      this.__clipboard = null;
    }
  }
});
