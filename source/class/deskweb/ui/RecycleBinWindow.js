/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Recycle Bin Window
 *
 * Displays items in the recycle bin with restore and delete options
 */
qx.Class.define("deskweb.ui.RecycleBinWindow", {
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "Recycle Bin");

    this.__storage = deskweb.util.StorageManager.getInstance();

    this.set({
      width: 700,
      height: 500,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox(0));

    // Create UI
    this._createToolbar();
    this._createTrashList();

    // Load trash items
    this._loadTrash();

    console.log("[RecycleBinWindow] Created");
  },

  members: {
    __storage: null,
    __trashList: null,
    __emptyBtn: null,
    __restoreBtn: null,
    __deleteBtn: null,
    __selectedItem: null,

    /**
     * Create toolbar
     */
    _createToolbar: function() {
      var toolbar = new qx.ui.toolbar.ToolBar();

      // Restore button
      this.__restoreBtn = new qx.ui.toolbar.Button("Restore", "icon/16/actions/edit-undo.png");
      this.__restoreBtn.setToolTipText("Restore selected item to original location");
      this.__restoreBtn.setEnabled(false);
      this.__restoreBtn.addListener("execute", this._onRestore, this);
      toolbar.add(this.__restoreBtn);

      // Delete permanently button
      this.__deleteBtn = new qx.ui.toolbar.Button("Delete Permanently", "icon/16/actions/edit-delete.png");
      this.__deleteBtn.setToolTipText("Permanently delete selected item");
      this.__deleteBtn.setEnabled(false);
      this.__deleteBtn.addListener("execute", this._onDeletePermanently, this);
      toolbar.add(this.__deleteBtn);

      toolbar.add(new qx.ui.toolbar.Separator());

      // Empty Recycle Bin button
      this.__emptyBtn = new qx.ui.toolbar.Button("Empty Recycle Bin", "icon/16/places/user-trash.png");
      this.__emptyBtn.setToolTipText("Permanently delete all items in Recycle Bin");
      this.__emptyBtn.addListener("execute", this._onEmptyTrash, this);
      toolbar.add(this.__emptyBtn);

      toolbar.add(new qx.ui.toolbar.Separator());

      // Refresh button
      var refreshBtn = new qx.ui.toolbar.Button("Refresh", "icon/16/actions/view-refresh.png");
      refreshBtn.setToolTipText("Refresh");
      refreshBtn.addListener("execute", this._onRefresh, this);
      toolbar.add(refreshBtn);

      this.add(toolbar);
    },

    /**
     * Create trash list
     */
    _createTrashList: function() {
      // Create scroll container
      var scrollContainer = new qx.ui.container.Scroll();

      // Create list
      this.__trashList = new qx.ui.form.List();
      this.__trashList.set({
        selectionMode: "single",
        height: null
      });

      // Handle selection change
      this.__trashList.addListener("changeSelection", this._onSelectionChange, this);

      // Handle double-click (restore)
      this.__trashList.addListener("dblclick", this._onRestore, this);

      scrollContainer.add(this.__trashList);
      this.add(scrollContainer, {flex: 1});

      // Status bar
      this.__statusBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      this.__statusBar.setPadding(5);
      this.__statusLabel = new qx.ui.basic.Label("");
      this.__statusBar.add(this.__statusLabel);
      this.add(this.__statusBar);
    },

    /**
     * Load trash items
     */
    _loadTrash: function() {
      // Clear current list
      this.__trashList.removeAll();

      // Get trash items
      var trashItems = this.__storage.listTrash();

      // Update status
      var itemCount = trashItems.length;
      if (itemCount === 0) {
        this.__statusLabel.setValue("Recycle Bin is empty");
        this.__emptyBtn.setEnabled(false);
      } else {
        this.__statusLabel.setValue(itemCount + (itemCount === 1 ? " item" : " items") + " in Recycle Bin");
        this.__emptyBtn.setEnabled(true);
      }

      // Add items to list
      trashItems.forEach(function(trashItem) {
        var icon = this._getIconForTrashItem(trashItem);
        var displayName = this._getDisplayName(trashItem);
        var listItem = new qx.ui.form.ListItem(displayName, icon);

        listItem.setUserData("trashId", trashItem.trashId);
        listItem.setUserData("trashItem", trashItem);

        this.__trashList.add(listItem);
      }, this);

      console.log("[RecycleBinWindow] Loaded trash:", trashItems.length, "items");
    },

    /**
     * Get display name for trash item
     */
    _getDisplayName: function(trashItem) {
      var originalPath = trashItem.originalPath;
      var name = originalPath.substring(originalPath.lastIndexOf('/') + 1);
      var trashedDate = new Date(trashItem.trashedAt);
      var dateStr = trashedDate.toLocaleString();

      return name + " (deleted " + dateStr + ")";
    },

    /**
     * Get icon for trash item
     */
    _getIconForTrashItem: function(trashItem) {
      if (trashItem.type === 'directory') {
        return "icon/16/places/folder.png";
      }
      return "icon/16/mimetypes/office-document.png";
    },

    /**
     * Handle selection change
     */
    _onSelectionChange: function(e) {
      var selection = this.__trashList.getSelection();
      var hasSelection = selection.length > 0;

      this.__restoreBtn.setEnabled(hasSelection);
      this.__deleteBtn.setEnabled(hasSelection);

      if (hasSelection) {
        this.__selectedItem = selection[0];
      } else {
        this.__selectedItem = null;
      }
    },

    /**
     * Handle restore
     */
    _onRestore: function() {
      if (!this.__selectedItem) {
        return;
      }

      var trashId = this.__selectedItem.getUserData("trashId");
      var trashItem = this.__selectedItem.getUserData("trashItem");

      console.log("[RecycleBinWindow] Restoring:", trashId);

      // Confirm restore
      var dialog = new qx.ui.window.Window("Restore Item");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      var message = "Restore '" + trashItem.originalPath + "' to its original location?";
      dialog.add(new qx.ui.basic.Label(message));

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var yesBtn = new qx.ui.form.Button("Yes");
      yesBtn.addListener("execute", function() {
        if (this.__storage.restoreFromTrash(trashId)) {
          this._loadTrash();
          console.log("[RecycleBinWindow] Restored:", trashId);
        } else {
          console.error("[RecycleBinWindow] Failed to restore:", trashId);
        }
        dialog.close();
      }, this);

      var noBtn = new qx.ui.form.Button("No");
      noBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(yesBtn);
      btnContainer.add(noBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();
    },

    /**
     * Handle delete permanently
     */
    _onDeletePermanently: function() {
      if (!this.__selectedItem) {
        return;
      }

      var trashId = this.__selectedItem.getUserData("trashId");
      var trashItem = this.__selectedItem.getUserData("trashItem");

      console.log("[RecycleBinWindow] Permanently deleting:", trashId);

      // Confirm permanent deletion
      var dialog = new qx.ui.window.Window("Delete Permanently");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      var message = "Are you sure you want to permanently delete '" + trashItem.originalPath + "'?\n\nThis cannot be undone!";
      dialog.add(new qx.ui.basic.Label(message));

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var yesBtn = new qx.ui.form.Button("Yes");
      yesBtn.addListener("execute", function() {
        if (this.__storage.deleteFromTrash(trashId)) {
          this._loadTrash();
          console.log("[RecycleBinWindow] Permanently deleted:", trashId);
        } else {
          console.error("[RecycleBinWindow] Failed to delete:", trashId);
        }
        dialog.close();
      }, this);

      var noBtn = new qx.ui.form.Button("No");
      noBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(yesBtn);
      btnContainer.add(noBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();
    },

    /**
     * Handle empty trash
     */
    _onEmptyTrash: function() {
      var trashCount = this.__storage.getTrashCount();

      if (trashCount === 0) {
        return;
      }

      console.log("[RecycleBinWindow] Emptying trash");

      // Confirm empty trash
      var dialog = new qx.ui.window.Window("Empty Recycle Bin");
      dialog.setLayout(new qx.ui.layout.VBox(10));
      dialog.set({
        width: 400,
        modal: true,
        showMinimize: false,
        showMaximize: false
      });

      var message = "Are you sure you want to permanently delete all " + trashCount + " items?\n\nThis cannot be undone!";
      dialog.add(new qx.ui.basic.Label(message));

      var btnContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5, "right"));

      var yesBtn = new qx.ui.form.Button("Yes");
      yesBtn.addListener("execute", function() {
        var count = this.__storage.emptyTrash();
        this._loadTrash();
        console.log("[RecycleBinWindow] Emptied trash:", count, "items deleted");
        dialog.close();
      }, this);

      var noBtn = new qx.ui.form.Button("No");
      noBtn.addListener("execute", function() {
        dialog.close();
      });

      btnContainer.add(yesBtn);
      btnContainer.add(noBtn);
      dialog.add(btnContainer);

      dialog.center();
      dialog.open();
    },

    /**
     * Handle refresh
     */
    _onRefresh: function() {
      this._loadTrash();
    }
  },

  destruct: function() {
    this.__storage = null;
    this.__trashList = null;
    this.__emptyBtn = null;
    this.__restoreBtn = null;
    this.__deleteBtn = null;
    this.__selectedItem = null;
    this.__statusBar = null;
    this.__statusLabel = null;
  }
});
