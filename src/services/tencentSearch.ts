import { formatAdministrativeLine } from "../utils/formatAdministrativeLine";
import { getTencentMapKey } from "../config/tencentMap";
import { tencentJsonp } from "./tencentJsonp";

export type SearchPoiResult = {
  id: string;
  name: string;
  address?: string;
  /** 省市区，来自 ad_info */
  adminLine?: string;
  latLng: { lat: number; lng: number };
};

export async function searchPoiByKeyword(params: {
  keyword: string;
  location?: string;
  pageCapacity?: number;
}): Promise<SearchPoiResult[]> {
  const keyword = params.keyword.trim();
  if (!keyword) return [];

  const location = params.location?.trim() || "广州";
  const page_size = Math.min(Math.max(params.pageCapacity ?? 10, 1), 20);
  const page_index = 1;

  const key = getTencentMapKey();

  // boundary=region(城市,0) - 不自动扩大范围
  const boundary = `region(${location},0)`;

  const url = new URL("https://apis.map.qq.com/ws/place/v1/search");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("boundary", boundary);
  url.searchParams.set("page_size", String(page_size));
  url.searchParams.set("page_index", String(page_index));
  url.searchParams.set("output", "jsonp");
  url.searchParams.set("key", key);

  const json = await tencentJsonp<any>(url.toString());

  if (!json) return [];

  // 腾讯：status=0 正常；非 0 为错误（含 status 121：key 每日调用上限）
  if (json.status !== 0) {
    const err = new Error(json?.message || "Tencent search failed");
    (err as any).tencentStatus = json.status;
    (err as any).requestId = json.request_id;
    throw err;
  }

  const pois: any[] = json.data ?? [];
  return pois
    .map((p) => {
      const lat =
        typeof p.lat === "number"
          ? p.lat
          : Number(p.location?.lat ?? NaN);
      const lng = typeof p.lng === "number" ? p.lng : Number(p.location?.lng ?? NaN);

    const latNum = Number(lat);
    const lngNum = Number(lng);

      const ad = p.ad_info as
        | { province?: string; city?: string; district?: string }
        | undefined;
      const adminLine =
        ad && typeof ad === "object"
          ? formatAdministrativeLine({
              province: ad.province,
              city: ad.city,
              district: ad.district,
            }).trim() || undefined
          : undefined;

      return {
        id: String(p.id ?? p.title ?? p.name ?? ""),
        name: String(p.title ?? ""),
        address: p.address ? String(p.address) : undefined,
        adminLine,
        latLng: { lat: latNum, lng: lngNum },
      };
    })
    .filter((x) => Number.isFinite(x.latLng.lat) && Number.isFinite(x.latLng.lng));
}
