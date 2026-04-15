/** 临时包车计价（与 Web temporaryCharterPricing 一致） */
const TEMP_CHARTER_OPERATING_YUAN_PER_KM = 2;
const TEMP_CHARTER_DEADHEAD_YUAN_PER_KM = 1;
const TEMP_CHARTER_DEADHEAD_MULTIPLIER = 2;

function roundMoney(n) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

function estimateTemporaryCharterYuan(operatingMeters, deadheadMeters) {
  const baseKm = Math.max(0, operatingMeters) / 1000;
  const deadKm = Math.max(0, deadheadMeters) / 1000;
  const baseYuan = roundMoney(baseKm * TEMP_CHARTER_OPERATING_YUAN_PER_KM);
  const emptyYuan = roundMoney(
    deadKm * TEMP_CHARTER_DEADHEAD_YUAN_PER_KM * TEMP_CHARTER_DEADHEAD_MULTIPLIER,
  );
  const totalYuan = roundMoney(baseYuan + emptyYuan);
  return { baseKm, deadKm, baseYuan, emptyYuan, totalYuan };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

module.exports = {
  estimateTemporaryCharterYuan,
  haversineMeters,
  TEMP_CHARTER_OPERATING_YUAN_PER_KM,
  TEMP_CHARTER_DEADHEAD_YUAN_PER_KM,
  TEMP_CHARTER_DEADHEAD_MULTIPLIER,
};
