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
    }
  }
});