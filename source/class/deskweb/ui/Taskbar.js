/* ************************************************************************

   Copyright: 2025 DeskWeb

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Windows XP-style Taskbar
 *
 * Contains Start button, window buttons, and system tray
 */
qx.Class.define("deskweb.ui.Taskbar", {
  extend: qx.ui.container.Composite,

  construct: function() {
    this.base(arguments, new qx.ui.layout.HBox(4));

    this.set({
      appearance: "taskbar",
      height: 30
    });

    this.__windowButtons = {};

    // Create Start button
    this.__startButton = new qx.ui.form.Button("Start");
    this.__startButton.set({
      appearance: "taskbar-button",
      minWidth: 80,
      height: 24,
      marginLeft: 4
    });
    this.__startButton.addListener("execute", this._onStartClick, this);
    this.add(this.__startButton);

    // Separator
    this.add(new qx.ui.core.Widget().set({
      width: 2,
      backgroundColor: "#0054E3"
    }));

    // Window buttons container
    this.__windowButtonsContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(2));
    this.add(this.__windowButtonsContainer, {flex: 1});

    // Spacer before system tray
    this.add(new qx.ui.core.Spacer(), {flex: 1});

    // System tray
    this.__systemTray = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    this.__systemTray.set({
      padding: [2, 8]
    });

    // Clock
    this.__clock = new qx.ui.basic.Label();
    this.__clock.set({
      textColor: "systemtray-text",
      font: "default",
      paddingRight: 4,
      cursor: "pointer"
    });
    this._updateClock();

    // Add click listener for calendar
    this.__clock.addListener("click", this._onClockClick, this);

    // Update clock every minute
    this.__clockTimer = qx.util.TimerManager.getInstance();
    this.__clockInterval = setInterval(() => {
      this._updateClock();
    }, 60000);

    this.__systemTray.add(this.__clock);
    this.add(this.__systemTray);

    // Create calendar popup
    this.__calendarPopup = null;
  },

  events: {
    /** Fired when Start button is clicked */
    "startClick": "qx.event.type.Event"
  },

  members: {
    __startButton: null,
    __windowButtonsContainer: null,
    __windowButtons: null,
    __systemTray: null,
    __clock: null,
    __clockInterval: null,
    __calendarPopup: null,

    /**
     * Update clock display
     */
    _updateClock: function() {
      var now = new Date();
      var hours = now.getHours();
      var minutes = now.getMinutes();
      var ampm = hours >= 12 ? 'PM' : 'AM';

      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      minutes = minutes < 10 ? '0' + minutes : minutes;

      var timeStr = hours + ':' + minutes + ' ' + ampm;
      this.__clock.setValue(timeStr);
    },

    /**
     * Handle Start button click
     */
    _onStartClick: function(e) {
      this.fireEvent("startClick");
    },

    /**
     * Handle clock click - show calendar
     */
    _onClockClick: function(e) {
      if (this.__calendarPopup && this.__calendarPopup.isVisible()) {
        this.__calendarPopup.hide();
        return;
      }

      if (!this.__calendarPopup) {
        // Create calendar popup
        this.__calendarPopup = new qx.ui.popup.Popup(new qx.ui.layout.VBox(5));
        this.__calendarPopup.set({
          backgroundColor: "white",
          padding: 10,
          autoHide: true
        });

        // Add date selector
        var dateChooser = new qx.ui.control.DateChooser();
        this.__calendarPopup.add(dateChooser);

        // Add current time display
        var now = new Date();
        var dateStr = now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
        var fullTimeStr = now.toLocaleTimeString('ko-KR');

        var timeLabel = new qx.ui.basic.Label(dateStr + '\n' + fullTimeStr);
        timeLabel.set({
          rich: true,
          textAlign: "center",
          padding: 5
        });
        this.__calendarPopup.add(timeLabel);
      }

      // Position popup above clock
      var clockBounds = this.__clock.getBounds();
      var clockLocation = qx.bom.element.Location.get(this.__clock.getContentElement().getDomElement());

      if (clockLocation) {
        this.__calendarPopup.placeToPoint({
          left: clockLocation.left - 200,
          top: clockLocation.top - 250
        });
      }

      this.__calendarPopup.show();
    },

    /**
     * Attach a window to the taskbar
     */
    attachWindow: function(window) {
      var button = new qx.ui.form.ToggleButton();
      button.set({
        appearance: "taskbar-button",
        minWidth: 120,
        maxWidth: 200,
        height: 24
      });

      // Bind window properties to button
      window.bind("caption", button, "label");
      window.bind("icon", button, "icon");

      // Toggle window visibility on button click
      button.addListener("execute", function() {
        if (window.isVisible()) {
          if (window.isActive()) {
            window.minimize();
          } else {
            window.restore();
            window.setActive(true);
          }
        } else {
          window.restore();
          window.setActive(true);
        }
      });

      // Update button state when window state changes
      window.addListener("changeActive", function(e) {
        button.setValue(e.getData());
      });

      window.addListener("changeVisibility", function(e) {
        if (!e.getData()) {
          button.setValue(false);
        }
      });

      // Remove button when window closes
      window.addListener("close", function() {
        this.__windowButtonsContainer.remove(button);
        delete this.__windowButtons[window.toHashCode()];
        button.destroy();
      }, this);

      this.__windowButtonsContainer.add(button);
      this.__windowButtons[window.toHashCode()] = button;

      return button;
    },

    /**
     * Remove window from taskbar
     */
    detachWindow: function(window) {
      var hash = window.toHashCode();
      if (this.__windowButtons[hash]) {
        this.__windowButtonsContainer.remove(this.__windowButtons[hash]);
        this.__windowButtons[hash].destroy();
        delete this.__windowButtons[hash];
      }
    }
  },

  destruct: function() {
    if (this.__clockInterval) {
      clearInterval(this.__clockInterval);
      this.__clockInterval = null;
    }
    this.__startButton = null;
    this.__windowButtonsContainer = null;
    this.__windowButtons = null;
    this.__systemTray = null;
    this.__clock = null;
  }
});
