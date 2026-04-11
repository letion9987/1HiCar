import type { MapPoint } from "../components/HomeMapPreview";

const KEY = "hiCar_home_locations_draft_v1";

export type HomeLocationsDraft = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
};

function normalizePoint(p: unknown): MapPoint | null {
  if (!p || typeof p !== "object") return null;
  const o = p as MapPoint;
  const label = o.label;
  const latLng = o.latLng;
  if (typeof label !== "string" || !latLng) return null;
  const lat = Number(latLng.lat);
  const lng = Number(latLng.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label, latLng: { lat, lng } };
}

/** 从会话恢复：切换子路由导致 Home 卸载时保留上/下车点 */
export function loadHomeLocationsDraft(): HomeLocationsDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { pickup: null, dropoff: null };
    const o = JSON.parse(raw) as { pickup?: unknown; dropoff?: unknown };
    return {
      pickup: normalizePoint(o.pickup),
      dropoff: normalizePoint(o.dropoff),
    };
  } catch {
    return { pickup: null, dropoff: null };
  }
}

export function saveHomeLocationsDraft(draft: HomeLocationsDraft) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        pickup: draft.pickup,
        dropoff: draft.dropoff,
      }),
    );
  } catch {
    // ignore
  }
}
