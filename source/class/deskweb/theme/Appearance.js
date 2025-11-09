/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

qx.Theme.define("deskweb.theme.Appearance",
{
  extend : qx.theme.indigo.Appearance,

  appearances :
  {
    "desktop": {
      style: function(states) {
        return {
          decorator: "desktop-background",
          backgroundColor: "desktop-background"
        };
      }
    },

    "taskbar": {
      style: function(states) {
        return {
          decorator: "taskbar",
          height: 30,
          padding: [2, 4]
        };
      }
    },

    "taskbar-button": {
      style: function(states) {
        return {
          decorator: states.hovered ? "taskbar-button-hover" : "taskbar-button",
          textColor: "white",
          padding: [2, 8],
          margin: [0, 2]
        };
      }
    },

    "desktop-icon": {
      style: function(states) {
        return {
          decorator: states.hovered ? "desktop-icon-hover" : "desktop-icon",
          textColor: "icon-label",
          padding: 5,
          cursor: "pointer",
          font: "default",
          iconPosition: "top",
          center: true,
          gap: 3
        };
      }
    },

    "startmenu": {
      style: function(states) {
        return {
          decorator: "startmenu",
          backgroundColor: "startmenu-background",
          padding: 2
        };
      }
    },

    "startmenu-item": {
      style: function(states) {
        return {
          backgroundColor: states.hovered ? "startmenu-item-hover" : undefined,
          textColor: states.hovered ? "white" : "black",
          padding: [4, 8],
          cursor: "pointer"
        };
      }
    },

    "playing-card": {
      style: function(states) {
        return {
          decorator: "main",
          backgroundColor: states.selected ? "#FFEB3B" : "white",
          width: 80,
          height: 110,
          padding: 2,
          cursor: "pointer"
        };
      }
    },

    "playing-card-back": {
      style: function(states) {
        return {
          decorator: "main",
          backgroundColor: "#1E5A8E",
          width: 80,
          height: 110,
          cursor: "default"
        };
      }
    },

    "card-corner-text": {
      style: function(states) {
        return {
          font: "card-corner",
          padding: 0,
          alignX: "center"
        };
      }
    }
  }
});