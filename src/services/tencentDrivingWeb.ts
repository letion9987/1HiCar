import { getTencentMapKey } from "../config/tencentMap";
import { tencentJsonp } from "./tencentJsonp";

export type LatLng = { lat: number; lng: number };

/**
 * 腾讯方向服务返回的 polyline：首两点为起点经纬度，后续为前向差分压缩值。
 * @see https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute
 */
export function decodeTencentDirectionPolyline(coors: number[]): LatLng[] {
  if (!Array.isArray(coors) || coors.length < 4) return [];
  const c = coors.slice();
  for (let i = 2; i < c.length; i++) {
    c[i] = c[i - 2] + c[i] / 1000000;
  }
  const out: LatLng[] = [];
  for (let i = 0; i + 1 < c.length; i += 2) {
    const lat = c[i];
    const lng = c[i + 1];
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
  return out;
}

type DrivingRouteJson = {
  status: number;
  result?: { routes?: Array<{ distance?: number; polyline?: number[] }> };
};

async function fetchDrivingRouteJson(from: LatLng, to: LatLng): Promise<DrivingRouteJson> {
  const key = getTencentMapKey();
  const url = new URL("https://apis.map.qq.com/ws/direction/v1/driving");
  url.searchParams.set("from", `${from.lat},${from.lng}`);
  url.searchParams.set("to", `${to.lat},${to.lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "jsonp");
  return tencentJsonp<DrivingRouteJson>(url.toString());
}

/** 驾车方案总里程（米），失败返回 null */
export async function getDrivingDistanceMeters(from: LatLng, to: LatLng): Promise<number | null> {
  const json = await fetchDrivingRouteJson(from, to);
  if (json.status !== 0) return null;
  const m = json.result?.routes?.[0]?.distance;
  if (typeof m !== "number" || !Number.isFinite(m) || m < 0) return null;
  return m;
}

/** 驾车路线折线（WebService JSONP，不依赖 JS API DrivingService） */
export async function getDrivingRoutePolyline(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const json = await fetchDrivingRouteJson(from, to);
  if (json.status !== 0) return [];

  const poly = json.result?.routes?.[0]?.polyline;
  if (!Array.isArray(poly) || poly.length < 4) return [];

  return decodeTencentDirectionPolyline(poly);
}
