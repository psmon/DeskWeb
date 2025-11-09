/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

qx.Theme.define("deskweb.theme.Decoration",
{
  extend : qx.theme.indigo.Decoration,

  decorations :
  {
    "desktop-background": {
      style: {
        backgroundColor: "desktop-background"
      }
    },

    "taskbar": {
      style: {
        backgroundColor: "taskbar-background",
        widthTop: 2,
        colorTop: "#3E7EFF",
        styleTop: "solid"
      }
    },

    "taskbar-button": {
      style: {
        backgroundColor: "taskbar-button",
        width: 1,
        color: "#1E5EDF",
        style: "solid",
        radius: 3
      }
    },

    "taskbar-button-hover": {
      style: {
        backgroundColor: "taskbar-button-hover",
        width: 1,
        color: "#4E8EFF",
        style: "solid",
        radius: 3
      }
    },

    "window-caption": {
      style: {
        gradientStart: ["window-caption", 0],
        gradientEnd: ["#3E8EFF", 100],
        orientation: "horizontal"
      }
    },

    "window-caption-active": {
      style: {
        gradientStart: ["#0058E6", 0],
        gradientEnd: ["#3E8EFF", 100],
        orientation: "horizontal"
      }
    },

    "window-caption-inactive": {
      style: {
        gradientStart: ["#7A96C4", 0],
        gradientEnd: ["#A4B8D8", 100],
        orientation: "horizontal"
      }
    },

    "desktop-icon": {
      style: {
        radius: 3
      }
    },

    "desktop-icon-hover": {
      style: {
        backgroundColor: "icon-background-hover",
        radius: 3
      }
    },

    "startmenu": {
      style: {
        backgroundColor: "startmenu-background",
        width: 1,
        color: "#0054E3",
        style: "solid",
        shadowLength: 3,
        shadowBlurRadius: 5,
        shadowColor: "rgba(0, 0, 0, 0.3)"
      }
    },

    "startmenu-sidebar": {
      style: {
        backgroundColor: "startmenu-sidebar"
      }
    }
  }
});