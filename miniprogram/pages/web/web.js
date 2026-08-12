const { WEB_APP_URL } = require("../../utils/config.js");

Page({
  data: {
    webUrl: WEB_APP_URL
  },

  onWebMessage(_event) {
    /* H5 postMessage 预留 */
  }
});
