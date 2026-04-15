const api = require("../../utils/api.js");
const draft = require("../../utils/homeDraft.js");
const geo = require("../../utils/geo.js");
const mapBuild = require("../../utils/mapBuild.js");
const wxUserUtil = require("../../utils/wxUser.js");
const wxEnv = require("../../utils/wxEnv.js");

const PACKAGE_TOTAL_YUAN = 500;
/** 与云函数默认头像一致；chooseAvatar 前作为预览占位 */
const DEFAULT_WX_AVATAR =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";
const STEP_MINUTES = [0, 15, 30, 45];
const REMARK_TAGS_A = ["有大件行李", "携带宠物"];
const REMARK_TAGS_B = [
  "赶时间",
  "电话联系",
  "不便接电话",
  "请勿抽烟",
  "有老人",
  "有孕妇",
  "时间可协商",
  "地点可协商",
  "需走高架",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateFromYmd(ymd) {
  const parts = ymd.split("-").map((x) => Number(x));
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function addDays(d, days) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function addMonths(d, months) {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

function ceilToNextStep15(now) {
  const ms = now.getTime();
  const stepMs = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / stepMs) * stepMs);
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfWeekSunday(d) {
  const s = startOfLocalDay(d);
  return addDays(s, -s.getDay());
}

function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function calendarFortnightTitle(firstSunday) {
  const lastDay = addDays(firstSunday, 13);
  const y0 = firstSunday.getFullYear();
  const m0 = firstSunday.getMonth() + 1;
  const y1 = lastDay.getFullYear();
  const m1 = lastDay.getMonth() + 1;
  if (y0 === y1 && m0 === m1) return `${y0}年${m0}月`;
  return `${y0}年${m0}月 / ${y1}年${m1}月`;
}

function formatDateLabel(ymd, baseTodayYmd) {
  const d = dateFromYmd(ymd);
  if (ymd === baseTodayYmd) return "今天";
  const tomorrowYmd = ymdFromDate(addDays(dateFromYmd(baseTodayYmd), 1));
  if (ymd === tomorrowYmd) return "明天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 与 Web Home validDateItems 一致 */
function buildWheelDateItems(min, max) {
  const result = [];
  const minDay = dateFromYmd(ymdFromDate(min));
  const maxDay = dateFromYmd(ymdFromDate(max));
  const baseTodayYmd = ymdFromDate(min);
  for (let d = new Date(minDay); d.getTime() <= maxDay.getTime(); d = addDays(d, 1)) {
    const ymd = ymdFromDate(d);
    const day = dateFromYmd(ymd);
    let hasAny = false;
    for (let h = 0; h <= 23 && !hasAny; h++) {
      for (let mi = 0; mi < STEP_MINUTES.length; mi++) {
        const m = STEP_MINUTES[mi];
        const cand = new Date(day);
        cand.setHours(h, m, 0, 0);
        if (cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime()) {
          hasAny = true;
          break;
        }
      }
    }
    if (hasAny) {
      result.push({ value: ymd, label: formatDateLabel(ymd, baseTodayYmd) });
    }
  }
  return result;
}

/** 与 Web validHourItems 一致 */
function buildWheelHourItems(ymd, min, max) {
  const day = dateFromYmd(ymd);
  const hours = [];
  for (let h = 0; h <= 23; h++) {
    let hasAny = false;
    for (let mi = 0; mi < STEP_MINUTES.length; mi++) {
      const m = STEP_MINUTES[mi];
      const cand = new Date(day);
      cand.setHours(h, m, 0, 0);
      if (cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime()) {
        hasAny = true;
        break;
      }
    }
    if (hasAny) hours.push(h);
  }
  return hours.map((h) => ({ value: h, label: `${h}时` }));
}

/** 与 Web validMinuteItems 一致 */
function buildWheelMinuteItems(ymd, hour, min, max) {
  const day = dateFromYmd(ymd);
  return STEP_MINUTES.filter((m) => {
    const cand = new Date(day);
    cand.setHours(hour, m, 0, 0);
    return cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime();
  }).map((m) => ({ value: m, label: `${pad2(m)}分` }));
}

/** 与 Web WheelColumn：行高 96rpx(h-12)、上下留白 128rpx(py-16) */
function wheelMetricsPx() {
  const ww = wxEnv.readWindowWidthPx();
  return { item: (96 * ww) / 750, pad: (128 * ww) / 750 };
}

function windowInnerHeightPx() {
  return wxEnv.readWindowHeightPx();
}

function computeHeaderPaddingTopPx() {
  return wxEnv.readSafeAreaTopPx() + wxEnv.rpxToPx(8);
}

/** 从微信选址 address 中取「xx市」 */
function extractCityFromAddress(addr) {
  if (!addr || typeof addr !== "string") return "";
  const m = addr.match(/([\u4e00-\u9fa5]{2,}市)/);
  return m ? m[1] : "";
}

/** 选址结果：市 · 地点名/剩余地址 */
function formatChooseLocationPoint(res) {
  const name = (res.name && String(res.name).trim()) || "";
  const address = (res.address && String(res.address).trim()) || "";
  const city = extractCityFromAddress(address);
  if (city && name) return `${city} · ${name}`;
  if (city && address) {
    const tail = address
      .replace(/^[\u4e00-\u9fa5]+省/, "")
      .replace(/^[\u4e00-\u9fa5]{2,}市/, "")
      .replace(/^[，,\s]+/, "");
    const rest = (tail && tail.trim()) || name || address;
    return `${city} · ${rest}`;
  }
  return name || address || "所选位置";
}

/** 逆地理失败时的兜底：坐标文案，避免显示「当前位置」 */
function formatPickupCoordFallback(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "请选择上车地点";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

/** 上车点展示逆地理结果，不用「当前位置」占位 */
function formatPickupLabelFromReverse(r, lat, lng) {
  const rawCity = r && r.cityText != null ? String(r.cityText).trim() : "";
  const cityTok = rawCity ? (rawCity.endsWith("市") ? rawCity : `${rawCity}市`) : "";
  const formatted = r && r.formatted != null ? String(r.formatted).trim() : "";
  if (formatted) {
    if (cityTok && formatted.indexOf(cityTok) === 0) {
      const rest = formatted.slice(cityTok.length).replace(/^[，,\s]+/, "");
      return rest ? `${cityTok} · ${rest}` : formatted;
    }
    if (cityTok) return `${cityTok} · ${formatted}`;
    return formatted;
  }
  if (cityTok) return cityTok;
  return formatPickupCoordFallback(lat, lng);
}

Page({
  data: {
    scrollViewHeight: windowInnerHeightPx(),
    headerPaddingTopPx: computeHeaderPaddingTopPx(),
    profile: null,
    hasUser: false,
    profileSubmitting: false,
    profileDraftAvatar: "",
    profileAvatarPlaceholder: DEFAULT_WX_AVATAR,
    profilePhoneBound: false,
    profilePhoneMasked: "",
    profilePhoneLoading: false,
    locateKind: "loading",
    locateText: "",
    driverLatLng: null,
    pickup: null,
    dropoff: null,
    pickupGeocodeError: "",
    calendarWeekOffset: 0,
    effectiveCalendarWeekOffset: 0,
    maxCalendarWeekOffset: 0,
    calendarCardTitle: "",
    calendarDays: [],
    weekDisabledPrev: true,
    weekDisabledNext: false,
    pricingMode: "package",
    passengers: 1,
    selectedTags: [],
    remarkText: "",
    remarkTagsA: REMARK_TAGS_A,
    remarkTagsB: REMARK_TAGS_B,
    sheet: "",
    selectedDateYmd: "",
    dateStart: "",
    dateEnd: "",
    selectedHour: 0,
    selectedMinute: 0,
    wheelDateItems: [],
    wheelHourItems: [],
    wheelMinuteItems: [],
    wheelScrollTop0: 0,
    wheelScrollTop1: 0,
    wheelScrollTop2: 0,
    wheelScrollAnim: false,
    wheelItemPxNum: 48,
    wheelPadPxNum: 64,
    wheelDisplayDateIdx: 0,
    wheelDisplayHourIdx: 0,
    wheelDisplayMinuteIdx: 0,
    tempQuote: {
      loading: false,
      baseKm: 0,
      deadKm: 0,
      baseYuan: 0,
      emptyYuan: 0,
      totalYuan: 0,
      fallback: true,
    },
    estimatedTotal: PACKAGE_TOTAL_YUAN,
    emptyPrice: 0,
    deposit: 0,
    selectedTimeCardText: "",
    remarkSummary: "无",
    canSubmitBooking: false,
    mapMarkers: [],
    mapPolyline: [],
    mapLat: 31.23,
    mapLng: 121.47,
    mapScale: 12,
    PACKAGE_TOTAL_YUAN,
    opPerKm: geo.TEMP_CHARTER_OPERATING_YUAN_PER_KM,
    deadPerKm: geo.TEMP_CHARTER_DEADHEAD_YUAN_PER_KM,
    deadMul: geo.TEMP_CHARTER_DEADHEAD_MULTIPLIER,
    tempBaseKmStr: "0.0",
    tempDeadKmStr: "0.0",
    tempBaseYuanStr: "0.00",
    tempEmptyYuanStr: "0.00",
    tempTotalYuanStr: "0.00",
    estimatedTotalStr: "500.00",
    emptyPriceStr: "0.00",
    depositStr: "100.00",
    routeLeg1Meters: null,
    routeLeg2Meters: null,
    routeFallback: false,
    routeLoading: false,
    mapIncludePoints: [],
  },

  _timeMin: null,
  _timeMax: null,
  _routeTimer: null,

  onLoad() {
    this.setData({
      scrollViewHeight: Math.max(200, windowInnerHeightPx()),
      headerPaddingTopPx: computeHeaderPaddingTopPx(),
    });
    const loc = draft.loadLocations();
    const ui = draft.loadBookingUi();
    const pricingMode = draft.loadPricingMode();
    if (!getApp().globalData.wxUser || !getApp().globalData.wxUser.nickName) {
      wxUserUtil.hydrateAppFromStorage(getApp());
    }
    this.refreshProfileFromApp();
    this.setData(
      {
        pickup: loc.pickup,
        dropoff: loc.dropoff,
        pricingMode,
        passengers: ui && ui.passengers ? ui.passengers : 1,
        selectedTags: (ui && ui.selectedTags) || [],
        remarkText: (ui && ui.remarkText) || "",
        calendarWeekOffset: (ui && ui.calendarWeekOffset) || 0,
      },
      () => {
        this.updateCalendar();
        this.initTimeRangeFromDraft(ui);
        this.recomputePricing();
        this.scheduleRouteRefresh();
        this.startDriverLocate();
      },
    );
  },

  onShow() {
    this.refreshProfileFromApp();
    this.persistBookingUi();
  },

  onUnload() {
    if (this._routeTimer) {
      clearTimeout(this._routeTimer);
      this._routeTimer = null;
    }
  },

  onResize() {
    this.setData({
      scrollViewHeight: Math.max(200, windowInnerHeightPx()),
      headerPaddingTopPx: computeHeaderPaddingTopPx(),
    });
    if (this.data.sheet === "time" && this.data.wheelDateItems.length) {
      this.syncWheelMetrics();
      const item = this._wheelItemPx;
      const i0 = this.data.wheelDateItems.findIndex((d) => d.value === this.data.selectedDateYmd);
      const i1 = this.data.wheelHourItems.findIndex((h) => h.value === this.data.selectedHour);
      const i2 = this.data.wheelMinuteItems.findIndex((m) => m.value === this.data.selectedMinute);
      this._wheelIgnoreScroll = true;
      this.setData(
        {
          wheelItemPxNum: item,
          wheelPadPxNum: this._wheelPadPx,
          wheelScrollAnim: false,
          wheelScrollTop0: Math.max(0, i0) * item,
          wheelScrollTop1: Math.max(0, i1) * item,
          wheelScrollTop2: Math.max(0, i2) * item,
          wheelDisplayDateIdx: Math.max(0, i0),
          wheelDisplayHourIdx: Math.max(0, i1),
          wheelDisplayMinuteIdx: Math.max(0, i2),
        },
        () => {
          const nt =
            typeof wx !== "undefined" && typeof wx.nextTick === "function"
              ? wx.nextTick
              : (fn) => setTimeout(fn, 0);
          nt(() => {
            this._wheelIgnoreScroll = false;
          });
        },
      );
    }
  },

  refreshProfileFromApp() {
    const app = getApp();
    if (!app.globalData.wxUser || !app.globalData.wxUser.nickName) {
      wxUserUtil.hydrateAppFromStorage(app);
    }
    const u = app.globalData.wxUser;
    const p = app.globalData.profile;
    this.setData({
      profile: p,
      hasUser: !!(u && u.nickName),
    });
    this.recomputePricing();
  },

  onAvatarTap() {
    if (this.data.profileSubmitting || this.data.profilePhoneLoading) return;
    if (this.data.hasUser && this.data.profile) {
      wx.navigateTo({ url: "/pages/me/me" });
      return;
    }
    const app = getApp();
    if (!app.globalData.wxUser || !app.globalData.wxUser.nickName) {
      wxUserUtil.hydrateAppFromStorage(app);
    }
    const u = app.globalData.wxUser;
    const phoneBound = wxUserUtil.isPhoneBound(u);
    this.setData({
      sheet: "profile",
      profileDraftAvatar: "",
      profilePhoneBound: phoneBound,
      profilePhoneMasked: (u && u.phoneMasked) || "",
    });
    if (!phoneBound) {
      api
        .userGet({ silent: true })
        .then((r) => {
          const pm = r && r.profile && r.profile.phoneMasked;
          if (pm && String(pm).trim() && String(pm).trim() !== "—") {
            const prev = wxUserUtil.readWxUserFromStorage() || {};
            const next = { ...prev, phoneMasked: String(pm).trim() };
            wxUserUtil.saveWxUserToStorage(next);
            app.globalData.wxUser = next;
            this.setData({ profilePhoneBound: true, profilePhoneMasked: next.phoneMasked });
          }
        })
        .catch(() => {});
    }
  },

  onProfileGetPhoneNumber(e) {
    const d = e.detail || {};
    if (d.errno === 1400001) {
      wx.showToast({ title: "验证次数已达上限", icon: "none" });
      return;
    }
    const errMsg = String(d.errMsg || "");
    const code = d.code;
    if (code) {
      this._submitPhoneCode(String(code));
      return;
    }
    if (errMsg.indexOf("getPhoneNumber:ok") === 0) {
      wx.showToast({
        title: "未返回授权码，请用真机重试或在后台配置隐私指引",
        icon: "none",
      });
      return;
    }
    if (
      errMsg.indexOf("拒绝") !== -1 ||
      errMsg.indexOf("deny") !== -1 ||
      errMsg.indexOf("cancel") !== -1
    ) {
      wx.showToast({ title: "需授权手机号之后才能设置头像昵称", icon: "none" });
      return;
    }
    const tip =
      errMsg.length > 40 ? `${errMsg.slice(0, 40)}…` : errMsg || "获取手机号失败";
    wx.showToast({ title: tip, icon: "none" });
  },

  _submitPhoneCode(code) {
    this.setData({ profilePhoneLoading: true });
    api
      .userBindPhone({ code }, { silent: false })
      .then((r) => {
        const masked = (r.profile && r.profile.phoneMasked) || "—";
        const app = getApp();
        const prev = wxUserUtil.readWxUserFromStorage() || app.globalData.wxUser || {};
        const next = { ...prev, phoneMasked: masked };
        wxUserUtil.saveWxUserToStorage(next);
        app.globalData.wxUser = next;
        if (app.globalData.profile && app.globalData.profile.displayName) {
          app.globalData.profile = wxUserUtil.wxUserToDisplayProfile(next);
        }
        this.setData({
          profilePhoneBound: true,
          profilePhoneMasked: masked,
          profilePhoneLoading: false,
          profile: app.globalData.profile || this.data.profile,
        });
        wx.showToast({ title: "手机号已验证", icon: "success" });
      })
      .catch((err) => {
        this.setData({ profilePhoneLoading: false });
        wx.showToast({ title: (err && err.message) || "换取手机号失败", icon: "none" });
      });
  },

  onTitleTap() {
    if (this.data.hasUser && this.data.profile) {
      wx.navigateTo({ url: "/pages/me/me" });
    }
  },

  onProfileChooseAvatar(e) {
    const { avatarUrl } = e.detail || {};
    if (avatarUrl) {
      this.setData({ profileDraftAvatar: avatarUrl });
    }
  },

  onProfileFormSubmit(e) {
    if (this.data.profileSubmitting || !this.data.profilePhoneBound) return;
    const fromForm = (e.detail && e.detail.value) || {};
    const nickName = String(fromForm.nickName || "").trim();
    const avatarPath = this.data.profileDraftAvatar;
    if (!nickName) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }
    if (!avatarPath) {
      wx.showToast({ title: "请选择头像", icon: "none" });
      return;
    }
    this.persistProfileFromAvatarNickname(nickName, avatarPath);
  },

  /** chooseAvatar 临时路径上传云存储（失败则本地 saveFile），再写入本地与 user.upsert */
  persistProfileFromAvatarNickname(nickName, avatarTempPath) {
    this.setData({ profileSubmitting: true });
    const applyUser = (avatarUrl) => {
      const app = getApp();
      const prev = wxUserUtil.readWxUserFromStorage() || app.globalData.wxUser || {};
      const u = {
        ...prev,
        nickName,
        avatarUrl: avatarUrl || "",
      };
      app.globalData.wxUser = u;
      app.globalData.profile = wxUserUtil.wxUserToDisplayProfile(u);
      wxUserUtil.saveWxUserToStorage(u);
      this.setData({
        profile: app.globalData.profile,
        hasUser: true,
        profileSubmitting: false,
        sheet: "",
        profileDraftAvatar: "",
      });
      this.recomputePricing();
      wx.showToast({ title: "已保存", icon: "success" });
      api
        .userUpsert(
          {
            displayName: nickName || "微信用户",
            avatarUrl: u.avatarUrl || "",
            phoneMasked: u.phoneMasked != null ? String(u.phoneMasked) : "—",
          },
          { silent: true },
        )
        .catch(() => {});
    };
    const failUpload = () => {
      this.setData({ profileSubmitting: false });
      wx.showToast({ title: "头像保存失败，请重试", icon: "none" });
    };
    if (typeof avatarTempPath === "string" && avatarTempPath.indexOf("cloud://") === 0) {
      applyUser(avatarTempPath);
      return;
    }
    const trySaveLocal = () => {
      wx.getFileSystemManager().saveFile({
        tempFilePath: avatarTempPath,
        success: (res) => applyUser(res.savedFilePath),
        fail: failUpload,
      });
    };
    if (typeof wx.cloud !== "undefined" && typeof wx.cloud.uploadFile === "function") {
      wx.cloud.uploadFile({
        cloudPath: `user_avatars/${Date.now()}.jpg`,
        filePath: avatarTempPath,
        success: (res) => applyUser(res.fileID),
        fail: () => trySaveLocal(),
      });
    } else {
      trySaveLocal();
    }
  },

  retryLocate() {
    this.startDriverLocate();
  },

  startDriverLocate() {
    this.setData({ locateKind: "loading", locateText: "" });
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: (res) => {
        const ll = { lat: res.latitude, lng: res.longitude };
        this.setData({
          driverLatLng: ll,
          locateKind: "loading",
          locateText: "定位中",
          pickupGeocodeError: "",
        });
        const hadPickup = !!this.data.pickup;
        if (!hadPickup) {
          this.setData({ pickup: { label: "定位中…", latLng: ll } }, () => {
            draft.saveLocations(this.data.pickup, this.data.dropoff);
          });
          api
            .mapReverse({ lat: ll.lat, lng: ll.lng }, { silent: true })
            .then((geo) => {
              const label = formatPickupLabelFromReverse(geo, ll.lat, ll.lng);
              this.setData({ pickup: { label, latLng: ll } }, () => {
                draft.saveLocations(this.data.pickup, this.data.dropoff);
              });
            })
            .catch(() => {
              this.setData({ pickup: { label: formatPickupCoordFallback(ll.lat, ll.lng), latLng: ll } }, () => {
                draft.saveLocations(this.data.pickup, this.data.dropoff);
              });
            });
        }
        this.recomputePricing();
        this.scheduleRouteRefresh();
      },
      fail: () => {
        this.setData({
          locateKind: "error",
          locateText: "",
          driverLatLng: null,
        });
        this.recomputePricing();
        this.scheduleRouteRefresh();
      },
    });
  },

  updateCalendar() {
    const calendarToday = startOfLocalDay(new Date());
    const calendarRangeEnd = addDays(calendarToday, 30);
    const calendarWeek0Sunday = startOfWeekSunday(calendarToday);
    const calendarLastWeekSunday = startOfWeekSunday(calendarRangeEnd);
    const maxCalendarWeekOffset = Math.max(
      0,
      Math.round(
        (calendarLastWeekSunday.getTime() - calendarWeek0Sunday.getTime()) / (7 * 24 * 60 * 60 * 1000),
      ),
    );
    let offset = Math.min(Math.max(0, this.data.calendarWeekOffset), maxCalendarWeekOffset);
    if (offset !== this.data.calendarWeekOffset) {
      this.setData({ calendarWeekOffset: offset });
    }
    const displayWeekSunday = addDays(calendarWeek0Sunday, 7 * offset);
    const title = calendarFortnightTitle(displayWeekSunday);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const day = addDays(displayWeekSunday, i);
      const ymd = ymdFromDate(day);
      const d0 = startOfLocalDay(day).getTime();
      const t0 = calendarToday.getTime();
      const t1 = calendarRangeEnd.getTime();
      const inBookingWindow = d0 >= t0 && d0 <= t1;
      const isToday = sameLocalDay(day, calendarToday);
      let sub = "";
      if (inBookingWindow && !isToday) {
        sub = day.getDate() % 3 !== 0 ? "已约" : "可约";
      }
      days.push({
        key: ymd,
        dateNum: day.getDate(),
        inBookingWindow,
        isToday,
        sub,
        muted: !inBookingWindow,
      });
    }
    this.setData({
      calendarCardTitle: title,
      calendarDays: days,
      maxCalendarWeekOffset,
      effectiveCalendarWeekOffset: offset,
      weekDisabledPrev: offset <= 0,
      weekDisabledNext: offset >= maxCalendarWeekOffset,
    });
  },

  onWeekPrev() {
    const o = Math.max(0, this.data.effectiveCalendarWeekOffset - 1);
    this.setData({ calendarWeekOffset: o }, () => {
      this.updateCalendar();
      this.persistBookingUi();
    });
  },

  onWeekNext() {
    const o = Math.min(
      this.data.maxCalendarWeekOffset,
      this.data.effectiveCalendarWeekOffset + 1,
    );
    this.setData({ calendarWeekOffset: o }, () => {
      this.updateCalendar();
      this.persistBookingUi();
    });
  },

  initTimeRangeFromDraft(ui) {
    const now = new Date();
    const min = ceilToNextStep15(now);
    const max = addMonths(min, 1);
    this._timeMin = min;
    this._timeMax = max;
    let ymd = ymdFromDate(min);
    let hour = min.getHours();
    let minute = min.getMinutes();
    if (ui && ui.departureAt) {
      const cand = new Date(ui.departureAt);
      const step = 15 * 60 * 1000;
      const aligned = new Date(Math.ceil(cand.getTime() / step) * step);
      if (aligned.getTime() >= min.getTime() && aligned.getTime() <= max.getTime()) {
        ymd = ymdFromDate(aligned);
        hour = aligned.getHours();
        minute = aligned.getMinutes();
      }
    }
    this.setData({ selectedDateYmd: ymd, selectedHour: hour, selectedMinute: minute }, () =>
      this.rebuildTimeWheel(),
    );
  },

  refreshTimeRangeForSheet() {
    const now = new Date();
    const min = ceilToNextStep15(now);
    const max = addMonths(min, 1);
    this._timeMin = min;
    this._timeMax = max;
    const ds = ymdFromDate(min);
    const de = ymdFromDate(max);
    let ymd = this.data.selectedDateYmd || ds;
    if (ymd < ds) ymd = ds;
    if (ymd > de) ymd = de;
    this.setData({ selectedDateYmd: ymd }, () => this.rebuildTimeWheel());
  },

  syncWheelMetrics() {
    const m = wheelMetricsPx();
    this._wheelItemPx = m.item;
    this._wheelPadPx = m.pad;
    return m;
  },

  rebuildTimeWheel() {
    const min = this._timeMin;
    const max = this._timeMax;
    if (!min || !max) {
      this.setData({
        wheelDateItems: [],
        wheelHourItems: [],
        wheelMinuteItems: [],
        wheelScrollTop0: 0,
        wheelScrollTop1: 0,
        wheelScrollTop2: 0,
        wheelDisplayDateIdx: 0,
        wheelDisplayHourIdx: 0,
        wheelDisplayMinuteIdx: 0,
        selectedTimeCardText: "",
      });
      return;
    }
    const dateItems = buildWheelDateItems(min, max);
    if (!dateItems.length) {
      this.setData({
        wheelDateItems: [],
        wheelHourItems: [],
        wheelMinuteItems: [],
        wheelScrollTop0: 0,
        wheelScrollTop1: 0,
        wheelScrollTop2: 0,
        wheelDisplayDateIdx: 0,
        wheelDisplayHourIdx: 0,
        wheelDisplayMinuteIdx: 0,
        selectedTimeCardText: "",
      });
      return;
    }
    let ymd = this.data.selectedDateYmd;
    if (!dateItems.some((d) => d.value === ymd)) ymd = dateItems[0].value;

    const hourItems = buildWheelHourItems(ymd, min, max);
    if (!hourItems.length) {
      this.setData({ selectedTimeCardText: "" });
      return;
    }
    let hour = this.data.selectedHour;
    if (!hourItems.some((h) => h.value === hour)) hour = hourItems[0].value;

    const minuteItems = buildWheelMinuteItems(ymd, hour, min, max);
    if (!minuteItems.length) {
      this.setData({ selectedTimeCardText: "" });
      return;
    }
    let minute = this.data.selectedMinute;
    if (!minuteItems.some((m) => m.value === minute)) minute = minuteItems[0].value;

    const i0 = dateItems.findIndex((d) => d.value === ymd);
    const i1 = hourItems.findIndex((h) => h.value === hour);
    const i2 = minuteItems.findIndex((m) => m.value === minute);

    const m = this.syncWheelMetrics();
    const item = m.item;
    this._wheelIgnoreScroll = true;
    this.setData(
      {
        wheelDateItems: dateItems,
        wheelHourItems: hourItems,
        wheelMinuteItems: minuteItems,
        selectedDateYmd: ymd,
        selectedHour: hour,
        selectedMinute: minute,
        dateStart: ymdFromDate(min),
        dateEnd: ymdFromDate(max),
        wheelItemPxNum: item,
        wheelPadPxNum: m.pad,
        wheelScrollAnim: false,
        wheelScrollTop0: i0 * item,
        wheelScrollTop1: i1 * item,
        wheelScrollTop2: i2 * item,
        wheelDisplayDateIdx: i0,
        wheelDisplayHourIdx: i1,
        wheelDisplayMinuteIdx: i2,
      },
      () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
        this.applySelectedDeparture();
      },
    );
  },

  onWheelScrollDate(e) {
    if (this._wheelIgnoreScroll) return;
    const item = this._wheelItemPx;
    const n = this.data.wheelDateItems.length;
    if (item && n) {
      let di = Math.round(e.detail.scrollTop / item);
      if (di < 0) di = 0;
      if (di >= n) di = n - 1;
      if (di !== this.data.wheelDisplayDateIdx) {
        this.setData({ wheelDisplayDateIdx: di });
      }
    }
    this._wheelLastScroll0 = e.detail.scrollTop;
    if (this._wheelDeb0) clearTimeout(this._wheelDeb0);
    this._wheelDeb0 = setTimeout(() => {
      this._wheelDeb0 = null;
      this.finalizeWheelDate(this._wheelLastScroll0);
    }, 80);
  },

  onWheelScrollHour(e) {
    if (this._wheelIgnoreScroll) return;
    const item = this._wheelItemPx;
    const n = this.data.wheelHourItems.length;
    if (item && n) {
      let hi = Math.round(e.detail.scrollTop / item);
      if (hi < 0) hi = 0;
      if (hi >= n) hi = n - 1;
      if (hi !== this.data.wheelDisplayHourIdx) {
        this.setData({ wheelDisplayHourIdx: hi });
      }
    }
    this._wheelLastScroll1 = e.detail.scrollTop;
    if (this._wheelDeb1) clearTimeout(this._wheelDeb1);
    this._wheelDeb1 = setTimeout(() => {
      this._wheelDeb1 = null;
      this.finalizeWheelHour(this._wheelLastScroll1);
    }, 80);
  },

  onWheelScrollMinute(e) {
    if (this._wheelIgnoreScroll) return;
    const item = this._wheelItemPx;
    const n = this.data.wheelMinuteItems.length;
    if (item && n) {
      let mi = Math.round(e.detail.scrollTop / item);
      if (mi < 0) mi = 0;
      if (mi >= n) mi = n - 1;
      if (mi !== this.data.wheelDisplayMinuteIdx) {
        this.setData({ wheelDisplayMinuteIdx: mi });
      }
    }
    this._wheelLastScroll2 = e.detail.scrollTop;
    if (this._wheelDeb2) clearTimeout(this._wheelDeb2);
    this._wheelDeb2 = setTimeout(() => {
      this._wheelDeb2 = null;
      this.finalizeWheelMinute(this._wheelLastScroll2);
    }, 80);
  },

  finalizeWheelDate(st) {
    const item = this._wheelItemPx;
    const dateItems = this.data.wheelDateItems;
    if (!item || !dateItems.length) return;
    const n = dateItems.length;
    let idx = Math.round(st / item);
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    const target = idx * item;
    if (Math.abs(st - target) > 0.5) {
      this._wheelIgnoreScroll = true;
      this.setData({ wheelScrollTop0: target, wheelScrollAnim: false, wheelDisplayDateIdx: idx }, () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
      });
    }
    const ymd = dateItems[idx].value;
    if (ymd !== this.data.selectedDateYmd) {
      this.applyDateIndexChange(idx);
    }
  },

  finalizeWheelHour(st) {
    const item = this._wheelItemPx;
    const hourItems = this.data.wheelHourItems;
    if (!item || !hourItems.length) return;
    const n = hourItems.length;
    let idx = Math.round(st / item);
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    const target = idx * item;
    if (Math.abs(st - target) > 0.5) {
      this._wheelIgnoreScroll = true;
      this.setData({ wheelScrollTop1: target, wheelScrollAnim: false, wheelDisplayHourIdx: idx }, () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
      });
    }
    const hour = hourItems[idx].value;
    if (hour !== this.data.selectedHour) {
      this.applyHourIndexChange(idx);
    }
  },

  finalizeWheelMinute(st) {
    const item = this._wheelItemPx;
    const minuteItems = this.data.wheelMinuteItems;
    if (!item || !minuteItems.length) return;
    const n = minuteItems.length;
    let idx = Math.round(st / item);
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    const target = idx * item;
    if (Math.abs(st - target) > 0.5) {
      this._wheelIgnoreScroll = true;
      this.setData({ wheelScrollTop2: target, wheelScrollAnim: false, wheelDisplayMinuteIdx: idx }, () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
      });
    }
    const minute = minuteItems[idx].value;
    if (minute !== this.data.selectedMinute) {
      this.setData({ selectedMinute: minute }, () => this.applySelectedDeparture());
    }
  },

  applyDateIndexChange(idx) {
    const min = this._timeMin;
    const max = this._timeMax;
    const dateItems = this.data.wheelDateItems;
    if (!min || !max || !dateItems[idx]) return;
    const ymd = dateItems[idx].value;
    const hourItems = buildWheelHourItems(ymd, min, max);
    if (!hourItems.length) return;
    let hour = this.data.selectedHour;
    if (!hourItems.some((h) => h.value === hour)) hour = hourItems[0].value;
    const minuteItems = buildWheelMinuteItems(ymd, hour, min, max);
    if (!minuteItems.length) return;
    let minute = this.data.selectedMinute;
    if (!minuteItems.some((m) => m.value === minute)) minute = minuteItems[0].value;
    const i1 = hourItems.findIndex((h) => h.value === hour);
    const i2 = minuteItems.findIndex((m) => m.value === minute);
    const item = this._wheelItemPx;
    this._wheelIgnoreScroll = true;
    this.setData(
      {
        selectedDateYmd: ymd,
        selectedHour: hour,
        selectedMinute: minute,
        wheelHourItems: hourItems,
        wheelMinuteItems: minuteItems,
        wheelScrollAnim: false,
        wheelScrollTop1: i1 * item,
        wheelScrollTop2: i2 * item,
        wheelDisplayDateIdx: idx,
        wheelDisplayHourIdx: i1,
        wheelDisplayMinuteIdx: i2,
      },
      () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
        this.applySelectedDeparture();
      },
    );
  },

  applyHourIndexChange(idx) {
    const min = this._timeMin;
    const max = this._timeMax;
    const hourItems = this.data.wheelHourItems;
    const ymd = this.data.selectedDateYmd;
    if (!min || !max || !hourItems[idx]) return;
    const hour = hourItems[idx].value;
    const minuteItems = buildWheelMinuteItems(ymd, hour, min, max);
    if (!minuteItems.length) return;
    let minute = this.data.selectedMinute;
    if (!minuteItems.some((m) => m.value === minute)) minute = minuteItems[0].value;
    const i2 = minuteItems.findIndex((m) => m.value === minute);
    const item = this._wheelItemPx;
    this._wheelIgnoreScroll = true;
    this.setData(
      {
        selectedHour: hour,
        selectedMinute: minute,
        wheelMinuteItems: minuteItems,
        wheelScrollAnim: false,
        wheelScrollTop2: i2 * item,
        wheelDisplayHourIdx: idx,
        wheelDisplayMinuteIdx: i2,
      },
      () => {
        const nt =
          typeof wx !== "undefined" && typeof wx.nextTick === "function"
            ? wx.nextTick
            : (fn) => setTimeout(fn, 0);
        nt(() => {
          this._wheelIgnoreScroll = false;
        });
        this.applySelectedDeparture();
      },
    );
  },

  onWheelDateTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const item = this._wheelItemPx;
    const dateItems = this.data.wheelDateItems;
    if (!dateItems[idx]) return;
    this._wheelIgnoreScroll = true;
    this.setData(
      { wheelScrollTop0: idx * item, wheelScrollAnim: true, wheelDisplayDateIdx: idx },
      () => {
        setTimeout(() => {
          this._wheelIgnoreScroll = false;
        }, 280);
      },
    );
    if (dateItems[idx].value !== this.data.selectedDateYmd) {
      this.applyDateIndexChange(idx);
    }
  },

  onWheelHourTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const item = this._wheelItemPx;
    const hourItems = this.data.wheelHourItems;
    if (!hourItems[idx]) return;
    this._wheelIgnoreScroll = true;
    this.setData(
      { wheelScrollTop1: idx * item, wheelScrollAnim: true, wheelDisplayHourIdx: idx },
      () => {
        setTimeout(() => {
          this._wheelIgnoreScroll = false;
        }, 280);
      },
    );
    if (hourItems[idx].value !== this.data.selectedHour) {
      this.applyHourIndexChange(idx);
    }
  },

  onWheelMinuteTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const item = this._wheelItemPx;
    const minuteItems = this.data.wheelMinuteItems;
    if (!minuteItems[idx]) return;
    this._wheelIgnoreScroll = true;
    this.setData(
      { wheelScrollTop2: idx * item, wheelScrollAnim: true, wheelDisplayMinuteIdx: idx },
      () => {
        setTimeout(() => {
          this._wheelIgnoreScroll = false;
        }, 280);
      },
    );
    if (minuteItems[idx].value !== this.data.selectedMinute) {
      this.setData({ selectedMinute: minuteItems[idx].value }, () => this.applySelectedDeparture());
    }
  },

  applySelectedDeparture() {
    const ymd = this.data.selectedDateYmd;
    const hour = this.data.selectedHour;
    const minute = this.data.selectedMinute;
    if (!ymd || !this._timeMin) {
      this.setData({ selectedTimeCardText: "" });
      return;
    }
    const baseTodayYmd = ymdFromDate(this._timeMin);
    const dl = formatDateLabel(ymd, baseTodayYmd);
    this.setData({ selectedTimeCardText: `${dl} ${pad2(hour)}:${pad2(minute)}` });
    this.persistBookingUi();
  },

  persistBookingUi() {
    if (!this._timeMin || !this.data.selectedDateYmd) return;
    const ymd = this.data.selectedDateYmd;
    const hh = this.data.selectedHour;
    const mm = this.data.selectedMinute;
    const d = dateFromYmd(ymd);
    d.setHours(hh, mm, 0, 0);
    draft.saveBookingUi({
      version: 1,
      departureAt: d.getTime(),
      calendarWeekOffset: this.data.calendarWeekOffset,
      passengers: this.data.passengers,
      selectedTags: this.data.selectedTags,
      remarkText: this.data.remarkText,
    });
  },

  persistLocations() {
    draft.saveLocations(this.data.pickup, this.data.dropoff);
  },

  openChooseLocation(role) {
    wx.chooseLocation({
      success: (res) => {
        const label = formatChooseLocationPoint(res);
        const point = { label, latLng: { lat: res.latitude, lng: res.longitude } };
        if (role === "pickup") {
          this.setData({ pickup: point, pickupGeocodeError: "" });
        } else {
          this.setData({ dropoff: point });
        }
        this.persistLocations();
        this.recomputePricing();
        this.scheduleRouteRefresh();
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("cancel") !== -1 || msg.indexOf("fail cancel") !== -1) return;
        if (msg.indexOf("auth deny") !== -1 || msg.indexOf("permission") !== -1) {
          wx.showToast({ title: "请在设置中开启位置权限", icon: "none" });
          return;
        }
        wx.showToast({ title: "未选择地点", icon: "none" });
      },
    });
  },

  onPickupTap() {
    this.openChooseLocation("pickup");
  },

  onDropoffTap() {
    this.openChooseLocation("dropoff");
  },

  openSheet(e) {
    const sheet = e.currentTarget.dataset.sheet;
    if (sheet === "time") {
      this.refreshTimeRangeForSheet();
    }
    this.updateRemarkSummary();
    this.setData({ sheet });
  },

  closeSheet() {
    this.setData({ sheet: "", profilePhoneLoading: false });
  },

  onSheetPageContainerBeforeLeave() {
    this.closeSheet();
  },

  preventMove() {},

  onMaskTap() {
    this.closeSheet();
  },

  onPricingPackage() {
    this.setData({ pricingMode: "package" });
    draft.savePricingMode("package");
    this.recomputePricing();
  },

  onPricingTemp() {
    this.setData({ pricingMode: "temporary" });
    draft.savePricingMode("temporary");
    this.recomputePricing();
  },

  recomputePricing() {
    const {
      pricingMode,
      pickup,
      dropoff,
      driverLatLng,
      hasUser,
      routeLeg1Meters,
      routeLeg2Meters,
      routeLoading,
      routeFallback,
    } = this.data;
    let tempQuote = {
      loading: false,
      baseKm: 0,
      deadKm: 0,
      baseYuan: 0,
      emptyYuan: 0,
      totalYuan: 0,
      fallback: false,
    };
    if (pricingMode === "temporary" && pickup && pickup.latLng && dropoff && dropoff.latLng) {
      let opM = geo.haversineMeters(pickup.latLng, dropoff.latLng);
      let fallback = false;
      if (routeLeg2Meters != null && routeLeg2Meters > 0) {
        opM = routeLeg2Meters;
      } else {
        fallback = true;
      }
      let deadM = 0;
      if (driverLatLng && pickup.latLng) {
        deadM = geo.haversineMeters(driverLatLng, pickup.latLng);
        if (routeLeg1Meters != null && routeLeg1Meters > 0) {
          deadM = routeLeg1Meters;
        } else {
          fallback = true;
        }
      }
      if (routeFallback) fallback = true;
      const q = geo.estimateTemporaryCharterYuan(opM, deadM);
      tempQuote = { loading: routeLoading, ...q, fallback };
    }
    const estimatedTotal =
      pricingMode === "package" ? PACKAGE_TOTAL_YUAN : tempQuote.totalYuan;
    const emptyPrice = pricingMode === "package" ? 0 : tempQuote.emptyYuan;
    const deposit = Math.round(Math.max(estimatedTotal * 0.2, emptyPrice) * 100) / 100;
    const canSubmit =
      !!hasUser &&
      (pricingMode === "package" ? !!(pickup && pickup.latLng) : !!(pickup && pickup.latLng && dropoff && dropoff.latLng));
    this.setData({
      tempQuote,
      tempBaseKmStr: tempQuote.baseKm.toFixed(1),
      tempDeadKmStr: tempQuote.deadKm.toFixed(1),
      tempBaseYuanStr: tempQuote.baseYuan.toFixed(2),
      tempEmptyYuanStr: tempQuote.emptyYuan.toFixed(2),
      tempTotalYuanStr: tempQuote.totalYuan.toFixed(2),
      estimatedTotal,
      estimatedTotalStr: estimatedTotal.toFixed(2),
      emptyPriceStr: emptyPrice.toFixed(2),
      depositStr: deposit.toFixed(2),
      emptyPrice,
      deposit,
      canSubmitBooking: canSubmit,
    });
  },

  scheduleRouteRefresh() {
    if (this._routeTimer) {
      clearTimeout(this._routeTimer);
      this._routeTimer = null;
    }
    this._routeTimer = setTimeout(() => {
      this._routeTimer = null;
      this.refreshRoutesNow();
    }, 320);
  },

  refreshRoutesNow() {
    const { driverLatLng, pickup, dropoff } = this.data;
    const pickupLatLng = pickup && pickup.latLng ? pickup.latLng : null;
    const dropoffLatLng = dropoff && dropoff.latLng ? dropoff.latLng : null;
    if (!driverLatLng && !pickupLatLng) {
      this.applyRouteData(null);
      return;
    }
    this.setData({ routeLoading: true }, () => this.recomputePricing());
    api
      .mapRoutes(
        {
          driverLatLng: driverLatLng || null,
          pickupLatLng,
          dropoffLatLng,
        },
        { silent: true },
      )
      .then((r) => this.applyRouteData(r))
      .catch(() => this.applyRouteData(null));
  },

  applyRouteData(r) {
    const { driverLatLng, pickup, dropoff, locateKind } = this.data;
    const pickupLatLng = pickup && pickup.latLng ? pickup.latLng : null;
    const dropoffLatLng = dropoff && dropoff.latLng ? dropoff.latLng : null;

    let cityText = "";
    let leg1Meters = null;
    let leg2Meters = null;
    let leg1Points = [];
    let leg2Points = [];
    let routeFallback = true;

    if (r && r.ok !== false) {
      cityText = (r.cityText && String(r.cityText).trim()) || "";
      leg1Meters = typeof r.leg1Meters === "number" ? r.leg1Meters : null;
      leg2Meters = typeof r.leg2Meters === "number" ? r.leg2Meters : null;
      leg1Points = Array.isArray(r.leg1Points) ? r.leg1Points : [];
      leg2Points = Array.isArray(r.leg2Points) ? r.leg2Points : [];
      routeFallback = !!r.fallback;
    }

    let nextLocateKind = locateKind;
    let nextLocateText = this.data.locateText;
    if (locateKind !== "error") {
      if (driverLatLng) {
        nextLocateKind = "city";
        const ct = (cityText && String(cityText).trim()) || "";
        nextLocateText = ct ? (ct.endsWith("市") ? ct : `${ct}市`) : "已定位";
      }
    }

    const ctx = mapBuild.buildMapContext({
      driverLatLng,
      pickupLatLng,
      dropoffLatLng,
      leg1Points,
      leg2Points,
    });

    this.setData(
      {
        routeLoading: false,
        routeLeg1Meters: leg1Meters,
        routeLeg2Meters: leg2Meters,
        routeFallback,
        locateKind: nextLocateKind,
        locateText: nextLocateText,
        mapMarkers: ctx.markers,
        mapPolyline: ctx.polyline,
        mapLat: ctx.mapLat,
        mapLng: ctx.mapLng,
        mapScale: ctx.scale,
        mapIncludePoints: ctx.includePoints,
      },
      () => this.recomputePricing(),
    );
  },

  onPassengerMinus() {
    const n = Math.max(1, this.data.passengers - 1);
    this.setData({ passengers: n }, () => this.persistBookingUi());
  },

  onPassengerPlus() {
    const n = Math.min(4, this.data.passengers + 1);
    this.setData({ passengers: n }, () => this.persistBookingUi());
  },

  onPassengerQuick(e) {
    const n = Number(e.currentTarget.dataset.n);
    this.setData({ passengers: n }, () => this.persistBookingUi());
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const arr = [...this.data.selectedTags];
    const i = arr.indexOf(tag);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(tag);
    this.setData({ selectedTags: arr }, () => {
      this.persistBookingUi();
      this.updateRemarkSummary();
    });
  },

  onRemarkInput(e) {
    this.setData({ remarkText: e.detail.value }, () => {
      this.persistBookingUi();
      this.updateRemarkSummary();
    });
  },

  updateRemarkSummary() {
    const parts = [...this.data.selectedTags];
    if (this.data.remarkText.trim()) parts.push(this.data.remarkText.trim());
    this.setData({ remarkSummary: parts.length ? parts.join("、") : "无" });
  },

  onConfirmDeposit() {
    if (!this.data.canSubmitBooking || !this.data.pickup || !this.data.pickup.latLng) return;
    const remarkParts = [...this.data.selectedTags];
    if (this.data.remarkText.trim()) remarkParts.push(this.data.remarkText.trim());
    const remark = remarkParts.join("、");
    const clientOrderId = `HC${Date.now()}`;
    const tq = this.data.tempQuote;
    const payload = {
      clientOrderId,
      pickup: {
        label: this.data.pickup.label,
        latLng: { ...this.data.pickup.latLng },
      },
      dropoff: this.data.dropoff
        ? { label: this.data.dropoff.label, latLng: { ...this.data.dropoff.latLng } }
        : null,
      driverLatLng: this.data.driverLatLng ? { ...this.data.driverLatLng } : null,
      useTime: this.data.selectedTimeCardText || "待定",
      remark,
      pricingMode: this.data.pricingMode,
      estimatedTotalYuan: this.data.estimatedTotal,
      depositPaidYuan: this.data.deposit,
      passengers: this.data.passengers,
      vehicleLabel:
        this.data.pricingMode === "package"
          ? "商务7座 · 丰田埃尔法或同级（8h/200km 套餐）"
          : "商务7座 · 丰田埃尔法或同级（临时包车）",
      tempFeeDetail:
        this.data.pricingMode === "temporary"
          ? {
              baseYuan: tq.baseYuan,
              emptyYuan: tq.emptyYuan,
              baseKm: tq.baseKm,
              deadKm: tq.deadKm,
            }
          : undefined,
    };
    try {
      wx.setStorageSync("__booking_submit_pending", payload);
    } catch (e) {
      wx.showToast({ title: "存储失败", icon: "none" });
      return;
    }
    draft.clearBookingUi();
    this.setData({
      sheet: "",
      selectedTags: [],
      remarkText: "",
      remarkSummary: "无",
    });
    wx.navigateTo({ url: "/pages/booking-result/booking-result" });
  },
});
