import { formatAdministrativeLine } from "../utils/formatAdministrativeLine";
import { getTencentMapKey } from "../config/tencentMap";
import { tencentJsonp } from "./tencentJsonp";

export type LatLng = { lat: number; lng: number };
export type ReverseGeocodeResult = {
  poiName: string;
  address: string;
};

function assertGeocoderOk(json: { status?: number; message?: string; request_id?: string }) {
  if (json.status === 0) return;
  const err = new Error(json.message || "Tencent geocoder failed");
  (err as { tencentStatus?: number }).tencentStatus = json.status;
  (err as { requestId?: string }).requestId = json.request_id;
  throw err;
}

/** 将 WebService 地理编码异常转为界面展示文案（与 POI 搜索错误处理风格一致） */
export function describeTencentGeocoderError(err: unknown): {
  status?: number;
  message: string;
  quotaExceeded: boolean;
} {
  const status = (err as { tencentStatus?: number })?.tencentStatus;
  if (status === 121) {
    return {
      status,
      message: "地址解析失败：此 Key 每日调用量已达到上限，请更换 Key 或次日再试。",
      quotaExceeded: true,
    };
  }
  if (status === 113) {
    return {
      status,
      message:
        "地址解析失败：地理编码未授权。请在腾讯位置服务控制台为该 Key 开通 WebService 地理编码能力。",
      quotaExceeded: false,
    };
  }
  const m = err instanceof Error ? err.message : "";
  return {
    status,
    message: m.trim() ? m : "地址解析失败，请稍后重试。",
    quotaExceeded: false,
  };
}

/**
 * 地理编码：地址 → 坐标（WebService，避免 JS API Geocoder 需单独商业授权导致的 status 113）
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const key = getTencentMapKey();
  const url = new URL("https://apis.map.qq.com/ws/geocoder/v1/");
  url.searchParams.set("address", trimmed);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "jsonp");

  const json = (await tencentJsonp(url.toString())) as {
    status: number;
    message?: string;
    request_id?: string;
    result?: { location?: { lat?: number; lng?: number } };
  };

  assertGeocoderOk(json);

  const loc = json.result?.location;
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 逆地理编码：一次请求得到推荐地址文案 + 省市区行政文案（WebService）
 */
export async function reverseGeocodeLabels(pos: LatLng): Promise<{
  primary: string;
  adminLine: string;
  /** 首页等城市展示：普通地级市为市名，直辖市等为省级名 */
  cityDisplay: string;
}> {
  const key = getTencentMapKey();
  const url = new URL("https://apis.map.qq.com/ws/geocoder/v1/");
  url.searchParams.set("location", `${pos.lat},${pos.lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "jsonp");

  const json = (await tencentJsonp(url.toString())) as {
    status: number;
    message?: string;
    request_id?: string;
    result?: {
      address?: string;
      formatted_addresses?: { recommend?: string; rough?: string };
      address_component?: {
        province?: string;
        city?: string;
        district?: string;
      };
    };
  };

  assertGeocoderOk(json);

  const r = json.result ?? {};
  const primary = String(
    r.formatted_addresses?.recommend || r.address || r.formatted_addresses?.rough || "",
  ).trim();
  const ac = r.address_component;
  const province = String(ac?.province ?? "").trim();
  const city = String(ac?.city ?? "").trim();
  const adminLine = formatAdministrativeLine({
    province: ac?.province,
    city: ac?.city,
    district: ac?.district,
  }).trim();

  const cityDisplay = (city || province).trim();

  return { primary, adminLine, cityDisplay };
}

/**
 * 逆地理编码：坐标 → 单行地址（WebService）
 */
export async function reverseGeocode(pos: LatLng): Promise<string> {
  const { primary } = await reverseGeocodeLabels(pos);
  return primary;
}

/** 仅行政省市区文案（与 reverseGeocode 同源接口，适合补全历史记录展示） */
export async function reverseGeocodeAdministrativeLine(pos: LatLng): Promise<string> {
  const { adminLine } = await reverseGeocodeLabels(pos);
  return adminLine;
}

/**
 * 逆地理编码：返回 POI 名 + 详细地址（WebService，get_poi=1）
 */
export async function reverseGeocodeDetail(
  pos: LatLng,
): Promise<ReverseGeocodeResult> {
  const key = getTencentMapKey();
  const url = new URL("https://apis.map.qq.com/ws/geocoder/v1/");
  url.searchParams.set("location", `${pos.lat},${pos.lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("get_poi", "1");
  url.searchParams.set("output", "jsonp");

  const json = (await tencentJsonp(url.toString())) as {
    status: number;
    message?: string;
    request_id?: string;
    result?: {
      address?: string;
      formatted_addresses?: { recommend?: string };
      pois?: Array<{ title?: string; address?: string }>;
      address_reference?: { landmark_l2?: { title?: string } };
    };
  };

  assertGeocoderOk(json);

  const r = json.result ?? {};
  const address = String(
    r.address || r.formatted_addresses?.recommend || "",
  );
  const pois = Array.isArray(r.pois) ? r.pois : [];
  const poiName = String(
    pois[0]?.title ||
      r.address_reference?.landmark_l2?.title ||
      "",
  );

  return {
    poiName,
    address,
  };
}
