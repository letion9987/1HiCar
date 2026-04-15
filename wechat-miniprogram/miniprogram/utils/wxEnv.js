/**
 * 窗口 / 安全区尺寸：统一用 wx.getWindowInfo，避免 wx.getSystemInfoSync 弃用告警。
 * @see https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html
 */

function getWindowInfoSafe() {
  try {
    if (typeof wx.getWindowInfo === "function") return wx.getWindowInfo();
  } catch (e) {}
  return null;
}

function readWindowWidthPx() {
  const w = getWindowInfoSafe();
  if (w && typeof w.windowWidth === "number") return w.windowWidth;
  return 375;
}

function readWindowHeightPx() {
  const w = getWindowInfoSafe();
  if (w && typeof w.windowHeight === "number") return w.windowHeight;
  return 667;
}

/** 与首页 header 一致：优先 safeArea.top，否则 statusBarHeight，再无则 0 */
function readSafeAreaTopPx() {
  const w = getWindowInfoSafe();
  if (w && w.safeArea && typeof w.safeArea.top === "number") return w.safeArea.top;
  if (w && typeof w.statusBarHeight === "number") return w.statusBarHeight;
  return 0;
}

function readStatusBarHeightPx() {
  const w = getWindowInfoSafe();
  if (w && typeof w.statusBarHeight === "number") return w.statusBarHeight;
  return 20;
}

function rpxToPx(rpx) {
  return (rpx * readWindowWidthPx()) / 750;
}

module.exports = {
  getWindowInfoSafe,
  readWindowWidthPx,
  readWindowHeightPx,
  readSafeAreaTopPx,
  readStatusBarHeightPx,
  rpxToPx,
};
