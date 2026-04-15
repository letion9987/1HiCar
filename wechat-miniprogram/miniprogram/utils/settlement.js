const SETTLEMENT_OVERTIME_YUAN_PER_MINUTE = 1;
const SETTLEMENT_OVER_DISTANCE_YUAN_PER_KM = 2;

function pad2Local(n) {
  return String(n).padStart(2, "0");
}

function buildSettlementSnapshot(order, input) {
  const now = new Date();
  const completedAtLabel = `${pad2Local(now.getMonth() + 1)}-${pad2Local(now.getDate())} ${pad2Local(now.getHours())}:${pad2Local(now.getMinutes())}`;

  let baseLineLabel;
  let baseYuan;
  let emptyLineLabel;
  let emptyYuan;

  const d = order.tempFeeDetail;
  if (order.pricingMode === "temporary" && d) {
    baseLineLabel = `基础行程（约 ${d.baseKm.toFixed(1)} km）`;
    baseYuan = d.baseYuan;
    emptyLineLabel = `空驶补偿（约 ${d.deadKm.toFixed(1)} km）`;
    emptyYuan = d.emptyYuan;
  } else if (order.pricingMode === "package") {
    baseLineLabel = "基础行程（8h / 200km）";
    baseYuan = order.estimatedTotalYuan ?? 500;
    emptyLineLabel = "空驶补偿";
    emptyYuan = 0;
  } else {
    baseLineLabel = "基础行程";
    baseYuan = order.estimatedTotalYuan ?? 320.5;
    emptyLineLabel = "空驶补偿";
    emptyYuan = 0;
  }

  const overtimeYuan = input.overtimeMinutes * SETTLEMENT_OVERTIME_YUAN_PER_MINUTE;
  const overDistanceYuan = input.overDistanceKm * SETTLEMENT_OVER_DISTANCE_YUAN_PER_KM;
  const paidTotalYuan = baseYuan + emptyYuan + overtimeYuan + overDistanceYuan + input.tollYuan;

  return {
    baseLineLabel,
    baseYuan,
    emptyLineLabel,
    emptyYuan,
    overtimeMinutes: input.overtimeMinutes,
    overtimeYuan,
    overDistanceKm: input.overDistanceKm,
    overDistanceYuanPerKm: SETTLEMENT_OVER_DISTANCE_YUAN_PER_KM,
    overDistanceYuan,
    tollYuan: input.tollYuan,
    paidTotalYuan,
    completedAtLabel,
  };
}

function computeDepositPaidYuan(order) {
  if (typeof order.depositPaidYuan === "number" && Number.isFinite(order.depositPaidYuan)) {
    return Math.round(order.depositPaidYuan * 100) / 100;
  }
  const emptyPrice =
    order.pricingMode === "temporary" && order.tempFeeDetail
      ? order.tempFeeDetail.emptyYuan
      : 0;
  let estimated = order.estimatedTotalYuan;
  if (estimated == null || !Number.isFinite(estimated)) {
    if (order.pricingMode === "package") estimated = 500;
    else if (order.pricingMode === "temporary" && order.tempFeeDetail) {
      estimated = order.tempFeeDetail.baseYuan + order.tempFeeDetail.emptyYuan;
    } else estimated = 320.5;
  }
  return Math.round(Math.max(estimated * 0.2, emptyPrice) * 100) / 100;
}

function orderDestinationDisplay(to) {
  const t = to || "";
  return t === "（套餐内行程）" ? "" : t;
}

module.exports = {
  buildSettlementSnapshot,
  computeDepositPaidYuan,
  orderDestinationDisplay,
};
