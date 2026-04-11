/** 首页出发时间、人数、行程备注：会话内恢复；预约成功后清空 */
const KEY = "hicar_home_booking_ui_v1";

const STEP_MINUTES = [0, 15, 30, 45] as const;

export type HomeBookingUiDraftV1 = {
  version: 1;
  /** 用户选择的出发时刻（本地时间） */
  departureAt: number;
  calendarWeekOffset: number;
  passengers: number;
  selectedTags: string[];
  remarkText: string;
};

export function alignDepartureMinuteToStep(d: Date): Date {
  const x = new Date(d);
  const m = x.getMinutes();
  let best: (typeof STEP_MINUTES)[number] = STEP_MINUTES[0];
  let bestDist = 999;
  for (const s of STEP_MINUTES) {
    const dist = Math.abs(m - s);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  x.setMinutes(best, 0, 0);
  return x;
}

function clampPassengers(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(4, Math.max(1, Math.round(v)));
}

export function loadHomeBookingUiDraft(): HomeBookingUiDraftV1 | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<HomeBookingUiDraftV1>;
    if (o.version !== 1) return null;
    if (typeof o.departureAt !== "number" || !Number.isFinite(o.departureAt)) return null;
    const tags = Array.isArray(o.selectedTags)
      ? o.selectedTags.filter((t): t is string => typeof t === "string")
      : [];
    return {
      version: 1,
      departureAt: o.departureAt,
      calendarWeekOffset:
        typeof o.calendarWeekOffset === "number" && Number.isFinite(o.calendarWeekOffset)
          ? Math.max(0, Math.floor(o.calendarWeekOffset))
          : 0,
      passengers: clampPassengers(o.passengers),
      selectedTags: tags,
      remarkText: typeof o.remarkText === "string" ? o.remarkText : "",
    };
  } catch {
    return null;
  }
}

export function saveHomeBookingUiDraft(draft: HomeBookingUiDraftV1) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

/** 预约成功后恢复为「初始」：清空会话草稿 */
export function clearHomeBookingUiDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
