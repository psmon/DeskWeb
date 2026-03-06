/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Desktop Icon Component
 *
 * A draggable icon that can be placed on the desktop
 */
qx.Class.define("deskweb.ui.DesktopIcon", {
  extend: qx.ui.basic.Atom,

  construct: function(label, icon, iconId) {
    this.base(arguments, label, icon);

    // Store unique icon ID
    this.__iconId = iconId || label;

    // Get position manager
    this.__positionManager = deskweb.util.IconPositionManager.getInstance();

    // Configure appearance
    this.set({
      appearance: "desktop-icon",
      draggable: true,
      droppable: false,
      width: 80,
      height: 80,
      focusable: true,
      selectable: false,
      iconPosition: "top",
      center: true,
      gap: 5
    });

    // Add double-click listener
    this.addListener("dblclick", this._onDoubleClick, this);

    // Add click listener for selection
    this.addListener("click", this._onClick, this);

    // Enable drag and drop
    this.addListener("dragstart", this._onDragStart, this);
    this.addListener("drag", this._onDrag, this);
    this.addListener("dragend", this._onDragEnd, this);

    // Store drag offset
    this.__dragOffsetX = 0;
    this.__dragOffsetY = 0;

    // Track if using external favicon
    this.__usesFavicon = false;
  },

  events: {
    /** Fired when icon is double-clicked */
    "open": "qx.event.type.Event",
    /** Fired when icon is clicked (selected) */
    "iconSelect": "qx.event.type.Event"
  },

  members: {
    __iconId: null,
    __positionManager: null,
    __dragOffsetX: null,
    __dragOffsetY: null,
    __isDragging: false,
    __usesFavicon: false,
    __originalIcon: null,

    /**
     * Handle click event for selection
     */
    _onClick: function(e) {
      e.stopPropagation();
      this.fireEvent("iconSelect");
    },

    /**
     * Select this icon (show selection overlay)
     */
    select: function() {
      this.addState("selected");
    },

    /**
     * Deselect this icon (hide selection overlay)
     */
    deselect: function() {
      this.removeState("selected");
    },

    /**
     * Check if icon is selected
     */
    isIconSelected: function() {
      return this.hasState("selected");
    },

    /**
     * Set favicon from URL using multi-strategy fallback
     *
     * Strategy order:
     * 1. Google Favicon Service (most reliable, handles all edge cases)
     * 2. DuckDuckGo Favicon Service (backup)
     * 3. Direct /favicon.ico (classic approach)
     */
    setFaviconFromUrl: function(url) {
      try {
        var urlObj = new URL(url);
        var domain = urlObj.hostname;
        var self = this;

        var candidates = [
          "https://www.google.com/s2/favicons?domain=" + domain + "&sz=64",
          "https://icons.duckduckgo.com/ip3/" + domain + ".ico",
          urlObj.origin + "/favicon.ico"
        ];

        this._tryFaviconCandidates(candidates, 0, domain);
      } catch (err) {
        console.warn("[DesktopIcon] Invalid URL for favicon:", url);
      }
    },

    /**
     * Try favicon candidates in order until one succeeds
     */
    _tryFaviconCandidates: function(candidates, index, domain) {
      if (index >= candidates.length) {
        console.log("[DesktopIcon] All favicon strategies failed for:", domain);
        return;
      }

      var faviconUrl = candidates[index];
      var testImg = new Image();
      var self = this;

      testImg.onload = function() {
        // Google service returns a default 16x16 globe icon when not found
        // Check if the image is too small (likely a fallback placeholder)
        if (index === 0 && testImg.naturalWidth <= 16 && testImg.naturalHeight <= 16) {
          // Still usable but try next for better quality
          // Accept it anyway - Google's fallback is still a valid icon
        }
        self.__usesFavicon = true;
        self.__faviconUrl = faviconUrl;
        self._applyFaviconIcon(faviconUrl);
        console.log("[DesktopIcon] Favicon loaded for", domain, "via strategy", index);
      };

      testImg.onerror = function() {
        console.log("[DesktopIcon] Favicon strategy", index, "failed for:", domain);
        self._tryFaviconCandidates(candidates, index + 1, domain);
      };

      testImg.src = faviconUrl;
    },

    /**
     * Apply favicon as icon using qooxdoo API only.
     * Sets the external favicon URL directly as the icon source
     * so qooxdoo handles layout (icon top, label bottom) natively.
     */
    _applyFaviconIcon: function(faviconUrl) {
      // Save original icon path for restoration
      if (!this.__originalIcon) {
        this.__originalIcon = this.getIcon();
      }

      // Simply set the favicon URL as the icon source
      // qooxdoo Image widget supports external URLs natively
      this.setIcon(faviconUrl);

      // After render, ensure the icon image is sized properly
      this.addListenerOnce("appear", function() {
        this._resizeFaviconIcon();
      }, this);

      // Also try immediately if already rendered
      this._resizeFaviconIcon();
    },

    /**
     * Resize the favicon icon image to match other icons
     */
    _resizeFaviconIcon: function() {
      var iconWidget = this.getChildControl("icon", true);
      if (iconWidget) {
        iconWidget.set({
          width: 48,
          height: 48,
          scale: true,
          allowGrowX: false,
          allowGrowY: false
        });
      }
    },

    /**
     * Handle double-click event
     */
    _onDoubleClick: function(e) {
      this.fireEvent("open");
    },

    /**
     * Handle drag start
     */
    _onDragStart: function(e) {
      // Get current position
      var layoutProps = this.getLayoutProperties();
      var mouseX = e.getDocumentLeft();
      var mouseY = e.getDocumentTop();

      // Calculate offset from icon position to mouse
      this.__dragOffsetX = mouseX - (layoutProps.left || 0);
      this.__dragOffsetY = mouseY - (layoutProps.top || 0);

      this.__isDragging = true;

      // Add cursor style
      this.setCursor("move");
    },

    /**
     * Handle drag
     */
    _onDrag: function(e) {
      if (!this.__isDragging) {
        return;
      }

      var mouseX = e.getDocumentLeft();
      var mouseY = e.getDocumentTop();

      // Calculate new position
      var newLeft = mouseX - this.__dragOffsetX;
      var newTop = mouseY - this.__dragOffsetY;

      // Keep icon within bounds (prevent dragging off screen)
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;

      // Update position
      this.setLayoutProperties({
        left: newLeft,
        top: newTop
      });
    },

    /**
     * Handle drag end
     */
    _onDragEnd: function(e) {
      this.__isDragging = false;
      this.setCursor("pointer");

      // Save new position
      var layoutProps = this.getLayoutProperties();
      var left = layoutProps.left || 0;
      var top = layoutProps.top || 0;

      if (this.__positionManager && this.__iconId) {
        this.__positionManager.saveIconPosition(this.__iconId, left, top);
        console.log("[DesktopIcon] Position saved for", this.__iconId + ":", left, top);
      }
    },

    /**
     * Get icon ID
     */
    getIconId: function() {
      return this.__iconId;
    },

    /**
     * Set icon ID
     */
    setIconId: function(iconId) {
      this.__iconId = iconId;
    },

    /**
     * Change icon to a preset resource icon
     */
    changeToPresetIcon: function(iconPath) {
      this.__usesFavicon = false;
      this.setIcon(iconPath);
    },

    /**
     * Check if this icon uses a favicon
     */
    usesFavicon: function() {
      return this.__usesFavicon;
    }
  }
});
