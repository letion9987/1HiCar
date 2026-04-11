import { loadTencentMap } from "./tencentMapLoader";

export type LatLng = { lat: number; lng: number };

export async function getDrivingRoutePath(params: {
  start: LatLng;
  end: LatLng;
  policy?: string;
  locationScope?: string;
}): Promise<{ path: LatLng[]; distance: number; duration: string }> {
  await loadTencentMap();

  const makeLatLng = (lat: number, lng: number) => {
    const LatLngCtor = (qq as any)?.maps?.LatLng;
    if (typeof LatLngCtor !== "function") return { lat, lng };
    try {
      // eslint-disable-next-line new-cap
      return new qq.maps.LatLng(lat, lng);
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (qq as any).maps.LatLng(lat, lng);
      } catch {
        return { lat, lng };
      }
    }
  };

  const startLL = makeLatLng(params.start.lat, params.start.lng);
  const endLL = makeLatLng(params.end.lat, params.end.lng);

  const panel = document.createElement("div");
  const service = new qq.maps.DrivingService({
    // DrivingService 需要 map 实例；我们传一个离屏用的 map，回调会给出 path 数据
    map: new qq.maps.Map(panel, { center: startLL, zoom: 3 }),
    panel,
    location: params.locationScope ?? "广州",
  });

  if (params.policy && (qq.maps.DrivingPolicy as any)?.[params.policy]) {
    service.setPolicy((qq.maps.DrivingPolicy as any)[params.policy]);
  }

  return new Promise((resolve, reject) => {
    service.setComplete((result: any) => {
      try {
        const routes = result?.detail?.routes ?? [];
        const r0 = routes[0];
        const path = (r0?.path ?? []).map((p: any) => ({
          lat: typeof p.lat === "function" ? p.lat() : p.lat,
          lng: typeof p.lng === "function" ? p.lng() : p.lng,
        }));
        resolve({
          path,
          distance: Number(r0?.distance ?? 0),
          duration: String(r0?.duration ?? ""),
        });
      } catch (e) {
        reject(e);
      }
    });
    service.setError((err: any) => reject(err));
    service.search(startLL, endLL);
  });
}

