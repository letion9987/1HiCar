import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomSheet from "../components/BottomSheet";
import HomeMapPreview, { type MapPoint } from "../components/HomeMapPreview";
import { useUserSession } from "../contexts/UserSessionContext";
import WheelColumn from "../components/WheelColumn";
import {
  loadHomeLocationsDraft,
  saveHomeLocationsDraft,
} from "../services/homeLocationsDraft";
import {
  alignDepartureMinuteToStep,
  clearHomeBookingUiDraft,
  loadHomeBookingUiDraft,
  saveHomeBookingUiDraft,
} from "../services/homeBookingUiDraft";
import { loadHomePricingMode, saveHomePricingMode } from "../services/homePricingModeDraft";
import {
  describeTencentGeocoderError,
  reverseGeocodeLabels,
} from "../services/tencentGeocode";
import { getDrivingDistanceMeters } from "../services/tencentDrivingWeb";
import {
  estimateTemporaryCharterYuan,
  TEMP_CHARTER_DEADHEAD_MULTIPLIER,
  TEMP_CHARTER_DEADHEAD_YUAN_PER_KM,
  TEMP_CHARTER_OPERATING_YUAN_PER_KM,
} from "../services/temporaryCharterPricing";
import { haversineMeters } from "../utils/geoDistance";
import type { BookingSubmitState } from "../types/booking";

type PricingMode = "package" | "temporary";

type TempQuote = {
  loading: boolean;
  baseKm: number;
  deadKm: number;
  baseYuan: number;
  emptyYuan: number;
  totalYuan: number;
  fallback: boolean;
};

const EMPTY_TEMP_QUOTE: TempQuote = {
  loading: false,
  baseKm: 0,
  deadKm: 0,
  baseYuan: 0,
  emptyYuan: 0,
  totalYuan: 0,
  fallback: false,
};

