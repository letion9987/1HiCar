import { useEffect, useMemo, useRef, useState } from "react";
import { getDrivingRoutePolyline } from "../services/tencentDrivingWeb";
import { loadTencentMap } from "../services/tencentMapLoader";

type LatLng = { lat: number; lng: number };

export type MapPoint = {
  label: string;
  latLng: LatLng;
};

export type HomeMapPreviewProps = {
  driverLatLng: LatLng | null;
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
};

const PRIMARY = "#07C160";
const ACCENT = "#FF9800";

/** 纬度方向最小视野跨度（度），约三百米级，避免多点重合时 fitBounds 缩放过低看不清 */
const MIN_PREVIEW_LAT_SPAN = 0.0028;
/** 缩放级别下限（数值越大越近），防止 API 在极小范围内仍给过低级别 */
const MIN_PREVIEW_ZOOM = 14;
const MAX_PREVIEW_ZOOM = 19;

function makeLatLng(lat: number, lng: number): any {
  const LatLngCtor = (qq as any)?.maps?.LatLng;
  if (typeof LatLngCtor !== "function") return { lat, lng };

  try {
    // v2/不同版本中 LatLng 可能是构造函数，也可能是工厂函数
    // eslint-disable-next-line new-cap
    return new LatLngCtor(lat, lng);
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return LatLngCtor(lat, lng);
    } catch {
      return { lat, lng };
    }
  }
}

function dotIcon(color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'><circle cx='9' cy='9' r='6.1' fill='${color}' stroke='#ffffff' stroke-width='2.2'/></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // anchor: center bottom-ish (makes dot sit nicely on the point)
  return new qq.maps.MarkerImage(
    url,
    new qq.maps.Size(18, 18),
    new qq.maps.Point(0, 0),
    new qq.maps.Point(9, 9),
  );
}

/**
 * 仅按定位点、上车点、下车点包络适配视野（不含路线折线），留最小边距使三点刚好落在图内。
 */
function fitPreviewBounds(
  map: any,
  args: {
    driverLatLng: LatLng | null;
    pickup: MapPoint | null;
    dropoff: MapPoint | null;
  },
) {
  if (!map || typeof map.fitBounds !== "function") return;

  const points: LatLng[] = [];
  if (args.driverLatLng) points.push(args.driverLatLng);
  if (args.pickup?.latLng) points.push(args.pickup.latLng);
  if (args.dropoff?.latLng) points.push(args.dropoff.latLng);

  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return;

  let minLat = valid[0].lat;
  let maxLat = valid[0].lat;
  let minLng = valid[0].lng;
  let maxLng = valid[0].lng;
  for (let i = 1; i < valid.length; i++) {
    const p = valid[i];
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const latSpan = Math.max(maxLat - minLat, 1e-7);
  const lngSpan = Math.max(maxLng - minLng, 1e-7);
  // 小比例外扩 + 极小下限，避免点贴边；单点时不拉得过远
  const latPad = Math.max(latSpan * 0.06, 0.00012);
  const lngPad = Math.max(lngSpan * 0.06, 0.00012);

  let bMinLat = minLat - latPad;
  let bMaxLat = maxLat + latPad;
  let bMinLng = minLng - lngPad;
  let bMaxLng = maxLng + lngPad;

  const midLat = (bMinLat + bMaxLat) / 2;
  const midLng = (bMinLng + bMaxLng) / 2;
  let latSpanBox = bMaxLat - bMinLat;
  let lngSpanBox = bMaxLng - bMinLng;

  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const minLngSpan = MIN_PREVIEW_LAT_SPAN / Math.max(Math.abs(cosLat), 0.35);

  /** 仅当点很密时才纠正缩放；远距离 fitBounds 会得到较低 zoom，强行 setZoom(14) 会裁掉路线 */
  const spanTooSmallForComfort =
    latSpanBox < MIN_PREVIEW_LAT_SPAN || lngSpanBox < minLngSpan;

  if (latSpanBox < MIN_PREVIEW_LAT_SPAN) {
    const half = MIN_PREVIEW_LAT_SPAN / 2;
    bMinLat = midLat - half;
    bMaxLat = midLat + half;
    latSpanBox = MIN_PREVIEW_LAT_SPAN;
  }
  if (lngSpanBox < minLngSpan) {
    const half = minLngSpan / 2;
    bMinLng = midLng - half;
    bMaxLng = midLng + half;
  }

  const centerLat = (bMinLat + bMaxLat) / 2;
  const centerLng = (bMinLng + bMaxLng) / 2;

  try {
    if (typeof qq?.maps?.event?.trigger === "function") {
      qq.maps.event.trigger(map, "resize");
    }
    const sw = makeLatLng(bMinLat, bMinLng);
    const ne = makeLatLng(bMaxLat, bMaxLng);
    const bounds = new qq.maps.LatLngBounds(sw, ne);
    try {
      map.fitBounds(bounds, { top: 12, right: 12, bottom: 12, left: 12 });
    } catch {
      map.fitBounds(bounds, 12);
    }

    const z = typeof map.getZoom === "function" ? map.getZoom() : undefined;
    if (typeof z === "number" && spanTooSmallForComfort) {
      if (z < MIN_PREVIEW_ZOOM) {
        if (typeof map.setZoom === "function") map.setZoom(MIN_PREVIEW_ZOOM);
        if (typeof map.setCenter === "function") map.setCenter(makeLatLng(centerLat, centerLng));
      } else if (z > MAX_PREVIEW_ZOOM) {
        map.setZoom(MAX_PREVIEW_ZOOM);
      }
    }
  } catch {
    // ignore
  }
}

type FitPreviewArgs = {
  driverLatLng: LatLng | null;
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
};

/** 等地图容器布局稳定后再 fit */
function scheduleFitPreviewBounds(map: any, args: FitPreviewArgs) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitPreviewBounds(map, args);
    });
  });
}

