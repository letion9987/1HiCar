/**
 * 微信用户信息：手机号（getPhoneNumber + 云函数换号）→ 头像昵称填写 → 本地存储；
 * 展示以本地为准；云 `user.phone` / `user.upsert` 同步；个人中心会员另调 `user.get`。
 * @see https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
 * @see https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html
 */
const STORAGE_KEY = "__hicar_wx_user";

function readWxUserFromStorage() {
  try {
    const u = wx.getStorageSync(STORAGE_KEY);
    return u && typeof u === "object" ? u : null;
  } catch (e) {
    return null;
  }
}

function saveWxUserToStorage(userInfo) {
  try {
    wx.setStorageSync(STORAGE_KEY, userInfo);
  } catch (e) {}
}

/** 与首页展示一致的 profile 结构（无云字段） */
function wxUserToDisplayProfile(u) {
  if (!u || !u.nickName) return null;
  const pm = u.phoneMasked != null ? String(u.phoneMasked).trim() : "";
  return {
    displayName: u.nickName || "微信用户",
    avatarUrl: u.avatarUrl || "",
    phoneMasked: pm && pm !== "—" ? pm : "—",
  };
}

function isPhoneBound(u) {
  const pm = u && u.phoneMasked != null ? String(u.phoneMasked).trim() : "";
  return !!pm && pm !== "—";
}

/** 从本地存储恢复到 App globalData（可无昵称，仅已绑手机） */
function hydrateAppFromStorage(app) {
  const u = readWxUserFromStorage();
  if (!u || typeof u !== "object") return false;
  app.globalData.wxUser = u;
  app.globalData.profile = u.nickName ? wxUserToDisplayProfile(u) : null;
  return !!u.nickName;
}

module.exports = {
  STORAGE_KEY,
  readWxUserFromStorage,
  saveWxUserToStorage,
  wxUserToDisplayProfile,
  isPhoneBound,
  hydrateAppFromStorage,
};
