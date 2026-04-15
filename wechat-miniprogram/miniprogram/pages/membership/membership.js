const wxUserUtil = require("../../utils/wxUser.js");

Page({
  onShow() {
    const app = getApp();
    if (!app.globalData.profile || !app.globalData.profile.displayName) {
      wxUserUtil.hydrateAppFromStorage(app);
    }
    if (!app.globalData.profile || !app.globalData.profile.displayName) {
      wx.showToast({ title: "请先在首页授权手机号并完善资料", icon: "none" });
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/home/home" }) }), 400);
    }
  },
  data: {
    levels: [
      { name: "张小三", phone: "138 **** 8888", badge: "普通会员", badgeClass: "n" },
      { name: "李思源", phone: "139 **** 6666", badge: "白银会员", badgeClass: "s" },
      { name: "王金发", phone: "136 **** 9999", badge: "黄金会员", badgeClass: "g" },
      { name: "赵伯爵", phone: "188 **** 0001", badge: "铂金会员", badgeClass: "p" },
      { name: "陈钻钻", phone: "199 **** 9999", badge: "钻石会员", badgeClass: "d" },
    ],
  },
});
