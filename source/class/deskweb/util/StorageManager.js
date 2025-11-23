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
    writeFile: function(path, content, isBinary) {
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
          type: this._getFileType(path),
          isBinary: isBinary || false
        };
        localStorage.setItem(key + "::meta", JSON.stringify(metadata));

        console.log("[StorageManager] File written:", path, "isBinary:", isBinary);
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
     * Delete directory and all its contents
     */
    deleteDirectory: function(path) {
      // Normalize path
      if (!path.endsWith('/')) {
        path = path + '/';
      }

      var prefix = this._toStorageKey(path);
      var keysToRemove = [];

      // Find all keys under this directory
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all keys
      keysToRemove.forEach(function(key) {
        localStorage.removeItem(key);
      });

      // Remove directory marker
      var dirKey = this._toStorageKey(path.substring(0, path.length - 1));
      localStorage.removeItem(dirKey + "::dir");

      console.log("[StorageManager] Directory deleted:", path, "Removed", keysToRemove.length, "items");
      return true;
    },

    /**
     * Rename file or directory
     */
    renameFile: function(oldPath, newPath) {
      var oldKey = this._toStorageKey(oldPath);
      var newKey = this._toStorageKey(newPath);

      // Check if it's a directory
      if (localStorage.getItem(oldKey + "::dir") !== null) {
        // It's a directory - rename directory and all contents
        return this._renameDirectory(oldPath, newPath);
      }

      // It's a file
      var content = localStorage.getItem(oldKey);
      if (content === null) {
        console.error("[StorageManager] File not found:", oldPath);
        return false;
      }

      // Copy to new location
      localStorage.setItem(newKey, content);

      // Copy metadata
      var metadata = this.getFileMetadata(oldPath);
      if (metadata) {
        metadata.path = newPath;
        metadata.modified = Date.now();
        localStorage.setItem(newKey + "::meta", JSON.stringify(metadata));
      }

      // Remove old file
      localStorage.removeItem(oldKey);
      localStorage.removeItem(oldKey + "::meta");

      console.log("[StorageManager] File renamed:", oldPath, "->", newPath);
      return true;
    },

    /**
     * Rename directory and all its contents
     */
    _renameDirectory: function(oldPath, newPath) {
      // Normalize paths
      if (!oldPath.endsWith('/')) {
        oldPath = oldPath + '/';
      }
      if (!newPath.endsWith('/')) {
        newPath = newPath + '/';
      }

      var oldPrefix = this._toStorageKey(oldPath);
      var newPrefix = this._toStorageKey(newPath);
      var keysToRename = [];

      // Find all keys under this directory
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith(oldPrefix)) {
          keysToRename.push(key);
        }
      }

      // Rename all keys
      keysToRename.forEach(function(oldKey) {
        var newKey = newPrefix + oldKey.substring(oldPrefix.length);
        var value = localStorage.getItem(oldKey);
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      });

      // Rename directory marker
      var oldDirKey = this._toStorageKey(oldPath.substring(0, oldPath.length - 1));
      var newDirKey = this._toStorageKey(newPath.substring(0, newPath.length - 1));
      var dirData = localStorage.getItem(oldDirKey + "::dir");
      if (dirData) {
        var dirMeta = JSON.parse(dirData);
        dirMeta.path = newPath.substring(0, newPath.length - 1);
        localStorage.setItem(newDirKey + "::dir", JSON.stringify(dirMeta));
        localStorage.removeItem(oldDirKey + "::dir");
      }

      console.log("[StorageManager] Directory renamed:", oldPath, "->", newPath, "Moved", keysToRename.length, "items");
      return true;
    },

    /**
     * Check if directory exists
     */
    directoryExists: function(path) {
      var key = this._toStorageKey(path);
      return localStorage.getItem(key + "::dir") !== null;
    },

    /**
     * Move file or directory to trash
     */
    moveToTrash: function(path) {
      var key = this._toStorageKey(path);
      var isDirectory = localStorage.getItem(key + "::dir") !== null;

      // Create trash item metadata
      var trashItem = {
        originalPath: path,
        trashedAt: Date.now(),
        type: isDirectory ? 'directory' : 'file',
        trashId: 'trash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };

      // Store trash metadata
      var trashKey = this.__rootPath + ".trash/" + trashItem.trashId;
      localStorage.setItem(trashKey + "::trash", JSON.stringify(trashItem));

      if (isDirectory) {
        // Move directory and all contents
        this._moveDirectoryToTrash(path, trashItem.trashId);
      } else {
        // Move file
        var content = localStorage.getItem(key);
        var metadata = localStorage.getItem(key + "::meta");

        if (content !== null) {
          localStorage.setItem(trashKey, content);
          if (metadata) {
            localStorage.setItem(trashKey + "::meta", metadata);
          }

          // Remove original
          localStorage.removeItem(key);
          localStorage.removeItem(key + "::meta");
        }
      }

      console.log("[StorageManager] Moved to trash:", path, "ID:", trashItem.trashId);
      return trashItem.trashId;
    },

    /**
     * Move directory to trash
     */
    _moveDirectoryToTrash: function(dirPath, trashId) {
      if (!dirPath.endsWith('/')) {
        dirPath = dirPath + '/';
      }

      var oldPrefix = this._toStorageKey(dirPath);
      var newPrefix = this.__rootPath + ".trash/" + trashId + "/";
      var keysList = [];

      // Collect all keys under this directory
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith(oldPrefix)) {
          keysList.push(key);
        }
      }

      // Move all keys
      keysList.forEach(function(oldKey) {
        var relativePath = oldKey.substring(oldPrefix.length);
        var newKey = newPrefix + relativePath;
        var value = localStorage.getItem(oldKey);
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      });

      // Move directory marker
      var oldDirKey = this._toStorageKey(dirPath.substring(0, dirPath.length - 1));
      var newDirKey = newPrefix.substring(0, newPrefix.length - 1);
      var dirData = localStorage.getItem(oldDirKey + "::dir");
      if (dirData) {
        localStorage.setItem(newDirKey + "::dir", dirData);
        localStorage.removeItem(oldDirKey + "::dir");
      }

      console.log("[StorageManager] Moved directory to trash:", dirPath, "Moved", keysList.length, "items");
    },

    /**
     * List trash items
     */
    listTrash: function() {
      var trashItems = [];
      var trashPrefix = this.__rootPath + ".trash/";

      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);

        if (key.startsWith(trashPrefix) && key.endsWith("::trash")) {
          try {
            var trashData = JSON.parse(localStorage.getItem(key));
            trashItems.push(trashData);
          } catch (e) {
            console.error("[StorageManager] Error parsing trash item:", key, e);
          }
        }
      }

      // Sort by trashed date (newest first)
      trashItems.sort(function(a, b) {
        return b.trashedAt - a.trashedAt;
      });

      return trashItems;
    },

    /**
     * Restore item from trash
     */
    restoreFromTrash: function(trashId) {
      var trashKey = this.__rootPath + ".trash/" + trashId;
      var trashMetaKey = trashKey + "::trash";
      var trashMetaStr = localStorage.getItem(trashMetaKey);

      if (!trashMetaStr) {
        console.error("[StorageManager] Trash item not found:", trashId);
        return false;
      }

      var trashItem = JSON.parse(trashMetaStr);
      var originalPath = trashItem.originalPath;

      if (trashItem.type === 'directory') {
        // Restore directory
        this._restoreDirectoryFromTrash(trashId, originalPath);
      } else {
        // Restore file
        var content = localStorage.getItem(trashKey);
        var metadata = localStorage.getItem(trashKey + "::meta");

        if (content !== null) {
          var originalKey = this._toStorageKey(originalPath);
          localStorage.setItem(originalKey, content);
          if (metadata) {
            localStorage.setItem(originalKey + "::meta", metadata);
          }

          // Remove from trash
          localStorage.removeItem(trashKey);
          localStorage.removeItem(trashKey + "::meta");
        }
      }

      // Remove trash metadata
      localStorage.removeItem(trashMetaKey);

      console.log("[StorageManager] Restored from trash:", originalPath);
      return true;
    },

    /**
     * Restore directory from trash
     */
    _restoreDirectoryFromTrash: function(trashId, originalPath) {
      if (!originalPath.endsWith('/')) {
        originalPath = originalPath + '/';
      }

      var trashPrefix = this.__rootPath + ".trash/" + trashId + "/";
      var originalPrefix = this._toStorageKey(originalPath);
      var keysList = [];

      // Collect all keys under trash directory
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith(trashPrefix)) {
          keysList.push(key);
        }
      }

      // Restore all keys
      keysList.forEach(function(trashKey) {
        var relativePath = trashKey.substring(trashPrefix.length);
        var originalKey = originalPrefix + relativePath;
        var value = localStorage.getItem(trashKey);
        localStorage.setItem(originalKey, value);
        localStorage.removeItem(trashKey);
      });

      // Restore directory marker
      var trashDirKey = this.__rootPath + ".trash/" + trashId;
      var originalDirKey = this._toStorageKey(originalPath.substring(0, originalPath.length - 1));
      var dirData = localStorage.getItem(trashDirKey + "::dir");
      if (dirData) {
        localStorage.setItem(originalDirKey + "::dir", dirData);
        localStorage.removeItem(trashDirKey + "::dir");
      }

      console.log("[StorageManager] Restored directory from trash:", originalPath, "Restored", keysList.length, "items");
    },

    /**
     * Permanently delete item from trash
     */
    deleteFromTrash: function(trashId) {
      var trashKey = this.__rootPath + ".trash/" + trashId;
      var trashMetaKey = trashKey + "::trash";
      var trashMetaStr = localStorage.getItem(trashMetaKey);

      if (!trashMetaStr) {
        console.error("[StorageManager] Trash item not found:", trashId);
        return false;
      }

      var trashItem = JSON.parse(trashMetaStr);
      var keysToRemove = [];

      // Find all keys for this trash item
      var trashPrefix = trashKey + "/";
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key === trashKey || key.startsWith(trashPrefix) || key === trashMetaKey || key === trashKey + "::meta" || key === trashKey + "::dir") {
          keysToRemove.push(key);
        }
      }

      // Remove all keys
      keysToRemove.forEach(function(key) {
        localStorage.removeItem(key);
      });

      console.log("[StorageManager] Permanently deleted from trash:", trashId, "Removed", keysToRemove.length, "items");
      return true;
    },

    /**
     * Empty trash - permanently delete all items
     */
    emptyTrash: function() {
      var trashItems = this.listTrash();
      var count = 0;

      trashItems.forEach(function(item) {
        if (this.deleteFromTrash(item.trashId)) {
          count++;
        }
      }, this);

      console.log("[StorageManager] Emptied trash:", count, "items deleted");
      return count;
    },

    /**
     * Get trash item count
     */
    getTrashCount: function() {
      return this.listTrash().length;
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
