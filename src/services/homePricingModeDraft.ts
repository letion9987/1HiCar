/** 首页计价方式：子路由返回时恢复 8h/200km 套餐 vs 临时包车 */
const KEY = "hicar_home_pricing_mode_v1";

export type HomePricingMode = "package" | "temporary";

export function loadHomePricingMode(): HomePricingMode {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === "temporary" || raw === "package") return raw;
  } catch {
    // ignore
  }
  return "package";
}

export function saveHomePricingMode(mode: HomePricingMode) {
  try {
    sessionStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
}
