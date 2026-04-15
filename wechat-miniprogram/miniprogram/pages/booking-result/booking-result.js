const api = require("../../utils/api.js");
const draft = require("../../utils/homeDraft.js");
const mapBuild = require("../../utils/mapBuild.js");
const wxUserUtil = require("../../utils/wxUser.js");
const wxEnv = require("../../utils/wxEnv.js");

function getStatusBarHeightPx() {
  return wxEnv.readStatusBarHeightPx();
}

Page({
  data: {
    phase: "submitting",
    statusBarHeight: getStatusBarHeightPx(),
    errMsg: "",
    orderId: "",
    vehicleText: "",
    useTimeText: "",
    fromText: "",
    mapLat: 31.23,
    mapLng: 121.47,
    mapScale: 13,
    mapMarkers: [],
    mapPolyline: [],
    mapIncludePoints: [],
  },

  onLoad() {
    let payload = null;
    try {
      payload = wx.getStorageSync("__booking_submit_pending");
    } catch (e) {
      payload = null;
    }
    if (!payload || !payload.clientOrderId || !payload.pickup || !payload.pickup.latLng) {
      this.setData({ phase: "bad", errMsg: "无预约数据" });
      return;
    }
    const app = getApp();
    if (!app.globalData.profile || !app.globalData.profile.displayName) {
      wxUserUtil.hydrateAppFromStorage(app);
    }
    const p = app.globalData.profile;
    if (!p || !p.displayName) {
      this.setData({ phase: "bad", errMsg: "请先在首页授权手机号并完善资料" });
      return;
    }

    const createPayload = {
      id: payload.clientOrderId,
      status: "pending",
      from: payload.pickup.label,
      to: payload.dropoff ? payload.dropoff.label : "",
      useTime: payload.useTime || "",
      remark: payload.remark || undefined,
      passengers: payload.passengers,
      pricingMode: payload.pricingMode,
      vehicleLabel: payload.vehicleLabel,
      estimatedTotalYuan: payload.estimatedTotalYuan,
      depositPaidYuan: payload.depositPaidYuan,
      driverLatLng: payload.driverLatLng,
      pickupLatLng: payload.pickup.latLng,
      dropoffLatLng: payload.dropoff ? payload.dropoff.latLng : null,
      tempFeeDetail: payload.tempFeeDetail,
    };

    wx.showLoading({ title: "加载中", mask: true });
    api
      .ordersCreate(createPayload, { silent: true })
      .then(() => {
        try {
          wx.removeStorageSync("__booking_submit_pending");
        } catch (e) {}
        draft.saveLocations(null, null);
        draft.clearBookingUi();
        return api.mapRoutes(
          {
            driverLatLng: payload.driverLatLng || null,
            pickupLatLng: payload.pickup.latLng,
            dropoffLatLng: payload.dropoff && payload.dropoff.latLng ? payload.dropoff.latLng : null,
          },
          { silent: true },
        ).catch(() => null);
      })
      .then((r) => {
        const leg1Points = r && Array.isArray(r.leg1Points) ? r.leg1Points : [];
        const leg2Points = r && Array.isArray(r.leg2Points) ? r.leg2Points : [];
        const ctx = mapBuild.buildMapContext({
          driverLatLng: payload.driverLatLng || null,
          pickupLatLng: payload.pickup.latLng,
          dropoffLatLng: payload.dropoff && payload.dropoff.latLng ? payload.dropoff.latLng : null,
          leg1Points,
          leg2Points,
        });
        this.setData({
          phase: "ok",
          orderId: payload.clientOrderId,
          vehicleText: payload.vehicleLabel || "商务7座 · 丰田埃尔法或同级",
          useTimeText: payload.useTime || "—",
          fromText: payload.pickup.label || "—",
          mapLat: ctx.mapLat,
          mapLng: ctx.mapLng,
          mapScale: ctx.scale,
          mapMarkers: ctx.markers,
          mapPolyline: ctx.polyline,
          mapIncludePoints: ctx.includePoints,
        });
      })
      .catch((e) => {
        this.setData({
          phase: "error",
          errMsg: e.message || "创建订单失败",
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  onClose() {
    wx.reLaunch({ url: "/pages/home/home" });
  },

  onViewOrder() {
    const id = this.data.orderId;
    if (!id) return;
    wx.redirectTo({
      url: `/pages/order-detail/order-detail?id=${encodeURIComponent(id)}&status=pending`,
    });
  },
});
