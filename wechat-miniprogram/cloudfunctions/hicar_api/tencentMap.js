/**
 * 腾讯位置服务：驾车路线、逆地理（与 Web 端 tencentDrivingWeb / geocoder 一致）
 * 可在云函数环境变量中配置 TENCENT_MAP_KEY；未配置时使用与 Web 默认一致的 Key（仅供开发联调）
 */
const https = require("https");

const DEFAULT_KEY = "SHABZ-6TXWW-2ESRD-3WHDF-6R5KO-SSBJN";

function mapKey() {
  return (process.env.TENCENT_MAP_KEY || "").trim() || DEFAULT_KEY;
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (c) => {
          raw += c;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function decodeTencentDirectionPolyline(coors) {
  if (!Array.isArray(coors) || coors.length < 4) return [];
  const c = coors.slice();
  for (let i = 2; i < c.length; i++) {
    c[i] = c[i - 2] + c[i] / 1000000;
  }
  const out = [];
  for (let i = 0; i + 1 < c.length; i += 2) {
    const lat = c[i];
    const lng = c[i + 1];
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
  return out;
}

async function drivingRoute(from, to) {
  const key = mapKey();
  const url = `https://apis.map.qq.com/ws/direction/v1/driving/?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&key=${encodeURIComponent(key)}`;
  try {
    const json = await httpsGetJson(url);
    if (json.status !== 0) return { meters: null, points: [] };
    const route = json.result && json.result.routes && json.result.routes[0];
    const meters = typeof route.distance === "number" ? route.distance : null;
    const poly = route && route.polyline;
    const points = Array.isArray(poly) ? decodeTencentDirectionPolyline(poly) : [];
    return { meters, points };
  } catch (e) {
    console.error("drivingRoute", e);
    return { meters: null, points: [] };
  }
}

async function reverseGeocode(lat, lng) {
  const key = mapKey();
  const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${encodeURIComponent(key)}&get_poi=0`;
  try {
    const json = await httpsGetJson(url);
    if (json.status !== 0) return { cityText: "", formatted: "" };
    const r = json.result || {};
    const ac = r.address_component || {};
    const city = ac.city || (r.ad_info && r.ad_info.city) || "";
    const cityText = String(city).replace(/市$/u, "") || "";
    const fa = r.formatted_addresses || {};
    const formatted =
      (fa.recommend && String(fa.recommend).trim()) ||
      (fa.rough && String(fa.rough).trim()) ||
      (r.address && String(r.address).trim()) ||
      "";
    return { cityText, formatted };
  } catch (e) {
    console.error("reverseGeocode", e);
    return { cityText: "", formatted: "" };
  }
}

/**
 * 首页/订单：接驾 + 营运两段路线；逆地理仅在有 driver 时算城市展示
 */
async function mapRoutes(payload) {
  const driver = payload.driverLatLng;
  const pickup = payload.pickupLatLng;
  const dropoff = payload.dropoffLatLng;

  let cityText = "";
  if (driver && Number.isFinite(driver.lat) && Number.isFinite(driver.lng)) {
    const geo = await reverseGeocode(driver.lat, driver.lng);
    cityText = geo.cityText || (geo.formatted ? geo.formatted.slice(0, 12) : "");
  }

  let leg1Meters = null;
  let leg1Points = [];
  let leg2Meters = null;
  let leg2Points = [];
  let fallback = false;

  if (driver && pickup && Number.isFinite(pickup.lat) && Number.isFinite(pickup.lng)) {
    const r1 = await drivingRoute(driver, pickup);
    leg1Meters = r1.meters;
    leg1Points = r1.points;
    if (leg1Meters == null || leg1Points.length === 0) fallback = true;
  }

  if (pickup && dropoff && Number.isFinite(dropoff.lat) && Number.isFinite(dropoff.lng)) {
    const r2 = await drivingRoute(pickup, dropoff);
    leg2Meters = r2.meters;
    leg2Points = r2.points;
    if (leg2Meters == null || leg2Points.length === 0) fallback = true;
  }

  return {
    ok: true,
    cityText,
    leg1Meters,
    leg1Points,
    leg2Meters,
    leg2Points,
    fallback,
  };
}

async function mapReverse(payload) {
  const lat = payload && Number(payload.lat);
  const lng = payload && Number(payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "BAD_COORDS" };
  }
  const geo = await reverseGeocode(lat, lng);
  return {
    ok: true,
    cityText: geo.cityText,
    formatted: geo.formatted,
  };
}

module.exports = {
  mapRoutes,
  mapReverse,
  drivingRoute,
  reverseGeocode,
};
