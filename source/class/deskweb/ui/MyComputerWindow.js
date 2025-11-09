/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * My Computer Window
 *
 * Displays system drives and folders
 */
qx.Class.define("deskweb.ui.MyComputerWindow", {
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "My Computer");

    this.set({
      width: 600,
      height: 400,
      showMinimize: true,
      showMaximize: true,
      showClose: true,
      contentPadding: 0
    });

    this.setLayout(new qx.ui.layout.VBox());

    // Toolbar
    var toolbar = new qx.ui.toolbar.ToolBar();
    toolbar.set({
      backgroundColor: "#ECE9D8"
    });

    var backButton = new qx.ui.toolbar.Button("Back", null);
    var forwardButton = new qx.ui.toolbar.Button("Forward", null);
    var upButton = new qx.ui.toolbar.Button("Up", null);

    toolbar.add(backButton);
    toolbar.add(forwardButton);
    toolbar.add(new qx.ui.toolbar.Separator());
    toolbar.add(upButton);
    toolbar.add(new qx.ui.core.Spacer(), {flex: 1});

    this.add(toolbar);

    // Address bar
    var addressBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    addressBar.set({
      backgroundColor: "#ECE9D8",
      padding: 4
    });

    var addressLabel = new qx.ui.basic.Label("Address:");
    var addressField = new qx.ui.form.TextField("My Computer");
    addressField.set({
      readOnly: true
    });

    addressBar.add(addressLabel);
    addressBar.add(addressField, {flex: 1});

    this.add(addressBar);

    // Content area
    var contentArea = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
    contentArea.set({
      backgroundColor: "white",
      padding: 20
    });

    // System Tasks section
    var tasksLabel = new qx.ui.basic.Label("<b>System Tasks</b>");
    tasksLabel.setRich(true);
    contentArea.add(tasksLabel);

    var viewSystemInfo = this._createLink("View system information");
    var addRemovePrograms = this._createLink("Add or remove programs");
    var changeSettings = this._createLink("Change a setting");

    contentArea.add(viewSystemInfo);
    contentArea.add(addRemovePrograms);
    contentArea.add(changeSettings);

    contentArea.add(new qx.ui.core.Spacer().set({height: 10}));

    // Drives section
    var drivesLabel = new qx.ui.basic.Label("<b>Hard Disk Drives</b>");
    drivesLabel.setRich(true);
    contentArea.add(drivesLabel);

    // C: Drive
    var driveC = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
    driveC.set({
      padding: 10,
      backgroundColor: "#F0F0F0",
      decorator: new qx.ui.decoration.Decorator().set({
        width: 1,
        color: "#C0C0C0",
        style: "solid"
      })
    });

    var driveIcon = new qx.ui.basic.Label("💾");
    driveIcon.set({
      font: "bold",
      fontSize: 24
    });

    var driveInfo = new qx.ui.container.Composite(new qx.ui.layout.VBox(2));
    driveInfo.add(new qx.ui.basic.Label("Local Disk (C:)").set({font: "bold"}));
    driveInfo.add(new qx.ui.basic.Label("System Drive"));

    driveC.add(driveIcon);
    driveC.add(driveInfo, {flex: 1});

    contentArea.add(driveC);

    this.add(contentArea, {flex: 1});

    // Status bar
    var statusBar = new qx.ui.toolbar.ToolBar();
    statusBar.set({
      backgroundColor: "#ECE9D8"
    });

    var statusLabel = new qx.ui.basic.Label("My Computer");
    statusBar.add(statusLabel);

    this.add(statusBar);
  },

  members: {
    /**
     * Create a clickable link
     */
    _createLink: function(text) {
      var link = new qx.ui.basic.Label(text);
      link.set({
        textColor: "#0000EE",
        cursor: "pointer",
        paddingLeft: 20
      });

      link.addListener("mouseover", function() {
        link.setTextColor("#551A8B");
        link.setDecorator(new qx.ui.decoration.Decorator().set({
          widthBottom: 1,
          colorBottom: "#551A8B",
          styleBottom: "solid"
        }));
      });

      link.addListener("mouseout", function() {
        link.setTextColor("#0000EE");
        link.setDecorator(null);
      });

      return link;
    }
  }
});
