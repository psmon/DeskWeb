/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * ChatBot Window - AI Chat Assistant with WebLLM
 *
 * A Windows XP style chat interface that uses WebLLM for local AI inference.
 * Features include model selection, conversation history, and responsive design.
 */
qx.Class.define("deskweb.ui.ChatBotWindow",
{
  extend : qx.ui.window.Window,

  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  construct : function()
  {
    this.base(arguments, "AI ChatBot");

    console.log("[ChatBotWindow] Initializing...");

    // Initialize managers
    this.__llmManager = deskweb.util.WebLLMManager.getInstance();
    this.__conversationHistory = [];
    this.__currentModelId = null;

    // Setup window
    this._setupWindow();

    // Build UI
    this._buildUI();

    // Setup event listeners
    this._setupEventListeners();

    // Load conversation history from localStorage
    this._loadConversationHistory();

    console.log("[ChatBotWindow] Initialized successfully");
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    __llmManager: null,
    __conversationHistory: null,
    __currentModelId: null,

    // UI Elements
    __chatArea: null,
    __inputField: null,
    __sendButton: null,
    __modelSelector: null,
    __loadModelButton: null,
    __statusLabel: null,
    __progressBar: null,
    __clearButton: null,
    __thinkingIndicator: null,
    __thinkingAnimation: null,
    __streamingMessageContainer: null,
    __streamingMessageLabel: null,
    __currentStreamingText: null,

    /**
     * Setup window properties
     */
    _setupWindow: function() {
      this.setLayout(new qx.ui.layout.VBox(5));
      this.set({
        width: 600,
        height: 500,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        contentPadding: 10,
        icon: "deskweb/images/chatbot.svg"
      });
    },

    /**
     * Build the user interface
     */
    _buildUI: function() {
      // Create toolbar with model selection
      this._createToolbar();

      // Create status bar with progress
      this._createStatusBar();

      // Create chat display area
      this._createChatArea();

      // Create input area
      this._createInputArea();
    },

    /**
     * Create toolbar with model selection
     */
    _createToolbar: function() {
      const toolbar = new qx.ui.toolbar.ToolBar();

      // Model selector label
      const modelLabel = new qx.ui.basic.Label("Model:");
      toolbar.add(modelLabel);

      // Model selector dropdown
      this.__modelSelector = new qx.ui.form.SelectBox();
      this.__modelSelector.setWidth(200);

      const models = this.__llmManager.getAvailableModels();
      models.forEach(model => {
        const item = new qx.ui.form.ListItem(
          `${model.name} (${model.size})`,
          null,
          model.id
        );
        item.setRich(true);
        this.__modelSelector.add(item);
      });

      toolbar.add(this.__modelSelector);

      // Load model button
      this.__loadModelButton = new qx.ui.toolbar.Button("Load Model");
      this.__loadModelButton.addListener("execute", this._onLoadModel, this);
      toolbar.add(this.__loadModelButton);

      // Spacer
      toolbar.addSpacer();

      // Clear history button
      this.__clearButton = new qx.ui.toolbar.Button("Clear History");
      this.__clearButton.addListener("execute", this._onClearHistory, this);
      toolbar.add(this.__clearButton);

      this.add(toolbar);
    },

    /**
     * Create status bar with progress indicator
     */
    _createStatusBar: function() {
      const statusContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));

      // Status label
      this.__statusLabel = new qx.ui.basic.Label("Ready. Please select and load a model.");
      this.__statusLabel.set({
        rich: true,
        textColor: "#0000FF"
      });
      statusContainer.add(this.__statusLabel);

      // Progress bar
      this.__progressBar = new qx.ui.indicator.ProgressBar();
      this.__progressBar.set({
        height: 20,
        visibility: "excluded"
      });
      statusContainer.add(this.__progressBar);

      this.add(statusContainer);
    },

    /**
     * Create chat display area
     */
    _createChatArea: function() {
      // Scroll container for chat
      const scrollContainer = new qx.ui.container.Scroll();
      scrollContainer.set({
        backgroundColor: "#FFFFFF",
        decorator: "main"
      });

      // Chat area with VBox layout
      this.__chatArea = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.__chatArea.setPadding(10);

      scrollContainer.add(this.__chatArea);
      this.add(scrollContainer, {flex: 1});

      // Welcome message
      this._addSystemMessage("Welcome to AI ChatBot! Please load a model to start chatting.");
    },

    /**
     * Create input area with text field and send button
     */
    _createInputArea: function() {
      const inputContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));

      // Input text field
      this.__inputField = new qx.ui.form.TextField();
      this.__inputField.setPlaceholder("Type your message here...");
      this.__inputField.setEnabled(false);
      this.__inputField.addListener("keypress", function(e) {
        if (e.getKeyIdentifier() === "Enter") {
          this._onSendMessage();
        }
      }, this);

      inputContainer.add(this.__inputField, {flex: 1});

      // Send button
      this.__sendButton = new qx.ui.form.Button("Send");
      this.__sendButton.setEnabled(false);
      this.__sendButton.addListener("execute", this._onSendMessage, this);

      inputContainer.add(this.__sendButton);

      this.add(inputContainer);
    },

    /**
     * Setup event listeners
     */
    _setupEventListeners: function() {
      // Listen to LLM manager events
      this.__llmManager.addListener("loadProgress", this._onLoadProgress, this);
      this.__llmManager.addListener("modelLoaded", this._onModelLoaded, this);
      this.__llmManager.addListener("loadError", this._onLoadError, this);
      this.__llmManager.addListener("chatResponse", this._onChatResponse, this);
    },

    /**
     * Handle load model button click
     */
    _onLoadModel: async function() {
      const selectedItem = this.__modelSelector.getSelection()[0];
      if (!selectedItem) {
        alert("Please select a model first.");
        return;
      }

      const modelId = selectedItem.getModel();
      this.__currentModelId = modelId;

      console.log("[ChatBotWindow] Loading model:", modelId);

      // Disable buttons during loading
      this.__loadModelButton.setEnabled(false);
      this.__modelSelector.setEnabled(false);

      // Show progress bar
      this.__progressBar.set({
        visibility: "visible",
        value: 0
      });

      this.__statusLabel.setValue("Loading model... This may take a few minutes on first load.");

      try {
        await this.__llmManager.loadModel(modelId);
      } catch (error) {
        console.error("[ChatBotWindow] Failed to load model:", error);
      }
    },

    /**
     * Handle load progress event
     */
    _onLoadProgress: function(e) {
      const data = e.getData();
      const progress = Math.round((data.progress || 0) * 100);

      this.__progressBar.setValue(progress);
      this.__statusLabel.setValue(`Loading: ${data.text || ''} (${progress}%)`);

      console.log("[ChatBotWindow] Load progress:", progress);
    },

    /**
     * Handle model loaded event
     */
    _onModelLoaded: function(e) {
      const data = e.getData();

      console.log("[ChatBotWindow] Model loaded:", data);

      // Hide progress bar
      this.__progressBar.setVisibility("excluded");

      // Update status
      this.__statusLabel.setValue(
        `<b>Model loaded:</b> ${data.model} (${data.engineType}) - Ready to chat!`
      );

      // Enable input and send button
      this.__inputField.setEnabled(true);
      this.__sendButton.setEnabled(true);
      this.__loadModelButton.setEnabled(true);
      this.__modelSelector.setEnabled(true);

      // Add system message
      this._addSystemMessage(`Model ${data.model} loaded successfully using ${data.engineType}. You can now start chatting!`);

      // Focus input field with a small delay to ensure it's ready
      qx.event.Timer.once(function() {
        this.__inputField.focus();
      }, this, 100);
    },

    /**
     * Handle load error event
     */
    _onLoadError: function(e) {
      const error = e.getData().error;

      console.error("[ChatBotWindow] Load error:", error);

      // Hide progress bar
      this.__progressBar.setVisibility("excluded");

      // Update status
      this.__statusLabel.setValue(
        `<span style="color: red;">Error loading model: ${error.message}</span>`
      );

      // Re-enable buttons
      this.__loadModelButton.setEnabled(true);
      this.__modelSelector.setEnabled(true);

      // Show error message
      this._addSystemMessage(`Error: ${error.message}`, true);
    },

    /**
     * Handle send message button click
     */
    _onSendMessage: async function() {
      const message = this.__inputField.getValue();
      if (!message || message.trim() === "") {
        return;
      }

      console.log("[ChatBotWindow] Sending message:", message);

      // Add user message to chat
      this._addUserMessage(message);

      // Clear input field
      this.__inputField.setValue("");

      // Disable input during response generation
      this.__inputField.setEnabled(false);
      this.__sendButton.setEnabled(false);

      // Show thinking indicator
      this._showThinkingIndicator();

      // Update status
      this.__statusLabel.setValue("Generating response...");

      try {
        // Add user message to conversation history BEFORE generating response
        this.__conversationHistory.push({
          role: "user",
          content: message
        });

        // Build history for context (now includes the current message)
        const history = this.__conversationHistory.slice(-10); // Last 10 messages

        console.log("[ChatBotWindow] Sending to LLM with history:", history);

        // Remove thinking indicator and prepare for streaming
        this._removeThinkingIndicator();

        // Create streaming message bubble
        this._createStreamingMessageBubble();

        // Initialize streaming text
        this.__currentStreamingText = "";

        // Generate response with streaming
        const response = await this.__llmManager.chat(message, history);

        // Finalize the streaming message
        this._finalizeStreamingMessage(response);

        // Add assistant response to conversation history
        this.__conversationHistory.push({
          role: "assistant",
          content: response
        });

        // Save to localStorage
        this._saveConversationHistory();

        // Update status
        this.__statusLabel.setValue("Ready");

        console.log("[ChatBotWindow] Response completed");
      } catch (error) {
        console.error("[ChatBotWindow] Chat error:", error);
        this._removeThinkingIndicator();

        // Remove streaming message if present
        if (this.__streamingMessageContainer) {
          this.__chatArea.remove(this.__streamingMessageContainer);
          this.__streamingMessageContainer = null;
          this.__streamingMessageLabel = null;
        }

        this._addSystemMessage(`Error: ${error.message}`, true);
        this.__statusLabel.setValue(`<span style="color: red;">Error: ${error.message}</span>`);
      } finally {
        // Re-enable input
        this.__inputField.setEnabled(true);
        this.__sendButton.setEnabled(true);
        this.__inputField.focus();
      }
    },

    /**
     * Handle chat response streaming
     */
    _onChatResponse: function(e) {
      const data = e.getData();

      if (!data || !this.__streamingMessageLabel) {
        return;
      }

      // Update streaming text with new chunk
      if (!data.isDone && data.text) {
        this.__currentStreamingText = data.text;

        // Render markdown and update the widget
        const renderedHtml = this._renderMarkdown(data.text);

        // Use setHtml for qx.ui.embed.Html widget
        if (this.__streamingMessageLabel.setHtml) {
          this.__streamingMessageLabel.setHtml(renderedHtml);
        } else {
          this.__streamingMessageLabel.setValue(renderedHtml);
        }

        // Force the widget to recalculate its size
        const element = this.__streamingMessageLabel.getContentElement();
        if (element) {
          const domElement = element.getDomElement();
          if (domElement) {
            // Reset height to allow content to expand
            domElement.style.height = "auto";

            // Get the actual content height
            const contentHeight = domElement.scrollHeight;

            // Apply the calculated height
            if (contentHeight > 0) {
              this.__streamingMessageLabel.setHeight(contentHeight);
            }
          }
        }

        // Force layout update and scroll to bottom
        this.__chatArea.invalidateLayoutCache();
        qx.ui.core.queue.Manager.flush();
        this._scrollToBottom();

        console.log("[ChatBotWindow] Streaming chunk received, length:", data.text.length);
      }
    },

    /**
     * Add user message to chat area
     */
    _addUserMessage: function(message) {
      const messageContainer = this._createMessageBubble(message, "user");
      this.__chatArea.add(messageContainer);

      // Force layout update before scrolling
      this.__chatArea.invalidateLayoutCache();
      qx.ui.core.queue.Manager.flush();

      this._scrollToBottom();
    },

    /**
     * Add assistant message to chat area
     */
    _addAssistantMessage: function(message) {
      const messageContainer = this._createMessageBubble(message, "assistant");
      this.__chatArea.add(messageContainer);

      // Render mermaid diagrams if present
      const widget = messageContainer.getChildren()[0]; // Get the widget from container
      if (widget) {
        qx.event.Timer.once(function() {
          this._renderMermaidDiagrams(widget);
        }, this, 200);
      }

      // Force layout update before scrolling
      this.__chatArea.invalidateLayoutCache();
      qx.ui.core.queue.Manager.flush();

      this._scrollToBottom();
    },

    /**
     * Add system message to chat area
     */
    _addSystemMessage: function(message, isError) {
      const label = new qx.ui.basic.Label(message);
      label.set({
        rich: true,
        textColor: isError ? "#FF0000" : "#888888",
        textAlign: "center",
        padding: 5
      });
      this.__chatArea.add(label);

      // Force layout update before scrolling
      this.__chatArea.invalidateLayoutCache();
      qx.ui.core.queue.Manager.flush();

      this._scrollToBottom();
    },

    /**
     * Create a message bubble
     */
    _createMessageBubble: function(message, role) {
      const container = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      container.setPadding(5);

      // Render markdown for assistant messages, escape HTML for user messages
      const displayText = role === "assistant" ? this._renderMarkdown(message) : this._escapeHtml(message);

      // Use Html widget instead of Label for better HTML rendering and text selection
      const htmlWidget = new qx.ui.embed.Html(displayText);
      htmlWidget.set({
        // Use minWidth instead of fixed width, allow it to grow
        minWidth: 200,
        padding: 10,
        backgroundColor: role === "user" ? "#E3F2FD" : "#F5F5F5",
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 10,
          backgroundColor: role === "user" ? "#E3F2FD" : "#F5F5F5"
        }),
        // Enable text selection
        selectable: true,
        // Allow content to grow in both directions
        allowGrowX: true,
        allowGrowY: true,
        allowShrinkY: false
      });

      // Add custom CSS for text selection and overflow
      htmlWidget.addListenerOnce("appear", function() {
        const element = htmlWidget.getContentElement();
        if (element) {
          const domElement = element.getDomElement();
          if (domElement) {
            domElement.style.userSelect = "text";
            domElement.style.webkitUserSelect = "text";
            domElement.style.cursor = "text";
            domElement.style.wordWrap = "break-word";
            domElement.style.overflowWrap = "break-word";
            domElement.style.overflow = "auto";
            domElement.style.minHeight = "20px";
            domElement.style.width = "100%";
            domElement.style.maxWidth = "none";

            // Calculate and set initial height
            const contentHeight = domElement.scrollHeight;
            if (contentHeight > 0) {
              htmlWidget.setHeight(contentHeight);
            }
          }
        }
      });

      if (role === "user") {
        container.add(new qx.ui.core.Spacer(), {flex: 1});
        container.add(htmlWidget, {flex: 0});
      } else {
        container.add(htmlWidget, {flex: 1});
        container.add(new qx.ui.core.Spacer(), {flex: 0});
      }

      return container;
    },

    /**
     * Scroll chat area to bottom
     */
    _scrollToBottom: function() {
      // Use multiple timings to ensure scroll works reliably
      const scrollToEnd = function() {
        const scrollContainer = this.__chatArea.getLayoutParent();
        if (scrollContainer instanceof qx.ui.container.Scroll) {
          // Force layout recalculation first
          scrollContainer.invalidateLayoutCache();

          const scrollPane = scrollContainer.getChildControl("pane");
          if (scrollPane) {
            // Get the actual content height
            const contentElement = scrollPane.getContentElement();
            if (contentElement) {
              const domElement = contentElement.getDomElement();
              if (domElement) {
                // Calculate the maximum scroll position
                const maxScrollY = Math.max(
                  domElement.scrollHeight,
                  domElement.offsetHeight,
                  this.__chatArea.getBounds()?.height || 0
                );

                // Scroll to the very bottom with extra padding
                scrollContainer.scrollToY(maxScrollY + 2000);

                console.log("[ChatBotWindow] Scrolled to bottom, height:", maxScrollY);
              }
            }
          }
        }
      }.bind(this);

      // Scroll immediately
      scrollToEnd();

      // Scroll again after layout is complete with multiple timings
      qx.event.Timer.once(scrollToEnd, this, 10);
      qx.event.Timer.once(scrollToEnd, this, 50);
      qx.event.Timer.once(scrollToEnd, this, 100);
      qx.event.Timer.once(scrollToEnd, this, 200);
      qx.event.Timer.once(scrollToEnd, this, 400);
    },

    /**
     * Show thinking indicator animation
     */
    _showThinkingIndicator: function() {
      if (this.__thinkingIndicator) {
        return; // Already showing
      }

      // Create thinking indicator container
      const container = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      container.setPadding(5);

      // Create animated thinking bubble
      const thinkingBubble = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      thinkingBubble.set({
        padding: 10,
        backgroundColor: "#F5F5F5",
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 10,
          backgroundColor: "#F5F5F5"
        })
      });

      // Create animated dots
      const dot1 = new qx.ui.basic.Label("●");
      const dot2 = new qx.ui.basic.Label("●");
      const dot3 = new qx.ui.basic.Label("●");

      [dot1, dot2, dot3].forEach(function(dot) {
        dot.set({
          textColor: "#888888",
          font: "bold"
        });
        thinkingBubble.add(dot);
      });

      container.add(thinkingBubble);
      container.add(new qx.ui.core.Spacer(), {flex: 1});

      this.__thinkingIndicator = container;
      this.__chatArea.add(this.__thinkingIndicator);

      // Force layout update before scrolling
      this.__chatArea.invalidateLayoutCache();
      qx.ui.core.queue.Manager.flush();

      this._scrollToBottom();

      // Animate dots
      let dotIndex = 0;
      const dots = [dot1, dot2, dot3];

      this.__thinkingAnimation = setInterval(function() {
        dots.forEach(function(dot, index) {
          if (index === dotIndex) {
            dot.setTextColor("#4A90E2");
            dot.setFont("bold");
          } else {
            dot.setTextColor("#CCCCCC");
          }
        });
        dotIndex = (dotIndex + 1) % 3;
      }, 400);

      console.log("[ChatBotWindow] Thinking indicator shown");
    },

    /**
     * Remove thinking indicator
     */
    _removeThinkingIndicator: function() {
      if (this.__thinkingIndicator) {
        // Stop animation
        if (this.__thinkingAnimation) {
          clearInterval(this.__thinkingAnimation);
          this.__thinkingAnimation = null;
        }

        // Remove from UI
        this.__chatArea.remove(this.__thinkingIndicator);
        this.__thinkingIndicator.dispose();
        this.__thinkingIndicator = null;

        console.log("[ChatBotWindow] Thinking indicator removed");
      }
    },

    /**
     * Create streaming message bubble for real-time updates
     */
    _createStreamingMessageBubble: function() {
      // Create container
      const container = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      container.setPadding(5);

      // Create Html widget for streaming text (instead of Label)
      const htmlWidget = new qx.ui.embed.Html("");
      htmlWidget.set({
        // Use minWidth instead of fixed width, allow it to grow
        minWidth: 200,
        padding: 10,
        backgroundColor: "#F5F5F5",
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 10,
          backgroundColor: "#F5F5F5"
        }),
        selectable: true,
        // Allow content to grow in both directions
        allowGrowX: true,
        allowGrowY: true,
        allowShrinkY: false
      });

      // Enable text selection and proper overflow when element appears
      htmlWidget.addListenerOnce("appear", function() {
        const element = htmlWidget.getContentElement();
        if (element) {
          const domElement = element.getDomElement();
          if (domElement) {
            domElement.style.userSelect = "text";
            domElement.style.webkitUserSelect = "text";
            domElement.style.cursor = "text";
            domElement.style.wordWrap = "break-word";
            domElement.style.overflowWrap = "break-word";
            domElement.style.overflow = "auto";
            domElement.style.minHeight = "20px";
            domElement.style.width = "100%";
            domElement.style.maxWidth = "none";
          }
        }
      });

      container.add(htmlWidget, {flex: 1});
      container.add(new qx.ui.core.Spacer(), {flex: 0});

      this.__streamingMessageContainer = container;
      this.__streamingMessageLabel = htmlWidget;

      // Add to chat area
      this.__chatArea.add(container);

      // Initial scroll
      this.__chatArea.invalidateLayoutCache();
      qx.ui.core.queue.Manager.flush();
      this._scrollToBottom();

      console.log("[ChatBotWindow] Streaming message bubble created");
    },

    /**
     * Finalize streaming message
     */
    _finalizeStreamingMessage: function(finalText) {
      if (this.__streamingMessageLabel && finalText) {
        // Render markdown and update with final text
        const renderedHtml = this._renderMarkdown(finalText);

        // Use setHtml for qx.ui.embed.Html widget
        if (this.__streamingMessageLabel.setHtml) {
          this.__streamingMessageLabel.setHtml(renderedHtml);
        } else {
          this.__streamingMessageLabel.setValue(renderedHtml);
        }

        // Force the widget to recalculate its final size
        const element = this.__streamingMessageLabel.getContentElement();
        if (element) {
          const domElement = element.getDomElement();
          if (domElement) {
            // Reset height to allow content to expand
            domElement.style.height = "auto";

            // Get the actual content height
            const contentHeight = domElement.scrollHeight;

            // Apply the calculated height
            if (contentHeight > 0) {
              this.__streamingMessageLabel.setHeight(contentHeight);
            }
          }
        }

        // Store reference for mermaid rendering
        const widget = this.__streamingMessageLabel;

        // Render mermaid diagrams if present (with delay to ensure DOM is ready)
        qx.event.Timer.once(function() {
          this._renderMermaidDiagrams(widget);

          // Scroll again after mermaid rendering
          this._scrollToBottom();
        }, this, 500);

        // Force final layout update and scroll
        this.__chatArea.invalidateLayoutCache();
        qx.ui.core.queue.Manager.flush();
        this._scrollToBottom();
      }

      // Clear streaming references
      this.__streamingMessageContainer = null;
      this.__streamingMessageLabel = null;
      this.__currentStreamingText = null;

      console.log("[ChatBotWindow] Streaming message finalized");
    },

    /**
     * Escape HTML for safe display
     */
    _escapeHtml: function(text) {
      if (!text) return "";

      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br/>");
    },

    /**
     * Render markdown text to HTML
     */
    _renderMarkdown: function(text) {
      if (!text) return "";

      try {
        // Check if marked library is available
        if (typeof marked === 'undefined') {
          console.warn("[ChatBotWindow] marked.js not loaded, falling back to plain text");
          return this._escapeHtml(text);
        }

        // Configure marked options
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: true,
          mangle: false,
          sanitize: false
        });

        // Convert markdown to HTML
        let html = marked.parse(text);

        // Process mermaid diagrams if available
        if (typeof mermaid !== 'undefined') {
          // Find mermaid code blocks and render them
          html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, function(match, code) {
            const uniqueId = 'mermaid-' + Math.random().toString(36).substr(2, 9);
            // Decode HTML entities in the code
            const decodedCode = code
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&');

            return '<div class="mermaid" id="' + uniqueId + '">' + decodedCode + '</div>';
          });
        }

        return html;
      } catch (error) {
        console.error("[ChatBotWindow] Markdown rendering error:", error);
        return this._escapeHtml(text);
      }
    },

    /**
     * Render mermaid diagrams in a widget
     */
    _renderMermaidDiagrams: function(widget) {
      if (typeof mermaid === 'undefined') {
        console.warn("[ChatBotWindow] Mermaid not available");
        return;
      }

      try {
        // Get the DOM element from the widget
        const contentElement = widget.getContentElement();
        if (!contentElement) {
          console.warn("[ChatBotWindow] No content element for mermaid rendering");
          return;
        }

        const domElement = contentElement.getDomElement();
        if (!domElement) {
          console.warn("[ChatBotWindow] No DOM element for mermaid rendering");
          return;
        }

        // Find all mermaid elements
        const mermaidElements = domElement.querySelectorAll('.mermaid');

        if (mermaidElements.length === 0) {
          console.log("[ChatBotWindow] No mermaid diagrams found");
          return;
        }

        console.log("[ChatBotWindow] Found " + mermaidElements.length + " mermaid diagram(s)");

        mermaidElements.forEach(function(element, index) {
          if (!element.hasAttribute('data-processed')) {
            console.log("[ChatBotWindow] Rendering mermaid diagram #" + index);

            // Render the mermaid diagram
            mermaid.run({
              nodes: [element]
            }).then(function() {
              element.setAttribute('data-processed', 'true');
              console.log("[ChatBotWindow] Mermaid diagram #" + index + " rendered successfully");
            }).catch(function(error) {
              console.error("[ChatBotWindow] Mermaid rendering error for diagram #" + index + ":", error);
              element.innerHTML = "<div style='color: red; padding: 10px; border: 1px solid red;'>Error rendering diagram: " + error.message + "</div>";
              element.setAttribute('data-processed', 'error');
            });
          } else {
            console.log("[ChatBotWindow] Mermaid diagram #" + index + " already processed");
          }
        });
      } catch (error) {
        console.error("[ChatBotWindow] Mermaid rendering error:", error);
      }
    },

    /**
     * Handle clear history button click
     */
    _onClearHistory: function() {
      if (confirm("Are you sure you want to clear the conversation history?")) {
        this.__conversationHistory = [];
        this._saveConversationHistory();

        // Clear chat area
        this.__chatArea.removeAll();

        // Add welcome message
        this._addSystemMessage("Conversation history cleared.");

        console.log("[ChatBotWindow] Conversation history cleared");
      }
    },

    /**
     * Load conversation history from localStorage
     */
    _loadConversationHistory: function() {
      try {
        const stored = localStorage.getItem("deskweb.chatbot.history");
        if (stored) {
          this.__conversationHistory = JSON.parse(stored);

          // Restore messages to chat area
          this.__conversationHistory.forEach(msg => {
            if (msg.role === "user") {
              this._addUserMessage(msg.content);
            } else if (msg.role === "assistant") {
              this._addAssistantMessage(msg.content);
            }
          });

          console.log("[ChatBotWindow] Loaded conversation history:", this.__conversationHistory.length, "messages");
        }
      } catch (error) {
        console.error("[ChatBotWindow] Failed to load conversation history:", error);
      }
    },

    /**
     * Save conversation history to localStorage
     */
    _saveConversationHistory: function() {
      try {
        localStorage.setItem(
          "deskweb.chatbot.history",
          JSON.stringify(this.__conversationHistory)
        );
        console.log("[ChatBotWindow] Saved conversation history");
      } catch (error) {
        console.error("[ChatBotWindow] Failed to save conversation history:", error);
      }
    }
  },

  /*
  *****************************************************************************
     DESTRUCTOR
  *****************************************************************************
  */

  destruct : function()
  {
    // Clean up thinking animation
    if (this.__thinkingAnimation) {
      clearInterval(this.__thinkingAnimation);
      this.__thinkingAnimation = null;
    }

    // Remove event listeners
    if (this.__llmManager) {
      this.__llmManager.removeListener("loadProgress", this._onLoadProgress, this);
      this.__llmManager.removeListener("modelLoaded", this._onModelLoaded, this);
      this.__llmManager.removeListener("loadError", this._onLoadError, this);
      this.__llmManager.removeListener("chatResponse", this._onChatResponse, this);
    }

    this.__llmManager = null;
    this.__conversationHistory = null;
    this.__thinkingIndicator = null;
    this.__streamingMessageContainer = null;
    this.__streamingMessageLabel = null;
    this.__currentStreamingText = null;
  }
});
