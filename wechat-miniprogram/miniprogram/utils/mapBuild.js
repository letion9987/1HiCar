const PRIMARY = "#07C160";
const ACCENT = "#FF9800";
const DRIVER = "#1e293b";

const DEFAULT_LAT = 31.23;
const DEFAULT_LNG = 121.47;

/** 统一解析 { lat, lng }，避免草稿/缓存里只有半套坐标导致 map 渲染层 fitBounds 读 undefined.lat */
function normalizeLL(p) {
  if (!p || typeof p !== "object") return null;
  const lat = Number(p.lat != null ? p.lat : p.latitude);
  const lng = Number(p.lng != null ? p.lng : p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toPoint(p) {
  const n = normalizeLL(p);
  if (!n) return null;
  return { latitude: n.lat, longitude: n.lng };
}

function polylineFromLatLngs(points, color, width) {
  if (!points || points.length < 2) return null;
  const pts = points.map(toPoint).filter(Boolean);
  if (pts.length < 2) return null;
  return {
    points: pts,
    color: color || PRIMARY + "EB",
    width: width || 4,
  };
}

function haversineLine(a, b) {
  const pa = normalizeLL(a);
  const pb = normalizeLL(b);
  if (!pa || !pb) return [];
  return [pa, pb];
}

/**
 * @param {object} p
 * @param {{ lat: number, lng: number } | null} p.driverLatLng
 * @param {{ lat: number, lng: number } | null} p.pickupLatLng
 * @param {{ lat: number, lng: number } | null} p.dropoffLatLng
 * @param {{ lat: number, lng: number }[]} p.leg1Points
 * @param {{ lat: number, lng: number }[]} p.leg2Points
 */
function buildMapContext(p) {
  const driver = normalizeLL(p.driverLatLng);
  const pickup = normalizeLL(p.pickupLatLng);
  const dropoff = normalizeLL(p.dropoffLatLng);
  const rawLeg1 = Array.isArray(p.leg1Points) ? p.leg1Points : [];
  const rawLeg2 = Array.isArray(p.leg2Points) ? p.leg2Points : [];
  let leg1 = rawLeg1.length >= 2 ? rawLeg1.map(normalizeLL).filter(Boolean) : [];
  let leg2 = rawLeg2.length >= 2 ? rawLeg2.map(normalizeLL).filter(Boolean) : [];
  if (leg1.length < 2) leg1 = [];
  if (leg2.length < 2) leg2 = [];

  if (leg1.length < 2 && driver && pickup) {
    leg1 = haversineLine(driver, pickup);
  }
  if (leg2.length < 2 && pickup && dropoff) {
    leg2 = haversineLine(pickup, dropoff);
  }

  const polylines = [];
  const pl1 = polylineFromLatLngs(leg1, PRIMARY + "EB", 4);
  const pl2 = polylineFromLatLngs(leg2, ACCENT + "EB", 4);
  if (pl1) polylines.push(pl1);
  if (pl2) polylines.push(pl2);

  const markers = [];
  let id = 0;
  if (driver) {
    const pt = toPoint(driver);
    if (pt) {
      markers.push({
        id: id++,
        ...pt,
        title: "我的位置",
        width: 22,
        height: 22,
      });
    }
  }
  if (pickup) {
    const pt = toPoint(pickup);
    if (pt) {
      markers.push({
        id: id++,
        ...pt,
        title: "上车",
        width: 24,
        height: 24,
      });
    }
  }
  if (dropoff) {
    const pt = toPoint(dropoff);
    if (pt) {
      markers.push({
        id: id++,
        ...pt,
        title: "下车",
        width: 24,
        height: 24,
      });
    }
  }

  const includePoints = [];
  const addInc = (pt) => {
    const x = toPoint(pt);
    if (x) includePoints.push(x);
  };
  [driver, pickup, dropoff].forEach(addInc);
  leg1.forEach((q) => addInc(q));
  leg2.forEach((q) => addInc(q));

  if (includePoints.length === 1) {
    includePoints.push({ latitude: includePoints[0].latitude, longitude: includePoints[0].longitude });
  }

  let mapLat = DEFAULT_LAT;
  let mapLng = DEFAULT_LNG;
  let scale = 13;
  const center = pickup || driver || dropoff;
  if (center) {
    mapLat = center.lat;
    mapLng = center.lng;
  }

  return {
    markers,
    polyline: polylines,
    includePoints,
    mapLat,
    mapLng,
    scale,
  };
}

module.exports = {
  buildMapContext,
  PRIMARY,
  ACCENT,
  DRIVER,
};
