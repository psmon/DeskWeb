/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Canvas Demo Application Window
 *
 * Displays mathematical patterns and animations similar to Windows screensavers.
 * Features:
 * - Multiple pattern types (circular, spiral, wave, fractal)
 * - Adjustable speed, color, and size
 * - Smooth transitions between patterns
 * - GPU acceleration with CPU fallback
 * - Fullscreen mode support
 */
qx.Class.define("deskweb.ui.CanvasDemoWindow", {
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "Canvas Demo");

    this.__currentPattern = "circular";
    this.__isAnimating = false;
    this.__animationFrame = null;
    this.__patterns = {};
    this.__useGPU = true;
    this.__transitionAlpha = 1.0;
    this.__isTransitioning = false;

    this.set({
      width: 800,
      height: 600,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Create UI
    this._createToolbar();
    this._createCanvasArea();
    this._createControlPanel();

    // Initialize patterns
    this._initializePatterns();

    // Handle window close
    this.addListener("close", this._onClose, this);
    this.addListener("resize", this._onResize, this);

    console.log("[CanvasDemoWindow] Created, animation will start after canvas is ready");
  },

  members: {
    __canvas: null,
    __ctx: null,
    __canvasWidget: null,
    __currentPattern: null,
    __isAnimating: false,
    __animationFrame: null,
    __patterns: null,
    __patternSelector: null,
    __speedSlider: null,
    __sizeSlider: null,
    __colorPicker: null,
    __useGPU: false,
    __transitionAlpha: 1.0,
    __isTransitioning: false,
    __previousPattern: null,

    // Animation parameters
    __time: 0,
    __speed: 1.0,
    __size: 1.0,
    __color: {r: 100, g: 150, b: 255},

    /**
     * Create toolbar
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();

      // Pattern selector
      this.__patternSelector = new qx.ui.form.SelectBox();
      this.__patternSelector.add(new qx.ui.form.ListItem("Circular Pattern", null, "circular"));
      this.__patternSelector.add(new qx.ui.form.ListItem("Spiral Pattern", null, "spiral"));
      this.__patternSelector.add(new qx.ui.form.ListItem("Wave Pattern", null, "wave"));
      this.__patternSelector.add(new qx.ui.form.ListItem("Fractal Pattern", null, "fractal"));
      this.__patternSelector.add(new qx.ui.form.ListItem("Particles", null, "particles"));

      this.__patternSelector.addListener("changeSelection", this._onPatternChange, this);
      toolbar.add(new qx.ui.basic.Label("Pattern:"));
      toolbar.add(this.__patternSelector);

      toolbar.add(new qx.ui.toolbar.Separator());

      // Play/Pause button
      var playBtn = new qx.ui.toolbar.Button("Pause", "icon/16/actions/media-playback-pause.png");
      playBtn.addListener("execute", function() {
        if (this.__isAnimating) {
          this._stopAnimation();
          playBtn.setLabel("Play");
          playBtn.setIcon("icon/16/actions/media-playback-start.png");
        } else {
          this._startAnimation();
          playBtn.setLabel("Pause");
          playBtn.setIcon("icon/16/actions/media-playback-pause.png");
        }
      }, this);
      toolbar.add(playBtn);

      toolbar.add(new qx.ui.toolbar.Separator());

      // Fullscreen button
      var fullscreenBtn = new qx.ui.toolbar.Button("Fullscreen", "icon/16/actions/view-fullscreen.png");
      fullscreenBtn.addListener("execute", this._toggleFullscreen, this);
      toolbar.add(fullscreenBtn);

      this.add(toolbar);
    },

    /**
     * Create canvas area
     */
    _createCanvasArea: function() {
      // Create HTML canvas using qx.ui.embed.Html
      this.__canvasWidget = new qx.ui.embed.Html();
      this.__canvasWidget.set({
        backgroundColor: "#000000",
        overflowX: "hidden",
        overflowY: "hidden"
      });

      // Create canvas element after widget is rendered
      this.__canvasWidget.addListenerOnce("appear", function() {
        var element = this.__canvasWidget.getContentElement().getDomElement();

        // Create canvas
        this.__canvas = document.createElement("canvas");
        this.__canvas.style.display = "block";
        this.__canvas.style.width = "100%";
        this.__canvas.style.height = "100%";

        // Get 2D context
        this.__ctx = this.__canvas.getContext("2d");
        this.__useGPU = false; // Use 2D canvas

        if (this.__ctx) {
          console.log("[CanvasDemoWindow] Canvas 2D context initialized");
        } else {
          console.error("[CanvasDemoWindow] Failed to get canvas context");
        }

        element.appendChild(this.__canvas);

        // Resize canvas after a short delay to ensure bounds are available
        setTimeout(function() {
          this._resizeCanvas();
          console.log("[CanvasDemoWindow] Canvas resized to:", this.__canvas.width, "x", this.__canvas.height);

          // Start animation after canvas is ready
          this._startAnimation();
        }.bind(this), 100);
      }, this);

      this.add(this.__canvasWidget, {flex: 1});
    },

    /**
     * Create control panel
     */
    _createControlPanel: function() {
      var controlPanel = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      controlPanel.set({
        padding: 10,
        backgroundColor: "#F0F0F0"
      });

      // Speed control
      controlPanel.add(new qx.ui.basic.Label("Speed:"));
      this.__speedSlider = new qx.ui.form.Slider();
      this.__speedSlider.set({
        minimum: 1,
        maximum: 50,
        value: 10,
        width: 100
      });
      this.__speedSlider.addListener("changeValue", function(e) {
        this.__speed = e.getData() / 10.0;
      }, this);
      controlPanel.add(this.__speedSlider);

      // Size control
      controlPanel.add(new qx.ui.basic.Label("Size:"));
      this.__sizeSlider = new qx.ui.form.Slider();
      this.__sizeSlider.set({
        minimum: 5,
        maximum: 50,
        value: 20,
        width: 100
      });
      this.__sizeSlider.addListener("changeValue", function(e) {
        this.__size = e.getData() / 20.0;
      }, this);
      controlPanel.add(this.__sizeSlider);

      // Color presets
      controlPanel.add(new qx.ui.basic.Label("Color:"));

      var colorButtons = [
        {label: "Blue", color: {r: 100, g: 150, b: 255}},
        {label: "Red", color: {r: 255, g: 100, b: 100}},
        {label: "Green", color: {r: 100, g: 255, b: 100}},
        {label: "Purple", color: {r: 200, g: 100, b: 255}},
        {label: "Rainbow", color: null}
      ];

      colorButtons.forEach(function(btnDef) {
        var btn = new qx.ui.form.Button(btnDef.label);
        btn.addListener("execute", function() {
          this.__color = btnDef.color;
        }, this);
        controlPanel.add(btn);
      }, this);

      this.add(controlPanel);
    },

    /**
     * Initialize pattern objects
     */
    _initializePatterns: function() {
      this.__patterns = {
        circular: {
          time: 0,
          particles: []
        },
        spiral: {
          time: 0,
          angle: 0
        },
        wave: {
          time: 0,
          offset: 0
        },
        fractal: {
          time: 0,
          iteration: 0
        },
        particles: {
          time: 0,
          items: []
        }
      };

      // Initialize particle system
      for (var i = 0; i < 50; i++) {
        this.__patterns.particles.items.push({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.002,
          vy: (Math.random() - 0.5) * 0.002,
          size: Math.random() * 3 + 1
        });
      }
    },

    /**
     * Resize canvas to fit container
     */
    _resizeCanvas: function() {
      if (!this.__canvas || !this.__canvasWidget) {
        console.log("[CanvasDemoWindow] Cannot resize - canvas or widget not ready");
        return;
      }

      var bounds = this.__canvasWidget.getBounds();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        this.__canvas.width = bounds.width;
        this.__canvas.height = bounds.height;
        console.log("[CanvasDemoWindow] Canvas resized to:", bounds.width, "x", bounds.height);
      } else {
        // Try to get size from DOM element
        var element = this.__canvasWidget.getContentElement().getDomElement();
        if (element) {
          var width = element.clientWidth || 800;
          var height = element.clientHeight || 600;
          this.__canvas.width = width;
          this.__canvas.height = height;
          console.log("[CanvasDemoWindow] Canvas resized from DOM:", width, "x", height);
        }
      }
    },

    /**
     * Handle window resize
     */
    _onResize: function() {
      this._resizeCanvas();
    },

    /**
     * Handle pattern change
     */
    _onPatternChange: function(e) {
      var selection = this.__patternSelector.getSelection();
      if (selection.length > 0) {
        var newPattern = selection[0].getModel();

        if (newPattern !== this.__currentPattern) {
          // Start transition
          this.__previousPattern = this.__currentPattern;
          this.__currentPattern = newPattern;
          this.__isTransitioning = true;
          this.__transitionAlpha = 0.0;

          console.log("[CanvasDemoWindow] Switching pattern to:", newPattern);
        }
      }
    },

    /**
     * Start animation loop
     */
    _startAnimation: function() {
      if (this.__isAnimating) {
        console.log("[CanvasDemoWindow] Animation already running");
        return;
      }

      if (!this.__canvas || !this.__ctx) {
        console.log("[CanvasDemoWindow] Cannot start animation - canvas not ready");
        return;
      }

      this.__isAnimating = true;
      this._animate();
      console.log("[CanvasDemoWindow] Animation started, canvas size:", this.__canvas.width, "x", this.__canvas.height);
    },

    /**
     * Stop animation loop
     */
    _stopAnimation: function() {
      if (!this.__isAnimating) {
        return;
      }

      this.__isAnimating = false;
      if (this.__animationFrame) {
        cancelAnimationFrame(this.__animationFrame);
        this.__animationFrame = null;
      }
      console.log("[CanvasDemoWindow] Animation stopped");
    },

    /**
     * Animation loop
     */
    _animate: function() {
      if (!this.__isAnimating) {
        return;
      }

      // Debug first frame
      if (this.__time === 0) {
        console.log("[CanvasDemoWindow] First animation frame - Canvas:", this.__canvas.width, "x", this.__canvas.height, "Pattern:", this.__currentPattern);
      }

      // Update time
      this.__time += 0.016 * this.__speed;

      // Update transition
      if (this.__isTransitioning) {
        this.__transitionAlpha += 0.02;
        if (this.__transitionAlpha >= 1.0) {
          this.__transitionAlpha = 1.0;
          this.__isTransitioning = false;
          this.__previousPattern = null;
        }
      }

      // Clear canvas
      if (this.__ctx && this.__canvas) {
        this.__ctx.fillStyle = "#000000";
        this.__ctx.fillRect(0, 0, this.__canvas.width, this.__canvas.height);

        // Render previous pattern during transition
        if (this.__isTransitioning && this.__previousPattern) {
          this.__ctx.globalAlpha = 1.0 - this.__transitionAlpha;
          this._renderPattern(this.__previousPattern);
        }

        // Render current pattern
        this.__ctx.globalAlpha = this.__transitionAlpha;
        this._renderPattern(this.__currentPattern);
        this.__ctx.globalAlpha = 1.0;
      } else {
        console.error("[CanvasDemoWindow] Animation frame but no canvas/context!");
      }

      // Request next frame
      this.__animationFrame = requestAnimationFrame(this._animate.bind(this));
    },

    /**
     * Render specific pattern
     */
    _renderPattern: function(patternType) {
      switch(patternType) {
        case "circular":
          this._renderCircular();
          break;
        case "spiral":
          this._renderSpiral();
          break;
        case "wave":
          this._renderWave();
          break;
        case "fractal":
          this._renderFractal();
          break;
        case "particles":
          this._renderParticles();
          break;
      }
    },

    /**
     * Render circular pattern
     */
    _renderCircular: function() {
      if (!this.__ctx || !this.__canvas) {
        console.error("[CanvasDemoWindow] _renderCircular: no ctx or canvas");
        return;
      }

      var cx = this.__canvas.width / 2;
      var cy = this.__canvas.height / 2;
      var maxRadius = Math.min(cx, cy) * 0.8;

      // Debug first render
      if (this.__time < 0.02) {
        console.log("[CanvasDemoWindow] Rendering circular pattern at center:", cx, cy, "maxRadius:", maxRadius);
      }

      var numCircles = 20;

      for (var i = 0; i < numCircles; i++) {
        var radius = (i + 1) * (maxRadius / numCircles) * this.__size;
        var angle = this.__time + i * 0.1;
        var alpha = 0.5 + 0.5 * Math.sin(angle);

        // Calculate color
        var color = this._getColor(i / numCircles);

        this.__ctx.beginPath();
        this.__ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.__ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + alpha + ")";
        this.__ctx.lineWidth = 2;
        this.__ctx.stroke();
      }
    },

    /**
     * Render spiral pattern
     */
    _renderSpiral: function() {
      if (!this.__ctx || !this.__canvas) return;

      var cx = this.__canvas.width / 2;
      var cy = this.__canvas.height / 2;

      this.__ctx.beginPath();

      var maxSteps = 500;
      for (var i = 0; i < maxSteps; i++) {
        var angle = i * 0.1 + this.__time;
        var radius = i * this.__size * 0.5;

        var x = cx + Math.cos(angle) * radius;
        var y = cy + Math.sin(angle) * radius;

        if (i === 0) {
          this.__ctx.moveTo(x, y);
        } else {
          this.__ctx.lineTo(x, y);
        }
      }

      var color = this._getColor(0.5);
      this.__ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + ",0.8)";
      this.__ctx.lineWidth = 2;
      this.__ctx.stroke();
    },

    /**
     * Render wave pattern
     */
    _renderWave: function() {
      if (!this.__ctx || !this.__canvas) return;

      var numWaves = 5;

      for (var w = 0; w < numWaves; w++) {
        this.__ctx.beginPath();

        var amplitude = 50 * this.__size;
        var frequency = 0.02;
        var phase = this.__time + w * 0.5;

        for (var x = 0; x < this.__canvas.width; x += 2) {
          var y = this.__canvas.height / 2 +
                  Math.sin(x * frequency + phase) * amplitude +
                  w * 30 - (numWaves * 15);

          if (x === 0) {
            this.__ctx.moveTo(x, y);
          } else {
            this.__ctx.lineTo(x, y);
          }
        }

        var color = this._getColor(w / numWaves);
        this.__ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + ",0.7)";
        this.__ctx.lineWidth = 3;
        this.__ctx.stroke();
      }
    },

    /**
     * Render fractal pattern (Sierpinski-like triangle)
     */
    _renderFractal: function() {
      if (!this.__ctx || !this.__canvas) return;

      var cx = this.__canvas.width / 2;
      var cy = this.__canvas.height / 2;
      var size = Math.min(this.__canvas.width, this.__canvas.height) * 0.4 * this.__size;

      var depth = Math.floor(5 + 2 * Math.sin(this.__time * 0.5));

      this._drawFractalTriangle(cx, cy - size/2, size, depth, 0);
    },

    /**
     * Draw recursive fractal triangle
     */
    _drawFractalTriangle: function(x, y, size, depth, level) {
      if (depth <= 0) return;

      var height = size * Math.sqrt(3) / 2;

      // Triangle points
      var x1 = x;
      var y1 = y;
      var x2 = x - size/2;
      var y2 = y + height;
      var x3 = x + size/2;
      var y3 = y + height;

      // Draw triangle
      this.__ctx.beginPath();
      this.__ctx.moveTo(x1, y1);
      this.__ctx.lineTo(x2, y2);
      this.__ctx.lineTo(x3, y3);
      this.__ctx.closePath();

      var color = this._getColor(level / 6);
      this.__ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + ",0.6)";
      this.__ctx.lineWidth = 1;
      this.__ctx.stroke();

      // Recursive calls
      if (depth > 1) {
        this._drawFractalTriangle(x1, y1, size/2, depth-1, level+1);
        this._drawFractalTriangle((x1+x2)/2, (y1+y2)/2, size/2, depth-1, level+1);
        this._drawFractalTriangle((x1+x3)/2, (y1+y3)/2, size/2, depth-1, level+1);
      }
    },

    /**
     * Render particle system
     */
    _renderParticles: function() {
      if (!this.__ctx || !this.__canvas) return;

      var particles = this.__patterns.particles.items;

      // Update and draw particles
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        // Update position
        p.x += p.vx * this.__speed;
        p.y += p.vy * this.__speed;

        // Wrap around edges
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        // Draw particle
        var x = p.x * this.__canvas.width;
        var y = p.y * this.__canvas.height;
        var size = p.size * this.__size * 2;

        var color = this._getColor(i / particles.length);

        this.__ctx.beginPath();
        this.__ctx.arc(x, y, size, 0, Math.PI * 2);
        this.__ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + ",0.8)";
        this.__ctx.fill();

        // Draw connections to nearby particles
        for (var j = i + 1; j < particles.length; j++) {
          var p2 = particles[j];
          var dx = p.x - p2.x;
          var dy = p.y - p2.y;
          var dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < 0.15) {
            var alpha = (0.15 - dist) / 0.15 * 0.3;
            this.__ctx.beginPath();
            this.__ctx.moveTo(x, y);
            this.__ctx.lineTo(p2.x * this.__canvas.width, p2.y * this.__canvas.height);
            this.__ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + alpha + ")";
            this.__ctx.lineWidth = 1;
            this.__ctx.stroke();
          }
        }
      }
    },

    /**
     * Get color based on position and user selection
     */
    _getColor: function(t) {
      if (this.__color === null) {
        // Rainbow mode
        var r = Math.floor(128 + 127 * Math.sin(t * Math.PI * 2));
        var g = Math.floor(128 + 127 * Math.sin(t * Math.PI * 2 + 2));
        var b = Math.floor(128 + 127 * Math.sin(t * Math.PI * 2 + 4));
        return {r: r, g: g, b: b};
      } else {
        return this.__color;
      }
    },

    /**
     * Toggle fullscreen mode
     */
    _toggleFullscreen: function() {
      var elem = this.__canvas;

      if (!elem) {
        return;
      }

      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }

        // Resize canvas when entering fullscreen
        setTimeout(function() {
          this.__canvas.width = window.screen.width;
          this.__canvas.height = window.screen.height;
        }.bind(this), 100);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }

        // Resize back when exiting fullscreen
        setTimeout(function() {
          this._resizeCanvas();
        }.bind(this), 100);
      }
    },

    /**
     * Handle window close
     */
    _onClose: function() {
      this._stopAnimation();
      console.log("[CanvasDemoWindow] Closed");
    }
  },

  destruct: function() {
    this._stopAnimation();
    this.__canvas = null;
    this.__ctx = null;
    this.__canvasWidget = null;
    this.__patterns = null;
    this.__patternSelector = null;
    this.__speedSlider = null;
    this.__sizeSlider = null;
    this.__colorPicker = null;
  }
});
