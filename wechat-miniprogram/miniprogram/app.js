// 在微信开发者工具中：云开发 → 开通并复制环境 ID，填入下方 env
const CLOUD_ENV_ID = "cloud1-9g5c9zja64f37f01"; // 例: cloud1-xxxxx

// loadFontFace 的 source 仅支持 https / Data URL（本地路径会 ERR_INVALID_URL）；CDN 不可用时可改为自有 HTTPS + CORS
const MATERIAL_SYMBOLS_WOFF_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/material-symbols-outlined@5.2.38/files/material-symbols-outlined-latin-400-normal.woff";

function loadMaterialSymbolsFont() {
  if (typeof wx.loadFontFace !== "function") return;
  wx.loadFontFace({
    family: "Material Symbols Outlined",
    global: true,
    scopes: ["webview", "native"],
    desc: {
      style: "normal",
      weight: "normal",
    },
    source: `url("${MATERIAL_SYMBOLS_WOFF_URL}")`,
    success() {},
    fail(err) {
      console.warn("[app] Material Symbols 字体加载失败（图标可能显示为英文）", err);
    },
  });
}

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("当前基础库过低，请升级微信或开发者工具");
      return;
    }
    if (!CLOUD_ENV_ID) {
      console.warn("请在 miniprogram/app.js 中配置 CLOUD_ENV_ID（云开发环境 ID）");
    }
    wx.cloud.init({
      env: CLOUD_ENV_ID || wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    });
    loadMaterialSymbolsFont();
    const wxUser = require("./utils/wxUser.js");
    wxUser.hydrateAppFromStorage(this);
  },
  globalData: {
    profile: null,
    /** { phoneMasked?, nickName?, avatarUrl? } 本地与云同步 */
    wxUser: null,
  },
});