/**
 * 首页地图卡片：仅预览、无地图交互。
 * 有定位时显示定位点；有上车/下车则显示对应点与驾车路线（定位→上车、上车→下车可独立存在）。
 */
export default function HomeMapPreview({
  driverLatLng,
  pickup,
  dropoff,
}: HomeMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const leg1PolylineRef = useRef<any>(null);
  const leg2PolylineRef = useRef<any>(null);
  const routeReqId = useRef(0);
  const overviewSnapshotRef = useRef<FitPreviewArgs | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const scheduleOverview = (map: any, args: FitPreviewArgs) => {
    overviewSnapshotRef.current = args;
    scheduleFitPreviewBounds(map, args);
  };

  const driverPosition = useMemo(() => {
    if (!sdkReady || !driverLatLng) return null;
    return makeLatLng(driverLatLng.lat, driverLatLng.lng);
  }, [sdkReady, driverLatLng]);

  useEffect(() => {
    loadTencentMap()
      .then(() => setSdkReady(true))
      .catch(() => setSdkReady(false));
  }, []);

  // init map + markers
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    try {
      if (!mapRef.current) {
        const center =
          driverPosition ?? makeLatLng(23.1291, 113.2644); // Guangzhou fallback
        mapRef.current = new qq.maps.Map(containerRef.current, {
          center,
          zoom: 13,
          draggable: false,
          scrollwheel: false,
          zoomControl: false,
          disableDoubleClickZoom: true,
          panControl: false,
          mapTypeControl: false,
          scaleControl: false,
          keyboardShortcuts: false,
        });
      }

      // markers
      const map = mapRef.current;

      if (driverPosition) {
        if (driverMarkerRef.current) driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = new qq.maps.Marker({
          position: driverPosition,
          map,
          icon: dotIcon("#1e293b"),
        });
      } else {
        if (driverMarkerRef.current) driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }

      if (pickup?.latLng) {
        if (pickupMarkerRef.current) pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = new qq.maps.Marker({
          position: makeLatLng(pickup.latLng.lat, pickup.latLng.lng),
          map,
          icon: dotIcon(PRIMARY),
        });
      } else {
        if (pickupMarkerRef.current) pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }

      if (dropoff?.latLng) {
        if (dropoffMarkerRef.current) dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = new qq.maps.Marker({
          position: makeLatLng(dropoff.latLng.lat, dropoff.latLng.lng),
          map,
          icon: dotIcon(ACCENT),
        });
      } else {
        if (dropoffMarkerRef.current) dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = null;
      }

      // 有「定位→上车」或「上车→下车」任一段需要展示时，先框住所有已有点位（含无定位时的上下车）
      const shouldFitMultiPoint =
        (driverLatLng && pickup?.latLng) || (pickup?.latLng && dropoff?.latLng);
      if (shouldFitMultiPoint) {
        scheduleOverview(map, { driverLatLng, pickup, dropoff });
      } else {
        overviewSnapshotRef.current = null;
      }
      if (!shouldFitMultiPoint && driverPosition) {
        map.setCenter(driverPosition);
        map.setZoom(13);
      } else if (!shouldFitMultiPoint && pickup?.latLng) {
        map.setCenter(makeLatLng(pickup.latLng.lat, pickup.latLng.lng));
        map.setZoom(14);
      }
    } catch {
      // silent: avoid breaking the whole Home page
    }
  }, [sdkReady, driverPosition, driverLatLng, pickup, dropoff]);

  // route polylines（WebService 驾车路线 + Polyline，避免 DrivingService 内部异常）
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;

    const clearPolylines = () => {
      if (leg1PolylineRef.current) {
        leg1PolylineRef.current.setMap(null);
        leg1PolylineRef.current = null;
      }
      if (leg2PolylineRef.current) {
        leg2PolylineRef.current.setMap(null);
        leg2PolylineRef.current = null;
      }
    };

    if (!pickup?.latLng) {
      clearPolylines();
      return;
    }

    // 仅有上车点、且没有定位与下车点时无需拉路线
    if (!driverLatLng && !dropoff?.latLng) {
      clearPolylines();
      return;
    }

    const map = mapRef.current;
    const id = ++routeReqId.current;
    let cancelled = false;

    clearPolylines();

    const drawPolyline = (path: LatLng[], strokeColor: string) => {
      if (path.length === 0) return null;
      return new qq.maps.Polyline({
        map,
        path: path.map((p) => makeLatLng(p.lat, p.lng)),
        strokeColor,
        strokeWeight: 4,
        strokeOpacity: 0.92,
      });
    };

    void (async () => {
      try {
        let path1: LatLng[] = [];

        if (driverLatLng) {
          path1 = await getDrivingRoutePolyline(driverLatLng, pickup.latLng);
          if (cancelled || id !== routeReqId.current) return;
          leg1PolylineRef.current = drawPolyline(path1, PRIMARY);
        } else if (leg1PolylineRef.current) {
          leg1PolylineRef.current.setMap(null);
          leg1PolylineRef.current = null;
        }

        scheduleOverview(map, { driverLatLng, pickup, dropoff });

        if (dropoff?.latLng) {
          const path2 = await getDrivingRoutePolyline(pickup.latLng, dropoff.latLng);
          if (cancelled || id !== routeReqId.current) return;
          leg2PolylineRef.current = drawPolyline(path2, ACCENT);
          scheduleOverview(map, { driverLatLng, pickup, dropoff });
        } else if (leg2PolylineRef.current) {
          leg2PolylineRef.current.setMap(null);
          leg2PolylineRef.current = null;
        }
      } catch {
        // silent：配额/网络失败时保留点标
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, driverLatLng, pickup, dropoff]);

  // 容器宽高变化（含首屏布局、旋转）时通知地图并重算全览
  useEffect(() => {
    if (!sdkReady) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const map = mapRef.current;
        const snap = overviewSnapshotRef.current;
        if (!map || !snap) return;
        try {
          if (typeof qq?.maps?.event?.trigger === "function") {
            qq.maps.event.trigger(map, "resize");
          }
        } catch {
          // ignore
        }
        scheduleFitPreviewBounds(map, snap);
      }, 100);
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [sdkReady]);

  return (
    <div className="pointer-events-none relative aspect-[16/9] w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}
