/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

/**
 * 3D Tetris Game Logic
 *
 * Implements classic Tetris game rules with 3D block rendering using Three.js
 * Features:
 * - 10 stages with increasing difficulty
 * - 3D block rotation effects
 * - 3D spatial sound effects
 * - Camera control options
 * - Graphics acceleration options (WebGL/Canvas)
 *
 * @ignore(THREE)
 * @ignore(requestAnimationFrame)
 * @ignore(cancelAnimationFrame)
 */
qx.Class.define("deskweb.game.TetrisGame",
{
  extend : qx.core.Object,

  construct : function()
  {
    this.base(arguments);

    console.log("[TetrisGame] Initializing...");

    // Game board dimensions
    this.__cols = 10;
    this.__rows = 20;
    this.__blockSize = 1;

    // Game state
    this.__board = [];
    this.__currentPiece = null;
    this.__nextPiece = null;
    this.__gameState = "ready"; // ready, playing, paused, gameover
    this.__score = 0;
    this.__lines = 0;
    this.__level = 1;
    this.__stage = 1;

    // Stage system
    this.__stageConfig = this.__initStageConfig();

    // Timer
    this.__dropTimer = null;
    this.__dropInterval = 1000;

    // 3D rendering
    this.__scene = null;
    this.__camera = null;
    this.__renderer = null;
    this.__blockMeshes = [];
    this.__currentPieceMeshes = [];
    this.__useWebGL = true;

    // Camera settings
    this.__cameraDistance = 25;
    this.__cameraAngleX = 0.3;
    this.__cameraAngleY = 0;

    // Sound system
    this.__audioContext = null;
    this.__sounds = {};

    // Material type: 'glossy', 'metallic', 'glass', 'plastic', 'matte'
    this.__materialType = 'glossy';

    // Initialize
    this.__initBoard();
    this.__initAudio();

    console.log("[TetrisGame] Initialized successfully");
  },

  events :
  {
    /** Fired when game state changes */
    "gameStateChange": "qx.event.type.Event",

    /** Fired when score updates */
    "scoreUpdate": "qx.event.type.Data",

    /** Fired when lines are cleared */
    "linesCleared": "qx.event.type.Data",

    /** Fired when level changes */
    "levelChange": "qx.event.type.Data",

    /** Fired when stage changes */
    "stageChange": "qx.event.type.Data",

    /** Fired when game is over */
    "gameOver": "qx.event.type.Data",

    /** Fired when piece locks in place */
    "pieceLocked": "qx.event.type.Event",

    /** Fired when piece rotates */
    "pieceRotated": "qx.event.type.Event",

    /** Fired for rendering update */
    "renderUpdate": "qx.event.type.Event"
  },

  // Tetromino shapes (I, O, T, S, Z, J, L)
  statics :
  {
    PIECES: {
      I: {
        shape: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ],
        color: 0x00FFFF // Cyan
      },
      O: {
        shape: [
          [1, 1],
          [1, 1]
        ],
        color: 0xFFFF00 // Yellow
      },
      T: {
        shape: [
          [0, 1, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: 0x800080 // Purple
      },
      S: {
        shape: [
          [0, 1, 1],
          [1, 1, 0],
          [0, 0, 0]
        ],
        color: 0x00FF00 // Green
      },
      Z: {
        shape: [
          [1, 1, 0],
          [0, 1, 1],
          [0, 0, 0]
        ],
        color: 0xFF0000 // Red
      },
      J: {
        shape: [
          [1, 0, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: 0x0000FF // Blue
      },
      L: {
        shape: [
          [0, 0, 1],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: 0xFF8000 // Orange
      }
    },

    PIECE_TYPES: ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  },

  members :
  {
    __cols: null,
    __rows: null,
    __blockSize: null,
    __board: null,
    __currentPiece: null,
    __nextPiece: null,
    __gameState: null,
    __score: null,
    __lines: null,
    __level: null,
    __stage: null,
    __stageConfig: null,
    __dropTimer: null,
    __dropInterval: null,
    __scene: null,
    __camera: null,
    __renderer: null,
    __blockMeshes: null,
    __currentPieceMeshes: null,
    __useWebGL: null,
    __cameraDistance: null,
    __cameraAngleX: null,
    __cameraAngleY: null,
    __audioContext: null,
    __sounds: null,
    __container: null,
    __animationId: null,
    __ghostPieceMeshes: null,
    __gridHelper: null,
    __boardGroup: null,
    __materialType: null,

    /**
     * Initialize stage configuration
     */
    __initStageConfig: function() {
      return [
        { level: 1, speed: 1000, colors: 'basic', bgm: 'stage1' },
        { level: 2, speed: 900, colors: 'basic', bgm: 'stage2' },
        { level: 3, speed: 800, colors: 'enhanced', bgm: 'stage3' },
        { level: 4, speed: 700, colors: 'enhanced', bgm: 'stage4' },
        { level: 5, speed: 600, colors: 'vivid', bgm: 'stage5' },
        { level: 6, speed: 500, colors: 'vivid', bgm: 'stage6' },
        { level: 7, speed: 400, colors: 'neon', bgm: 'stage7' },
        { level: 8, speed: 300, colors: 'neon', bgm: 'stage8' },
        { level: 9, speed: 200, colors: 'rainbow', bgm: 'stage9' },
        { level: 10, speed: 100, colors: 'rainbow', bgm: 'stage10' }
      ];
    },

    /**
     * Initialize game board
     */
    __initBoard: function() {
      this.__board = [];
      for (var row = 0; row < this.__rows; row++) {
        this.__board[row] = [];
        for (var col = 0; col < this.__cols; col++) {
          this.__board[row][col] = { filled: false, color: null };
        }
      }
      console.log("[TetrisGame] Board initialized:", this.__cols, "x", this.__rows);
    },

    /**
     * Initialize Web Audio API for 3D sound effects
     */
    __initAudio: function() {
      try {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.__audioContext = new AudioContext();
          console.log("[TetrisGame] Audio context initialized");
        }
      } catch (e) {
        console.warn("[TetrisGame] Web Audio API not supported:", e);
      }
    },

    /**
     * Play 3D spatial sound effect
     */
    __playSound: function(type, x, y) {
      if (!this.__audioContext) return;

      try {
        var ctx = this.__audioContext;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        var oscillator = ctx.createOscillator();
        var gainNode = ctx.createGain();

        // Create 3D panner for spatial audio
        var panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.maxDistance = 30;
        panner.refDistance = 1;

        // Calculate 3D position based on block position
        var posX = (x - this.__cols / 2) * 0.5;
        var posY = (y - this.__rows / 2) * 0.5;
        panner.positionX.setValueAtTime(posX, ctx.currentTime);
        panner.positionY.setValueAtTime(posY, ctx.currentTime);
        panner.positionZ.setValueAtTime(-5, ctx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(ctx.destination);

        switch(type) {
          case 'rotate':
            oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
            break;

          case 'drop':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
            break;

          case 'clear':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(261.63, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
            break;

          case 'move':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.05);
            break;

          case 'gameover':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(440, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 1.2);
            break;
        }
      } catch (e) {
        console.warn("[TetrisGame] Sound playback error:", e);
      }
    },

    /**
     * Initialize 3D rendering
     */
    init3D: function(container, width, height) {
      if (typeof THREE === 'undefined') {
        console.error("[TetrisGame] Three.js not loaded!");
        return false;
      }

      this.__container = container;

      console.log("[TetrisGame] Initializing 3D with dimensions:", width, "x", height);

      // Create scene
      this.__scene = new THREE.Scene();
      this.__scene.background = new THREE.Color(0x1a1a2e);

      // Create camera with perspective
      this.__camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      this.__updateCameraPosition();

      // Create renderer (WebGL or Canvas fallback)
      try {
        if (this.__useWebGL) {
          this.__renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          console.log("[TetrisGame] Using WebGL renderer");
        } else {
          // Fallback to Canvas - not available in newer Three.js versions
          this.__renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
          console.log("[TetrisGame] Using Canvas fallback (WebGL with reduced quality)");
        }
      } catch (e) {
        console.error("[TetrisGame] Renderer creation failed:", e);
        return false;
      }

      this.__renderer.setSize(width, height);
      this.__renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(this.__renderer.domElement);

      // Create board group for organized rendering
      this.__boardGroup = new THREE.Group();
      this.__scene.add(this.__boardGroup);

      // Add lighting
      this.__setupLighting();

      // Add grid helper
      this.__setupGrid();

      // Start render loop
      this.__startRenderLoop();

      console.log("[TetrisGame] 3D initialized successfully");
      return true;
    },

    /**
     * Setup lighting for the scene
     */
    __setupLighting: function() {
      // Ambient light
      var ambient = new THREE.AmbientLight(0x404040, 0.5);
      this.__scene.add(ambient);

      // Directional light from top-front
      var directional = new THREE.DirectionalLight(0xffffff, 0.8);
      directional.position.set(5, 10, 10);
      directional.castShadow = true;
      this.__scene.add(directional);

      // Point light for dynamic highlights
      var pointLight = new THREE.PointLight(0x6366f1, 0.5, 30);
      pointLight.position.set(0, 10, 5);
      this.__scene.add(pointLight);
    },

    /**
     * Setup grid visualization
     */
    __setupGrid: function() {
      // Create game board outline
      var boardWidth = this.__cols * this.__blockSize;
      var boardHeight = this.__rows * this.__blockSize;

      // Board background
      var boardGeometry = new THREE.PlaneGeometry(boardWidth, boardHeight);
      var boardMaterial = new THREE.MeshBasicMaterial({
        color: 0x16213e,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      var boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
      boardMesh.position.set(boardWidth / 2 - 0.5, boardHeight / 2 - 0.5, -0.5);
      this.__boardGroup.add(boardMesh);

      // Grid lines
      var gridMaterial = new THREE.LineBasicMaterial({ color: 0x3a506b, transparent: true, opacity: 0.3 });

      // Vertical lines
      for (var x = 0; x <= this.__cols; x++) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([
          x - 0.5, -0.5, 0,
          x - 0.5, this.__rows - 0.5, 0
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        var line = new THREE.Line(geometry, gridMaterial);
        this.__boardGroup.add(line);
      }

      // Horizontal lines
      for (var y = 0; y <= this.__rows; y++) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([
          -0.5, y - 0.5, 0,
          this.__cols - 0.5, y - 0.5, 0
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        var line = new THREE.Line(geometry, gridMaterial);
        this.__boardGroup.add(line);
      }

      // Board frame
      var frameGeometry = new THREE.BufferGeometry();
      var frameVertices = new Float32Array([
        -0.5, -0.5, 0,
        this.__cols - 0.5, -0.5, 0,
        this.__cols - 0.5, this.__rows - 0.5, 0,
        -0.5, this.__rows - 0.5, 0,
        -0.5, -0.5, 0
      ]);
      frameGeometry.setAttribute('position', new THREE.BufferAttribute(frameVertices, 3));
      var frameMaterial = new THREE.LineBasicMaterial({ color: 0x6366f1, linewidth: 2 });
      var frameLine = new THREE.Line(frameGeometry, frameMaterial);
      this.__boardGroup.add(frameLine);
    },

    /**
     * Update camera position based on settings
     */
    __updateCameraPosition: function() {
      if (!this.__camera) return;

      var centerX = this.__cols / 2;
      var centerY = this.__rows / 2;

      var x = centerX + this.__cameraDistance * Math.sin(this.__cameraAngleY) * Math.cos(this.__cameraAngleX);
      var y = centerY + this.__cameraDistance * Math.sin(this.__cameraAngleX);
      var z = this.__cameraDistance * Math.cos(this.__cameraAngleY) * Math.cos(this.__cameraAngleX);

      this.__camera.position.set(x, y, z);
      this.__camera.lookAt(centerX, centerY, 0);
    },

    /**
     * Start render loop
     */
    __startRenderLoop: function() {
      var self = this;

      function animate() {
        self.__animationId = requestAnimationFrame(animate);

        if (self.__renderer && self.__scene && self.__camera) {
          self.__renderer.render(self.__scene, self.__camera);
        }
      }

      animate();
    },

    /**
     * Create a 3D block mesh
     * Y coordinate is inverted so blocks stack from bottom (row 0 = bottom)
     */
    __createBlockMesh: function(x, y, color, isGhost) {
      var geometry = new THREE.BoxGeometry(
        this.__blockSize * 0.95,
        this.__blockSize * 0.95,
        this.__blockSize * 0.95
      );

      // Invert Y: row 0 should be at bottom, row 19 at top
      var displayY = this.__rows - 1 - y;

      var material;
      if (isGhost) {
        material = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.3,
          wireframe: true
        });
      } else {
        material = this.__createMaterial(color);
      }

      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, displayY, 0);

      // Add edge lines for better visibility
      if (!isGhost) {
        var edges = new THREE.EdgesGeometry(geometry);
        var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }));
        mesh.add(line);
      }

      return mesh;
    },

    /**
     * Create material based on selected type
     */
    __createMaterial: function(color) {
      switch (this.__materialType) {
        case 'glossy':
          // Glossy plastic-like material with high shininess
          return new THREE.MeshPhongMaterial({
            color: color,
            shininess: 150,
            specular: 0x666666,
            transparent: true,
            opacity: 0.95,
            reflectivity: 0.5
          });

        case 'metallic':
          // Metallic material with strong specular
          return new THREE.MeshPhongMaterial({
            color: color,
            shininess: 200,
            specular: 0xaaaaaa,
            transparent: true,
            opacity: 0.98,
            reflectivity: 0.8
          });

        case 'glass':
          // Glass-like transparent material
          return new THREE.MeshPhongMaterial({
            color: color,
            shininess: 250,
            specular: 0xffffff,
            transparent: true,
            opacity: 0.7,
            reflectivity: 1.0
          });

        case 'plastic':
          // Standard plastic material
          return new THREE.MeshPhongMaterial({
            color: color,
            shininess: 80,
            specular: 0x333333,
            transparent: true,
            opacity: 0.95
          });

        case 'matte':
          // Matte/diffuse material with no shine
          return new THREE.MeshLambertMaterial({
            color: color,
            transparent: true,
            opacity: 0.95
          });

        default:
          // Default glossy
          return new THREE.MeshPhongMaterial({
            color: color,
            shininess: 150,
            specular: 0x666666,
            transparent: true,
            opacity: 0.95
          });
      }
    },

    /**
     * Update 3D rendering of the game board
     */
    __updateBoardMeshes: function() {
      if (!this.__scene) return;

      // Remove old block meshes
      this.__blockMeshes.forEach(function(mesh) {
        this.__boardGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }, this);
      this.__blockMeshes = [];

      // Create meshes for filled cells
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var cell = this.__board[row][col];
          if (cell.filled) {
            var mesh = this.__createBlockMesh(col, row, cell.color, false);
            this.__boardGroup.add(mesh);
            this.__blockMeshes.push(mesh);
          }
        }
      }
    },

    /**
     * Update 3D rendering of current piece
     */
    __updateCurrentPieceMeshes: function() {
      if (!this.__scene || !this.__currentPiece) return;

      // Remove old piece meshes
      this.__currentPieceMeshes.forEach(function(mesh) {
        this.__boardGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }, this);
      this.__currentPieceMeshes = [];

      // Remove ghost meshes
      if (this.__ghostPieceMeshes) {
        this.__ghostPieceMeshes.forEach(function(mesh) {
          this.__boardGroup.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }, this);
      }
      this.__ghostPieceMeshes = [];

      var piece = this.__currentPiece;
      var shape = piece.shape;
      var color = piece.color;

      // Calculate ghost position
      var ghostY = this.__calculateGhostPosition();

      // Draw ghost piece (preview of drop position)
      for (var row = 0; row < shape.length; row++) {
        for (var col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            var x = piece.x + col;
            var y = ghostY + row;
            if (y >= 0 && y < this.__rows) {
              var ghostMesh = this.__createBlockMesh(x, y, color, true);
              this.__boardGroup.add(ghostMesh);
              this.__ghostPieceMeshes.push(ghostMesh);
            }
          }
        }
      }

      // Draw current piece with 3D effect
      for (var row = 0; row < shape.length; row++) {
        for (var col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            var x = piece.x + col;
            var y = piece.y + row;
            if (y >= 0) {
              var mesh = this.__createBlockMesh(x, y, color, false);
              this.__boardGroup.add(mesh);
              this.__currentPieceMeshes.push(mesh);
            }
          }
        }
      }
    },

    /**
     * Calculate ghost piece position (preview of where piece will land)
     */
    __calculateGhostPosition: function() {
      if (!this.__currentPiece) return 0;

      var piece = this.__currentPiece;
      var ghostY = piece.y;

      while (this.__canMove(piece.x, ghostY + 1, piece.shape)) {
        ghostY++;
      }

      return ghostY;
    },

    /**
     * Generate a new random piece
     */
    __generatePiece: function() {
      var types = deskweb.game.TetrisGame.PIECE_TYPES;
      var type = types[Math.floor(Math.random() * types.length)];
      var pieceData = deskweb.game.TetrisGame.PIECES[type];

      // Apply stage-specific color variations
      var color = this.__getStageColor(pieceData.color);

      return {
        type: type,
        shape: this.__copyShape(pieceData.shape),
        color: color,
        x: Math.floor((this.__cols - pieceData.shape[0].length) / 2),
        y: 0,
        rotation: 0
      };
    },

    /**
     * Get stage-specific color
     */
    __getStageColor: function(baseColor) {
      var stageConfig = this.__stageConfig[this.__stage - 1];
      if (!stageConfig) return baseColor;

      switch (stageConfig.colors) {
        case 'enhanced':
          // Increase saturation
          return this.__adjustColor(baseColor, 1.2);
        case 'vivid':
          // More vibrant colors
          return this.__adjustColor(baseColor, 1.4);
        case 'neon':
          // Neon glow effect - brighter
          return this.__adjustColor(baseColor, 1.6);
        case 'rainbow':
          // Random rainbow variation
          var hueShift = Math.random() * 0.2 - 0.1;
          return this.__shiftHue(baseColor, hueShift);
        default:
          return baseColor;
      }
    },

    /**
     * Adjust color brightness
     */
    __adjustColor: function(color, factor) {
      var r = (color >> 16) & 0xFF;
      var g = (color >> 8) & 0xFF;
      var b = color & 0xFF;

      r = Math.min(255, Math.floor(r * factor));
      g = Math.min(255, Math.floor(g * factor));
      b = Math.min(255, Math.floor(b * factor));

      return (r << 16) | (g << 8) | b;
    },

    /**
     * Shift hue of color
     */
    __shiftHue: function(color, shift) {
      var r = ((color >> 16) & 0xFF) / 255;
      var g = ((color >> 8) & 0xFF) / 255;
      var b = (color & 0xFF) / 255;

      var max = Math.max(r, g, b);
      var min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      h = (h + shift) % 1;
      if (h < 0) h += 1;

      // Convert back to RGB
      if (s === 0) {
        r = g = b = l;
      } else {
        var hue2rgb = function(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }

      return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
    },

    /**
     * Copy shape array
     */
    __copyShape: function(shape) {
      return shape.map(function(row) {
        return row.slice();
      });
    },

    /**
     * Rotate piece clockwise
     */
    __rotateShape: function(shape) {
      var rows = shape.length;
      var cols = shape[0].length;
      var rotated = [];

      for (var col = 0; col < cols; col++) {
        rotated[col] = [];
        for (var row = rows - 1; row >= 0; row--) {
          rotated[col][rows - 1 - row] = shape[row][col];
        }
      }

      return rotated;
    },

    /**
     * Check if piece can move to position
     */
    __canMove: function(x, y, shape) {
      for (var row = 0; row < shape.length; row++) {
        for (var col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            var newX = x + col;
            var newY = y + row;

            // Check boundaries
            if (newX < 0 || newX >= this.__cols || newY >= this.__rows) {
              return false;
            }

            // Check collision with placed blocks
            if (newY >= 0 && this.__board[newY][newX].filled) {
              return false;
            }
          }
        }
      }
      return true;
    },

    /**
     * Lock current piece in place
     */
    __lockPiece: function() {
      if (!this.__currentPiece) return;

      var piece = this.__currentPiece;
      var shape = piece.shape;

      for (var row = 0; row < shape.length; row++) {
        for (var col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            var x = piece.x + col;
            var y = piece.y + row;
            if (y >= 0 && y < this.__rows && x >= 0 && x < this.__cols) {
              this.__board[y][x] = { filled: true, color: piece.color };
            }
          }
        }
      }

      // Play lock sound
      this.__playSound('drop', piece.x + shape[0].length / 2, piece.y);
      this.fireEvent("pieceLocked");

      // Check for completed lines
      this.__checkLines();

      // Update board meshes
      this.__updateBoardMeshes();

      // Spawn next piece
      this.__spawnNextPiece();
    },

    /**
     * Check and clear completed lines
     */
    __checkLines: function() {
      var linesCleared = [];

      for (var row = this.__rows - 1; row >= 0; row--) {
        var complete = true;
        for (var col = 0; col < this.__cols; col++) {
          if (!this.__board[row][col].filled) {
            complete = false;
            break;
          }
        }

        if (complete) {
          linesCleared.push(row);
        }
      }

      if (linesCleared.length > 0) {
        // Play clear sound
        this.__playSound('clear', this.__cols / 2, linesCleared[0]);

        // Remove completed lines
        linesCleared.forEach(function(row) {
          this.__board.splice(row, 1);
          var newRow = [];
          for (var col = 0; col < this.__cols; col++) {
            newRow.push({ filled: false, color: null });
          }
          this.__board.unshift(newRow);
        }, this);

        // Update score
        var lineScore = [0, 100, 300, 500, 800]; // 0, 1, 2, 3, 4 lines
        var points = lineScore[linesCleared.length] * this.__level;
        this.__score += points;
        this.__lines += linesCleared.length;

        // Check for level up
        var newLevel = Math.floor(this.__lines / 10) + 1;
        if (newLevel > this.__level) {
          this.__level = newLevel;
          this.__updateDropSpeed();
          this.fireDataEvent("levelChange", this.__level);

          // Check for stage change
          var newStage = Math.min(10, Math.floor((this.__level - 1) / 1) + 1);
          if (newStage > this.__stage) {
            this.__stage = newStage;
            this.fireDataEvent("stageChange", this.__stage);
          }
        }

        this.fireDataEvent("linesCleared", linesCleared.length);
        this.fireDataEvent("scoreUpdate", { score: this.__score, lines: this.__lines });

        // Update board meshes
        this.__updateBoardMeshes();
      }
    },

    /**
     * Update drop speed based on level/stage
     */
    __updateDropSpeed: function() {
      var stageConfig = this.__stageConfig[Math.min(this.__stage - 1, 9)];
      this.__dropInterval = stageConfig ? stageConfig.speed : Math.max(100, 1000 - (this.__level - 1) * 100);

      if (this.__dropTimer) {
        this.__dropTimer.setInterval(this.__dropInterval);
      }

      console.log("[TetrisGame] Drop speed updated:", this.__dropInterval, "ms");
    },

    /**
     * Spawn next piece
     */
    __spawnNextPiece: function() {
      this.__currentPiece = this.__nextPiece || this.__generatePiece();
      this.__nextPiece = this.__generatePiece();

      // Check for game over
      if (!this.__canMove(this.__currentPiece.x, this.__currentPiece.y, this.__currentPiece.shape)) {
        this.__gameOver();
        return;
      }

      this.__updateCurrentPieceMeshes();
      this.fireEvent("gameStateChange");
    },

    /**
     * Game over
     */
    __gameOver: function() {
      this.__gameState = "gameover";
      this.__stopDropTimer();

      this.__playSound('gameover', this.__cols / 2, this.__rows / 2);

      this.fireDataEvent("gameOver", {
        score: this.__score,
        lines: this.__lines,
        level: this.__level,
        stage: this.__stage
      });
      this.fireEvent("gameStateChange");

      console.log("[TetrisGame] Game over! Score:", this.__score);
    },

    /**
     * Start drop timer
     */
    __startDropTimer: function() {
      if (this.__dropTimer) {
        this.__dropTimer.start();
        return;
      }

      this.__dropTimer = new qx.event.Timer(this.__dropInterval);
      this.__dropTimer.addListener("interval", function() {
        if (this.__gameState === "playing") {
          this.moveDown();
        }
      }, this);
      this.__dropTimer.start();
    },

    /**
     * Stop drop timer
     */
    __stopDropTimer: function() {
      if (this.__dropTimer) {
        this.__dropTimer.stop();
      }
    },

    // Public API methods

    /**
     * Start new game
     */
    newGame: function() {
      console.log("[TetrisGame] Starting new game");

      this.__initBoard();
      this.__score = 0;
      this.__lines = 0;
      this.__level = 1;
      this.__stage = 1;
      this.__dropInterval = 1000;

      this.__gameState = "playing";

      // Generate initial pieces
      this.__nextPiece = this.__generatePiece();
      this.__spawnNextPiece();

      // Start timer
      this.__updateDropSpeed();
      this.__startDropTimer();

      // Update visuals
      this.__updateBoardMeshes();

      this.fireDataEvent("scoreUpdate", { score: this.__score, lines: this.__lines });
      this.fireDataEvent("levelChange", this.__level);
      this.fireDataEvent("stageChange", this.__stage);
      this.fireEvent("gameStateChange");
    },

    /**
     * Pause game
     */
    pause: function() {
      if (this.__gameState === "playing") {
        this.__gameState = "paused";
        this.__stopDropTimer();
        this.fireEvent("gameStateChange");
        console.log("[TetrisGame] Game paused");
      }
    },

    /**
     * Resume game
     */
    resume: function() {
      if (this.__gameState === "paused") {
        this.__gameState = "playing";
        this.__startDropTimer();
        this.fireEvent("gameStateChange");
        console.log("[TetrisGame] Game resumed");
      }
    },

    /**
     * Move piece left
     */
    moveLeft: function() {
      if (this.__gameState !== "playing" || !this.__currentPiece) return false;

      if (this.__canMove(this.__currentPiece.x - 1, this.__currentPiece.y, this.__currentPiece.shape)) {
        this.__currentPiece.x--;
        this.__playSound('move', this.__currentPiece.x, this.__currentPiece.y);
        this.__updateCurrentPieceMeshes();
        return true;
      }
      return false;
    },

    /**
     * Move piece right
     */
    moveRight: function() {
      if (this.__gameState !== "playing" || !this.__currentPiece) return false;

      if (this.__canMove(this.__currentPiece.x + 1, this.__currentPiece.y, this.__currentPiece.shape)) {
        this.__currentPiece.x++;
        this.__playSound('move', this.__currentPiece.x, this.__currentPiece.y);
        this.__updateCurrentPieceMeshes();
        return true;
      }
      return false;
    },

    /**
     * Move piece down
     */
    moveDown: function() {
      if (this.__gameState !== "playing" || !this.__currentPiece) return false;

      if (this.__canMove(this.__currentPiece.x, this.__currentPiece.y + 1, this.__currentPiece.shape)) {
        this.__currentPiece.y++;
        this.__updateCurrentPieceMeshes();
        return true;
      } else {
        this.__lockPiece();
        return false;
      }
    },

    /**
     * Rotate piece with 3D animation effect
     */
    rotate: function() {
      if (this.__gameState !== "playing" || !this.__currentPiece) return false;

      var piece = this.__currentPiece;
      var rotated = this.__rotateShape(piece.shape);

      // Try rotation with wall kicks
      var kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]];

      for (var i = 0; i < kicks.length; i++) {
        var kickX = piece.x + kicks[i][0];
        var kickY = piece.y + kicks[i][1];

        if (this.__canMove(kickX, kickY, rotated)) {
          piece.shape = rotated;
          piece.x = kickX;
          piece.y = kickY;
          piece.rotation = (piece.rotation + 90) % 360;

          // 3D rotation animation
          this.__animateRotation();

          this.__playSound('rotate', piece.x + rotated[0].length / 2, piece.y);
          this.fireEvent("pieceRotated");
          this.__updateCurrentPieceMeshes();
          return true;
        }
      }

      return false;
    },

    /**
     * Animate 3D rotation effect
     */
    __animateRotation: function() {
      if (!this.__currentPieceMeshes || this.__currentPieceMeshes.length === 0) return;

      var self = this;
      var startRotation = 0;
      var targetRotation = Math.PI / 2;
      var duration = 100;
      var startTime = Date.now();

      function animate() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease out
        var eased = 1 - Math.pow(1 - progress, 3);
        var currentRotation = startRotation + (targetRotation - startRotation) * eased;

        self.__currentPieceMeshes.forEach(function(mesh) {
          mesh.rotation.z = currentRotation;
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Reset rotation after animation
          self.__currentPieceMeshes.forEach(function(mesh) {
            mesh.rotation.z = 0;
          });
        }
      }

      animate();
    },

    /**
     * Hard drop - drop piece to bottom instantly
     */
    hardDrop: function() {
      if (this.__gameState !== "playing" || !this.__currentPiece) return;

      var dropDistance = 0;
      while (this.__canMove(this.__currentPiece.x, this.__currentPiece.y + 1, this.__currentPiece.shape)) {
        this.__currentPiece.y++;
        dropDistance++;
      }

      // Bonus points for hard drop
      this.__score += dropDistance * 2;
      this.fireDataEvent("scoreUpdate", { score: this.__score, lines: this.__lines });

      this.__lockPiece();
    },

    /**
     * Set camera distance (zoom)
     */
    setCameraDistance: function(distance) {
      this.__cameraDistance = Math.max(15, Math.min(50, distance));
      this.__updateCameraPosition();
    },

    /**
     * Set camera angle X (up/down)
     */
    setCameraAngleX: function(angle) {
      this.__cameraAngleX = Math.max(-0.8, Math.min(0.8, angle));
      this.__updateCameraPosition();
    },

    /**
     * Set camera angle Y (left/right)
     */
    setCameraAngleY: function(angle) {
      this.__cameraAngleY = angle;
      this.__updateCameraPosition();
    },

    /**
     * Set WebGL mode
     */
    setUseWebGL: function(useWebGL) {
      this.__useWebGL = useWebGL;
      console.log("[TetrisGame] Graphics mode set to:", useWebGL ? "WebGL" : "Canvas");
    },

    /**
     * Set material type
     * @param {String} type - 'glossy', 'metallic', 'glass', 'plastic', 'matte'
     */
    setMaterialType: function(type) {
      this.__materialType = type;
      console.log("[TetrisGame] Material type set to:", type);

      // Refresh all meshes with new material
      this.__updateBoardMeshes();
      this.__updateCurrentPieceMeshes();
    },

    /**
     * Get current material type
     */
    getMaterialType: function() {
      return this.__materialType;
    },

    /**
     * Resize renderer
     */
    resize: function(width, height) {
      if (this.__renderer && this.__camera) {
        this.__renderer.setSize(width, height);
        this.__camera.aspect = width / height;
        this.__camera.updateProjectionMatrix();
        console.log("[TetrisGame] Resized to:", width, "x", height);
      }
    },

    // Getters

    getScore: function() { return this.__score; },
    getLines: function() { return this.__lines; },
    getLevel: function() { return this.__level; },
    getStage: function() { return this.__stage; },
    getGameState: function() { return this.__gameState; },
    getNextPiece: function() { return this.__nextPiece; },
    getCameraDistance: function() { return this.__cameraDistance; },
    getCameraAngleX: function() { return this.__cameraAngleX; },
    getCameraAngleY: function() { return this.__cameraAngleY; },
    getUseWebGL: function() { return this.__useWebGL; },
    getStageConfig: function() { return this.__stageConfig[this.__stage - 1]; }
  },

  destruct : function()
  {
    console.log("[TetrisGame] Disposing...");

    // Stop timer
    if (this.__dropTimer) {
      this.__dropTimer.stop();
      this.__dropTimer.dispose();
      this.__dropTimer = null;
    }

    // Stop render loop
    if (this.__animationId) {
      cancelAnimationFrame(this.__animationId);
      this.__animationId = null;
    }

    // Dispose Three.js objects
    if (this.__renderer) {
      this.__renderer.dispose();
      if (this.__container && this.__renderer.domElement) {
        this.__container.removeChild(this.__renderer.domElement);
      }
      this.__renderer = null;
    }

    if (this.__scene) {
      this.__scene.traverse(function(object) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(function(m) { m.dispose(); });
          } else {
            object.material.dispose();
          }
        }
      });
      this.__scene = null;
    }

    // Close audio context
    if (this.__audioContext) {
      this.__audioContext.close();
      this.__audioContext = null;
    }

    this.__board = null;
    this.__currentPiece = null;
    this.__nextPiece = null;
    this.__blockMeshes = null;
    this.__currentPieceMeshes = null;
    this.__ghostPieceMeshes = null;

    console.log("[TetrisGame] Disposed");
  }
});
