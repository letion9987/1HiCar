import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderLatLng } from "../services/ordersStore";
import { loadTencentMap } from "../services/tencentMapLoader";

const PRIMARY = "#07C160";
const ACCENT = "#FF9800";

function makeLatLng(lat: number, lng: number): any {
  const LatLngCtor = (qq as any)?.maps?.LatLng;
  if (typeof LatLngCtor !== "function") return { lat, lng };
  try {
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
  return new qq.maps.MarkerImage(
    url,
    new qq.maps.Size(18, 18),
    new qq.maps.Point(0, 0),
    new qq.maps.Point(9, 9),
  );
}

function fitToPoints(map: any, pts: OrderLatLng[]) {
  const valid = pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0 || !map?.fitBounds) return;
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
  const pad = 0.0012;
  try {
    if (typeof qq?.maps?.event?.trigger === "function") qq.maps.event.trigger(map, "resize");
    const sw = makeLatLng(minLat - pad, minLng - pad);
    const ne = makeLatLng(maxLat + pad, maxLng + pad);
    map.fitBounds(new qq.maps.LatLngBounds(sw, ne), { top: 16, right: 16, bottom: 16, left: 16 });
  } catch {
    // ignore
  }
}

export type OrderRouteMapProps = {
  driverLatLng: OrderLatLng | null;
  pickupLatLng: OrderLatLng;
  dropoffLatLng: OrderLatLng | null;
  pathLeg1: OrderLatLng[];
  pathLeg2: OrderLatLng[];
  className?: string;
};

/**
 * 订单/结果页路线：定位、上下车点 + 两段驾车折线（与首页预览配色一致）
 */
export default function OrderRouteMap({
  driverLatLng,
  pickupLatLng,
  dropoffLatLng,
  pathLeg1,
  pathLeg2,
  className = "",
}: OrderRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const driverPos = useMemo(() => {
    if (!sdkReady || !driverLatLng) return null;
    return makeLatLng(driverLatLng.lat, driverLatLng.lng);
  }, [sdkReady, driverLatLng]);

  const pathLeg1Key = useMemo(() => JSON.stringify(pathLeg1), [pathLeg1]);
  const pathLeg2Key = useMemo(() => JSON.stringify(pathLeg2), [pathLeg2]);

  useEffect(() => {
    loadTencentMap()
      .then(() => setSdkReady(true))
      .catch(() => setSdkReady(false));
  }, []);

  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    const overlays: any[] = [];
    try {
      if (!mapRef.current) {
        const c = driverPos ?? makeLatLng(pickupLatLng.lat, pickupLatLng.lng);
        mapRef.current = new qq.maps.Map(containerRef.current, {
          center: c,
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
      const map = mapRef.current;

      const add = (o: any) => {
        overlays.push(o);
      };

      if (driverPos) {
        add(new qq.maps.Marker({ position: driverPos, map, icon: dotIcon("#1e293b") }));
      }
      add(
        new qq.maps.Marker({
          position: makeLatLng(pickupLatLng.lat, pickupLatLng.lng),
          map,
          icon: dotIcon(PRIMARY),
        }),
      );
      if (dropoffLatLng) {
        add(
          new qq.maps.Marker({
            position: makeLatLng(dropoffLatLng.lat, dropoffLatLng.lng),
            map,
            icon: dotIcon(ACCENT),
          }),
        );
      }

      if (pathLeg1.length > 0) {
        add(
          new qq.maps.Polyline({
            map,
            path: pathLeg1.map((p) => makeLatLng(p.lat, p.lng)),
            strokeColor: PRIMARY,
            strokeWeight: 4,
            strokeOpacity: 0.92,
          }),
        );
      }
      if (pathLeg2.length > 0) {
        add(
          new qq.maps.Polyline({
            map,
            path: pathLeg2.map((p) => makeLatLng(p.lat, p.lng)),
            strokeColor: ACCENT,
            strokeWeight: 4,
            strokeOpacity: 0.92,
          }),
        );
      }

      const allPts: OrderLatLng[] = [...pathLeg1, ...pathLeg2];
      if (driverLatLng) allPts.push(driverLatLng);
      allPts.push(pickupLatLng);
      if (dropoffLatLng) allPts.push(dropoffLatLng);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => fitToPoints(map, allPts));
      });

      return () => {
        overlays.forEach((o) => {
          try {
            o.setMap(null);
          } catch {
            // ignore
          }
        });
      };
    } catch {
      return undefined;
    }
  }, [
    sdkReady,
    driverPos,
    pickupLatLng.lat,
    pickupLatLng.lng,
    dropoffLatLng?.lat,
    dropoffLatLng?.lng,
    pathLeg1Key,
    pathLeg2Key,
    driverLatLng?.lat,
    driverLatLng?.lng,
  ]);

  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-200 ${className}`}>
      <div ref={containerRef} className="absolute inset-0 min-h-[128px]" />
    </div>
  );
}
