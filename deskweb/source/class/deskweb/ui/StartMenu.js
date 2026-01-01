/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Windows XP Start Menu
 *
 * Popup menu that appears when Start button is clicked
 */
qx.Class.define("deskweb.ui.StartMenu", {
  extend: qx.ui.popup.Popup,

  construct: function() {
    this.base(arguments, new qx.ui.layout.HBox());

    this.set({
      appearance: "startmenu",
      autoHide: true,
      width: 300,
      maxHeight: 500,
      padding: 0
    });

    // Create sidebar with Windows logo area
    var sidebar = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
    sidebar.set({
      decorator: "startmenu-sidebar",
      width: 40,
      padding: 0
    });

    var sidebarLabel = new qx.ui.basic.Label("Windows XP WebOS");
    sidebarLabel.set({
      textColor: "white",
      font: "bold",
      rich: true
    });

    // Rotate text -90 degrees (vertical, bottom to top)
    sidebarLabel.addListener("appear", function() {
      var el = sidebarLabel.getContentElement().getDomElement();
      if (el) {
        el.style.transform = "rotate(-90deg)";
        el.style.transformOrigin = "left bottom";
        el.style.whiteSpace = "nowrap";
        el.style.position = "absolute";
        el.style.bottom = "16px";
        el.style.left = "35px";
      }
    });

    // Position in the sidebar
    sidebar.add(sidebarLabel, {left: 0, bottom: 0});

    this.add(sidebar);

    // Create menu items container
    this.__menuContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(0));
    this.__menuContainer.set({
      backgroundColor: "startmenu-background",
      padding: 2
    });

    // Add menu items
    this._addMenuItem("My Computer", "computer", "mycomputer");
    this._addMenuItem("My Documents", "folder", "mydocuments");
    this._addSeparator();
    this._addMenuItem("Notepad", "text-editor", "notepad");
    this._addMenuItem("Solitaire", "games-card", "solitaire");
    this._addMenuItem("Minesweeper", "minesweeper", "minesweeper");
    this._addMenuItem("3D Tetris", "tetris", "tetris");
    this._addMenuItem("Janggi", "janggi", "janggi");
    this._addMenuItem("AI ChatBot", "ai-chatbot", "chatbot");
    this._addMenuItem("ASK BOT", "askbot", "askbot");
    this._addMenuItem("Canvas Demo", "canvas-demo", "canvas-demo");
    this._addMenuItem("HWP Viewer", "hwpviewer", "hwpviewer");
    this._addMenuItem("Calc", "calc", "calc");
    this._addSeparator();
    this._addMenuItem("Control Panel", "preferences-system", "controlpanel");
    this._addSeparator();
    this._addMenuItem("Run...", "system-run", "run");

    this.add(this.__menuContainer, {flex: 1});
  },

  events: {
    /** Fired when a menu item is clicked */
    "itemClick": "qx.event.type.Data"
  },

  members: {
    __menuContainer: null,

    /**
     * Add a menu item
     */
    _addMenuItem: function(label, icon, id) {
      var item = new qx.ui.basic.Atom(label, null);
      item.set({
        appearance: "startmenu-item",
        iconPosition: "left",
        gap: 8,
        minHeight: 32,
        alignY: "middle",
        paddingLeft: 10,
        paddingRight: 10,
        cursor: "pointer"
      });

      // Store item ID
      item.setUserData("itemId", id);

      // Add hover effect
      item.addListener("mouseover", function() {
        item.setBackgroundColor("startmenu-item-hover");
        item.setTextColor("white");
      });

      item.addListener("mouseout", function() {
        item.setBackgroundColor(null);
        item.setTextColor("black");
      });

      // Handle click
      item.addListener("click", function() {
        this.fireDataEvent("itemClick", id);
        this.hide();
      }, this);

      this.__menuContainer.add(item);

      return item;
    },

    /**
     * Add a separator
     */
    _addSeparator: function() {
      var separator = new qx.ui.core.Widget();
      separator.set({
        height: 1,
        backgroundColor: "startmenu-separator",
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 10,
        marginRight: 10
      });

      this.__menuContainer.add(separator);
    },

    /**
     * Show menu at specific position
     */
    showAt: function(left, top) {
      // Position menu above the taskbar
      this.setLayoutProperties({
        left: left,
        bottom: top
      });

      this.show();
    }
  }
});
