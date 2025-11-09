/* ************************************************************************

   Copyright: 2025 undefined

   License: MIT license

   Authors: undefined

************************************************************************ */

qx.Theme.define("deskweb.theme.Font",
{
  extend : qx.theme.indigo.Font,

  fonts :
  {
    "card-rank": {
      size: 12,
      family: ["Arial", "sans-serif"],
      bold: true,
      lineHeight: 1.0
    },

    "card-suit": {
      size: 7,
      family: ["Arial", "sans-serif"],
      lineHeight: 0.8
    },

    "card-corner": {
      size: 10,
      family: ["Arial", "sans-serif"],
      lineHeight: 1.0
    }
  }
});