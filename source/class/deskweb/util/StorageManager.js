/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * StorageManager - Virtual File System using localStorage
 *
 * Manages a virtual file system with session-based isolation.
 * Files are stored with path as key in localStorage.
 *
 * Storage structure:
 * - Session ID is generated on first access
 * - Root path: c:/webroot/{sessionId}/
 * - Files: c:/webroot/{sessionId}/path/to/file.txt
 * - Metadata stored separately for each file
 */
qx.Class.define("deskweb.util.StorageManager", {
  type: "singleton",
  extend: qx.core.Object,

  construct: function() {
    this.base(arguments);
    this.__sessionId = this._getOrCreateSessionId();
    this.__rootPath = "c:/webroot/" + this.__sessionId + "/";

    // Initialize root directory if not exists
    this._ensureDirectoryStructure();

    console.log("[StorageManager] Initialized with session:", this.__sessionId);
    console.log("[StorageManager] Root path:", this.__rootPath);
  },

  members: {
    __sessionId: null,
    __rootPath: null,

    /**
     * Get or create session ID
     */
    _getOrCreateSessionId: function() {
      var sessionId = localStorage.getItem("deskweb_session_id");

      if (!sessionId) {
        // Generate new session ID
        sessionId = this._generateSessionId();
        localStorage.setItem("deskweb_session_id", sessionId);
        console.log("[StorageManager] Created new session ID:", sessionId);
      } else {
        console.log("[StorageManager] Using existing session ID:", sessionId);
      }

      return sessionId;
    },

    /**
     * Generate random session ID
     */
    _generateSessionId: function() {
      return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Ensure basic directory structure exists
     */
    _ensureDirectoryStructure: function() {
      var dirs = this._listDirectories("/");

      // Create default directories if this is a new session
      if (dirs.length === 0) {
        console.log("[StorageManager] Creating default directory structure");
        this.createDirectory("/Documents");
        this.createDirectory("/Pictures");
        this.createDirectory("/Music");

        // Create a sample readme file
        this.writeFile("/readme.txt", "Welcome to DeskWeb!\n\nThis is your personal virtual file system.\nAll files are stored in your browser's localStorage.\n\nSession ID: " + this.__sessionId);
      }
    },

    /**
     * Get session ID
     */
    getSessionId: function() {
      return this.__sessionId;
    },

    /**
     * Get root path
     */
    getRootPath: function() {
      return this.__rootPath;
    },

    /**
     * Convert virtual path to storage key
     */
    _toStorageKey: function(path) {
      // Normalize path
      path = path.replace(/\\/g, '/');
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      return this.__rootPath + path.substring(1);
    },

    /**
     * Convert storage key to virtual path
     */
    _fromStorageKey: function(key) {
      if (!key.startsWith(this.__rootPath)) {
        return null;
      }
      return '/' + key.substring(this.__rootPath.length);
    },

    /**
     * Write file to storage
     */
    writeFile: function(path, content) {
      var key = this._toStorageKey(path);

      try {
        // Store file content
        localStorage.setItem(key, content);

        // Store metadata
        var metadata = {
          path: path,
          size: content.length,
          created: Date.now(),
          modified: Date.now(),
          type: this._getFileType(path)
        };
        localStorage.setItem(key + "::meta", JSON.stringify(metadata));

        console.log("[StorageManager] File written:", path);
        return true;
      } catch (e) {
        console.error("[StorageManager] Error writing file:", path, e);
        return false;
      }
    },

    /**
     * Read file from storage
     */
    readFile: function(path) {
      var key = this._toStorageKey(path);
      var content = localStorage.getItem(key);

      if (content === null) {
        console.warn("[StorageManager] File not found:", path);
        return null;
      }

      return content;
    },

    /**
     * Delete file
     */
    deleteFile: function(path) {
      var key = this._toStorageKey(path);

      localStorage.removeItem(key);
      localStorage.removeItem(key + "::meta");

      console.log("[StorageManager] File deleted:", path);
      return true;
    },

    /**
     * Check if file exists
     */
    fileExists: function(path) {
      var key = this._toStorageKey(path);
      return localStorage.getItem(key) !== null;
    },

    /**
     * Get file metadata
     */
    getFileMetadata: function(path) {
      var key = this._toStorageKey(path);
      var metaStr = localStorage.getItem(key + "::meta");

      if (!metaStr) {
        return null;
      }

      try {
        return JSON.parse(metaStr);
      } catch (e) {
        console.error("[StorageManager] Error parsing metadata:", path, e);
        return null;
      }
    },

    /**
     * Create directory
     */
    createDirectory: function(path) {
      var key = this._toStorageKey(path);

      // Store directory marker
      localStorage.setItem(key + "::dir", JSON.stringify({
        path: path,
        created: Date.now()
      }));

      console.log("[StorageManager] Directory created:", path);
      return true;
    },

    /**
     * List files and directories in a path
     */
    listDirectory: function(path) {
      // Normalize path
      if (!path.endsWith('/')) {
        path = path + '/';
      }

      var prefix = this._toStorageKey(path);
      var items = [];
      var seen = new Set();

      // Iterate through localStorage
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);

        if (!key.startsWith(prefix)) {
          continue;
        }

        // Skip metadata keys
        if (key.includes("::meta") || key.includes("::dir")) {
          continue;
        }

        var relativePath = key.substring(prefix.length);

        // Check if it's in current directory (not subdirectory)
        var slashIndex = relativePath.indexOf('/');

        if (slashIndex === -1) {
          // It's a file in this directory
          if (!seen.has(relativePath)) {
            seen.add(relativePath);
            items.push({
              name: relativePath,
              path: path + relativePath,
              type: 'file',
              metadata: this.getFileMetadata(path + relativePath)
            });
          }
        } else {
          // It's a subdirectory
          var dirName = relativePath.substring(0, slashIndex);
          if (!seen.has(dirName)) {
            seen.add(dirName);
            items.push({
              name: dirName,
              path: path + dirName,
              type: 'directory'
            });
          }
        }
      }

      // Also check for directories marked with ::dir
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);

        if (!key.startsWith(prefix) || !key.endsWith("::dir")) {
          continue;
        }

        var dirPath = key.substring(0, key.length - 5); // Remove ::dir
        var relativePath = dirPath.substring(prefix.length);

        var slashIndex = relativePath.indexOf('/');
        if (slashIndex === -1 && relativePath.length > 0) {
          if (!seen.has(relativePath)) {
            seen.add(relativePath);
            items.push({
              name: relativePath,
              path: path + relativePath,
              type: 'directory'
            });
          }
        }
      }

      return items;
    },

    /**
     * List only directories
     */
    _listDirectories: function(path) {
      var items = this.listDirectory(path);
      return items.filter(function(item) {
        return item.type === 'directory';
      });
    },

    /**
     * List only files
     */
    _listFiles: function(path) {
      var items = this.listDirectory(path);
      return items.filter(function(item) {
        return item.type === 'file';
      });
    },

    /**
     * Get file type from extension
     */
    _getFileType: function(path) {
      var ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();

      var typeMap = {
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'xml': 'application/xml'
      };

      return typeMap[ext] || 'application/octet-stream';
    },

    /**
     * Get file extension
     */
    getFileExtension: function(path) {
      var lastDot = path.lastIndexOf('.');
      if (lastDot === -1) {
        return '';
      }
      return path.substring(lastDot + 1).toLowerCase();
    },

    /**
     * Clear all files for current session
     */
    clearSession: function() {
      var keysToRemove = [];

      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith(this.__rootPath)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(function(key) {
        localStorage.removeItem(key);
      });

      console.log("[StorageManager] Session cleared, removed", keysToRemove.length, "items");

      // Recreate basic structure
      this._ensureDirectoryStructure();
    }
  }
});
