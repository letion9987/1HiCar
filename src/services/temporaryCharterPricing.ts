/**
 * 临时包车预估价规则（与首页原静态示例对齐：营运里程 ×2元/km + 空驶 ×1×2）
 * 里程来自驾车路线 API（米），失败时由调用方用直线距离兜底。
 */
export const TEMP_CHARTER_OPERATING_YUAN_PER_KM = 2;
export const TEMP_CHARTER_DEADHEAD_YUAN_PER_KM = 1;
export const TEMP_CHARTER_DEADHEAD_MULTIPLIER = 2;

function roundMoney(n: number) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

/** operatingMeters：上车→下车；deadheadMeters：定位→上车（无定位时传 0） */
export function estimateTemporaryCharterYuan(operatingMeters: number, deadheadMeters: number) {
  const baseKm = Math.max(0, operatingMeters) / 1000;
  const deadKm = Math.max(0, deadheadMeters) / 1000;
  const baseYuan = roundMoney(baseKm * TEMP_CHARTER_OPERATING_YUAN_PER_KM);
  const emptyYuan = roundMoney(
    deadKm * TEMP_CHARTER_DEADHEAD_YUAN_PER_KM * TEMP_CHARTER_DEADHEAD_MULTIPLIER,
  );
  const totalYuan = roundMoney(baseYuan + emptyYuan);
  return { baseKm, deadKm, baseYuan, emptyYuan, totalYuan };
}
