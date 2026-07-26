/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * WebLLM Manager - Manages LLM inference engine with WebGPU and fallback support
 *
 * This singleton class provides a reusable interface for loading and running
 * large language models in the browser using WebLLM with GPU acceleration.
 * It supports model selection, progress tracking, and automatic fallback to picoLLM.
 */
qx.Class.define("deskweb.util.WebLLMManager",
{
  extend : qx.core.Object,
  type: "singleton",

  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  construct : function()
  {
    this.base(arguments);

    this.__engine = null;
    this.__currentModel = null;
    this.__isLoading = false;
    this.__engineType = null; // 'webllm' or 'picollm'

    console.log("[WebLLMManager] Initialized");
  },

  /*
  *****************************************************************************
     EVENTS
  *****************************************************************************
  */

  events: {
    /**
     * Fired when model loading progress updates
     * Data: {progress: number, text: string}
     */
    "loadProgress": "qx.event.type.Data",

    /**
     * Fired when model is successfully loaded
     * Data: {model: string, engineType: string}
     */
    "modelLoaded": "qx.event.type.Data",

    /**
     * Fired when model loading fails
     * Data: {error: Error}
     */
    "loadError": "qx.event.type.Data",

    /**
     * Fired when chat response is being generated (streaming)
     * Data: {text: string, isDone: boolean}
     */
    "chatResponse": "qx.event.type.Data"
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    __engine: null,
    __currentModel: null,
    __isLoading: false,
    __engineType: null,

    /**
     * Get available models (under 4GB)
     * @return {Array} Array of model configurations
     */
    getAvailableModels: function() {
      return [
        {
          id: "chrome-gemini-nano",
          name: "🌟 Chrome 내장 (Gemini Nano)",
          description: "온디바이스 · 크롬 전용 · 무설치(첫 사용 시 자동 다운로드)",
          size: "내장",
          context: "on-device",
          isChrome: true
        },
        {
          id: "openai/gpt-oss-20b",
          name: "openai/gpt-oss-20b",
          description: "Cloud API model, no download required",
          size: "API",
          context: "8k tokens",
          isAPI: true
        },
        {
          id: "gemma-2b-it-q4f16_1-MLC",
          name: "Gemma 2B",
          description: "Lightweight model, 1.5GB, best for simple tasks",
          size: "1.5 GB",
          context: "8k tokens"
        },
        {
          id: "Phi-2-q4f16_1-MLC",
          name: "Phi-2",
          description: "Balanced model, 2.1GB, good performance",
          size: "2.1 GB",
          context: "2k tokens"
        },
        {
          id: "Phi-3-mini-4k-instruct-q4f32_1-MLC-1k",
          name: "Phi-3 Mini",
          description: "Advanced model, 3.2GB, best quality",
          size: "3.2 GB",
          context: "4k tokens"
        }
      ];
    },

    /**
     * Check if WebGPU is available in the browser
     * @return {Promise<boolean>} True if WebGPU is supported
     */
    checkWebGPUSupport: async function() {
      try {
        if (!navigator.gpu) {
          console.log("[WebLLMManager] WebGPU not available");
          return false;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.log("[WebLLMManager] WebGPU adapter not available");
          return false;
        }

        console.log("[WebLLMManager] WebGPU is supported");
        return true;
      } catch (error) {
        console.error("[WebLLMManager] WebGPU check failed:", error);
        return false;
      }
    },

    /**
     * Load a model with automatic fallback
     * @param {string} modelId - The model ID to load
     * @return {Promise<void>}
     */
    loadModel: async function(modelId) {
      if (this.__isLoading) {
        throw new Error("Model is already loading");
      }

      this.__isLoading = true;
      this.__currentModel = modelId;

      console.log("[WebLLMManager] Starting model load:", modelId);

      try {
        // Check if this is an API model
        const models = this.getAvailableModels();
        const modelConfig = models.find(m => m.id === modelId);

        // Chrome 내장 온디바이스 LLM (Gemini Nano / Prompt API) - 1순위
        if (modelConfig && modelConfig.isChrome) {
          console.log("[WebLLMManager] Loading Chrome built-in model...");
          await this.__loadChromeModel(modelId);
          return;
        }

        if (modelConfig && modelConfig.isAPI) {
          console.log("[WebLLMManager] Loading API model...");
          await this.__loadAPIModel(modelId);
          return;
        }

        // Try WebGPU-accelerated WebLLM first
        const webGPUSupported = await this.checkWebGPUSupport();

        if (webGPUSupported) {
          console.log("[WebLLMManager] Attempting to load with WebLLM (WebGPU)...");
          await this.__loadWithWebLLM(modelId);
        } else {
          console.log("[WebLLMManager] WebGPU not available, falling back to picoLLM...");
          await this.__loadWithPicoLLM(modelId);
        }
      } catch (error) {
        console.error("[WebLLMManager] Model loading failed:", error);
        this.__isLoading = false;
        this.fireDataEvent("loadError", {error: error});
        throw error;
      }
    },

    /**
     * Load model using WebLLM (WebGPU)
     * @param {string} modelId - The model ID
     * @return {Promise<void>}
     */
    __loadWithWebLLM: async function(modelId) {
      try {
        // Dynamically import WebLLM from CDN
        const webLLMModule = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm");
        const CreateMLCEngine = webLLMModule.CreateMLCEngine;

        console.log("[WebLLMManager] Creating WebLLM engine...");

        // Create engine with progress callback
        this.__engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (progress) => {
            console.log("[WebLLMManager] Load progress:", progress);
            this.fireDataEvent("loadProgress", {
              progress: progress.progress || 0,
              text: progress.text || "Loading..."
            });
          }
        });

        this.__engineType = "webllm";
        this.__isLoading = false;

        console.log("[WebLLMManager] WebLLM model loaded successfully");
        this.fireDataEvent("modelLoaded", {
          model: modelId,
          engineType: "webllm"
        });
      } catch (error) {
        console.error("[WebLLMManager] WebLLM loading failed:", error);
        // Try fallback to picoLLM
        console.log("[WebLLMManager] Attempting fallback to picoLLM...");
        await this.__loadWithPicoLLM(modelId);
      }
    },

    /**
     * Load model using picoLLM (fallback)
     * @param {string} modelId - The model ID
     * @return {Promise<void>}
     */
    __loadWithPicoLLM: async function(modelId) {
      try {
        // Dynamically import picoLLM from CDN
        const picoModule = await import("https://cdn.jsdelivr.net/npm/@picovoice/picollm-web@1.3.0/+esm");
        const PicoLLM = picoModule.PicoLLM;

        console.log("[WebLLMManager] Creating picoLLM engine...");

        // Map WebLLM model IDs to picoLLM equivalents
        const picoModelMap = {
          "gemma-2b-it-q4f16_1-MLC": "gemma-2b",
          "Phi-2-q4f16_1-MLC": "phi-2",
          "Phi-3-mini-4k-instruct-q4f32_1-MLC-1k": "phi-3-mini"
        };

        const picoModelId = picoModelMap[modelId] || "gemma-2b";

        // Create picoLLM instance with progress tracking
        this.__engine = await PicoLLM.create(
          picoModelId,
          (progress) => {
            console.log("[WebLLMManager] picoLLM load progress:", progress);
            this.fireDataEvent("loadProgress", {
              progress: progress,
              text: `Loading with picoLLM: ${Math.round(progress * 100)}%`
            });
          }
        );

        this.__engineType = "picollm";
        this.__isLoading = false;

        console.log("[WebLLMManager] picoLLM model loaded successfully");
        this.fireDataEvent("modelLoaded", {
          model: modelId,
          engineType: "picollm"
        });
      } catch (error) {
        console.error("[WebLLMManager] picoLLM loading failed:", error);
        this.__isLoading = false;
        throw new Error("Failed to load model with both WebLLM and picoLLM: " + error.message);
      }
    },

    /**
     * Check Chrome built-in AI (Prompt API / Gemini Nano) availability.
     * @return {Promise<string>} "available" | "downloadable" | "downloading" | "unavailable"
     */
    checkChromeAI: async function() {
      const LM = window.LanguageModel || (window.ai && window.ai.languageModel);
      if (!LM || typeof LM.availability !== "function") {
        return "unavailable";
      }
      try {
        return await LM.availability();
      } catch (e) {
        console.warn("[WebLLMManager] Chrome AI availability check failed:", e);
        return "unavailable";
      }
    },

    /**
     * Load Chrome built-in on-device model (Gemini Nano). Triggers/tracks the
     * one-time model download when needed. Works only in Chrome (desktop).
     * @param {string} modelId - The model ID
     * @return {Promise<void>}
     */
    __loadChromeModel: async function(modelId) {
      const LM = window.LanguageModel || (window.ai && window.ai.languageModel);
      if (!LM || typeof LM.availability !== "function") {
        this.__isLoading = false;
        const err = new Error(
          "크롬 내장 AI를 사용할 수 없습니다. 최신 Chrome 데스크톱(Prompt API 지원) 에서만 동작합니다. " +
          "다른 모델을 선택하거나 Chrome을 사용하세요."
        );
        this.fireDataEvent("loadError", { error: err });
        throw err;
      }

      const status = await LM.availability();
      console.log("[WebLLMManager] Chrome AI availability:", status);

      if (status === "unavailable") {
        this.__isLoading = false;
        const err = new Error(
          "이 기기/브라우저에서는 크롬 내장 AI(Gemini Nano)를 사용할 수 없습니다."
        );
        this.fireDataEvent("loadError", { error: err });
        throw err;
      }

      // downloadable/downloading 이면 create() 시 다운로드가 시작되고 진행률이 온다
      if (status !== "available") {
        this.fireDataEvent("loadProgress", {
          progress: 0,
          text: "Gemini Nano 다운로드 준비중..."
        });
      }

      const self = this;
      const primer = await LM.create({
        monitor(m) {
          m.addEventListener("downloadprogress", function(e) {
            self.fireDataEvent("loadProgress", {
              progress: e.loaded || 0,
              text: "Gemini Nano 다운로드: " + Math.round((e.loaded || 0) * 100) + "%"
            });
          });
        }
      });
      // 다운로드 트리거용 세션은 즉시 정리 (실제 대화는 매 호출 시 세션 생성)
      try { if (primer.destroy) { primer.destroy(); } } catch (e) { /* ignore */ }

      this.__engine = "chrome";
      this.__engineType = "chrome";
      this.__isLoading = false;

      console.log("[WebLLMManager] Chrome built-in model ready");
      this.fireDataEvent("modelLoaded", { model: modelId, engineType: "chrome" });
    },

    /**
     * Load API model (no actual loading needed)
     * @param {string} modelId - The model ID
     * @return {Promise<void>}
     */
    __loadAPIModel: async function(modelId) {
      console.log("[WebLLMManager] Setting up API model:", modelId);

      // Simulate a brief loading time for UX consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      this.__engine = "api"; // Mark as API mode
      this.__engineType = "api";
      this.__isLoading = false;

      console.log("[WebLLMManager] API model ready");
      this.fireDataEvent("modelLoaded", {
        model: modelId,
        engineType: "api"
      });
    },

    /**
     * Generate a chat response
     * @param {string} message - User message
     * @param {Array} history - Chat history (optional)
     * @param {string} systemPrompt - Custom system prompt (optional)
     * @return {Promise<string>} Generated response
     */
    chat: async function(message, history, systemPrompt) {
      if (!this.__engine) {
        throw new Error("No model loaded. Please load a model first.");
      }

      console.log("[WebLLMManager] Generating chat response for:", message);

      try {
        if (this.__engineType === "chrome") {
          return await this.__chatWithChrome(message, history, systemPrompt);
        } else if (this.__engineType === "api") {
          return await this.__chatWithAPI(message, history, systemPrompt);
        } else if (this.__engineType === "webllm") {
          return await this.__chatWithWebLLM(message, history);
        } else if (this.__engineType === "picollm") {
          return await this.__chatWithPicoLLM(message, history);
        } else {
          throw new Error("Unknown engine type: " + this.__engineType);
        }
      } catch (error) {
        console.error("[WebLLMManager] Chat generation failed:", error);
        throw error;
      }
    },

    /**
     * Chat using Chrome built-in Gemini Nano (Prompt API). Streams delta chunks.
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @param {string} systemPrompt - Optional system prompt
     * @return {Promise<string>} Generated response
     */
    __chatWithChrome: async function(message, history, systemPrompt) {
      const LM = window.LanguageModel || (window.ai && window.ai.languageModel);
      if (!LM) {
        throw new Error("Chrome 내장 AI를 사용할 수 없습니다.");
      }

      const sysContent = systemPrompt ||
        "You are a helpful assistant. Respond in Markdown format.";
      const initialPrompts = [{ role: "system", content: sysContent }];
      if (history && history.length > 0) {
        history.forEach(msg => {
          if (msg && msg.role && msg.content && msg.content !== message) {
            initialPrompts.push({ role: msg.role, content: msg.content });
          }
        });
      }

      let session;
      try {
        session = await LM.create({ initialPrompts: initialPrompts });
      } catch (e) {
        // 히스토리 포맷 제약 등으로 실패하면 시스템 프롬프트만으로 재시도
        console.warn("[WebLLMManager] Chrome session with history failed, retrying:", e);
        session = await LM.create({
          initialPrompts: [{ role: "system", content: sysContent }]
        });
      }

      let fullResponse = "";
      try {
        const stream = session.promptStreaming(message);
        for await (const chunk of stream) {
          fullResponse += chunk; // Prompt API는 델타(증분) 청크를 준다
          this.fireDataEvent("chatResponse", { text: fullResponse, isDone: false });
        }
      } finally {
        try { if (session.destroy) { session.destroy(); } } catch (e) { /* ignore */ }
      }

      this.fireDataEvent("chatResponse", { text: fullResponse, isDone: true });
      return fullResponse;
    },

    /**
     * Chat using API
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @return {Promise<string>} Generated response
     */
    __chatWithAPI: async function(message, history, systemPrompt) {
      console.log("[WebLLMManager] Calling API with message:", message);

      // Build messages array
      const sysContent = systemPrompt || "You are a helpful assistant. Respond in Markdown format.";
      const messages = [
        { role: "system", content: sysContent }
      ];

      // Add history
      if (history && history.length > 0) {
        history.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Add current message (if not already in history)
      if (!history || history.length === 0 || history[history.length - 1].content !== message) {
        messages.push({ role: "user", content: message });
      }

      const apiUrl = "https://mcp.webnori.com/api/llm/chat/completions";
      const payload = {
        model: this.__currentModel,
        messages: messages,
        max_tokens: 5000,
        temperature: 0.7,
        stream: true
      };

      console.log("[WebLLMManager] API request payload:", payload);

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "accept": "text/plain",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("[WebLLMManager] API stream complete");
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '' || line.trim() === 'data: [DONE]') {
              continue;
            }

            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6); // Remove 'data: ' prefix
                const data = JSON.parse(jsonStr);

                if (data.choices && data.choices[0] && data.choices[0].delta) {
                  const content = data.choices[0].delta.content;
                  if (content) {
                    fullResponse += content;
                    // Fire streaming event
                    this.fireDataEvent("chatResponse", {
                      text: fullResponse,
                      isDone: false
                    });
                    console.log("[WebLLMManager] API chunk received, total length:", fullResponse.length);
                  }
                }
              } catch (parseError) {
                console.warn("[WebLLMManager] Failed to parse SSE data:", line, parseError);
              }
            }
          }
        }

        // Fire completion event
        this.fireDataEvent("chatResponse", {
          text: fullResponse,
          isDone: true
        });

        console.log("[WebLLMManager] API response complete, total length:", fullResponse.length);
        return fullResponse;

      } catch (error) {
        console.error("[WebLLMManager] API chat error:", error);
        throw error;
      }
    },

    /**
     * Chat using WebLLM
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @return {Promise<string>} Generated response
     */
    __chatWithWebLLM: async function(message, history) {
      // Build messages array
      const messages = history || [];
      messages.push({ role: "user", content: message });

      // Generate response with streaming
      let fullResponse = "";

      const completion = await this.__engine.chat.completions.create({
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 512
      });

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          this.fireDataEvent("chatResponse", {
            text: fullResponse,
            isDone: false
          });
        }
      }

      this.fireDataEvent("chatResponse", {
        text: fullResponse,
        isDone: true
      });

      return fullResponse;
    },

    /**
     * Chat using picoLLM
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @return {Promise<string>} Generated response
     */
    __chatWithPicoLLM: async function(message, history) {
      // Build prompt from history
      let prompt = "";
      if (history) {
        history.forEach(msg => {
          prompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      prompt += `user: ${message}\nassistant: `;

      // Generate response
      const response = await this.__engine.generate(prompt, {
        maxTokens: 512,
        temperature: 0.7,
        onToken: (token) => {
          // Stream token-by-token
          this.fireDataEvent("chatResponse", {
            text: token,
            isDone: false
          });
        }
      });

      this.fireDataEvent("chatResponse", {
        text: response,
        isDone: true
      });

      return response;
    },

    /**
     * Unload the current model and free resources
     */
    unloadModel: function() {
      if (this.__engine) {
        console.log("[WebLLMManager] Unloading model...");

        // Cleanup based on engine type
        if (this.__engine.release) {
          this.__engine.release();
        }

        this.__engine = null;
        this.__currentModel = null;
        this.__engineType = null;

        console.log("[WebLLMManager] Model unloaded");
      }
    },

    /**
     * Get current model info
     * @return {Object} Current model information
     */
    getCurrentModelInfo: function() {
      return {
        modelId: this.__currentModel,
        engineType: this.__engineType,
        isLoaded: this.__engine !== null,
        isLoading: this.__isLoading
      };
    }
  }
});
