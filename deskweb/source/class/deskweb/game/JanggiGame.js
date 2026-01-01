/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Korean Chess (Janggi) Game Logic
 *
 * Implements traditional Korean chess rules with AI opponent using LLM API.
 * Features:
 * - Full traditional Janggi rules
 * - AI opponent using LLM for move prediction
 * - Move validation guardrails
 * - Game history tracking
 * - Game replay/analysis functionality
 *
 * @ignore(THREE)
 * @ignore(requestAnimationFrame)
 * @ignore(cancelAnimationFrame)
 * @ignore(AudioContext)
 * @ignore(webkitAudioContext)
 */
qx.Class.define("deskweb.game.JanggiGame",
{
  extend : qx.core.Object,

  /**
   * @param sessionId {String} Unique session ID for this game instance
   */
  construct : function(sessionId)
  {
    this.base(arguments);

    this.__sessionId = sessionId || "janggi-" + Date.now();
    console.log("[JanggiGame] Initializing with session:", this.__sessionId);

    // Board dimensions: 10 rows x 9 columns
    this.__rows = 10;
    this.__cols = 9;
    this.__blockSize = 1;

    // Game state
    this.__board = [];
    this.__selectedPiece = null;
    this.__validMoves = [];
    this.__currentPlayer = "cho"; // "cho" (red/bottom) or "han" (blue/top)
    this.__gameState = "ready"; // ready, playing, paused, gameover
    this.__winner = null;
    this.__gameEndReason = null; // "checkmate", "capture", "stalemate"

    // Score tracking
    this.__score = { cho: 0, han: 0 };

    // Game history
    this.__moveHistory = [];
    this.__capturedPieces = { cho: [], han: [] };

    // AI settings
    this.__isAIThinking = false;
    this.__aiDifficulty = "medium"; // easy, medium, hard
    this.__ai = null; // JanggiAI instance, initialized later

    // 3D rendering
    this.__scene = null;
    this.__camera = null;
    this.__renderer = null;
    this.__boardGroup = null;
    this.__pieceMeshes = {};
    this.__highlightMeshes = [];

    // Camera settings
    this.__cameraDistance = 15;
    this.__cameraAngleX = 0.8; // Looking down at the board
    this.__cameraAngleY = 0;

    // Material type
    this.__materialType = 'wood';

    // Animation state
    this.__isAnimating = false;
    this.__pendingAnimations = [];

    // Initialize
    this.__initBoard();
    this.__initAudio();

    console.log("[JanggiGame] Initialized successfully");
  },

  events :
  {
    /** Fired when game state changes */
    "gameStateChange": "qx.event.type.Event",

    /** Fired when a piece is selected */
    "pieceSelected": "qx.event.type.Data",

    /** Fired when a move is made */
    "moveMade": "qx.event.type.Data",

    /** Fired when game is over */
    "gameOver": "qx.event.type.Data",

    /** Fired when AI is thinking */
    "aiThinking": "qx.event.type.Data",

    /** Fired when AI move is ready */
    "aiMoveReady": "qx.event.type.Data",

    /** Fired for rendering update */
    "renderUpdate": "qx.event.type.Event",

    /** Fired when AI has a message (tactical explanation, taunt) */
    "aiMessage": "qx.event.type.Data",

    /** Fired when check occurs */
    "checkOccurred": "qx.event.type.Data"
  },

  statics :
  {
    // Piece types (한글 표기)
    PIECES: {
      KING: { name: "왕", nameHan: "초", nameCho: "한", symbol: "K", korName: "왕/장" },
      CAR: { name: "차", symbol: "R", korName: "차" },     // Rook-like
      CANNON: { name: "포", symbol: "C", korName: "포" },  // Cannon
      HORSE: { name: "마", symbol: "H", korName: "마" },   // Knight-like
      ELEPHANT: { name: "상", symbol: "E", korName: "상" }, // Elephant
      GUARD: { name: "사", symbol: "G", korName: "사" },   // Guard/Advisor
      SOLDIER: { name: "졸", nameHan: "졸", nameCho: "병", symbol: "S", korName: "졸/병" } // Pawn-like
    },

    // Palace boundaries
    PALACE: {
      cho: { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 },
      han: { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 }
    },

    // Initial board setup
    INITIAL_SETUP: {
      han: [
        // row 0: back row
        { type: "CAR", row: 0, col: 0 },
        { type: "ELEPHANT", row: 0, col: 1 },
        { type: "HORSE", row: 0, col: 2 },
        { type: "GUARD", row: 0, col: 3 },
        { type: "GUARD", row: 0, col: 5 },
        { type: "ELEPHANT", row: 0, col: 6 },
        { type: "HORSE", row: 0, col: 7 },
        { type: "CAR", row: 0, col: 8 },
        // row 1: king
        { type: "KING", row: 1, col: 4 },
        // row 2: cannons
        { type: "CANNON", row: 2, col: 1 },
        { type: "CANNON", row: 2, col: 7 },
        // row 3: soldiers
        { type: "SOLDIER", row: 3, col: 0 },
        { type: "SOLDIER", row: 3, col: 2 },
        { type: "SOLDIER", row: 3, col: 4 },
        { type: "SOLDIER", row: 3, col: 6 },
        { type: "SOLDIER", row: 3, col: 8 }
      ],
      cho: [
        // row 9: back row
        { type: "CAR", row: 9, col: 0 },
        { type: "ELEPHANT", row: 9, col: 1 },
        { type: "HORSE", row: 9, col: 2 },
        { type: "GUARD", row: 9, col: 3 },
        { type: "GUARD", row: 9, col: 5 },
        { type: "ELEPHANT", row: 9, col: 6 },
        { type: "HORSE", row: 9, col: 7 },
        { type: "CAR", row: 9, col: 8 },
        // row 8: king
        { type: "KING", row: 8, col: 4 },
        // row 7: cannons
        { type: "CANNON", row: 7, col: 1 },
        { type: "CANNON", row: 7, col: 7 },
        // row 6: soldiers
        { type: "SOLDIER", row: 6, col: 0 },
        { type: "SOLDIER", row: 6, col: 2 },
        { type: "SOLDIER", row: 6, col: 4 },
        { type: "SOLDIER", row: 6, col: 6 },
        { type: "SOLDIER", row: 6, col: 8 }
      ]
    }
  },

  members :
  {
    __sessionId: null,
    __rows: null,
    __cols: null,
    __blockSize: null,
    __board: null,
    __selectedPiece: null,
    __validMoves: null,
    __currentPlayer: null,
    __gameState: null,
    __winner: null,
    __gameEndReason: null,
    __score: null,
    __moveHistory: null,
    __capturedPieces: null,
    __isAIThinking: null,
    __aiDifficulty: null,
    __scene: null,
    __camera: null,
    __renderer: null,
    __boardGroup: null,
    __pieceMeshes: null,
    __highlightMeshes: null,
    __cameraDistance: null,
    __cameraAngleX: null,
    __cameraAngleY: null,
    __container: null,
    __animationId: null,
    __materialType: null,
    __audioContext: null,
    __isAnimating: false,
    __pendingAnimations: null,

    /**
     * Initialize audio context for sound effects
     */
    __initAudio: function() {
      try {
        this.__audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("[JanggiGame] Audio context initialized");
      } catch (e) {
        console.warn("[JanggiGame] Could not initialize audio context:", e);
      }
    },

    /**
     * Play impact sound effect
     * @param {String} type - "move" for normal move, "capture" for capturing
     */
    __playSound: function(type) {
      if (!this.__audioContext) return;

      try {
        var ctx = this.__audioContext;
        var oscillator = ctx.createOscillator();
        var gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === "capture") {
          // Stronger impact sound for capture - "탁!"
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(150, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
        } else {
          // Soft placement sound - "톡"
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(300, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.08);
        }
      } catch (e) {
        console.warn("[JanggiGame] Sound play error:", e);
      }
    },

    /**
     * Animate piece movement with 3D parabolic arc
     * @param {Object} mesh - Three.js mesh to animate
     * @param {Object} from - Start position {x, y, z}
     * @param {Object} to - End position {x, y, z}
     * @param {Number} duration - Animation duration in ms
     * @param {Function} onComplete - Callback when animation completes
     */
    __animatePieceMove: function(mesh, from, to, duration, onComplete) {
      var self = this;
      var startTime = Date.now();
      var arcHeight = 0.5; // Height of the arc

      // Calculate distance for dynamic arc height
      var dx = to.x - from.x;
      var dz = to.z - from.z;
      var distance = Math.sqrt(dx * dx + dz * dz);
      arcHeight = Math.min(0.8, 0.3 + distance * 0.1);

      function animateStep() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        var easeProgress = 1 - Math.pow(1 - progress, 3);

        // Linear interpolation for x and z
        var x = from.x + (to.x - from.x) * easeProgress;
        var z = from.z + (to.z - from.z) * easeProgress;

        // Parabolic arc for y (height)
        // y = baseY + arcHeight * 4 * t * (1 - t) where t is progress
        var arcY = arcHeight * 4 * progress * (1 - progress);
        var y = from.y + arcY;

        mesh.position.set(x, y, z);

        // Add slight rotation during flight
        mesh.rotation.y = progress * Math.PI * 0.5;

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        } else {
          // Ensure final position is exact
          mesh.position.set(to.x, to.y, to.z);
          mesh.rotation.y = 0;
          if (onComplete) onComplete();
        }
      }

      animateStep();
    },

    /**
     * Animate captured piece flying off the board
     * @param {Object} mesh - Three.js mesh of captured piece
     * @param {String} capturedByTeam - Team that captured the piece
     */
    __animateCapturedPiece: function(mesh, capturedByTeam) {
      var self = this;
      var startTime = Date.now();
      var duration = 600;
      var startPos = mesh.position.clone();

      // Direction based on which team captured (fly towards the capturing team's side)
      var direction = capturedByTeam === "cho" ? -1 : 1;
      var targetX = startPos.x + (Math.random() - 0.5) * 3;
      var targetZ = direction * 6; // Fly off board
      var targetY = -1; // Fall below board

      function animateStep() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease in for acceleration (gravity effect)
        var easeProgress = progress * progress;

        // Position
        var x = startPos.x + (targetX - startPos.x) * progress;
        var z = startPos.z + (targetZ - startPos.z) * easeProgress;

        // Arc up then fall
        var arcProgress = progress < 0.3 ? progress / 0.3 : 1;
        var fallProgress = progress > 0.3 ? (progress - 0.3) / 0.7 : 0;
        var y = startPos.y + 0.5 * (1 - Math.pow(arcProgress * 2 - 1, 2)) - fallProgress * 1.5;

        mesh.position.set(x, y, z);

        // Tumbling rotation
        mesh.rotation.x = progress * Math.PI * 2;
        mesh.rotation.z = progress * Math.PI * 1.5;

        // Fade out (scale down)
        var scale = 1 - easeProgress * 0.5;
        mesh.scale.set(scale, scale, scale);

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        } else {
          // Remove mesh from scene
          if (mesh.parent) {
            mesh.parent.remove(mesh);
          }
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        }
      }

      animateStep();
    },

    /**
     * Initialize game board with starting positions
     */
    __initBoard: function() {
      // Create empty board
      this.__board = [];
      for (var row = 0; row < this.__rows; row++) {
        this.__board[row] = [];
        for (var col = 0; col < this.__cols; col++) {
          this.__board[row][col] = null;
        }
      }

      // Place pieces
      var setup = deskweb.game.JanggiGame.INITIAL_SETUP;

      // Place Han (blue/top) pieces
      setup.han.forEach(function(p) {
        this.__board[p.row][p.col] = {
          type: p.type,
          team: "han",
          id: "han-" + p.type + "-" + p.row + "-" + p.col
        };
      }, this);

      // Place Cho (red/bottom) pieces
      setup.cho.forEach(function(p) {
        this.__board[p.row][p.col] = {
          type: p.type,
          team: "cho",
          id: "cho-" + p.type + "-" + p.row + "-" + p.col
        };
      }, this);

      console.log("[JanggiGame] Board initialized with starting positions");
    },

    /**
     * Initialize 3D rendering
     */
    init3D: function(container, width, height) {
      if (typeof THREE === 'undefined') {
        console.error("[JanggiGame] Three.js not loaded!");
        return false;
      }

      this.__container = container;

      console.log("[JanggiGame] Initializing 3D with dimensions:", width, "x", height);

      // Create scene
      this.__scene = new THREE.Scene();
      this.__scene.background = new THREE.Color(0x2d1810);

      // Create camera
      this.__camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      this.__updateCameraPosition();

      // Create renderer
      try {
        this.__renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.__renderer.setSize(width, height);
        this.__renderer.setPixelRatio(window.devicePixelRatio);
        this.__renderer.shadowMap.enabled = true;
        this.__renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.__renderer.domElement);
      } catch (e) {
        console.error("[JanggiGame] Renderer creation failed:", e);
        return false;
      }

      // Create board group
      this.__boardGroup = new THREE.Group();
      this.__scene.add(this.__boardGroup);

      // Setup lighting
      this.__setupLighting();

      // Create board
      this.__createBoard();

      // Create pieces
      this.__createAllPieces();

      // Start render loop
      this.__startRenderLoop();

      console.log("[JanggiGame] 3D initialized successfully");
      return true;
    },

    /**
     * Setup lighting
     */
    __setupLighting: function() {
      // Ambient light
      var ambient = new THREE.AmbientLight(0xffffff, 0.4);
      this.__scene.add(ambient);

      // Main directional light from top
      var directional = new THREE.DirectionalLight(0xffffff, 0.8);
      directional.position.set(0, 15, 5);
      directional.castShadow = true;
      directional.shadow.mapSize.width = 2048;
      directional.shadow.mapSize.height = 2048;
      directional.shadow.camera.near = 0.5;
      directional.shadow.camera.far = 50;
      this.__scene.add(directional);

      // Point light for warm atmosphere
      var pointLight = new THREE.PointLight(0xffaa55, 0.3, 30);
      pointLight.position.set(5, 10, 5);
      this.__scene.add(pointLight);
    },

    /**
     * Create the game board
     */
    __createBoard: function() {
      var boardWidth = this.__cols * this.__blockSize;
      var boardHeight = this.__rows * this.__blockSize;

      // Board base (wooden texture)
      var boardGeometry = new THREE.BoxGeometry(boardWidth + 1, 0.3, boardHeight + 1);
      var boardMaterial = new THREE.MeshPhongMaterial({
        color: 0xd4a574,
        shininess: 30
      });
      var boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
      boardMesh.position.set(boardWidth / 2 - 0.5, -0.15, boardHeight / 2 - 0.5);
      boardMesh.receiveShadow = true;
      this.__boardGroup.add(boardMesh);

      // Grid lines
      var lineMaterial = new THREE.LineBasicMaterial({ color: 0x2d1810, linewidth: 2 });

      // Vertical lines
      for (var col = 0; col < this.__cols; col++) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([
          col, 0.01, 0,
          col, 0.01, this.__rows - 1
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        var line = new THREE.Line(geometry, lineMaterial);
        this.__boardGroup.add(line);
      }

      // Horizontal lines
      for (var row = 0; row < this.__rows; row++) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([
          0, 0.01, row,
          this.__cols - 1, 0.01, row
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        var line = new THREE.Line(geometry, lineMaterial);
        this.__boardGroup.add(line);
      }

      // Palace diagonal lines
      this.__drawPalaceDiagonals("han");
      this.__drawPalaceDiagonals("cho");

      // River (Han River) marking
      this.__drawRiver();
    },

    /**
     * Draw palace diagonal lines
     */
    __drawPalaceDiagonals: function(team) {
      var palace = deskweb.game.JanggiGame.PALACE[team];
      var lineMaterial = new THREE.LineBasicMaterial({ color: 0x2d1810, linewidth: 1 });

      // Diagonal from top-left to bottom-right
      var geom1 = new THREE.BufferGeometry();
      var verts1 = new Float32Array([
        palace.colMin, 0.01, palace.rowMin,
        palace.colMax, 0.01, palace.rowMax
      ]);
      geom1.setAttribute('position', new THREE.BufferAttribute(verts1, 3));
      this.__boardGroup.add(new THREE.Line(geom1, lineMaterial));

      // Diagonal from top-right to bottom-left
      var geom2 = new THREE.BufferGeometry();
      var verts2 = new Float32Array([
        palace.colMax, 0.01, palace.rowMin,
        palace.colMin, 0.01, palace.rowMax
      ]);
      geom2.setAttribute('position', new THREE.BufferAttribute(verts2, 3));
      this.__boardGroup.add(new THREE.Line(geom2, lineMaterial));
    },

    /**
     * Draw river marking
     */
    __drawRiver: function() {
      // River is between row 4 and 5
      var textGeometry = new THREE.PlaneGeometry(2, 0.5);
      var textMaterial = new THREE.MeshBasicMaterial({
        color: 0x4a90d9,
        transparent: true,
        opacity: 0.3
      });

      // Han side marker
      var hanMarker = new THREE.Mesh(textGeometry, textMaterial);
      hanMarker.rotation.x = -Math.PI / 2;
      hanMarker.position.set(2, 0.02, 4.5);
      this.__boardGroup.add(hanMarker);

      // Cho side marker
      var choMarker = new THREE.Mesh(textGeometry, textMaterial);
      choMarker.rotation.x = -Math.PI / 2;
      choMarker.position.set(6, 0.02, 4.5);
      this.__boardGroup.add(choMarker);
    },

    /**
     * Create all pieces on the board
     */
    __createAllPieces: function() {
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece) {
            this.__createPieceMesh(piece, row, col);
          }
        }
      }
    },

    /**
     * Create a 3D piece mesh
     */
    __createPieceMesh: function(piece, row, col) {
      var pieceData = deskweb.game.JanggiGame.PIECES[piece.type];

      // Piece base (octagonal shape)
      var radius = 0.4;
      var height = 0.15;
      var geometry = new THREE.CylinderGeometry(radius, radius * 0.9, height, 8);

      // Color based on team
      var color = piece.team === "cho" ? 0xcc3333 : 0x3366cc;
      var material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: 80,
        specular: 0x444444
      });

      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(col, height / 2 + 0.01, row);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Store piece data in mesh
      mesh.userData = {
        piece: piece,
        row: row,
        col: col
      };

      // Create text label on top
      this.__createPieceLabel(mesh, piece, pieceData);

      this.__boardGroup.add(mesh);
      this.__pieceMeshes[piece.id] = mesh;
    },

    /**
     * Create text label on piece
     */
    __createPieceLabel: function(mesh, piece, pieceData) {
      // Create a canvas for the text
      var canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      var ctx = canvas.getContext('2d');

      // Clear canvas
      ctx.fillStyle = piece.team === "cho" ? '#cc3333' : '#3366cc';
      ctx.fillRect(0, 0, 128, 128);

      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var name = pieceData.name;
      if (piece.type === "KING") {
        name = piece.team === "cho" ? "한" : "초";  // 한글로 변경
      } else if (piece.type === "SOLDIER") {
        name = piece.team === "cho" ? "병" : "졸";  // 한글로 변경
      }
      ctx.fillText(name, 64, 64);

      // Create texture
      var texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      // Create plane for top of piece
      var labelGeometry = new THREE.CircleGeometry(0.35, 8);
      var labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      });
      var label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.rotation.x = -Math.PI / 2;
      label.position.y = 0.076;

      mesh.add(label);
    },

    /**
     * Update camera position
     */
    __updateCameraPosition: function() {
      if (!this.__camera) return;

      var centerX = (this.__cols - 1) / 2;
      var centerZ = (this.__rows - 1) / 2;

      var x = centerX + this.__cameraDistance * Math.sin(this.__cameraAngleY) * Math.cos(this.__cameraAngleX);
      var y = this.__cameraDistance * Math.sin(this.__cameraAngleX);
      var z = centerZ + this.__cameraDistance * Math.cos(this.__cameraAngleY) * Math.cos(this.__cameraAngleX);

      this.__camera.position.set(x, y, z);
      this.__camera.lookAt(centerX, 0, centerZ);
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
     * Handle click on the board
     */
    handleClick: function(row, col) {
      if (this.__gameState !== "playing") return;
      if (this.__isAIThinking) return;
      if (this.__isAnimating) return; // Don't accept clicks during animation
      if (this.__currentPlayer !== "cho") return; // Human plays Cho

      console.log("[JanggiGame] Click at:", row, col);

      var clickedPiece = this.__board[row][col];

      // If a piece is selected
      if (this.__selectedPiece) {
        // Check if clicked on valid move
        var isValidMove = this.__validMoves.some(function(move) {
          return move.row === row && move.col === col;
        });

        if (isValidMove) {
          // Make the move
          this.__makeMove(this.__selectedPiece.row, this.__selectedPiece.col, row, col);
          this.__clearSelection();
          // AI's turn is now called from within __makeMove after animation completes
        } else if (clickedPiece && clickedPiece.team === "cho") {
          // Select different piece
          this.__selectPiece(row, col);
        } else {
          // Deselect
          this.__clearSelection();
        }
      } else {
        // Select piece
        if (clickedPiece && clickedPiece.team === "cho") {
          this.__selectPiece(row, col);
        }
      }
    },

    /**
     * Select a piece and show valid moves
     */
    __selectPiece: function(row, col) {
      var piece = this.__board[row][col];
      if (!piece) return;

      this.__selectedPiece = { row: row, col: col, piece: piece };
      this.__validMoves = this.__getValidMoves(row, col, piece);

      // Highlight selected piece and valid moves
      this.__highlightSelection();

      this.fireDataEvent("pieceSelected", {
        piece: piece,
        row: row,
        col: col,
        validMoves: this.__validMoves
      });

      console.log("[JanggiGame] Selected:", piece.type, "at", row, col, "Valid moves:", this.__validMoves.length);
    },

    /**
     * Clear piece selection
     */
    __clearSelection: function() {
      this.__selectedPiece = null;
      this.__validMoves = [];
      this.__clearHighlights();
    },

    /**
     * Highlight selected piece and valid moves
     */
    __highlightSelection: function() {
      this.__clearHighlights();

      if (!this.__selectedPiece) return;

      // Highlight selected piece
      this.__createHighlight(this.__selectedPiece.row, this.__selectedPiece.col, 0xffff00);

      // Highlight valid moves
      this.__validMoves.forEach(function(move) {
        var color = move.isCapture ? 0xff0000 : 0x00ff00;
        this.__createHighlight(move.row, move.col, color);
      }, this);
    },

    /**
     * Create highlight mesh
     */
    __createHighlight: function(row, col, color) {
      var geometry = new THREE.RingGeometry(0.3, 0.45, 16);
      var material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(col, 0.02, row);
      this.__boardGroup.add(mesh);
      this.__highlightMeshes.push(mesh);
    },

    /**
     * Clear all highlights
     */
    __clearHighlights: function() {
      this.__highlightMeshes.forEach(function(mesh) {
        this.__boardGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }, this);
      this.__highlightMeshes = [];
    },

    /**
     * Get valid moves for a piece
     */
    __getValidMoves: function(row, col, piece) {
      var moves = [];

      switch (piece.type) {
        case "KING":
          moves = this.__getKingMoves(row, col, piece);
          break;
        case "GUARD":
          moves = this.__getGuardMoves(row, col, piece);
          break;
        case "CAR":
          moves = this.__getCarMoves(row, col, piece);
          break;
        case "CANNON":
          moves = this.__getCannonMoves(row, col, piece);
          break;
        case "HORSE":
          moves = this.__getHorseMoves(row, col, piece);
          break;
        case "ELEPHANT":
          moves = this.__getElephantMoves(row, col, piece);
          break;
        case "SOLDIER":
          moves = this.__getSoldierMoves(row, col, piece);
          break;
      }

      // Filter out moves that would put own king in check
      moves = moves.filter(function(move) {
        return !this.__wouldBeInCheck(row, col, move.row, move.col, piece.team);
      }, this);

      return moves;
    },

    /**
     * King moves (within palace, 1 step)
     */
    __getKingMoves: function(row, col, piece) {
      var moves = [];
      var palace = deskweb.game.JanggiGame.PALACE[piece.team];
      var directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1],  // orthogonal
        [-1, -1], [-1, 1], [1, -1], [1, 1] // diagonal (on palace diagonals)
      ];

      directions.forEach(function(dir) {
        var newRow = row + dir[0];
        var newCol = col + dir[1];

        // Check if within palace
        if (newRow >= palace.rowMin && newRow <= palace.rowMax &&
            newCol >= palace.colMin && newCol <= palace.colMax) {

          // Diagonal moves only on actual diagonal lines
          if (Math.abs(dir[0]) === 1 && Math.abs(dir[1]) === 1) {
            // Check if on palace diagonal
            if (!this.__isOnPalaceDiagonal(row, col, palace) ||
                !this.__isOnPalaceDiagonal(newRow, newCol, palace)) {
              return;
            }
          }

          var target = this.__board[newRow][newCol];
          if (!target || target.team !== piece.team) {
            moves.push({
              row: newRow,
              col: newCol,
              isCapture: target !== null
            });
          }
        }
      }, this);

      return moves;
    },

    /**
     * Check if position is on palace diagonal
     */
    __isOnPalaceDiagonal: function(row, col, palace) {
      var centerRow = (palace.rowMin + palace.rowMax) / 2;
      var centerCol = (palace.colMin + palace.colMax) / 2;

      // Center and corners of palace
      return (row === centerRow && col === centerCol) ||
             (row === palace.rowMin && (col === palace.colMin || col === palace.colMax)) ||
             (row === palace.rowMax && (col === palace.colMin || col === palace.colMax));
    },

    /**
     * Guard moves (within palace, 1 step diagonally)
     */
    __getGuardMoves: function(row, col, piece) {
      // Guards move same as King in Janggi
      return this.__getKingMoves(row, col, piece);
    },

    /**
     * Car (Rook) moves - straight lines
     */
    __getCarMoves: function(row, col, piece) {
      var moves = [];
      var directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      directions.forEach(function(dir) {
        for (var i = 1; i < 10; i++) {
          var newRow = row + dir[0] * i;
          var newCol = col + dir[1] * i;

          if (!this.__isValidPosition(newRow, newCol)) break;

          var target = this.__board[newRow][newCol];
          if (!target) {
            moves.push({ row: newRow, col: newCol, isCapture: false });
          } else {
            if (target.team !== piece.team) {
              moves.push({ row: newRow, col: newCol, isCapture: true });
            }
            break;
          }
        }
      }, this);

      // Add palace diagonal moves if in palace
      var palace = deskweb.game.JanggiGame.PALACE[piece.team];
      if (row >= palace.rowMin && row <= palace.rowMax &&
          col >= palace.colMin && col <= palace.colMax) {
        var diagMoves = this.__getPalaceDiagonalMoves(row, col, piece, false);
        moves = moves.concat(diagMoves);
      }

      return moves;
    },

    /**
     * Get palace diagonal moves for car/cannon
     */
    __getPalaceDiagonalMoves: function(row, col, piece, needJump) {
      var moves = [];
      var palace = deskweb.game.JanggiGame.PALACE[piece.team];
      var centerRow = (palace.rowMin + palace.rowMax) / 2;
      var centerCol = (palace.colMin + palace.colMax) / 2;

      if (!this.__isOnPalaceDiagonal(row, col, palace)) return moves;

      var diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

      diagonals.forEach(function(dir) {
        var jumpCount = 0;
        for (var i = 1; i <= 2; i++) {
          var newRow = row + dir[0] * i;
          var newCol = col + dir[1] * i;

          if (!this.__isValidPosition(newRow, newCol)) break;
          if (newRow < palace.rowMin || newRow > palace.rowMax ||
              newCol < palace.colMin || newCol > palace.colMax) break;

          var target = this.__board[newRow][newCol];

          if (needJump) {
            if (target) {
              jumpCount++;
              if (jumpCount === 1) continue;
              if (target.team !== piece.team && target.type !== "CANNON") {
                moves.push({ row: newRow, col: newCol, isCapture: true });
              }
              break;
            } else if (jumpCount === 1) {
              moves.push({ row: newRow, col: newCol, isCapture: false });
            }
          } else {
            if (!target) {
              moves.push({ row: newRow, col: newCol, isCapture: false });
            } else {
              if (target.team !== piece.team) {
                moves.push({ row: newRow, col: newCol, isCapture: true });
              }
              break;
            }
          }
        }
      }, this);

      return moves;
    },

    /**
     * Cannon moves - must jump over exactly one piece
     */
    __getCannonMoves: function(row, col, piece) {
      var moves = [];
      var directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      directions.forEach(function(dir) {
        var jumped = false;
        for (var i = 1; i < 10; i++) {
          var newRow = row + dir[0] * i;
          var newCol = col + dir[1] * i;

          if (!this.__isValidPosition(newRow, newCol)) break;

          var target = this.__board[newRow][newCol];

          if (!jumped) {
            if (target && target.type !== "CANNON") {
              jumped = true;
            }
          } else {
            if (!target) {
              moves.push({ row: newRow, col: newCol, isCapture: false });
            } else {
              if (target.team !== piece.team && target.type !== "CANNON") {
                moves.push({ row: newRow, col: newCol, isCapture: true });
              }
              break;
            }
          }
        }
      }, this);

      // Palace diagonal moves
      var palace = deskweb.game.JanggiGame.PALACE[piece.team];
      if (row >= palace.rowMin && row <= palace.rowMax &&
          col >= palace.colMin && col <= palace.colMax) {
        var diagMoves = this.__getPalaceDiagonalMoves(row, col, piece, true);
        moves = moves.concat(diagMoves);
      }

      return moves;
    },

    /**
     * Horse moves - L-shape with blocking
     */
    __getHorseMoves: function(row, col, piece) {
      var moves = [];
      // First step orthogonal, then diagonal
      var patterns = [
        { first: [-1, 0], second: [[-1, -1], [-1, 1]] },
        { first: [1, 0], second: [[1, -1], [1, 1]] },
        { first: [0, -1], second: [[-1, -1], [1, -1]] },
        { first: [0, 1], second: [[-1, 1], [1, 1]] }
      ];

      patterns.forEach(function(pattern) {
        var midRow = row + pattern.first[0];
        var midCol = col + pattern.first[1];

        // Check if first step is blocked
        if (!this.__isValidPosition(midRow, midCol)) return;
        if (this.__board[midRow][midCol]) return; // Blocked

        pattern.second.forEach(function(step) {
          var newRow = row + step[0] * 2;
          var newCol = col + step[1];

          if (pattern.first[0] !== 0) {
            newRow = row + pattern.first[0] * 2 + (step[0] > 0 ? 0 : 0);
            newCol = col + step[1];
            if (step[0] < 0) newRow = row + pattern.first[0] + step[0];
            if (step[0] > 0) newRow = row + pattern.first[0] + step[0];
          } else {
            newRow = row + step[0];
            newCol = col + pattern.first[1] * 2;
          }

          // Recalculate correctly
          newRow = midRow + (pattern.first[0] !== 0 ? pattern.first[0] : step[0]);
          newCol = midCol + (pattern.first[1] !== 0 ? pattern.first[1] : step[1]);

          if (!this.__isValidPosition(newRow, newCol)) return;

          var target = this.__board[newRow][newCol];
          if (!target || target.team !== piece.team) {
            moves.push({
              row: newRow,
              col: newCol,
              isCapture: target !== null
            });
          }
        }, this);
      }, this);

      return moves;
    },

    /**
     * Elephant moves - diagonal with blocking
     */
    __getElephantMoves: function(row, col, piece) {
      var moves = [];
      // First step orthogonal, then two diagonal steps
      var patterns = [
        { first: [-1, 0], diag: [-1, -1] },
        { first: [-1, 0], diag: [-1, 1] },
        { first: [1, 0], diag: [1, -1] },
        { first: [1, 0], diag: [1, 1] },
        { first: [0, -1], diag: [-1, -1] },
        { first: [0, -1], diag: [1, -1] },
        { first: [0, 1], diag: [-1, 1] },
        { first: [0, 1], diag: [1, 1] }
      ];

      patterns.forEach(function(pattern) {
        // Check first step (orthogonal)
        var mid1Row = row + pattern.first[0];
        var mid1Col = col + pattern.first[1];

        if (!this.__isValidPosition(mid1Row, mid1Col)) return;
        if (this.__board[mid1Row][mid1Col]) return; // Blocked

        // Check second step (first diagonal)
        var mid2Row = mid1Row + pattern.diag[0];
        var mid2Col = mid1Col + pattern.diag[1];

        if (!this.__isValidPosition(mid2Row, mid2Col)) return;
        if (this.__board[mid2Row][mid2Col]) return; // Blocked

        // Final position (second diagonal)
        var newRow = mid2Row + pattern.diag[0];
        var newCol = mid2Col + pattern.diag[1];

        if (!this.__isValidPosition(newRow, newCol)) return;

        var target = this.__board[newRow][newCol];
        if (!target || target.team !== piece.team) {
          moves.push({
            row: newRow,
            col: newCol,
            isCapture: target !== null
          });
        }
      }, this);

      return moves;
    },

    /**
     * Soldier moves - forward and sideways
     */
    __getSoldierMoves: function(row, col, piece) {
      var moves = [];
      var forward = piece.team === "cho" ? -1 : 1;

      // Forward
      var newRow = row + forward;
      if (this.__isValidPosition(newRow, col)) {
        var target = this.__board[newRow][col];
        if (!target || target.team !== piece.team) {
          moves.push({ row: newRow, col: col, isCapture: target !== null });
        }
      }

      // Sideways (always available in Janggi)
      [-1, 1].forEach(function(side) {
        var newCol = col + side;
        if (this.__isValidPosition(row, newCol)) {
          var target = this.__board[row][newCol];
          if (!target || target.team !== piece.team) {
            moves.push({ row: row, col: newCol, isCapture: target !== null });
          }
        }
      }, this);

      // Diagonal moves in enemy palace
      var enemyPalace = deskweb.game.JanggiGame.PALACE[piece.team === "cho" ? "han" : "cho"];
      if (row >= enemyPalace.rowMin && row <= enemyPalace.rowMax &&
          col >= enemyPalace.colMin && col <= enemyPalace.colMax) {
        if (this.__isOnPalaceDiagonal(row, col, enemyPalace)) {
          [[forward, -1], [forward, 1]].forEach(function(dir) {
            var diagRow = row + dir[0];
            var diagCol = col + dir[1];
            if (this.__isValidPosition(diagRow, diagCol) &&
                this.__isOnPalaceDiagonal(diagRow, diagCol, enemyPalace)) {
              var target = this.__board[diagRow][diagCol];
              if (!target || target.team !== piece.team) {
                moves.push({ row: diagRow, col: diagCol, isCapture: target !== null });
              }
            }
          }, this);
        }
      }

      return moves;
    },

    /**
     * Check if position is valid
     */
    __isValidPosition: function(row, col) {
      return row >= 0 && row < this.__rows && col >= 0 && col < this.__cols;
    },

    /**
     * Check if move would put own king in check
     */
    __wouldBeInCheck: function(fromRow, fromCol, toRow, toCol, team) {
      // Make temporary move
      var piece = this.__board[fromRow][fromCol];
      var captured = this.__board[toRow][toCol];
      this.__board[toRow][toCol] = piece;
      this.__board[fromRow][fromCol] = null;

      var inCheck = this.__isInCheck(team);

      // Undo move
      this.__board[fromRow][fromCol] = piece;
      this.__board[toRow][toCol] = captured;

      return inCheck;
    },

    /**
     * Check if team's king is in check
     */
    __isInCheck: function(team) {
      // Find king position
      var kingPos = null;
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === team && piece.type === "KING") {
            kingPos = { row: row, col: col };
            break;
          }
        }
        if (kingPos) break;
      }

      if (!kingPos) return true; // King captured = in check

      // Check if any enemy piece can capture king
      var enemyTeam = team === "cho" ? "han" : "cho";
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === enemyTeam) {
            var moves = this.__getValidMovesWithoutCheckTest(row, col, piece);
            for (var i = 0; i < moves.length; i++) {
              if (moves[i].row === kingPos.row && moves[i].col === kingPos.col) {
                return true;
              }
            }
          }
        }
      }

      return false;
    },

    /**
     * Check if team is in checkmate (no valid moves to escape check)
     */
    __isCheckmate: function(team) {
      // Must be in check first
      if (!this.__isInCheck(team)) {
        return false;
      }

      // Try all possible moves for the team
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === team) {
            var moves = this.__getValidMoves(row, col, piece);
            // If any piece has a valid move, not checkmate
            if (moves.length > 0) {
              return false;
            }
          }
        }
      }

      console.log("[JanggiGame] Checkmate detected for team:", team);
      return true;
    },

    /**
     * Check if team has any valid moves (for stalemate detection)
     */
    __hasAnyValidMoves: function(team) {
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === team) {
            var moves = this.__getValidMoves(row, col, piece);
            if (moves.length > 0) {
              return true;
            }
          }
        }
      }
      return false;
    },

    /**
     * Get valid moves without check validation (to avoid infinite recursion)
     */
    __getValidMovesWithoutCheckTest: function(row, col, piece) {
      switch (piece.type) {
        case "KING":
          return this.__getKingMoves(row, col, piece);
        case "GUARD":
          return this.__getGuardMoves(row, col, piece);
        case "CAR":
          return this.__getCarMoves(row, col, piece);
        case "CANNON":
          return this.__getCannonMoves(row, col, piece);
        case "HORSE":
          return this.__getHorseMoves(row, col, piece);
        case "ELEPHANT":
          return this.__getElephantMoves(row, col, piece);
        case "SOLDIER":
          return this.__getSoldierMoves(row, col, piece);
        default:
          return [];
      }
    },

    /**
     * Make a move
     */
    __makeMove: function(fromRow, fromCol, toRow, toCol) {
      var self = this;
      var piece = this.__board[fromRow][fromCol];
      var captured = this.__board[toRow][toCol];

      // Prevent new moves while animating
      this.__isAnimating = true;

      // Record move in history
      this.__moveHistory.push({
        piece: piece,
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        captured: captured,
        timestamp: Date.now()
      });

      // Update board state immediately (for game logic)
      this.__board[toRow][toCol] = piece;
      this.__board[fromRow][fromCol] = null;

      // Calculate animation duration based on distance
      var distance = Math.sqrt(Math.pow(toRow - fromRow, 2) + Math.pow(toCol - fromCol, 2));
      var animDuration = Math.min(600, 200 + distance * 80);

      // Get moving piece mesh
      var movingMesh = this.__pieceMeshes[piece.id];
      var capturedMesh = captured ? this.__pieceMeshes[captured.id] : null;

      // Complete move after animation
      var completeMove = function() {
        // Handle captured piece tracking
        if (captured) {
          self.__capturedPieces[piece.team].push(captured);
          delete self.__pieceMeshes[captured.id];

          // Check for king capture (game over)
          if (captured.type === "KING") {
            self.__winner = piece.team;
            self.__gameEndReason = "capture";
            self.__score[piece.team]++;
            self.__gameState = "gameover";
            console.log("[JanggiGame] Game Over - King captured by:", piece.team);
            self.fireDataEvent("gameOver", {
              winner: self.__winner,
              reason: "capture",
              score: self.__score
            });
            return;
          }
        }

        // Update mesh user data
        if (movingMesh) {
          movingMesh.userData.row = toRow;
          movingMesh.userData.col = toCol;
        }

        // Switch turns
        self.__currentPlayer = self.__currentPlayer === "cho" ? "han" : "cho";

        // Check if opponent's king is now in check
        var opponentInCheck = self.__isInCheck(self.__currentPlayer);

        // Check for checkmate (외통수)
        if (self.__isCheckmate(self.__currentPlayer)) {
          self.__winner = piece.team;
          self.__gameEndReason = "checkmate";
          self.__score[piece.team]++;
          self.__gameState = "gameover";
          console.log("[JanggiGame] CHECKMATE! Winner:", piece.team);
          self.fireDataEvent("gameOver", {
            winner: self.__winner,
            reason: "checkmate",
            score: self.__score
          });
          return;
        }

        // Check for stalemate (no valid moves but not in check)
        if (!self.__hasAnyValidMoves(self.__currentPlayer)) {
          // In Janggi, if you have no moves and not in check, you lose (passing is not allowed in competitive)
          self.__winner = piece.team;
          self.__gameEndReason = "stalemate";
          self.__score[piece.team]++;
          self.__gameState = "gameover";
          console.log("[JanggiGame] Stalemate - no moves available for:", self.__currentPlayer);
          self.fireDataEvent("gameOver", {
            winner: self.__winner,
            reason: "stalemate",
            score: self.__score
          });
          return;
        }

        if (opponentInCheck) {
          console.log("[JanggiGame] 장군! (Check!)");
          self.fireDataEvent("checkOccurred", {
            checker: piece.team,
            checked: self.__currentPlayer,
            piece: piece
          });
        }

        // Save game state
        self.__saveGameState();

        self.fireDataEvent("moveMade", {
          piece: piece,
          from: { row: fromRow, col: fromCol },
          to: { row: toRow, col: toCol },
          captured: captured,
          isCheck: opponentInCheck
        });

        self.fireEvent("gameStateChange");
        self.__isAnimating = false;

        console.log("[JanggiGame] Move:", piece.type, "from", fromRow, fromCol, "to", toRow, toCol, opponentInCheck ? "(장군!)" : "");

        // Trigger AI turn if it's now AI's turn (human just moved)
        if (self.__gameState === "playing" && self.__currentPlayer === "han" && piece.team === "cho") {
          // Small delay to let UI update before AI thinking
          setTimeout(function() {
            self.__aiTurn();
          }, 300);
        }
      };

      // Animate the moving piece
      if (movingMesh) {
        var fromPos = { x: fromCol, y: 0.076, z: fromRow };
        var toPos = { x: toCol, y: 0.076, z: toRow };

        this.__animatePieceMove(movingMesh, fromPos, toPos, animDuration, function() {
          // Play impact sound when landing
          if (captured) {
            self.__playSound("capture");
          } else {
            self.__playSound("move");
          }

          // If there's a captured piece, animate it flying off
          if (capturedMesh) {
            self.__animateCapturedPiece(capturedMesh, piece.team);
          }

          // Complete the move
          completeMove();
        });
      } else {
        // No mesh (shouldn't happen), complete immediately
        completeMove();
      }
    },

    /**
     * AI's turn - uses JanggiAI for LLM-based moves
     */
    __aiTurn: async function() {
      if (this.__gameState !== "playing") return;
      if (this.__currentPlayer !== "han") return;

      var self = this;
      this.__isAIThinking = true;
      this.fireDataEvent("aiThinking", { thinking: true });

      console.log("[JanggiGame] AI thinking...");

      // Initialize AI if not already done
      if (!this.__ai) {
        this.__ai = new deskweb.game.JanggiAI(this);
        this.__ai.addListener("aiMessage", function(e) {
          self.fireDataEvent("aiMessage", e.getData());
        });
      }

      try {
        // Get AI move using JanggiAI
        var aiMove = await this.__ai.getMove();

        if (aiMove && this.__validateAIMove(aiMove)) {
          // Small delay for natural feel
          await this.__delay(500);
          this.__makeMove(aiMove.fromRow, aiMove.fromCol, aiMove.toRow, aiMove.toCol);
        } else {
          // Fallback to simple AI if LLM fails
          console.warn("[JanggiGame] LLM move invalid, using fallback AI");
          var fallbackMove = this.__ai.getFallbackMove();
          if (fallbackMove) {
            await this.__delay(500);
            this.__makeMove(fallbackMove.fromRow, fallbackMove.fromCol, fallbackMove.toRow, fallbackMove.toCol);
          }
        }
      } catch (error) {
        console.error("[JanggiGame] AI error:", error);
        var fallbackMove = this.__ai ? this.__ai.getFallbackMove() : this.__getFallbackAIMove();
        if (fallbackMove) {
          this.__makeMove(fallbackMove.fromRow, fallbackMove.fromCol, fallbackMove.toRow, fallbackMove.toCol);
        }
      } finally {
        this.__isAIThinking = false;
        this.fireDataEvent("aiThinking", { thinking: false });
      }
    },

    /**
     * Get AI move from LLM API (streaming mode) with tactical explanation
     */
    __getAIMoveFromLLM: async function() {
      var self = this;
      var boardState = this.__getBoardStateForLLM();
      var historyStr = this.__getHistoryForLLM();
      var validMovesStr = this.__getValidMovesForLLM();

      var prompt = this.__buildAIPrompt(boardState, historyStr, validMovesStr);

      console.log("[JanggiGame] Sending LLM request...");

      try {
        var response = await fetch('https://mcp.webnori.com/api/llm/chat/completions', {
          method: 'POST',
          headers: {
            'Accept': 'text/plain',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
                content: "You are a skilled Janggi (Korean Chess) AI. Your goal is to CHECKMATE the opponent. Be aggressive! Always respond in the exact format: Line1=move, Line2=tactical reason in Korean, Line3=comment to opponent in Korean."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 150,
            temperature: 0.6,
            stream: true
          })
        });

        if (!response.ok) {
          console.error("[JanggiGame] API response not OK:", response.status);
          return null;
        }

        // Handle streaming response (SSE format)
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var fullResponse = "";

        while (true) {
          var result = await reader.read();
          if (result.done) break;

          var chunk = decoder.decode(result.value, { stream: true });
          var lines = chunk.split('\n');

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line === '' || line === 'data: [DONE]') continue;

            if (line.startsWith('data: ')) {
              try {
                var jsonStr = line.substring(6);
                var data = JSON.parse(jsonStr);

                if (data.choices && data.choices[0] && data.choices[0].delta) {
                  var content = data.choices[0].delta.content;
                  if (content) {
                    fullResponse += content;
                  }
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        console.log("[JanggiGame] LLM full response:", fullResponse);

        // Parse the response - extract move, tactical reason, and comment
        var responseLines = fullResponse.split('\n').filter(function(l) { return l.trim() !== ''; });
        var moveMatch = fullResponse.match(/(\d)\s*,\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/);

        if (moveMatch) {
          var move = {
            fromRow: parseInt(moveMatch[1], 10),
            fromCol: parseInt(moveMatch[2], 10),
            toRow: parseInt(moveMatch[3], 10),
            toCol: parseInt(moveMatch[4], 10)
          };

          // Extract tactical reason and comment
          var tacticalReason = "";
          var aiComment = "";

          if (responseLines.length >= 2) {
            tacticalReason = responseLines[1].trim();
          }
          if (responseLines.length >= 3) {
            aiComment = responseLines[2].trim();
          }

          // Fire AI message event with tactical info
          if (tacticalReason || aiComment) {
            self.fireDataEvent("aiMessage", {
              type: "move",
              tactical: tacticalReason || "수를 두었습니다.",
              comment: aiComment || "",
              phase: self.__getGamePhase()
            });
          }

          console.log("[JanggiGame] Parsed move:", move, "Tactical:", tacticalReason);
          return move;
        }

        console.warn("[JanggiGame] Could not parse move from response:", fullResponse);
      } catch (error) {
        console.error("[JanggiGame] LLM API error:", error);
      }

      return null;
    },

    /**
     * Get all valid moves for Han (AI) player as string for LLM
     */
    __getValidMovesForLLM: function() {
      var moves = [];
      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === "han") {
            var validMoves = this.__getValidMoves(row, col, piece);
            var symbol = deskweb.game.JanggiGame.PIECES[piece.type].symbol;
            for (var i = 0; i < validMoves.length; i++) {
              var m = validMoves[i];
              moves.push(symbol + "(" + row + "," + col + ")->" + "(" + m.row + "," + m.col + ") = " + row + "," + col + "," + m.row + "," + m.col);
            }
          }
        }
      }
      return moves.slice(0, 20).join("\n"); // Limit to 20 moves to keep prompt short
    },

    /**
     * Build prompt for AI with aggressive strategy
     */
    __buildAIPrompt: function(boardState, history, validMoves) {
      var phase = this.__getGamePhase();
      var checkMoves = this.__getCheckingMoves();
      var captureMoves = this.__getCaptureMoves();

      var phaseStrategy = "";
      if (phase === "opening") {
        phaseStrategy = "OPENING PHASE: Develop your pieces. Move horses and elephants first. Protect your king but prepare for attack.";
      } else if (phase === "midgame") {
        phaseStrategy = "MIDGAME PHASE: Be AGGRESSIVE! Attack the opponent's king. Use your cannons and cars to create threats. Force the opponent into defense.";
      } else {
        phaseStrategy = "ENDGAME PHASE: GO FOR CHECKMATE! Push hard. Every move should threaten the king or set up checkmate. Don't just capture pieces - WIN THE GAME!";
      }

      var priorityMoves = "";
      if (checkMoves.length > 0) {
        priorityMoves = "\n⚠️ CHECK MOVES (HIGHEST PRIORITY - can check opponent's king):\n" + checkMoves.join("\n");
      }
      if (captureMoves.length > 0) {
        priorityMoves += "\n\n🎯 CAPTURE MOVES (capture opponent pieces):\n" + captureMoves.join("\n");
      }

      return `You are a STRONG Janggi (Korean Chess) AI playing as Han (blue/bottom).
YOUR GOAL: CHECKMATE the opponent's king (왕). Capturing pieces is secondary!

GAME PHASE: ${phase.toUpperCase()}
${phaseStrategy}
${priorityMoves}

ALL VALID MOVES:
${validMoves}

BOARD STATE:
${boardState}

RECENT MOVES:
${history}

STRATEGY PRIORITY:
1. If you can CHECK the king, DO IT!
2. Look for CHECKMATE patterns (외통수)
3. Attack pieces protecting the king
4. Only defend if absolutely necessary

RESPONSE FORMAT (REQUIRED):
Line 1: Move as four numbers: fromRow,fromCol,toRow,toCol
Line 2: Brief tactical reason in Korean (1 sentence)
Line 3: Comment to opponent in Korean (respectful, playful, or teasing based on situation)

Example response:
0,1,2,2
마를 전진시켜 왕을 압박합니다
좋은 수 두셨네요, 하지만 이제 제 차례입니다!`;
    },

    /**
     * Get current game phase based on moves and pieces
     */
    __getGamePhase: function() {
      var moveCount = this.__moveHistory.length;
      var totalPieces = 0;

      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          if (this.__board[row][col]) totalPieces++;
        }
      }

      if (moveCount < 10) return "opening";
      if (totalPieces > 20) return "midgame";
      return "endgame";
    },

    /**
     * Get moves that would check opponent's king
     */
    __getCheckingMoves: function() {
      var checkMoves = [];
      var opponentTeam = "cho";

      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === "han") {
            var moves = this.__getValidMoves(row, col, piece);
            for (var i = 0; i < moves.length; i++) {
              var m = moves[i];
              // Simulate move and check if it puts opponent in check
              if (this.__wouldCauseCheck(row, col, m.row, m.col, opponentTeam)) {
                var symbol = deskweb.game.JanggiGame.PIECES[piece.type].name;
                checkMoves.push("⚡ " + symbol + ": " + row + "," + col + "," + m.row + "," + m.col + " (장군!)");
              }
            }
          }
        }
      }
      return checkMoves;
    },

    /**
     * Check if a move would put opponent in check
     */
    __wouldCauseCheck: function(fromRow, fromCol, toRow, toCol, opponentTeam) {
      // Temporarily make the move
      var piece = this.__board[fromRow][fromCol];
      var capturedPiece = this.__board[toRow][toCol];

      this.__board[toRow][toCol] = piece;
      this.__board[fromRow][fromCol] = null;

      var inCheck = this.__isInCheck(opponentTeam);

      // Restore
      this.__board[fromRow][fromCol] = piece;
      this.__board[toRow][toCol] = capturedPiece;

      return inCheck;
    },

    /**
     * Get moves that capture opponent pieces
     */
    __getCaptureMoves: function() {
      var captureMoves = [];

      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === "han") {
            var moves = this.__getValidMoves(row, col, piece);
            for (var i = 0; i < moves.length; i++) {
              var m = moves[i];
              var target = this.__board[m.row][m.col];
              if (target && target.team === "cho") {
                var symbol = deskweb.game.JanggiGame.PIECES[piece.type].name;
                var targetSymbol = deskweb.game.JanggiGame.PIECES[target.type].name;
                captureMoves.push(symbol + "로 " + targetSymbol + " 잡기: " + row + "," + col + "," + m.row + "," + m.col);
              }
            }
          }
        }
      }
      return captureMoves;
    },

    /**
     * Get board state string for LLM
     */
    __getBoardStateForLLM: function() {
      var lines = [];
      for (var row = 0; row < this.__rows; row++) {
        var rowStr = "Row " + row + ": ";
        var cells = [];
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece) {
            var symbol = deskweb.game.JanggiGame.PIECES[piece.type].symbol;
            cells.push(piece.team.charAt(0).toUpperCase() + "-" + symbol + "(" + col + ")");
          }
        }
        if (cells.length > 0) {
          lines.push(rowStr + cells.join(", "));
        }
      }
      return lines.join("\n");
    },

    /**
     * Get move history string for LLM
     */
    __getHistoryForLLM: function() {
      var recent = this.__moveHistory.slice(-5);
      if (recent.length === 0) return "No moves yet.";

      return recent.map(function(move, i) {
        var symbol = deskweb.game.JanggiGame.PIECES[move.piece.type].symbol;
        return (i + 1) + ". " + move.piece.team + " " + symbol + ": " +
               "(" + move.from.row + "," + move.from.col + ") -> (" + move.to.row + "," + move.to.col + ")";
      }).join("\n");
    },

    /**
     * Validate AI move
     */
    __validateAIMove: function(move) {
      if (!this.__isValidPosition(move.fromRow, move.fromCol) ||
          !this.__isValidPosition(move.toRow, move.toCol)) {
        console.warn("[JanggiGame] AI move out of bounds");
        return false;
      }

      var piece = this.__board[move.fromRow][move.fromCol];
      if (!piece || piece.team !== "han") {
        console.warn("[JanggiGame] No Han piece at source position");
        return false;
      }

      var validMoves = this.__getValidMoves(move.fromRow, move.fromCol, piece);
      var isValid = validMoves.some(function(m) {
        return m.row === move.toRow && m.col === move.toCol;
      });

      if (!isValid) {
        console.warn("[JanggiGame] AI move not in valid moves list");
      }

      return isValid;
    },

    /**
     * Get fallback AI move (simple random valid move)
     */
    __getFallbackAIMove: function() {
      var allMoves = [];

      for (var row = 0; row < this.__rows; row++) {
        for (var col = 0; col < this.__cols; col++) {
          var piece = this.__board[row][col];
          if (piece && piece.team === "han") {
            var moves = this.__getValidMoves(row, col, piece);
            moves.forEach(function(move) {
              allMoves.push({
                fromRow: row,
                fromCol: col,
                toRow: move.row,
                toCol: move.col,
                isCapture: move.isCapture
              });
            });
          }
        }
      }

      if (allMoves.length === 0) return null;

      // Prefer captures
      var captures = allMoves.filter(function(m) { return m.isCapture; });
      if (captures.length > 0) {
        return captures[Math.floor(Math.random() * captures.length)];
      }

      return allMoves[Math.floor(Math.random() * allMoves.length)];
    },

    /**
     * Utility delay function
     */
    __delay: function(ms) {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    },

    /**
     * Save game state to localStorage
     */
    __saveGameState: function() {
      try {
        var state = {
          board: this.__board,
          currentPlayer: this.__currentPlayer,
          moveHistory: this.__moveHistory,
          capturedPieces: this.__capturedPieces,
          gameState: this.__gameState,
          winner: this.__winner
        };
        localStorage.setItem("deskweb.janggi." + this.__sessionId, JSON.stringify(state));
        console.log("[JanggiGame] Game state saved");
      } catch (error) {
        console.error("[JanggiGame] Failed to save game state:", error);
      }
    },

    /**
     * Load game state from localStorage
     */
    __loadGameState: function() {
      try {
        var stored = localStorage.getItem("deskweb.janggi." + this.__sessionId);
        if (stored) {
          var state = JSON.parse(stored);
          this.__board = state.board;
          this.__currentPlayer = state.currentPlayer;
          this.__moveHistory = state.moveHistory;
          this.__capturedPieces = state.capturedPieces;
          this.__gameState = state.gameState;
          this.__winner = state.winner;
          console.log("[JanggiGame] Game state loaded");
          return true;
        }
      } catch (error) {
        console.error("[JanggiGame] Failed to load game state:", error);
      }
      return false;
    },

    // Public API

    /**
     * Start new game
     */
    newGame: function() {
      console.log("[JanggiGame] Starting new game");

      this.__initBoard();
      this.__currentPlayer = "cho";
      this.__gameState = "playing";
      this.__winner = null;
      this.__gameEndReason = null;
      this.__moveHistory = [];
      this.__capturedPieces = { cho: [], han: [] };
      this.__selectedPiece = null;
      this.__validMoves = [];
      // Don't reset score - keep cumulative score across games

      // Clear and recreate pieces
      Object.keys(this.__pieceMeshes).forEach(function(id) {
        this.__boardGroup.remove(this.__pieceMeshes[id]);
        this.__pieceMeshes[id].geometry.dispose();
        this.__pieceMeshes[id].material.dispose();
      }, this);
      this.__pieceMeshes = {};

      this.__createAllPieces();
      this.__clearHighlights();

      this.__saveGameState();
      this.fireEvent("gameStateChange");
    },

    /**
     * Convert screen position to board position
     */
    screenToBoard: function(x, y, containerWidth, containerHeight) {
      if (!this.__camera || !this.__renderer) return null;

      var mouse = new THREE.Vector2();
      mouse.x = (x / containerWidth) * 2 - 1;
      mouse.y = -(y / containerHeight) * 2 + 1;

      var raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.__camera);

      // Create a plane at y=0
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      var intersection = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(plane, intersection)) {
        var col = Math.round(intersection.x);
        var row = Math.round(intersection.z);

        if (this.__isValidPosition(row, col)) {
          return { row: row, col: col };
        }
      }

      return null;
    },

    /**
     * Get game analysis/replay
     */
    getGameAnalysis: function() {
      return {
        moves: this.__moveHistory,
        captures: this.__capturedPieces,
        winner: this.__winner,
        totalMoves: this.__moveHistory.length
      };
    },

    /**
     * Set camera distance
     */
    setCameraDistance: function(distance) {
      this.__cameraDistance = Math.max(8, Math.min(30, distance));
      this.__updateCameraPosition();
    },

    /**
     * Set camera angle Y (rotation)
     */
    setCameraAngleY: function(angle) {
      this.__cameraAngleY = angle;
      this.__updateCameraPosition();
    },

    /**
     * Set camera angle X (tilt)
     */
    setCameraAngleX: function(angle) {
      this.__cameraAngleX = Math.max(0.3, Math.min(1.4, angle));
      this.__updateCameraPosition();
    },

    /**
     * Resize renderer
     */
    resize: function(width, height) {
      if (this.__renderer && this.__camera) {
        this.__renderer.setSize(width, height);
        this.__camera.aspect = width / height;
        this.__camera.updateProjectionMatrix();
      }
    },

    // Getters
    getGameState: function() { return this.__gameState; },
    getCurrentPlayer: function() { return this.__currentPlayer; },
    getMoveHistory: function() { return this.__moveHistory; },
    getCapturedPieces: function() { return this.__capturedPieces; },
    getWinner: function() { return this.__winner; },
    getGameEndReason: function() { return this.__gameEndReason; },
    getScore: function() { return this.__score; },
    isAIThinking: function() { return this.__isAIThinking; },
    getSessionId: function() { return this.__sessionId; },
    getCameraDistance: function() { return this.__cameraDistance; },
    getCameraAngleX: function() { return this.__cameraAngleX; },
    getCameraAngleY: function() { return this.__cameraAngleY; },

    // Additional getters for JanggiAI
    getBoard: function() { return this.__board; },

    getValidMovesFor: function(row, col) {
      var piece = this.__board[row][col];
      if (!piece) return [];
      return this.__getValidMoves(row, col, piece);
    },

    wouldCauseCheck: function(fromRow, fromCol, toRow, toCol, opponentTeam) {
      return this.__wouldCauseCheck(fromRow, fromCol, toRow, toCol, opponentTeam);
    },

    isInCheck: function(team) {
      return this.__isInCheck(team);
    }
  },

  destruct : function()
  {
    console.log("[JanggiGame] Disposing...");

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

    this.__board = null;
    this.__pieceMeshes = null;
    this.__highlightMeshes = null;

    // Dispose AI
    if (this.__ai) {
      this.__ai.dispose();
      this.__ai = null;
    }

    console.log("[JanggiGame] Disposed");
  }
});
