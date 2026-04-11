import type { LatLng } from "./tencentGeocode";

const STORAGE_KEY = "hiCar_location_history_v1";
const MAX = 10;

export type HistoryItem = {
  label: string;
  latLng: LatLng;
  /** 省市区，用于历史列表副标题 */
  adminLine?: string;
};

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.label === "string" && x.latLng)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushHistory(item: HistoryItem) {
  const label = item.label.trim();
  if (!label) return;

  const lat = item.latLng.lat;
  const lng = item.latLng.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return;

  const prev = loadHistory();

  // De-dupe by (role-less) label + coords rounded.
  const deduped = prev.filter((x) => {
    const sameLabel = x.label === label;
    const sameCoords =
      Math.abs(x.latLng.lat - lat) < 1e-7 && Math.abs(x.latLng.lng - lng) < 1e-7;
    return !(sameLabel && sameCoords);
  });

  const adminLine =
    typeof item.adminLine === "string" && item.adminLine.trim()
      ? item.adminLine.trim()
      : undefined;

  const next = [{ label, latLng: { lat, lng }, ...(adminLine ? { adminLine } : {}) }, ...deduped].slice(
    0,
    MAX,
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

