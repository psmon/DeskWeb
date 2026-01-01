/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * IconPositionManager - Manages desktop icon positions
 *
 * Stores and retrieves icon positions per user session
 * Positions are saved in localStorage with session ID
 */
qx.Class.define("deskweb.util.IconPositionManager", {
  type: "singleton",
  extend: qx.core.Object,

  construct: function() {
    this.base(arguments);

    // Get session ID from StorageManager
    this.__storage = deskweb.util.StorageManager.getInstance();
    this.__sessionId = this.__storage.getSessionId();
    this.__storageKey = "deskweb_icon_positions_" + this.__sessionId;

    // Load positions from localStorage
    this.__positions = this._loadPositions();

    console.log("[IconPositionManager] Initialized for session:", this.__sessionId);
    console.log("[IconPositionManager] Loaded positions:", this.__positions);
  },

  members: {
    __storage: null,
    __sessionId: null,
    __storageKey: null,
    __positions: null,

    /**
     * Load icon positions from localStorage
     */
    _loadPositions: function() {
      var stored = localStorage.getItem(this.__storageKey);

      if (stored) {
        try {
          var positions = JSON.parse(stored);
          console.log("[IconPositionManager] Positions loaded from storage");
          return positions;
        } catch (e) {
          console.error("[IconPositionManager] Error parsing stored positions:", e);
          return {};
        }
      }

      console.log("[IconPositionManager] No stored positions found, using defaults");
      return {};
    },

    /**
     * Save icon positions to localStorage
     */
    _savePositions: function() {
      try {
        localStorage.setItem(this.__storageKey, JSON.stringify(this.__positions));
        console.log("[IconPositionManager] Positions saved to storage");
        return true;
      } catch (e) {
        console.error("[IconPositionManager] Error saving positions:", e);
        return false;
      }
    },

    /**
     * Save position for an icon
     *
     * @param iconId {String} Unique identifier for the icon
     * @param left {Number} Left position in pixels
     * @param top {Number} Top position in pixels
     */
    saveIconPosition: function(iconId, left, top) {
      if (!iconId) {
        console.warn("[IconPositionManager] Cannot save position: iconId is required");
        return false;
      }

      this.__positions[iconId] = {
        left: left,
        top: top,
        timestamp: Date.now()
      };

      console.log("[IconPositionManager] Saved position for", iconId + ":", left, top);
      return this._savePositions();
    },

    /**
     * Get saved position for an icon
     *
     * @param iconId {String} Unique identifier for the icon
     * @return {Object|null} Position object {left, top} or null if not found
     */
    getIconPosition: function(iconId) {
      if (!iconId) {
        return null;
      }

      var position = this.__positions[iconId];

      if (position) {
        console.log("[IconPositionManager] Retrieved position for", iconId + ":", position.left, position.top);
        return {
          left: position.left,
          top: position.top
        };
      }

      console.log("[IconPositionManager] No saved position for", iconId);
      return null;
    },

    /**
     * Check if icon has saved position
     *
     * @param iconId {String} Unique identifier for the icon
     * @return {Boolean} True if position exists
     */
    hasIconPosition: function(iconId) {
      return iconId && (this.__positions[iconId] !== undefined);
    },

    /**
     * Remove saved position for an icon
     *
     * @param iconId {String} Unique identifier for the icon
     */
    removeIconPosition: function(iconId) {
      if (!iconId) {
        return false;
      }

      if (this.__positions[iconId]) {
        delete this.__positions[iconId];
        console.log("[IconPositionManager] Removed position for", iconId);
        return this._savePositions();
      }

      return false;
    },

    /**
     * Clear all saved positions
     */
    clearAllPositions: function() {
      this.__positions = {};
      localStorage.removeItem(this.__storageKey);
      console.log("[IconPositionManager] Cleared all positions");
      return true;
    },

    /**
     * Get all saved positions
     *
     * @return {Object} All positions
     */
    getAllPositions: function() {
      return qx.lang.Object.clone(this.__positions);
    },

    /**
     * Export positions for debugging
     *
     * @return {String} JSON string of positions
     */
    exportPositions: function() {
      return JSON.stringify(this.__positions, null, 2);
    }
  }
});
