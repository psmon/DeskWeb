/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * AskBot Window - iframe-based external URL loader
 *
 * A Windows XP style window that loads external URLs using iframe.
 * Supports resizing with localStorage-based size persistence.
 */
qx.Class.define("deskweb.ui.AskBotWindow",
{
  extend : qx.ui.window.Window,

  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  construct : function(url, title, iconUrl)
  {
    // Default values
    this.__url = url || "https://mcp.webnori.com/ui/askbot";
    this.__title = title || "ASK BOT";
    this.__iconUrl = iconUrl || "deskweb/images/askbot.svg";
    this.__storageKey = "deskweb.askbot.windowSize";

    this.base(arguments, this.__title);

    console.log("[AskBotWindow] Initializing with URL:", this.__url);

    // Setup window
    this._setupWindow();

    // Build UI
    this._buildUI();

    // Load saved window size
    this._loadWindowSize();

    // Setup event listeners
    this._setupEventListeners();

    console.log("[AskBotWindow] Initialized successfully");
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    __url: null,
    __title: null,
    __iconUrl: null,
    __storageKey: null,
    __iframe: null,
    __iframeWidget: null,

    /**
     * Setup window properties
     */
    _setupWindow: function() {
      this.setLayout(new qx.ui.layout.VBox(0));

      // Load saved size or use default mobile size
      var savedSize = this._getSavedSize();
      var width = savedSize ? savedSize.width : 400;
      var height = savedSize ? savedSize.height : 700;

      this.set({
        width: width,
        height: height,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        contentPadding: 0,
        icon: this.__iconUrl,
        allowMaximize: true,
        allowMinimize: true,
        resizable: true
      });

      console.log("[AskBotWindow] Window size set to:", width, "x", height);
    },

    /**
     * Build the user interface
     */
    _buildUI: function() {
      // Create iframe widget using Html embed
      this.__iframeWidget = new qx.ui.embed.Iframe(this.__url);
      this.__iframeWidget.set({
        decorator: null,
        // Allow iframe to fill the window
        width: null,
        height: null
      });

      // Add iframe to window
      this.add(this.__iframeWidget, {flex: 1});

      console.log("[AskBotWindow] UI built with iframe loading:", this.__url);
    },

    /**
     * Setup event listeners
     */
    _setupEventListeners: function() {
      // Listen for resize events to save window size
      this.addListener("resize", this._onResize, this);

      console.log("[AskBotWindow] Event listeners setup");
    },

    /**
     * Handle window resize event
     */
    _onResize: function(e) {
      var bounds = this.getBounds();
      if (bounds && bounds.width && bounds.height) {
        this._saveWindowSize(bounds.width, bounds.height);
        console.log("[AskBotWindow] Window resized to:", bounds.width, "x", bounds.height);
      }
    },

    /**
     * Get saved window size from localStorage
     */
    _getSavedSize: function() {
      try {
        var stored = localStorage.getItem(this.__storageKey);
        if (stored) {
          var size = JSON.parse(stored);
          console.log("[AskBotWindow] Loaded saved size:", size);
          return size;
        }
      } catch (error) {
        console.error("[AskBotWindow] Failed to load saved size:", error);
      }
      return null;
    },

    /**
     * Save window size to localStorage
     */
    _saveWindowSize: function(width, height) {
      try {
        var size = {
          width: width,
          height: height
        };
        localStorage.setItem(this.__storageKey, JSON.stringify(size));
        console.log("[AskBotWindow] Saved window size:", size);
      } catch (error) {
        console.error("[AskBotWindow] Failed to save window size:", error);
      }
    },

    /**
     * Load saved window size
     */
    _loadWindowSize: function() {
      var savedSize = this._getSavedSize();
      if (savedSize) {
        this.setWidth(savedSize.width);
        this.setHeight(savedSize.height);
        console.log("[AskBotWindow] Applied saved window size");
      }
    },

    /**
     * Get the current URL
     */
    getUrl: function() {
      return this.__url;
    },

    /**
     * Set a new URL and reload iframe
     */
    setUrl: function(url) {
      this.__url = url;
      if (this.__iframeWidget) {
        this.__iframeWidget.setSource(url);
        console.log("[AskBotWindow] URL changed to:", url);
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
    this.__iframeWidget = null;
    this.__iframe = null;
  }
});