const remarkTagsA = ["有大件行李", "携带宠物"];
const remarkTagsB = [
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

const STEP_MINUTES = [0, 15, 30, 45] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateFromYmd(ymd: string) {
  const [y, m, day] = ymd.split("-").map((x) => Number(x));
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function addMonths(d: Date, months: number) {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

function ceilToNextStep15(now: Date) {
  const ms = now.getTime();
  const stepMs = 15 * 60 * 1000;
  // If already aligned, keep it; otherwise ceil to next 15-min boundary.
  const rounded = Math.ceil(ms / stepMs) * stepMs;
  return new Date(rounded);
}

function formatDateLabel(ymd: string, baseTodayYmd: string) {
  const d = dateFromYmd(ymd);
  if (ymd === baseTodayYmd) return "今天";
  const tomorrowYmd = ymdFromDate(addDays(dateFromYmd(baseTodayYmd), 1));
  if (ymd === tomorrowYmd) return "明天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 本地自然日 0 点 */
function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** 以周日为一周起始（与「日一二三四五六」表头一致） */
function startOfWeekSunday(d: Date) {
  const s = startOfLocalDay(d);
  return addDays(s, -s.getDay());
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 日历卡片展示连续 14 天时的标题（与肩头两行周视图一致） */
function calendarFortnightTitle(firstSunday: Date) {
  const lastDay = addDays(firstSunday, 13);
  const y0 = firstSunday.getFullYear();
  const m0 = firstSunday.getMonth() + 1;
  const y1 = lastDay.getFullYear();
  const m1 = lastDay.getMonth() + 1;
  if (y0 === y1 && m0 === m1) {
    return `${y0}年${m0}月`;
  }
  return `${y0}年${m0}月 / ${y1}年${m1}月`;
}

type HomeLocationState = {
  pickedLocation?: {
    role: "pickup" | "dropoff";
    label: string;
    latLng: { lat: number; lng: number };
  };
};

type HomeLocateUi =
  | { kind: "loading" }
  | { kind: "city"; text: string }
  | { kind: "none" }
  | { kind: "error" };

export default function Home() {
  const navigate = useNavigate();
  const { profile, hasUser, profileFetchLoading, refreshProfile } = useUserSession();
  const location = useLocation();
  const [openSheet, setOpenSheet] = useState<"time" | "remark" | "deposit" | null>(null);
  const [driverLatLng, setDriverLatLng] = useState<MapPoint["latLng"] | null>(null);
  /** 未选择时为 null；sessionStorage 草稿避免去搜索/地图页后 Home 重挂载丢另一项 */
  const [pickup, setPickup] = useState<MapPoint | null>(() => loadHomeLocationsDraft().pickup);
  const [pickupGeocodeError, setPickupGeocodeError] = useState("");
  const [dropoff, setDropoff] = useState<MapPoint | null>(() => loadHomeLocationsDraft().dropoff);
  const initialPickedRoleRef = useRef<"pickup" | "dropoff" | undefined>(
    (location.state as HomeLocationState | null)?.pickedLocation?.role,
  );
  const [timeRange, setTimeRange] = useState<{ min: Date; max: Date } | null>(null);
  const [selectedDateYmd, setSelectedDateYmd] = useState<string>("");
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [bookingUiDraftOnce] = useState(() => loadHomeBookingUiDraft());
  const [passengers, setPassengers] = useState(() => bookingUiDraftOnce?.passengers ?? 1);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    () => bookingUiDraftOnce?.selectedTags ?? [],
  );
  const [remarkText, setRemarkText] = useState(() => bookingUiDraftOnce?.remarkText ?? "");
  const [pricingMode, setPricingMode] = useState<PricingMode>(() => loadHomePricingMode());
  /** 相对「含今天的自然周」的周偏移，仅用于日期卡片展示 */
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(
    () => bookingUiDraftOnce?.calendarWeekOffset ?? 0,
  );
  const [tempQuote, setTempQuote] = useState<TempQuote>(EMPTY_TEMP_QUOTE);

  const [locateUi, setLocateUi] = useState<HomeLocateUi>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator
      ? { kind: "loading" }
      : { kind: "none" },
  );
  const [locateAttempt, setLocateAttempt] = useState(0);

  const retryLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocateAttempt((n) => n + 1);
  }, []);

  /** stitch/_13：套餐价固定展示 */
  const PACKAGE_TOTAL_YUAN = 500;

  const estimatedTotal = useMemo(() => {
    if (pricingMode === "package") return PACKAGE_TOTAL_YUAN;
    return tempQuote.totalYuan;
  }, [pricingMode, tempQuote.totalYuan]);

  const emptyPrice = useMemo(
    () => (pricingMode === "package" ? 0 : tempQuote.emptyYuan),
    [pricingMode, tempQuote.emptyYuan],
  );

  const deposit = useMemo(
    () => Math.max(estimatedTotal * 0.2, emptyPrice),
    [estimatedTotal, emptyPrice],
  );

  /** 须已拉取并持久化用户信息；套餐须选上车点；临时包车须选上、下车点 */
  const canSubmitBooking = useMemo(() => {
    if (!hasUser) return false;
    if (pricingMode === "package") return Boolean(pickup?.latLng);
    return Boolean(pickup?.latLng && dropoff?.latLng);
  }, [hasUser, pricingMode, pickup?.latLng, dropoff?.latLng]);

  const remarkSummary = (() => {
    const parts = [...selectedTags];
    if (remarkText.trim()) parts.push(remarkText.trim());
    return parts.length > 0 ? parts.join("、") : "无";
  })();

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
  const effectiveCalendarWeekOffset = Math.min(
    Math.max(0, calendarWeekOffset),
    maxCalendarWeekOffset,
  );
  const displayWeekSunday = addDays(calendarWeek0Sunday, 7 * effectiveCalendarWeekOffset);
  const calendarCardTitle = calendarFortnightTitle(displayWeekSunday);
  const calendarFortnightDays = Array.from({ length: 14 }, (_, i) =>
    addDays(displayWeekSunday, i),
  );

  useEffect(() => {
    if (effectiveCalendarWeekOffset !== calendarWeekOffset) {
      setCalendarWeekOffset(effectiveCalendarWeekOffset);
    }
  }, [calendarWeekOffset, effectiveCalendarWeekOffset]);

  useEffect(() => {
    saveHomeLocationsDraft({ pickup, dropoff });
  }, [pickup, dropoff]);

  useEffect(() => {
    saveHomePricingMode(pricingMode);
  }, [pricingMode]);

  useEffect(() => {
    if (!timeRange || !selectedDateYmd) return;
    const day = dateFromYmd(selectedDateYmd);
    const d = new Date(day);
    d.setHours(selectedHour, selectedMinute, 0, 0);
    saveHomeBookingUiDraft({
      version: 1,
      departureAt: d.getTime(),
      calendarWeekOffset,
      passengers,
      selectedTags,
      remarkText,
    });
  }, [
    timeRange,
    selectedDateYmd,
    selectedHour,
    selectedMinute,
    calendarWeekOffset,
    passengers,
    selectedTags,
    remarkText,
  ]);

  useEffect(() => {
    const st = location.state as HomeLocationState | null;
    if (!st?.pickedLocation) return;
    const { role, label, latLng } = st.pickedLocation;
    const picked: MapPoint = { label, latLng };
    if (role === "pickup") {
      setPickup(picked);
      setPickupGeocodeError("");
    } else setDropoff(picked);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  // 首页：获取当前位置权限，并把定位地址作为「上车地点」默认值；标题旁展示逆地理城市。
  // 如果本次进入首页是「从地图/搜索选了上车点」回来，则不覆盖已选的上车地点（仍解析城市用于展示）。
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocateUi({ kind: "none" });
      return;
    }

    let cancelled = false;
    setLocateUi({ kind: "loading" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;

        const ll = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setDriverLatLng(ll);

        try {
          setPickupGeocodeError("");
          const labels = await reverseGeocodeLabels(ll);
          if (cancelled) return;

          const cityText = labels.cityDisplay.trim() || labels.adminLine.trim();
          if (cityText) {
            setLocateUi({ kind: "city", text: cityText });
          } else {
            setLocateUi({ kind: "error" });
          }

          if (initialPickedRoleRef.current === "pickup") return;

          const addr = labels.primary.trim();
          if (!addr) {
            setPickupGeocodeError("未能将当前位置解析为地址，请在搜索或地图中选点。");
            return;
          }
          setPickup((prev) => (prev ? prev : { label: addr, latLng: ll }));
        } catch (e) {
          if (cancelled) return;
          setLocateUi({ kind: "error" });
          if (initialPickedRoleRef.current !== "pickup") {
            setPickupGeocodeError(describeTencentGeocoderError(e).message);
          }
        }
      },
      () => {
        if (cancelled) return;
        setLocateUi({ kind: "error" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );

    return () => {
      cancelled = true;
    };
  }, [locateAttempt]);

  // 临时包车：驾车里程 × 单价（路线 API，失败则直线距离兜底）
  useEffect(() => {
    if (pricingMode !== "temporary") return;

    const pl = pickup?.latLng;
    const dl = dropoff?.latLng;
    if (!pl || !dl) {
      setTempQuote(EMPTY_TEMP_QUOTE);
      return;
    }

    let cancelled = false;
    setTempQuote((prev) => ({ ...prev, loading: true }));

    void (async () => {
      const opM = await getDrivingDistanceMeters(pl, dl);
      const deadM = driverLatLng ? await getDrivingDistanceMeters(driverLatLng, pl) : 0;
      if (cancelled) return;

      let op = opM;
      let dead = typeof deadM === "number" ? deadM : 0;
      let fallback = false;
      if (op == null) {
        op = haversineMeters(pl, dl);
        fallback = true;
      }
      if (driverLatLng && deadM == null) {
        dead = haversineMeters(driverLatLng, pl);
        fallback = true;
      }

      const q = estimateTemporaryCharterYuan(op, dead);
      setTempQuote({
        loading: false,
        ...q,
        fallback,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pricingMode,
    pickup?.latLng?.lat,
    pickup?.latLng?.lng,
    dropoff?.latLng?.lat,
    dropoff?.latLng?.lng,
    driverLatLng?.lat,
    driverLatLng?.lng,
  ]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const renderTag = (tag: string) => {
    const active = selectedTags.includes(tag);
    return (
      <button
        key={tag}
        type="button"
        onClick={() => toggleTag(tag)}
        className={
          active
            ? "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
            : "rounded-lg border border-transparent bg-[#F5F5F5] px-3 py-2 text-sm font-medium text-[#666666]"
        }
      >
        {tag}
      </button>
    );
  };

  const initTimeRange = () => {
    const now = new Date();
    const min = ceilToNextStep15(now);
    const max = addMonths(min, 1);
    setTimeRange({ min, max });
    setSelectedDateYmd(ymdFromDate(min));
    setSelectedHour(min.getHours());
    setSelectedMinute(min.getMinutes());
  };

  // 首次进入首页：时间窗基于当前时刻；若会话内有有效出发时间则恢复
  useEffect(() => {
    if (timeRange) return;
    const now = new Date();
    const min = ceilToNextStep15(now);
    const max = addMonths(min, 1);
    setTimeRange({ min, max });
    const draft = loadHomeBookingUiDraft();
    if (draft != null) {
      const cand = alignDepartureMinuteToStep(new Date(draft.departureAt));
      if (cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime()) {
        setSelectedDateYmd(ymdFromDate(cand));
        setSelectedHour(cand.getHours());
        setSelectedMinute(cand.getMinutes());
        return;
      }
    }
    setSelectedDateYmd(ymdFromDate(min));
    setSelectedHour(min.getHours());
    setSelectedMinute(min.getMinutes());
  }, [timeRange]);

  // Recompute range when opening the time picker sheet (so "future one month" is always correct).
  useEffect(() => {
    if (openSheet !== "time") return;
    initTimeRange();
  }, [openSheet]);

  const baseTodayYmd = useMemo(() => {
    if (!timeRange) return "";
    return ymdFromDate(timeRange.min);
  }, [timeRange]);

  const validMinuteItems = useMemo(() => {
    if (!timeRange || !selectedDateYmd) return [];
    const day = dateFromYmd(selectedDateYmd);
    const min = timeRange.min;
    const max = timeRange.max;

    return STEP_MINUTES.filter((m) => {
      const cand = new Date(day);
      cand.setHours(selectedHour, m, 0, 0);
      return cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime();
    }).map((m) => ({
      value: m,
      label: `${pad2(m)}分`,
    }));
  }, [selectedDateYmd, selectedHour, timeRange]);

  const validHourItems = useMemo(() => {
    if (!timeRange || !selectedDateYmd) return [];
    const day = dateFromYmd(selectedDateYmd);
    const min = timeRange.min;
    const max = timeRange.max;

    const hours: number[] = [];
    for (let h = 0; h <= 23; h++) {
      const hasAny = STEP_MINUTES.some((m) => {
        const cand = new Date(day);
        cand.setHours(h, m, 0, 0);
        return cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime();
      });
      if (hasAny) hours.push(h);
    }

    return hours.map((h) => ({ value: h, label: `${h}时` }));
  }, [selectedDateYmd, timeRange]);

  const validDateItems = useMemo(() => {
    if (!timeRange) return [];
    const minDay = dateFromYmd(ymdFromDate(timeRange.min));
    const maxDay = dateFromYmd(ymdFromDate(timeRange.max));
    const result: { value: string; label: string }[] = [];
    for (
      let d = new Date(minDay);
      d.getTime() <= maxDay.getTime();
      d = addDays(d, 1)
    ) {
      const ymd = ymdFromDate(d);
      const day = dateFromYmd(ymd);
      const min = timeRange.min;
      const max = timeRange.max;

      const hasAny = (() => {
        for (let h = 0; h <= 23; h++) {
          const hasMinute = STEP_MINUTES.some((m) => {
            const cand = new Date(day);
            cand.setHours(h, m, 0, 0);
            return cand.getTime() >= min.getTime() && cand.getTime() <= max.getTime();
          });
          if (hasMinute) return true;
        }
        return false;
      })();

      if (hasAny) {
        result.push({
          value: ymd,
          label: formatDateLabel(ymd, ymdFromDate(timeRange.min)),
        });
      }
    }
    return result;
  }, [timeRange]);

  // Keep selections valid as options change.
  useEffect(() => {
    if (!timeRange) return;
    if (validDateItems.length === 0) {
      if (selectedDateYmd) setSelectedDateYmd("");
      return;
    }
    if (!selectedDateYmd) {
      setSelectedDateYmd(validDateItems[0].value);
      return;
    }
    if (!validDateItems.some((d) => d.value === selectedDateYmd)) {
      setSelectedDateYmd(validDateItems[0].value);
    }
  }, [selectedDateYmd, timeRange, validDateItems]);

  useEffect(() => {
    if (!timeRange) return;
    if (validHourItems.length === 0) return;
    if (!validHourItems.some((h) => h.value === selectedHour)) {
      setSelectedHour(validHourItems[0].value);
    }
  }, [selectedHour, timeRange, validHourItems]);

  useEffect(() => {
    if (!timeRange) return;
    if (validMinuteItems.length === 0) return;
    if (!validMinuteItems.some((m) => m.value === selectedMinute)) {
      setSelectedMinute(validMinuteItems[0].value);
    }
  }, [selectedMinute, timeRange, validMinuteItems]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateYmd || !baseTodayYmd) return "";
    return formatDateLabel(selectedDateYmd, baseTodayYmd);
  }, [baseTodayYmd, selectedDateYmd]);

  const selectedTimeCardText = useMemo(() => {
    if (!timeRange) return "";
    return `${selectedDateLabel} ${pad2(selectedHour)}:${pad2(selectedMinute)}`;
  }, [selectedDateLabel, selectedHour, selectedMinute, timeRange]);

  const locateEndSlot =
    locateUi.kind !== "none" ? (
      locateUi.kind === "error" ? (
        <button
          type="button"
          onClick={retryLocate}
          className="inline-flex max-w-[min(12rem,calc(100%-5rem))] items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-left text-xs font-semibold text-primary outline-none ring-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 active:bg-primary/15"
          aria-label="定位失败，点击重试"
        >
          <span className="material-symbols-outlined shrink-0 text-[16px] leading-none">
            location_off
          </span>
          <span className="min-w-0 shrink-0">定位失败 · 重试</span>
        </button>
      ) : (
        <div
          className="inline-flex max-w-[min(12rem,calc(100%-5rem))] items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
          title={locateUi.kind === "city" ? locateUi.text : undefined}
        >
          {locateUi.kind === "loading" ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[16px] leading-none">
                progress_activity
              </span>
              <span className="shrink-0">定位中</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px] leading-none">location_on</span>
              <span className="min-w-0 truncate">{locateUi.text}</span>
            </>
          )}
        </div>
      )
    ) : null;

  return (
    <div className="min-h-884 min-h-screen bg-backgroundLight font-display text-slate-900 antialiased">
      <div className="mx-auto max-w-md bg-backgroundLight pb-32">
        <header className="bg-white px-4 pt-6 pb-4 shadow-sm">
          <div className="mb-4 flex w-full min-w-0 items-start gap-3 rounded-lg py-1 pr-1 transition-colors hover:bg-slate-50">
            <button
              type="button"
              onClick={() => {
                if (profileFetchLoading) return;
                if (hasUser && profile) {
                  navigate("/profile");
                  return;
                }
                void refreshProfile();
              }}
              className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-slate-200 text-slate-400 outline-none ring-primary focus-visible:ring-2"
              aria-label={
                hasUser
                  ? "进入个人中心"
                  : profileFetchLoading
                    ? "正在获取用户信息"
                    : "点击获取用户信息"
              }
            >
              {profileFetchLoading ? (
                <span className="material-symbols-outlined animate-spin text-[22px] text-primary">
                  progress_activity
                </span>
              ) : hasUser && profile ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[22px]">person</span>
              )}
            </button>
            <div className="min-w-0 flex-1 text-left">
              {hasUser && profile ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className="text-left text-xl font-bold leading-tight text-slate-900 outline-none ring-primary focus-visible:ring-2"
                    >
                      {profile.displayName}
                    </button>
                    {locateEndSlot}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">包车易 · 专业包车服务</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h1 className="min-w-0 text-left text-xl font-bold leading-tight text-slate-900">
                      游客
                    </h1>
                    {locateEndSlot}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">专业包车服务</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4">
            <div>
              <p className="text-sm text-slate-600">今日可用里程</p>
              <p className="text-xl font-bold text-primary">200km</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-medium text-slate-600">可约</span>
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </header>

        <section className="m-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              disabled={effectiveCalendarWeekOffset <= 0}
              onClick={() =>
                setCalendarWeekOffset((o) =>
                  Math.max(0, Math.min(maxCalendarWeekOffset, o) - 1),
                )
              }
              className="rounded-full p-1 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="上一周"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2 className="font-bold text-slate-800">{calendarCardTitle}</h2>
            <button
              type="button"
              disabled={effectiveCalendarWeekOffset >= maxCalendarWeekOffset}
              onClick={() =>
                setCalendarWeekOffset((o) =>
                  Math.min(maxCalendarWeekOffset, Math.max(0, o) + 1),
                )
              }
              className="rounded-full p-1 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="下一周"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {"日一二三四五六".split("").map((x) => (
              <div key={x} className="pb-2 text-[10px] font-bold uppercase text-slate-400">
                {x}
              </div>
            ))}
            {calendarFortnightDays.map((day) => {
              const d0 = startOfLocalDay(day).getTime();
              const t0 = calendarToday.getTime();
              const t1 = calendarRangeEnd.getTime();
              const inBookingWindow = d0 >= t0 && d0 <= t1;
              const isToday = sameLocalDay(day, calendarToday);
              // 与 stitch/_13  mock 节奏一致：部分可约日展示「已约」（仅占位，不接后端）
              const showBookedSubtitle =
                inBookingWindow && !isToday && day.getDate() % 3 !== 0;

              const dayKey = ymdFromDate(day);

              if (!inBookingWindow) {
                return (
                  <div
                    key={dayKey}
                    className="flex aspect-square items-center justify-center text-sm text-slate-300"
                  >
                    {day.getDate()}
                  </div>
                );
              }

              if (isToday) {
                return (
                  <div
                    key={dayKey}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-md shadow-primary/30"
                  >
                    {day.getDate()}
                    <span className="text-[8px] opacity-80">今天</span>
                  </div>
                );
              }

              return (
                <div
                  key={dayKey}
                  className="flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium text-slate-800"
                >
                  {day.getDate()}
                  <span
                    className={
                      showBookedSubtitle ? "text-[8px] text-slate-400" : "text-[8px] text-primary"
                    }
                  >
                    {showBookedSubtitle ? "已约" : "可约"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mb-4 px-4">
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <HomeMapPreview driverLatLng={driverLatLng} pickup={pickup} dropoff={dropoff} />
          </div>
        </div>

        <section className="mx-4 space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() =>
              navigate("/location/search", {
                state: {
                  role: "pickup",
                  initialLatLng: pickup?.latLng ?? driverLatLng ?? undefined,
                },
              })
            }
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
            <div className="flex-1">
              <p className="mb-0.5 text-xs text-slate-400">上车地点</p>
              <p
                className={
                  pickup
                    ? "text-base font-medium text-slate-800"
                    : "text-base font-medium text-slate-400"
                }
              >
                {pickup?.label ?? "请选择上车地点"}
              </p>
              {pickupGeocodeError && !pickup ? (
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700">{pickupGeocodeError}</p>
              ) : null}
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
          <div className="ml-1 h-6 w-px bg-slate-100" />
          <button
            type="button"
            onClick={() =>
              navigate("/location/search", {
                state: {
                  role: "dropoff",
                  initialLatLng:
                    dropoff?.latLng ?? pickup?.latLng ?? driverLatLng ?? undefined,
                },
              })
            }
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent ring-4 ring-accent/20" />
            <div className="flex-1">
              <p className="mb-0.5 text-xs text-slate-400">下车地点</p>
              <p
                className={
                  dropoff
                    ? "text-base font-medium text-slate-800"
                    : "text-base font-medium text-slate-400"
                }
              >
                {dropoff?.label ?? "请选择下车地点"}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
        </section>

        <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpenSheet("time")}
            className="flex w-full items-center justify-between border-b border-slate-50 p-4 transition-colors active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">schedule</span>
              <span className="text-slate-700">出发时间</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-900">
                {selectedTimeCardText}
              </span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpenSheet("time")}
            className="flex w-full items-center justify-between border-b border-slate-50 p-4 transition-colors active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">person</span>
              <span className="text-slate-700">乘车人数</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-900">{passengers}人</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpenSheet("remark")}
            className="flex w-full items-center justify-between border-t border-slate-50 p-4 transition-colors active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">edit_note</span>
              <span className="text-slate-700">行程备注</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="max-w-[160px] truncate font-medium text-slate-900">{remarkSummary}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
        </section>

        <section className="mx-4 mt-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">费用明细</h3>
            <div className="flex rounded-full bg-primary/10 p-1">
              <button
                type="button"
                onClick={() => setPricingMode("package")}
                className={
                  pricingMode === "package"
                    ? "rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white shadow-sm"
                    : "px-3 py-1 text-[10px] font-bold text-primary"
                }
              >
                8h / 200km
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("temporary")}
                className={
                  pricingMode === "temporary"
                    ? "rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white shadow-sm"
                    : "px-3 py-1 text-[10px] font-bold text-primary"
                }
              >
                临时包车
              </button>
            </div>
          </div>
          {pricingMode === "package" ? (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">基础行程 (含200km)</span>
                <span className="font-medium text-slate-700">¥0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">空驶补偿 (套餐内免收)</span>
                <span className="font-medium text-slate-700">¥0.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-50 pt-2 text-sm">
                <span className="font-bold text-slate-900">预估总价</span>
                <span className="text-2xl font-bold text-accent">¥{PACKAGE_TOTAL_YUAN}</span>
              </div>
            </div>
          ) : (
            <div className="mb-4 space-y-2">
              {!pickup?.latLng || !dropoff?.latLng ? (
                <p className="text-xs text-slate-500">请选择上车点与下车点后，按驾车里程估算费用</p>
              ) : null}
              {tempQuote.loading ? (
                <p className="text-xs text-slate-400">正在计算路线里程…</p>
              ) : null}
              {tempQuote.fallback && !tempQuote.loading && pickup?.latLng && dropoff?.latLng ? (
                <p className="text-xs text-amber-700">路线服务不可用，已按直线距离粗略估算</p>
              ) : null}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  基础行程（{tempQuote.baseKm.toFixed(1)}km × {TEMP_CHARTER_OPERATING_YUAN_PER_KM}）
                </span>
                <span className="font-medium text-slate-700">¥{tempQuote.baseYuan.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  空驶补偿（
                  {driverLatLng
                    ? `${tempQuote.deadKm.toFixed(1)}km × ${TEMP_CHARTER_DEADHEAD_YUAN_PER_KM} × ${TEMP_CHARTER_DEADHEAD_MULTIPLIER}`
                    : "无定位，未计空驶"}
                  ）
                </span>
                <span className="font-medium text-slate-700">¥{tempQuote.emptyYuan.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-50 pt-2 text-sm">
                <span className="font-bold text-slate-900">预估总价</span>
                <span className="text-2xl font-bold text-accent">
                  ¥{tempQuote.totalYuan.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </section>

        <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-white p-4 shadow-bottomBar">
          <button
            type="button"
            disabled={!canSubmitBooking}
            onClick={() => {
              if (!canSubmitBooking) return;
              setOpenSheet("deposit");
            }}
            className={
              canSubmitBooking
                ? "w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                : "w-full cursor-not-allowed rounded-xl bg-primary/45 py-4 font-bold text-white/90 shadow-sm shadow-primary/10"
            }
          >
            立即预约
          </button>
        </div>
      </div>

      <BottomSheet
        open={openSheet === "time"}
        onClose={() => setOpenSheet(null)}
        backdropClassName="bg-black/40"
        maxHeightClassName="max-h-[84vh]"
        sheetClassName="bg-white rounded-t-xl overflow-hidden shadow-2xl"
        handleClassName="flex h-6 w-full items-center justify-center pt-2"
        handleBarClassName="h-1.5 w-10 rounded-full bg-slate-200"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        footerClassName="border-t border-slate-100 bg-white px-6 pt-4 pb-10"
        footer={
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-primary text-lg font-bold text-white"
            onClick={() => setOpenSheet(null)}
          >
            确定
          </button>
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-50 px-6 py-4">
          <button type="button" className="text-slate-400" onClick={() => setOpenSheet(null)}>
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <h2 className="text-lg font-semibold text-slate-900">选择出发时间和人数</h2>
          <div className="w-8" />
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-4">
              <h3 className="text-base font-bold">出发时间</h3>
              <p className="mt-1 text-xs text-slate-500">请提前合理规划好时间</p>
            </div>
            <div className="flex h-44 gap-2 overflow-hidden">
              <div className="flex-1 overflow-hidden border-r border-slate-50">
                <WheelColumn
                  items={validDateItems.map((it) => ({ value: it.value, label: it.label }))}
                  selected={selectedDateYmd}
                  onChange={(v) => setSelectedDateYmd(String(v))}
                />
              </div>
              <div className="flex-1 overflow-hidden border-r border-slate-50">
                <WheelColumn
                  items={validHourItems.map((it) => ({ value: it.value, label: it.label }))}
                  selected={selectedHour}
                  onChange={(v) => setSelectedHour(Number(v))}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <WheelColumn
                  items={validMinuteItems.map((it) => ({ value: it.value, label: it.label }))}
                  selected={selectedMinute}
                  onChange={(v) => setSelectedMinute(Number(v))}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h3 className="text-base font-bold">乘车人数</h3>
              <p className="mt-1 text-xs text-slate-500">婴幼儿、儿童需一同计入乘车人数</p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600">group</span>
                <span className="font-medium">乘车人数</span>
              </div>
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setPassengers((v) => Math.max(1, v - 1))}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-slate-200 text-slate-400"
                >
                  <span className="material-symbols-outlined text-xl">remove</span>
                </button>
                <span className="w-4 text-center text-xl font-bold">{passengers}</span>
                <button
                  type="button"
                  onClick={() => setPassengers((v) => Math.min(4, v + 1))}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-primary text-primary"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPassengers(count)}
                  className={
                    passengers === count
                      ? "rounded-full border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
                      : "rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                  }
                >
                  {count}人
                </button>
              ))}
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        open={openSheet === "remark"}
        onClose={() => setOpenSheet(null)}
        backdropClassName="bg-black/40"
        maxHeightClassName="max-h-[84vh]"
        sheetClassName="bg-white rounded-t-xl overflow-hidden shadow-2xl"
        handleClassName="flex h-6 w-full items-center justify-center pt-2"
        handleBarClassName="h-1.5 w-10 rounded-full bg-slate-200"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        footerClassName="border-t border-slate-100 bg-white px-6 pt-4 pb-10"
        footer={
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:brightness-110"
            onClick={() => setOpenSheet(null)}
          >
            确定
          </button>
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-50 px-6 py-4">
          <button type="button" className="text-slate-400" onClick={() => setOpenSheet(null)}>
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <h2 className="text-lg font-semibold text-slate-900">行程备注</h2>
          <div className="w-8" />
        </div>
        <div className="max-h-[618px] min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-6">
            <h3 className="mb-3 text-[15px] font-semibold text-slate-500">宠物与行李</h3>
            <div className="flex flex-wrap gap-2">{remarkTagsA.map(renderTag)}</div>
          </div>
          <div className="mb-6">
            <h3 className="mb-3 text-[15px] font-semibold text-slate-500">其他需求</h3>
            <div className="flex flex-wrap gap-2">{remarkTagsB.map(renderTag)}</div>
          </div>
          <div className="mb-4">
            <textarea
              rows={3}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm focus:border-primary focus:ring-primary"
              placeholder="请输入其他补充信息..."
            />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={openSheet === "deposit"}
        onClose={() => setOpenSheet(null)}
        backdropClassName="bg-black/40"
        maxHeightClassName="max-h-[84vh]"
        sheetClassName="bg-white rounded-t-xl overflow-hidden shadow-2xl"
        handleClassName="flex h-6 w-full items-center justify-center pt-2"
        handleBarClassName="h-1.5 w-10 rounded-full bg-slate-200"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        footerClassName="shrink-0 border-t border-slate-100 bg-white px-6 pt-4 pb-10"
        footer={
          <>
            <button
              type="button"
              disabled={!canSubmitBooking || !pickup?.latLng}
              onClick={() => {
                if (!canSubmitBooking || !pickup?.latLng) return;
                const clientOrderId = `HC${Date.now()}`;
                const remarkParts = [...selectedTags];
                if (remarkText.trim()) remarkParts.push(remarkText.trim());
                const remark = remarkParts.length > 0 ? remarkParts.join("、") : "";
                clearHomeBookingUiDraft();
                navigate("/booking/result", {
                  state: {
                    clientOrderId,
                    pickup: { label: pickup.label, latLng: { ...pickup.latLng } },
                    dropoff:
                      dropoff?.latLng != null
                        ? { label: dropoff.label, latLng: { ...dropoff.latLng } }
                        : null,
                    driverLatLng: driverLatLng ? { ...driverLatLng } : null,
                    useTime: selectedTimeCardText || "待定",
                    remark,
                    pricingMode,
                    estimatedTotalYuan: estimatedTotal,
                    depositPaidYuan: deposit,
                    passengers,
                    vehicleLabel:
                      pricingMode === "package"
                        ? "商务7座 · 丰田埃尔法或同级（8h/200km 套餐）"
                        : "商务7座 · 丰田埃尔法或同级（临时包车）",
                    tempFeeDetail:
                      pricingMode === "temporary"
                        ? {
                            baseYuan: tempQuote.baseYuan,
                            emptyYuan: tempQuote.emptyYuan,
                            baseKm: tempQuote.baseKm,
                            deadKm: tempQuote.deadKm,
                          }
                        : undefined,
                  } satisfies BookingSubmitState,
                });
                setOpenSheet(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#07C160] py-4 font-semibold text-white transition-all active:scale-[0.98] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              <span>微信支付 ¥{deposit.toFixed(2)}</span>
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">支付即表示同意《包车服务协议》</p>
          </>
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-50 px-6 py-4">
          <button type="button" className="text-slate-400" onClick={() => setOpenSheet(null)}>
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <h2 className="text-lg font-semibold text-slate-900">确认预约并支付定金</h2>
          <div className="w-8" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-6 pt-8 pb-4 text-center">
            <p className="mb-1 text-sm text-slate-500">应付定金</p>
            <div className="flex items-baseline justify-center text-slate-900">
              <span className="mr-1 text-2xl font-bold">¥</span>
              <span className="text-5xl font-bold tracking-tight">{deposit.toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">预估总金额</span>
                <span className="font-medium text-slate-900">¥{estimatedTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-500">定金比例</span>
                  <span className="material-symbols-outlined text-sm text-slate-300">info</span>
                </div>
                <span className="font-medium text-slate-900">20%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">空驶补偿金额</span>
                <span className="font-medium text-slate-900">¥{emptyPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-semibold text-slate-900">最终定金</span>
                <span className="font-bold text-primary">¥{deposit.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 px-6 py-4 pb-6">
            <div className="flex gap-2">
              <span className="material-symbols-outlined mt-0.5 text-sm text-slate-400">verified_user</span>
              <div>
                <p className="text-sm font-medium text-slate-900">定金计算规则</p>
                <p className="mt-0.5 text-xs text-slate-500">总金额的20%且不低于空驶补偿金额。</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="material-symbols-outlined mt-0.5 text-sm text-slate-400">assignment_return</span>
              <div>
                <p className="text-sm font-medium text-slate-900">退款说明</p>
                <p className="mt-0.5 text-xs text-slate-500">如行程未成行，定金将按原路退回您的支付账户。</p>
              </div>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

