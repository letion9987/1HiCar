const api = require("../../utils/api.js");
const settlement = require("../../utils/settlement.js");
const wxUserUtil = require("../../utils/wxUser.js");

const TABS = [
  { key: "pending", label: "预约中" },
  { key: "ongoing", label: "租赁中" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

const TAB_KEYS = TABS.map((t) => t.key);
const PAGE_SIZE = 10;

function statusLabel(st) {
  if (st === "pending") return "待确认";
  if (st === "ongoing") return "租赁中";
  if (st === "completed") return "已完成";
  return "已取消";
}

/** 与 `pages/membership/membership` 徽章等级一致：n/s/g/p/d；文案优先于 key，避免库中不一致 */
function membershipBadgeClass(key, label) {
  const k = String(key || "")
    .toLowerCase()
    .trim();
  const L = String(label || "");
  if (!k && !L) return "muted";
  if (L.includes("钻石") || k === "diamond" || k === "vip_diamond") return "d";
  if (L.includes("铂金") || k === "platinum" || k === "vip_platinum") return "p";
  if (L.includes("黄金") || k === "gold" || k === "vip_gold") return "g";
  if (L.includes("白银") || k === "silver" || k === "vip_silver") return "s";
  if (L.includes("普通") || k === "normal" || k === "member") return "n";
  return "n";
}

function decorateOrders(raw) {
  return (raw || []).map((o) => ({
    ...o,
    statusText: statusLabel(o.status),
    toDisplay: settlement.orderDestinationDisplay(o.to),
    dim: o.status === "cancelled",
  }));
}

Page({
  data: {
    profile: null,
    membershipLevelLabel: "",
    membershipLevelKey: "",
    membershipBadgeClass: "loading",
    membershipLoading: true,
    tabs: TABS,
    activeTab: "pending",
    currentList: [],
    listLoading: false,
    listLoadingMore: false,
    listHasMore: false,
  },

  onLoad() {
    this._tabCache = {};
    this._ordersPageInited = false;
    this._reqEpoch = 0;
  },

  onShow() {
    this.bootstrap();
  },

  onPullDownRefresh() {
    this.ensureTabLoaded(this.data.activeTab, { refresh: true }).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    const tab = this.data.activeTab;
    const c = this._getTabCache(tab);
    if (!c.hasMore || this.data.listLoadingMore || this.data.listLoading) return;
    this.ensureTabLoaded(tab, { append: true });
  },

  _getTabCache(tab) {
    if (!this._tabCache[tab]) {
      this._tabCache[tab] = {
        list: [],
        skip: 0,
        hasMore: true,
        initialized: false,
      };
    }
    return this._tabCache[tab];
  },

  invalidateOrderCaches() {
    TAB_KEYS.forEach((k) => {
      this._tabCache[k] = {
        list: [],
        skip: 0,
        hasMore: true,
        initialized: false,
      };
    });
  },

  _syncListUI(tab) {
    const c = this._getTabCache(tab);
    if (this.data.activeTab !== tab) return;
    this.setData({
      currentList: decorateOrders(c.list),
      listHasMore: c.hasMore,
      listLoading: false,
      listLoadingMore: false,
    });
  },

  /**
   * @param {string} tab
   * @param {{ refresh?: boolean; append?: boolean }} [opts]
   */
  ensureTabLoaded(tab, opts) {
    opts = opts || {};
    const refresh = !!opts.refresh;
    const append = !!opts.append;
    const epoch = this._reqEpoch;
    const c = this._getTabCache(tab);

    if (refresh) {
      c.list = [];
      c.skip = 0;
      c.hasMore = true;
      c.initialized = false;
    }

    if (append) {
      if (!c.hasMore) return Promise.resolve();
      if (this.data.listLoadingMore || this.data.listLoading) return Promise.resolve();
    } else if (!refresh && c.initialized) {
      this._syncListUI(tab);
      return Promise.resolve();
    }

    const reqSkip = append ? c.skip : 0;
    const isFirstPage = !append;

    if (isFirstPage) {
      this.setData({ listLoading: true, listLoadingMore: false });
    } else {
      this.setData({ listLoadingMore: true });
    }

    return api
      .ordersList(
        {
          status: tab,
          skip: reqSkip,
          limit: PAGE_SIZE,
        },
        { silent: true },
      )
      .then((r) => {
        const rows = r.orders || [];
        const hasMore = typeof r.hasMore === "boolean" ? r.hasMore : rows.length >= PAGE_SIZE;

        if (append) {
          c.list = c.list.concat(rows);
        } else {
          c.list = rows;
        }
        c.skip = reqSkip + rows.length;
        c.hasMore = hasMore;
        c.initialized = true;

        if (this.data.activeTab === tab) {
          this.setData({
            currentList: decorateOrders(c.list),
            listHasMore: c.hasMore,
            listLoading: false,
            listLoadingMore: false,
          });
        }
      })
      .catch((e) => {
        wx.showToast({ title: e.message || "加载失败", icon: "none" });
        if (this.data.activeTab === tab) {
          this.setData({
            listLoading: false,
            listLoadingMore: false,
            currentList: isFirstPage ? [] : decorateOrders(c.list),
          });
        }
      })
      .finally(() => {
        if (epoch === this._reqEpoch) {
          this.setData({ listLoading: false, listLoadingMore: false });
        }
      });
  },

  bootstrap() {
    const app = getApp();
    if (!app.globalData.profile || !app.globalData.profile.displayName) {
      wxUserUtil.hydrateAppFromStorage(app);
    }
    const p = app.globalData.profile;
    if (!p || !p.displayName) {
      wx.showToast({ title: "请先在首页授权手机号并完善资料", icon: "none" });
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/home/home" }) }), 400);
      return;
    }
    const profile = {
      ...p,
      phoneMasked: p.phoneMasked != null ? p.phoneMasked : "—",
    };
    this.setData({
      profile,
      membershipLevelLabel: "",
      membershipLevelKey: "",
      membershipBadgeClass: "loading",
      membershipLoading: true,
    });
    this.loadMembershipFromCloud();

    if (!this._ordersPageInited) {
      this._ordersPageInited = true;
      this.invalidateOrderCaches();
      this.ensureTabLoaded(this.data.activeTab, {});
    } else {
      this.ensureTabLoaded(this.data.activeTab, { refresh: true });
    }
  },

  /** 仅拉取云库会员等字段；昵称头像以本地（头像昵称填写）为准 */
  loadMembershipFromCloud() {
    api
      .userGet({ silent: true })
      .then((r) => {
        const cloud = r && r.profile;
        const patch = { membershipLoading: false };
        const label =
          cloud && cloud.membershipLevelLabel != null && String(cloud.membershipLevelLabel).trim()
            ? String(cloud.membershipLevelLabel).trim()
            : "";
        const mKey =
          cloud && cloud.membershipLevelKey != null && String(cloud.membershipLevelKey).trim()
            ? String(cloud.membershipLevelKey).trim()
            : "";
        patch.membershipLevelLabel = label;
        patch.membershipLevelKey = mKey;
        patch.membershipBadgeClass = label || mKey ? membershipBadgeClass(mKey, label) : "muted";
        this.setData(patch);
      })
      .catch(() => {
        this.setData({
          membershipLoading: false,
          membershipLevelLabel: "",
          membershipLevelKey: "",
          membershipBadgeClass: "muted",
        });
      });
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTab) return;
    this._reqEpoch += 1;
    this.setData({ activeTab: key, listLoading: false, listLoadingMore: false }, () => {
      const c = this._getTabCache(key);
      if (!c.initialized) {
        this.ensureTabLoaded(key, {});
      } else {
        this._syncListUI(key);
      }
    });
  },

  onMembershipTap() {
    wx.navigateTo({ url: "/pages/membership/membership" });
  },

  onGoHome() {
    wx.reLaunch({ url: "/pages/home/home" });
  },

  onViewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const st = e.currentTarget.dataset.status;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${encodeURIComponent(id)}&status=${st}`,
    });
  },

  onCancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "取消订单",
      content: "确定要取消该订单吗？取消后可在「已取消」中查看。",
      confirmText: "确认",
      success: (res) => {
        if (!res.confirm) return;
        api
          .ordersUpdate({ id, patch: { status: "cancelled" } })
          .then(() => {
            this.invalidateOrderCaches();
            this._reqEpoch += 1;
            this.setData(
              { activeTab: "cancelled", listLoading: false, listLoadingMore: false },
              () => {
                this.ensureTabLoaded("cancelled", {});
              },
            );
            wx.showToast({ title: "已取消", icon: "none" });
          })
          .catch((err) => wx.showToast({ title: err.message || "失败", icon: "none" }));
      },
    });
  },

  onDeleteOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除订单",
      content: "确定删除该订单？删除后不可恢复。",
      confirmText: "删除",
      confirmColor: "#ef4444",
      success: (res) => {
        if (!res.confirm) return;
        api
          .ordersDelete({ id })
          .then(() => {
            this.invalidateOrderCaches();
            this._reqEpoch += 1;
            const tab = this.data.activeTab;
            this.setData({ listLoading: false, listLoadingMore: false }, () => {
              this.ensureTabLoaded(tab, { refresh: true });
            });
            wx.showToast({ title: "已删除", icon: "none" });
          })
          .catch((err) => wx.showToast({ title: err.message || "失败", icon: "none" }));
      },
    });
  },
});
