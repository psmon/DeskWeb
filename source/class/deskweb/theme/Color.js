/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

qx.Theme.define("deskweb.theme.Color",
{
  extend : qx.theme.indigo.Color,

  colors :
  {
    // Desktop background - Windows XP blue
    "desktop-background": "#5A7EDB",
    "desktop-background-dark": "#245EDC",

    // Taskbar colors
    "taskbar-background": "#245EDC",
    "taskbar-background-light": "#3E7EFF",
    "taskbar-button": "#3E7EFF",
    "taskbar-button-hover": "#5A8EFF",
    "taskbar-button-active": "#1E5EDF",

    // Window colors (active = bright blue, inactive = gray)
    "window-caption": "#7A96DF",
    "window-caption-text": "#FFFFFF",
    "window-caption-active": "#0054E3",
    "window-caption-inactive": "#7A96DF",
    "window-border": "#0054E3",
    "window-background": "#ECE9D8",

    // Desktop icon colors
    "icon-label": "#FFFFFF",
    "icon-shadow": "#000000",
    "icon-background-hover": "rgba(255, 255, 255, 0.2)",

    // Start menu colors
    "startmenu-background": "#FFFFFF",
    "startmenu-sidebar": "#5A7EDB",
    "startmenu-item-hover": "#3169C6",
    "startmenu-separator": "#C0C0C0",

    // System tray
    "systemtray-background": "transparent",
    "systemtray-text": "#FFFFFF"
  }
});