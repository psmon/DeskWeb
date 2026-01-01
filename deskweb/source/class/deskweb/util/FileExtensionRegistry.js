/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * FileExtensionRegistry - Maps file extensions to applications
 *
 * This singleton manages the mapping between file extensions and
 * the applications that should handle them.
 */
qx.Class.define("deskweb.util.FileExtensionRegistry", {
  type: "singleton",
  extend: qx.core.Object,

  construct: function() {
    this.base(arguments);
    this.__extensionMap = {};
    this.__defaultHandlers = {};

    // Register default handlers
    this._registerDefaultHandlers();

    console.log("[FileExtensionRegistry] Initialized");
  },

  members: {
    __extensionMap: null,
    __defaultHandlers: null,

    /**
     * Register default file type handlers
     */
    _registerDefaultHandlers: function() {
      // Text files -> Notepad
      this.registerExtension("txt", "notepad", "Notepad");
      this.registerExtension("log", "notepad", "Notepad");
      this.registerExtension("md", "notepad", "Notepad");

      // Configuration files -> Notepad
      this.registerExtension("json", "notepad", "Notepad");
      this.registerExtension("xml", "notepad", "Notepad");
      this.registerExtension("ini", "notepad", "Notepad");
      this.registerExtension("cfg", "notepad", "Notepad");

      // Code files -> Notepad (for now)
      this.registerExtension("js", "notepad", "Notepad");
      this.registerExtension("html", "notepad", "Notepad");
      this.registerExtension("css", "notepad", "Notepad");

      // HWP files -> HWP Viewer
      this.registerExtension("hwp", "hwpviewer", "HWP Viewer");

      // Spreadsheet files -> Calc
      this.registerExtension("ods", "calc", "Calc");
      this.registerExtension("xlsx", "calc", "Calc");
      this.registerExtension("xls", "calc", "Calc");
      this.registerExtension("csv", "calc", "Calc");

      // Future extensions can be added here
      // this.registerExtension("jpg", "imageviewer", "Image Viewer");
      // this.registerExtension("png", "imageviewer", "Image Viewer");
      // this.registerExtension("mp3", "mediaplayer", "Media Player");

      console.log("[FileExtensionRegistry] Registered default handlers");
    },

    /**
     * Register a file extension handler
     *
     * @param extension {String} File extension (without dot)
     * @param appId {String} Application identifier
     * @param appName {String} Human-readable application name
     */
    registerExtension: function(extension, appId, appName) {
      extension = extension.toLowerCase();

      if (!this.__extensionMap[extension]) {
        this.__extensionMap[extension] = [];
      }

      // Check if already registered
      var existing = this.__extensionMap[extension].find(function(handler) {
        return handler.appId === appId;
      });

      if (!existing) {
        this.__extensionMap[extension].push({
          appId: appId,
          appName: appName,
          isDefault: this.__extensionMap[extension].length === 0
        });

        console.log("[FileExtensionRegistry] Registered:", extension, "->", appName);
      }
    },

    /**
     * Get handler for a file extension
     *
     * @param extension {String} File extension (without dot)
     * @return {Object|null} Handler object or null
     */
    getHandler: function(extension) {
      extension = extension.toLowerCase();

      var handlers = this.__extensionMap[extension];
      if (!handlers || handlers.length === 0) {
        console.warn("[FileExtensionRegistry] No handler for extension:", extension);
        return null;
      }

      // Return default handler
      var defaultHandler = handlers.find(function(h) {
        return h.isDefault;
      });

      return defaultHandler || handlers[0];
    },

    /**
     * Get all handlers for a file extension
     *
     * @param extension {String} File extension (without dot)
     * @return {Array} Array of handler objects
     */
    getAllHandlers: function(extension) {
      extension = extension.toLowerCase();
      return this.__extensionMap[extension] || [];
    },

    /**
     * Get handler for a file path
     *
     * @param filePath {String} Full file path
     * @return {Object|null} Handler object or null
     */
    getHandlerForFile: function(filePath) {
      var extension = this._getExtension(filePath);
      if (!extension) {
        return null;
      }

      return this.getHandler(extension);
    },

    /**
     * Set default handler for extension
     *
     * @param extension {String} File extension
     * @param appId {String} Application ID to set as default
     */
    setDefaultHandler: function(extension, appId) {
      extension = extension.toLowerCase();

      var handlers = this.__extensionMap[extension];
      if (!handlers) {
        console.warn("[FileExtensionRegistry] No handlers registered for:", extension);
        return false;
      }

      // Reset all defaults
      handlers.forEach(function(handler) {
        handler.isDefault = (handler.appId === appId);
      });

      console.log("[FileExtensionRegistry] Set default handler for", extension, "to", appId);
      return true;
    },

    /**
     * Check if extension has a handler
     *
     * @param extension {String} File extension
     * @return {Boolean} True if handler exists
     */
    hasHandler: function(extension) {
      extension = extension.toLowerCase();
      var handlers = this.__extensionMap[extension];
      return handlers && handlers.length > 0;
    },

    /**
     * Get file extension from path
     *
     * @param path {String} File path
     * @return {String} Extension without dot, or empty string
     */
    _getExtension: function(path) {
      var lastDot = path.lastIndexOf('.');
      if (lastDot === -1 || lastDot === path.length - 1) {
        return '';
      }

      return path.substring(lastDot + 1).toLowerCase();
    },

    /**
     * Get icon for file type
     *
     * @param extension {String} File extension
     * @return {String} Icon path
     */
    getIconForExtension: function(extension) {
      extension = extension.toLowerCase();

      // Icon mapping
      var iconMap = {
        'txt': 'icon/16/mimetypes/text-plain.png',
        'md': 'icon/16/mimetypes/text-plain.png',
        'log': 'icon/16/mimetypes/text-plain.png',
        'json': 'icon/16/mimetypes/text-plain.png',
        'xml': 'icon/16/mimetypes/text-xml.png',
        'html': 'icon/16/mimetypes/text-html.png',
        'css': 'icon/16/mimetypes/text-css.png',
        'js': 'icon/16/mimetypes/text-javascript.png',
        'hwp': 'deskweb/images/hwp.svg',
        'ods': 'deskweb/images/calc.svg',
        'xlsx': 'deskweb/images/calc.svg',
        'xls': 'deskweb/images/calc.svg',
        'csv': 'deskweb/images/calc.svg'
      };

      return iconMap[extension] || 'icon/16/mimetypes/office-document.png';
    },

    /**
     * Get all registered extensions
     *
     * @return {Array} Array of extension strings
     */
    getAllExtensions: function() {
      return Object.keys(this.__extensionMap);
    }
  }
});
