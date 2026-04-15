const api = require("../../utils/api.js");
const settlement = require("../../utils/settlement.js");
const mapBuild = require("../../utils/mapBuild.js");
const wxEnv = require("../../utils/wxEnv.js");

function fmtYuan(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "¥0.00";
  return `¥${x.toFixed(2)}`;
}

function normStatus(s) {
  if (s === "ongoing" || s === "completed" || s === "cancelled" || s === "pending") return s;
  return "pending";
}

function previewAmount(s) {
  const t = String(s == null ? "" : s).trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function readStatusBarHeight() {
  return wxEnv.readStatusBarHeightPx();
}

Page({
  data: {
    statusBarHeight: 20,
    id: "",
    urlStatus: "pending",
    order: null,
    status: "pending",
    statusText: "",
    statusBadge: "",
    fromLabel: "",
    toLabel: "",
    useTimeLabel: "",
    remarkLine: "",
    showRemark: false,
    displayTotalYuan: 0,
    displayTotalStr: "",
    paidDepositStr: "",
    showPaidDeposit: false,
    hasSettlement: false,
    snap: null,
    tempLines: [],
    showLegacyCompletedExtras: false,
    legacyExtrasLines: [],
    mapLat: 31.23,
    mapLng: 121.47,
    mapScale: 13,
    mapMarkers: [],
    mapPolyline: [],
    mapIncludePoints: [],
    settlementOpen: false,
    settleOvertime: "",
    settleDistance: "",
    settleToll: "",
    settleOvertimeMin: 0,
    settleOverDistanceKm: 0,
    settleTollYuan: 0,
    settleOvertimeYuan: 0,
    settleOverDistanceYuan: 0,
    settleExtrasTotalStr: "0.00",
    settleOvertimeYuanStr: "0.00",
    settleOverDistanceYuanStr: "0.00",
    settleTollYuanStr: "0.00",
    confirmKind: "",
    confirmTitle: "",
    confirmMessage: "",
    confirmOkText: "确定",
    confirmIsDanger: false,
    vehicleLabel: "",
    passengers: 1,
    pricingMode: "package",
    completedAtLabel: "—",
  },

  onLoad(query) {
    this.setData({ statusBarHeight: readStatusBarHeight() });
    const id = query.id ? decodeURIComponent(query.id) : "";
    const urlStatus = normStatus(query.status || "pending");
    this.setData({ id, urlStatus });
    if (!id) {
      wx.showModal({
        title: "提示",
        content: "无效的订单链接",
        showCancel: false,
        success: () => wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/me/me" }) }),
      });
      return;
    }
    this.load();
  },

  load() {
    api
      .ordersList({ id: this.data.id }, { silent: true })
      .then((r) => {
        const list = r.orders || [];
        const order = list[0];
        if (!order) {
          wx.showModal({
            title: "提示",
            content: "订单不存在或已被删除",
            showCancel: false,
            success: () => wx.navigateTo({ url: "/pages/me/me" }),
          });
          return;
        }
        this.applyOrder(order);
        this.refreshOrderMap(order);
      })
      .catch((e) => wx.showToast({ title: e.message || "加载失败", icon: "none" }));
  },

  refreshOrderMap(order) {
    if (!order || !order.pickupLatLng) {
      this.setData({
        mapMarkers: [],
        mapPolyline: [],
        mapIncludePoints: [],
        mapLat: 31.23,
        mapLng: 121.47,
        mapScale: 12,
      });
      return;
    }
    const driver = order.driverLatLng || null;
    const pickup = order.pickupLatLng;
    const dropoff = order.dropoffLatLng || null;
    api
      .mapRoutes(
        {
          driverLatLng: driver,
          pickupLatLng: pickup,
          dropoffLatLng: dropoff,
        },
        { silent: true },
      )
      .then((r) => {
        const leg1 = r && Array.isArray(r.leg1Points) ? r.leg1Points : [];
        const leg2 = r && Array.isArray(r.leg2Points) ? r.leg2Points : [];
        const ctx = mapBuild.buildMapContext({
          driverLatLng: driver,
          pickupLatLng: pickup,
          dropoffLatLng: dropoff,
          leg1Points: leg1,
          leg2Points: leg2,
        });
        this.setData({
          mapMarkers: ctx.markers,
          mapPolyline: ctx.polyline,
          mapLat: ctx.mapLat,
          mapLng: ctx.mapLng,
          mapScale: ctx.scale,
          mapIncludePoints: ctx.includePoints,
        });
      })
      .catch(() => {
        const leg1 = Array.isArray(order.routeLeg1Path) ? order.routeLeg1Path : [];
        const leg2 = Array.isArray(order.routeLeg2Path) ? order.routeLeg2Path : [];
        const ctx = mapBuild.buildMapContext({
          driverLatLng: driver,
          pickupLatLng: pickup,
          dropoffLatLng: dropoff,
          leg1Points: leg1,
          leg2Points: leg2,
        });
        this.setData({
          mapMarkers: ctx.markers,
          mapPolyline: ctx.polyline,
          mapLat: ctx.mapLat,
          mapLng: ctx.mapLng,
          mapScale: ctx.scale,
          mapIncludePoints: ctx.includePoints,
        });
      });
  },

  applyOrder(order) {
    const urlStatus = this.data.urlStatus;
    const status = order.status || urlStatus;
    const statusText =
      status === "ongoing"
        ? "司机正在服务中"
        : status === "completed"
          ? "行程已完成"
          : status === "cancelled"
            ? "订单已取消"
            : "司机正前往起点";
    const statusBadge =
      status === "ongoing"
        ? "租赁中"
        : status === "completed"
          ? "已完成"
          : status === "cancelled"
            ? "已取消"
            : "待确认";
    const fromLabel = order.from || "上海市 虹桥国际机场 T2航站楼";
    const toLabel = settlement.orderDestinationDisplay(order.to) || "—";
    const useTimeLabel = order.useTime || "—";
    const remarkLine = (order.remark && String(order.remark).trim()) || "";
    const showRemark = remarkLine.length > 0;
    const snap = order.settlementSnapshot;
    const hasSettlement = !!(status === "completed" && snap);
    const hasStoredEstimate = order.estimatedTotalYuan != null;
    const displayTotalYuan =
      snap && typeof snap.paidTotalYuan === "number"
        ? snap.paidTotalYuan
        : order.estimatedTotalYuan != null
          ? order.estimatedTotalYuan
          : status === "completed"
            ? 669.5
            : 320.5;
    const showPaidDeposit = status === "pending" || status === "ongoing";
    const paidDepositYuan = showPaidDeposit ? settlement.computeDepositPaidYuan(order) : 0;
    const showLegacyCompletedExtras =
      status === "completed" && !order.settlementSnapshot && !hasStoredEstimate;

    let tempLines = [];
    if (!hasSettlement) {
      const td = order.tempFeeDetail;
      if (order.pricingMode === "temporary" && td) {
        tempLines = [
          { k: `基础行程（约 ${td.baseKm.toFixed(1)} km）`, v: fmtYuan(td.baseYuan) },
          { k: `空驶补偿（约 ${td.deadKm.toFixed(1)} km）`, v: fmtYuan(td.emptyYuan) },
        ];
      } else if (order.pricingMode === "package") {
        tempLines = [
          {
            k: "套餐预估（8h / 200km）",
            v: fmtYuan(order.estimatedTotalYuan ?? 500),
          },
        ];
      } else {
        tempLines = [
          { k: "基础行程 (128.2km × 2.5)", v: "¥320.50" },
          { k: "空驶补偿 (15.0km × 0 × 2)", v: "¥0.00" },
        ];
      }
    }

    const legacyExtrasLines = showLegacyCompletedExtras
      ? [
          { k: "超时补差", v: "¥45.00" },
          { k: "超距补差", v: "¥100.00" },
          { k: "高速路桥费", v: "¥28.00" },
        ]
      : [];

    let snapForView = null;
    if (hasSettlement && snap) {
      const perKm = snap.overDistanceYuanPerKm != null ? snap.overDistanceYuanPerKm : 2;
      snapForView = {
        ...snap,
        baseYuanStr: fmtYuan(snap.baseYuan),
        emptyYuanStr: fmtYuan(snap.emptyYuan),
        packageYuanStr: fmtYuan(snap.baseYuan + snap.emptyYuan),
        comboYuanStr: fmtYuan(snap.baseYuan + snap.emptyYuan),
        overtimeYuanStr: fmtYuan(snap.overtimeYuan),
        overDistanceYuanStr: fmtYuan(snap.overDistanceYuan),
        tollYuanStr: fmtYuan(snap.tollYuan),
        paidTotalStr: fmtYuan(snap.paidTotalYuan),
        overDistanceYuanPerKmStr: perKm.toFixed(1),
      };
    }

    this.setData({
      order,
      status,
      statusText,
      statusBadge,
      fromLabel,
      toLabel,
      useTimeLabel,
      remarkLine,
      showRemark,
      displayTotalYuan,
      displayTotalStr: fmtYuan(displayTotalYuan),
      showPaidDeposit,
      paidDepositStr: fmtYuan(paidDepositYuan),
      hasSettlement,
      snap: snapForView,
      tempLines,
      showLegacyCompletedExtras,
      legacyExtrasLines,
      completedAtLabel: (snap && snap.completedAtLabel) || "10-24 15:30",
      vehicleLabel: order.vehicleLabel || "商务7座 · 丰田埃尔法或同级",
      passengers: order.passengers ?? 1,
      pricingMode: order.pricingMode || "package",
    });
  },

  computeSettlePreview(d) {
    const overtimeMin = previewAmount(d.settleOvertime);
    const overDistanceKm = previewAmount(d.settleDistance);
    const tollYuan = previewAmount(d.settleToll);
    const overtimeYuan = overtimeMin;
    const overDistanceYuan = overDistanceKm * 2;
    const extras = overtimeYuan + overDistanceYuan + tollYuan;
    return {
      settleOvertimeMin: overtimeMin,
      settleOverDistanceKm: overDistanceKm,
      settleTollYuan: tollYuan,
      settleOvertimeYuan: overtimeYuan,
      settleOverDistanceYuan: overDistanceYuan,
      settleExtrasTotalStr: extras.toFixed(2),
      settleOvertimeYuanStr: overtimeYuan.toFixed(2),
      settleOverDistanceYuanStr: overDistanceYuan.toFixed(2),
      settleTollYuanStr: tollYuan.toFixed(2),
    };
  },

  openSettlement() {
    const base = {
      settleOvertime: "",
      settleDistance: "",
      settleToll: "",
      settlementOpen: true,
    };
    this.setData({ ...base, ...this.computeSettlePreview({ ...this.data, ...base }) });
  },

  closeSettlement() {
    this.setData({ settlementOpen: false });
  },

  onOverlayPageContainerBeforeLeave() {
    if (this.data.settlementOpen) {
      this.closeSettlement();
      return;
    }
    if (this.data.confirmKind) {
      this.closeConfirm();
    }
  },

  onSettleInput(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail.value;
    const next = { ...this.data, [field]: val };
    this.setData({ [field]: val, ...this.computeSettlePreview(next) });
  },

  confirmSettlement() {
    const order = this.data.order;
    if (!order) return;
    const om = previewAmount(this.data.settleOvertime);
    const okm = previewAmount(this.data.settleDistance);
    const toll = previewAmount(this.data.settleToll);
    const snap = settlement.buildSettlementSnapshot(order, {
      overtimeMinutes: om,
      overDistanceKm: okm,
      tollYuan: toll,
    });
    api
      .ordersUpdate({
        id: order.id,
        patch: { status: "completed", settlementSnapshot: snap },
      })
      .then(() => {
        this.setData({ settlementOpen: false, urlStatus: "completed" });
        wx.showToast({ title: "结算完成", icon: "success" });
        this.load();
      })
      .catch((e) => wx.showToast({ title: e.message || "失败", icon: "none" }));
  },

  stopTap() {},

  requestCancel() {
    const { order } = this.data;
    if (!order || order.status !== "pending") return;
    this.setData({
      confirmKind: "cancel",
      confirmTitle: "取消订单",
      confirmMessage: "确定要取消该订单吗？取消后订单状态将更新为已取消。",
      confirmOkText: "取消",
      confirmIsDanger: false,
    });
  },

  requestDelete() {
    const { order } = this.data;
    if (!order) return;
    if (order.status !== "completed" && order.status !== "cancelled") return;
    this.setData({
      confirmKind: "delete",
      confirmTitle: "删除订单",
      confirmMessage: "确定删除该订单？删除后不可恢复。",
      confirmOkText: "删除",
      confirmIsDanger: true,
    });
  },

  requestContactDriver() {
    const { order } = this.data;
    if (!order || order.status !== "pending") return;
    this.setData({
      confirmKind: "contactDriver",
      confirmTitle: "联系司机",
      confirmMessage: "确认已联系上司机并将开始行程？确认后订单将进入「租赁中」状态。",
      confirmOkText: "确定",
      confirmIsDanger: false,
    });
  },

  closeConfirm() {
    this.setData({
      confirmKind: "",
      confirmTitle: "",
      confirmMessage: "",
      confirmOkText: "确定",
      confirmIsDanger: false,
    });
  },

  onConfirmMaskTap() {
    this.closeConfirm();
  },

  onConfirmOk() {
    const { order, confirmKind } = this.data;
    if (!order || !confirmKind) return;
    const kind = confirmKind;
    this.closeConfirm();
    if (kind === "cancel") {
      api
        .ordersUpdate({ id: order.id, patch: { status: "cancelled" } })
        .then(() => {
          wx.showToast({ title: "已取消", icon: "none" });
          this.load();
        })
        .catch((e) => wx.showToast({ title: e.message || "失败", icon: "none" }));
    } else if (kind === "delete") {
      api
        .ordersDelete({ id: order.id })
        .then(() => {
          wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/me/me" }) });
        })
        .catch((e) => wx.showToast({ title: e.message || "失败", icon: "none" }));
    } else if (kind === "contactDriver") {
      api
        .ordersUpdate({ id: order.id, patch: { status: "ongoing" } })
        .then(() => {
          wx.showToast({ title: "已开始行程", icon: "none" });
          this.load();
        })
        .catch((e) => wx.showToast({ title: e.message || "失败", icon: "none" }));
    }
  },

  onBookAgain() {
    wx.reLaunch({ url: "/pages/home/home" });
  },

  onNavBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: "/pages/me/me" }),
    });
  },

  /** Web 端 more 为展示位，暂无菜单逻辑 */
  onNavMore() {},
});
