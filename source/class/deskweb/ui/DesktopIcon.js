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

  construct: function(label, icon) {
    this.base(arguments, label, icon);

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

    // Enable drag and drop
    this.addListener("dragstart", this._onDragStart, this);
    this.addListener("drag", this._onDrag, this);
    this.addListener("dragend", this._onDragEnd, this);

    // Store drag offset
    this.__dragOffsetX = 0;
    this.__dragOffsetY = 0;
  },

  events: {
    /** Fired when icon is double-clicked */
    "open": "qx.event.type.Event"
  },

  members: {
    __dragOffsetX: null,
    __dragOffsetY: null,
    __isDragging: false,

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
    }
  }
});
