/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Janggi AI - LLM-based AI opponent for Korean Chess
 *
 * Handles:
 * - LLM API communication
 * - Prompt building with game situation analysis
 * - Move parsing and validation
 * - AI commentary generation
 *
 * @ignore(fetch)
 * @ignore(TextDecoder)
 */
qx.Class.define("deskweb.game.JanggiAI",
{
  extend : qx.core.Object,

  /**
   * @param game {deskweb.game.JanggiGame} Reference to the game instance
   */
  construct : function(game)
  {
    this.base(arguments);
    this.__game = game;
    console.log("[JanggiAI] Initialized");
  },

  events :
  {
    /** Fired when AI has a message */
    "aiMessage": "qx.event.type.Data"
  },

  statics :
  {
    // LLM API endpoint
    API_URL: "https://mcp.webnori.com/api/llm/chat/completions",

    // LocalStorage key for strategy settings
    STRATEGY_STORAGE_KEY: "janggi_ai_strategy",

    // Default strategy prompt template (editable by user)
    DEFAULT_STRATEGY: {
      opening: "초반: 마, 상 활성화하고 포 배치에 집중하세요. 중앙 통제가 중요합니다.",
      midgame: "중반: 적극적으로 공격하세요. 차와 포로 왕을 압박하고 약한 말을 노리세요.",
      endgame: "종반: 외통수를 만들어야 합니다! 연속 장군을 시도하고 도망갈 곳을 막으세요.",
      general: "장군 수가 있으면 우선 시도하세요! 말을 잡을 기회가 있으면 적극 활용하세요.",
      personality: "자신감 있고 존중하는 태도로, 상황에 맞게 유머러스하거나 진지하게 대화하세요."
    },

    /**
     * Load strategy from localStorage
     * @return {Object} Strategy object
     */
    loadStrategy: function() {
      try {
        var saved = localStorage.getItem(this.STRATEGY_STORAGE_KEY);
        if (saved) {
          var parsed = JSON.parse(saved);
          // Merge with defaults to ensure all fields exist
          return Object.assign({}, this.DEFAULT_STRATEGY, parsed);
        }
      } catch (e) {
        console.warn("[JanggiAI] Failed to load strategy:", e);
      }
      return Object.assign({}, this.DEFAULT_STRATEGY);
    },

    /**
     * Save strategy to localStorage
     * @param {Object} strategy Strategy object
     */
    saveStrategy: function(strategy) {
      try {
        localStorage.setItem(this.STRATEGY_STORAGE_KEY, JSON.stringify(strategy));
        console.log("[JanggiAI] Strategy saved");
        return true;
      } catch (e) {
        console.error("[JanggiAI] Failed to save strategy:", e);
        return false;
      }
    },

    /**
     * Reset strategy to defaults
     */
    resetStrategy: function() {
      localStorage.removeItem(this.STRATEGY_STORAGE_KEY);
      console.log("[JanggiAI] Strategy reset to defaults");
      return Object.assign({}, this.DEFAULT_STRATEGY);
    },

    // AI personality comments based on situation
    COMMENTS: {
      greeting: [
        "안녕하세요! 좋은 대국 하겠습니다.",
        "오늘도 즐거운 한 판 두시죠!",
        "잘 부탁드립니다. 최선을 다하겠습니다."
      ],
      thinking: [
        "음... 생각 중입니다...",
        "잠시만요, 좋은 수를 찾고 있습니다...",
        "어디로 갈까요..."
      ],
      advantage: [
        "지금 상황이 좋네요!",
        "유리하게 흘러가고 있습니다.",
        "이대로라면 승리가 가까워요."
      ],
      disadvantage: [
        "어려운 상황이네요...",
        "잘 두셨습니다. 만회해야겠어요.",
        "위기를 기회로 바꿔보겠습니다."
      ],
      captured: [
        "아! 제 말을 잡으셨네요.",
        "좋은 수였습니다!",
        "이런, 조심해야겠네요."
      ],
      capturing: [
        "하나 잡았습니다!",
        "이 말은 제가 가져가겠습니다.",
        "좋은 기회였어요!"
      ],
      check: [
        "장군이요! 왕을 피하세요!",
        "장군! 어디로 피하실 건가요?",
        "외통수를 노리고 있습니다!"
      ],
      checked: [
        "앗! 장군이네요. 피해야겠습니다.",
        "위험하네요, 왕을 지켜야해요.",
        "좋은 수시네요!"
      ],
      endgame: [
        "이제 막바지입니다!",
        "승부를 결정지을 때가 왔네요.",
        "마지막 공격을 준비합니다."
      ]
    }
  },

  members :
  {
    __game: null,

    /**
     * Get AI move from LLM
     * @return {Promise<Object|null>} Move object or null
     */
    getMove: async function() {
      var self = this;
      var game = this.__game;

      var boardState = this.__getBoardStateForLLM();
      var historyStr = this.__getHistoryForLLM();
      var validMovesStr = this.__getValidMovesForLLM();
      var situationAnalysis = this.__analyzeSituation();

      var prompt = this.__buildPrompt(boardState, historyStr, validMovesStr, situationAnalysis);

      console.log("[JanggiAI] Sending LLM request...");

      try {
        var response = await fetch(deskweb.game.JanggiAI.API_URL, {
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
                content: this.__getSystemPrompt()
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.6,
            stream: true
          })
        });

        if (!response.ok) {
          console.error("[JanggiAI] API response not OK:", response.status);
          return null;
        }

        // Handle streaming response
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

        console.log("[JanggiAI] LLM full response:", fullResponse);

        // Parse response
        return this.__parseResponse(fullResponse, situationAnalysis);

      } catch (error) {
        console.error("[JanggiAI] LLM API error:", error);
        return null;
      }
    },

    /**
     * Get random comment for situation
     */
    getComment: function(situation) {
      var comments = deskweb.game.JanggiAI.COMMENTS[situation];
      if (comments && comments.length > 0) {
        return comments[Math.floor(Math.random() * comments.length)];
      }
      return "";
    },

    /**
     * Get system prompt for LLM
     */
    __getSystemPrompt: function() {
      return `You are a skilled Janggi (Korean Chess) AI player named "한수".
Your goal is to CHECKMATE the opponent's king (왕).

PERSONALITY:
- You are confident but respectful
- You comment on the game situation naturally in Korean
- You explain your tactical reasoning briefly

RESPONSE FORMAT (REQUIRED - 3 lines):
Line 1: Move coordinates only: fromRow,fromCol,toRow,toCol (e.g., 0,1,2,2)
Line 2: Tactical reason in Korean (why this move, what it threatens)
Line 3: Comment to opponent in Korean (based on current game situation - be playful, encouraging, or competitive)

IMPORTANT: Always respond with exactly 3 lines. The move must be from the valid moves list.`;
    },

    /**
     * Build the prompt with game situation
     */
    __buildPrompt: function(boardState, history, validMoves, situation) {
      var phase = situation.phase;
      var phaseKor = phase === "opening" ? "초반" : (phase === "midgame" ? "중반" : "종반");

      var situationDesc = this.__buildSituationDescription(situation);

      // Load user's custom strategy
      var strategy = deskweb.game.JanggiAI.loadStrategy();
      var phaseStrategy = phase === "opening" ? strategy.opening :
                          (phase === "midgame" ? strategy.midgame : strategy.endgame);

      return `## 현재 게임 상황 (${phaseKor})
${situationDesc}

## 유효한 수 목록 (이 중에서 선택하세요):
${validMoves}

## 우선순위 수:
${situation.priorityMoves}

## 현재 보드 상태:
${boardState}

## 최근 기보:
${history}

## 전략 지침:
- ${phaseStrategy}
- ${strategy.general}

당신의 수를 선택하고 이유를 설명해주세요.`;
    },

    /**
     * Build situation description
     */
    __buildSituationDescription: function(situation) {
      var lines = [];

      // Piece count comparison
      lines.push("▸ 말 현황: 한(나) " + situation.hanPieceCount + "개, 초(상대) " + situation.choPieceCount + "개");

      // Captured pieces
      if (situation.capturedByHan.length > 0) {
        lines.push("▸ 내가 잡은 말: " + situation.capturedByHan.join(", "));
      }
      if (situation.capturedByCho.length > 0) {
        lines.push("▸ 상대가 잡은 말: " + situation.capturedByCho.join(", "));
      }

      // Last move
      if (situation.lastMove) {
        lines.push("▸ 상대 마지막 수: " + situation.lastMove);
      }

      // Advantage
      if (situation.advantage > 0) {
        lines.push("▸ 상황: 유리함 (+" + situation.advantage + ")");
      } else if (situation.advantage < 0) {
        lines.push("▸ 상황: 불리함 (" + situation.advantage + ")");
      } else {
        lines.push("▸ 상황: 균형");
      }

      // Check status
      if (situation.inCheck) {
        lines.push("▸ ⚠️ 현재 장군 상태! 왕을 피해야 합니다.");
      }

      return lines.join("\n");
    },

    /**
     * Analyze current game situation
     */
    __analyzeSituation: function() {
      var game = this.__game;
      var board = game.getBoard();
      var history = game.getMoveHistory();
      var captured = game.getCapturedPieces();

      // Count pieces
      var hanPieces = 0, choPieces = 0;
      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 9; c++) {
          var p = board[r][c];
          if (p) {
            if (p.team === "han") hanPieces++;
            else choPieces++;
          }
        }
      }

      // Get captured piece names
      var capturedByHan = captured.han.map(function(p) {
        return deskweb.game.JanggiGame.PIECES[p.type].name;
      });
      var capturedByCho = captured.cho.map(function(p) {
        return deskweb.game.JanggiGame.PIECES[p.type].name;
      });

      // Calculate advantage (simple piece count)
      var advantage = hanPieces - choPieces;

      // Get last move
      var lastMove = null;
      if (history.length > 0) {
        var last = history[history.length - 1];
        if (last.piece.team === "cho") {
          var pieceName = deskweb.game.JanggiGame.PIECES[last.piece.type].name;
          lastMove = pieceName + " (" + last.from.row + "," + last.from.col + ") → (" + last.to.row + "," + last.to.col + ")";
          if (last.captured) {
            lastMove += " [" + deskweb.game.JanggiGame.PIECES[last.captured.type].name + " 잡음]";
          }
        }
      }

      // Get game phase
      var phase = "opening";
      if (history.length >= 10) phase = "midgame";
      if (hanPieces + choPieces <= 16) phase = "endgame";

      // Get priority moves
      var priorityMoves = this.__getPriorityMoves();

      // Check if in check
      var inCheck = game.isInCheck("han");

      return {
        phase: phase,
        hanPieceCount: hanPieces,
        choPieceCount: choPieces,
        capturedByHan: capturedByHan,
        capturedByCho: capturedByCho,
        advantage: advantage,
        lastMove: lastMove,
        priorityMoves: priorityMoves,
        inCheck: inCheck
      };
    },

    /**
     * Get priority moves (checks and captures)
     */
    __getPriorityMoves: function() {
      var game = this.__game;
      var board = game.getBoard();
      var lines = [];

      // Check moves
      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 9; c++) {
          var piece = board[r][c];
          if (piece && piece.team === "han") {
            var moves = game.getValidMovesFor(r, c);
            for (var i = 0; i < moves.length; i++) {
              var m = moves[i];
              if (game.wouldCauseCheck(r, c, m.row, m.col, "cho")) {
                var name = deskweb.game.JanggiGame.PIECES[piece.type].name;
                lines.push("⚡ 장군 가능: " + name + " " + r + "," + c + " → " + m.row + "," + m.col);
              }
            }
          }
        }
      }

      // Capture moves
      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 9; c++) {
          var piece = board[r][c];
          if (piece && piece.team === "han") {
            var moves = game.getValidMovesFor(r, c);
            for (var i = 0; i < moves.length; i++) {
              var m = moves[i];
              var target = board[m.row][m.col];
              if (target && target.team === "cho") {
                var name = deskweb.game.JanggiGame.PIECES[piece.type].name;
                var targetName = deskweb.game.JanggiGame.PIECES[target.type].name;
                lines.push("🎯 잡기 가능: " + name + "로 " + targetName + " - " + r + "," + c + " → " + m.row + "," + m.col);
              }
            }
          }
        }
      }

      return lines.length > 0 ? lines.slice(0, 10).join("\n") : "특별한 우선순위 수 없음";
    },

    /**
     * Get board state string for LLM
     */
    __getBoardStateForLLM: function() {
      var board = this.__game.getBoard();
      var lines = [];

      for (var row = 0; row < 10; row++) {
        var cells = [];
        for (var col = 0; col < 9; col++) {
          var piece = board[row][col];
          if (piece) {
            var name = deskweb.game.JanggiGame.PIECES[piece.type].name;
            var team = piece.team === "han" ? "한" : "초";
            cells.push(team + "-" + name + "(" + col + ")");
          }
        }
        if (cells.length > 0) {
          lines.push("행" + row + ": " + cells.join(", "));
        }
      }
      return lines.join("\n");
    },

    /**
     * Get move history for LLM
     */
    __getHistoryForLLM: function() {
      var history = this.__game.getMoveHistory();
      var recent = history.slice(-6);

      if (recent.length === 0) return "아직 기보 없음";

      return recent.map(function(move, i) {
        var num = history.length - recent.length + i + 1;
        var name = deskweb.game.JanggiGame.PIECES[move.piece.type].name;
        var team = move.piece.team === "han" ? "한" : "초";
        var captureInfo = move.captured ? " [" + deskweb.game.JanggiGame.PIECES[move.captured.type].name + " 잡음]" : "";
        return num + ". " + team + " " + name + ": (" + move.from.row + "," + move.from.col + ")→(" + move.to.row + "," + move.to.col + ")" + captureInfo;
      }).join("\n");
    },

    /**
     * Get valid moves for LLM
     */
    __getValidMovesForLLM: function() {
      var game = this.__game;
      var board = game.getBoard();
      var moves = [];

      for (var row = 0; row < 10; row++) {
        for (var col = 0; col < 9; col++) {
          var piece = board[row][col];
          if (piece && piece.team === "han") {
            var validMoves = game.getValidMovesFor(row, col);
            var name = deskweb.game.JanggiGame.PIECES[piece.type].name;
            for (var i = 0; i < validMoves.length; i++) {
              var m = validMoves[i];
              moves.push(name + "(" + row + "," + col + ")→(" + m.row + "," + m.col + ") = " + row + "," + col + "," + m.row + "," + m.col);
            }
          }
        }
      }

      return moves.slice(0, 25).join("\n");
    },

    /**
     * Parse LLM response
     */
    __parseResponse: function(fullResponse, situation) {
      var lines = fullResponse.split('\n').filter(function(l) { return l.trim() !== ''; });
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

        if (lines.length >= 2) {
          // Skip the line with coordinates
          for (var i = 0; i < lines.length; i++) {
            if (!lines[i].match(/^\d\s*,/)) {
              if (!tacticalReason) {
                tacticalReason = lines[i].trim();
              } else if (!aiComment) {
                aiComment = lines[i].trim();
                break;
              }
            }
          }
        }

        // Generate fallback comment based on situation
        if (!aiComment) {
          if (situation.advantage > 0) {
            aiComment = this.getComment("advantage");
          } else if (situation.advantage < 0) {
            aiComment = this.getComment("disadvantage");
          } else {
            aiComment = this.getComment("thinking");
          }
        }

        // Fire AI message
        this.fireDataEvent("aiMessage", {
          type: "move",
          tactical: tacticalReason || "수를 두었습니다.",
          comment: aiComment,
          phase: situation.phase,
          advantage: situation.advantage
        });

        console.log("[JanggiAI] Parsed move:", move, "Tactical:", tacticalReason);
        return move;
      }

      console.warn("[JanggiAI] Could not parse move from response:", fullResponse);
      return null;
    },

    /**
     * Get fallback move (simple AI)
     */
    getFallbackMove: function() {
      var game = this.__game;
      var board = game.getBoard();
      var allMoves = [];

      for (var row = 0; row < 10; row++) {
        for (var col = 0; col < 9; col++) {
          var piece = board[row][col];
          if (piece && piece.team === "han") {
            var moves = game.getValidMovesFor(row, col);
            for (var i = 0; i < moves.length; i++) {
              var m = moves[i];
              var target = board[m.row][m.col];
              allMoves.push({
                fromRow: row,
                fromCol: col,
                toRow: m.row,
                toCol: m.col,
                piece: piece,
                captures: target,
                isCheck: game.wouldCauseCheck(row, col, m.row, m.col, "cho")
              });
            }
          }
        }
      }

      if (allMoves.length === 0) return null;

      // Prioritize: checks > captures > random
      var checkMoves = allMoves.filter(function(m) { return m.isCheck; });
      if (checkMoves.length > 0) {
        this.fireDataEvent("aiMessage", {
          type: "move",
          tactical: "장군을 노립니다!",
          comment: this.getComment("check"),
          phase: "unknown"
        });
        return checkMoves[Math.floor(Math.random() * checkMoves.length)];
      }

      var captureMoves = allMoves.filter(function(m) { return m.captures; });
      if (captureMoves.length > 0) {
        this.fireDataEvent("aiMessage", {
          type: "move",
          tactical: "상대 말을 잡습니다.",
          comment: this.getComment("capturing"),
          phase: "unknown"
        });
        return captureMoves[Math.floor(Math.random() * captureMoves.length)];
      }

      this.fireDataEvent("aiMessage", {
        type: "move",
        tactical: "포지션을 잡습니다.",
        comment: "차근차근 가보겠습니다.",
        phase: "unknown"
      });

      return allMoves[Math.floor(Math.random() * allMoves.length)];
    }
  },

  destruct : function()
  {
    this.__game = null;
  }
});
