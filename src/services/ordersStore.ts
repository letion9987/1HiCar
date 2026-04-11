import { loadPersistedProfile } from "./userProfileApi";

export type OrderStatus = "pending" | "ongoing" | "completed" | "cancelled";

export type OrderLatLng = { lat: number; lng: number };

export type OrderItem = {
  id: string;
  status: OrderStatus;
  from: string;
  to: string;
  useTime: string;
  remark?: string;
  passengers?: number;
  pricingMode?: "package" | "temporary";
  vehicleLabel?: string;
  estimatedTotalYuan?: number;
  /** 预约支付定金（元）；缺省时用 computeDepositPaidYuan 推算 */
  depositPaidYuan?: number;
  driverLatLng?: OrderLatLng | null;
  pickupLatLng?: OrderLatLng;
  dropoffLatLng?: OrderLatLng | null;
  /** 驾车路线折线（定位→上车） */
  routeLeg1Path?: OrderLatLng[];
  /** 驾车路线折线（上车→下车） */
  routeLeg2Path?: OrderLatLng[];
  tempFeeDetail?: {
    baseYuan: number;
    emptyYuan: number;
    baseKm: number;
    deadKm: number;
  };
  /** 确认结算后写入，已完成订单费用明细（对齐 stitch/_11） */
  settlementSnapshot?: OrderSettlementSnapshot;
};

/** 结算确认时写入，供订单详情展示 */
export type OrderSettlementSnapshot = {
  baseLineLabel: string;
  baseYuan: number;
  emptyLineLabel: string;
  emptyYuan: number;
  overtimeMinutes: number;
  overtimeYuan: number;
  overDistanceKm: number;
  /** 超距单价（元/km），展示为副标题「x km × 单价」 */
  overDistanceYuanPerKm: number;
  overDistanceYuan: number;
  tollYuan: number;
  paidTotalYuan: number;
  /** 完成时间展示，如 10-24 15:30 */
  completedAtLabel: string;
};

export const SETTLEMENT_OVERTIME_YUAN_PER_MINUTE = 1;
export const SETTLEMENT_OVER_DISTANCE_YUAN_PER_KM = 2;

function pad2Local(n: number) {
  return String(n).padStart(2, "0");
}

/** 根据订单与结算弹窗输入生成快照（与 stitch/_11 费用结构一致） */
export function buildSettlementSnapshot(
  order: OrderItem,
  input: {
    overtimeMinutes: number;
    overDistanceKm: number;
    tollYuan: number;
  },
): OrderSettlementSnapshot {
  const now = new Date();
  const completedAtLabel = `${pad2Local(now.getMonth() + 1)}-${pad2Local(now.getDate())} ${pad2Local(now.getHours())}:${pad2Local(now.getMinutes())}`;

  let baseLineLabel: string;
  let baseYuan: number;
  let emptyLineLabel: string;
  let emptyYuan: number;

  if (order.pricingMode === "temporary" && order.tempFeeDetail) {
    const d = order.tempFeeDetail;
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

/** 与首页套餐参考总价一致，用于无 stored 定金时的推算 */
export const ORDER_PACKAGE_REFERENCE_TOTAL_YUAN = 500;

/** 与首页一致：max(预估×20%, 空驶补偿)；有 depositPaidYuan 时优先用订单字段 */
export function computeDepositPaidYuan(order: OrderItem): number {
  if (typeof order.depositPaidYuan === "number" && Number.isFinite(order.depositPaidYuan)) {
    return Math.round(order.depositPaidYuan * 100) / 100;
  }
  const emptyPrice =
    order.pricingMode === "temporary" && order.tempFeeDetail ? order.tempFeeDetail.emptyYuan : 0;
  let estimated = order.estimatedTotalYuan;
  if (estimated == null || !Number.isFinite(estimated)) {
    if (order.pricingMode === "package") {
      estimated = ORDER_PACKAGE_REFERENCE_TOTAL_YUAN;
    } else if (order.pricingMode === "temporary" && order.tempFeeDetail) {
      estimated = order.tempFeeDetail.baseYuan + order.tempFeeDetail.emptyYuan;
    } else {
      estimated = 320.5;
    }
  }
  return Math.round(Math.max(estimated * 0.2, emptyPrice) * 100) / 100;
}

/** 历史版本无下车点时写入的占位，展示时应视为空行 */
const LEGACY_EMPTY_DESTINATION = "（套餐内行程）";

/** 订单列表/详情展示终点：无下车点或历史占位时不显示文案 */
export function orderDestinationDisplay(to: string | undefined): string {
  const t = to ?? "";
  return t === LEGACY_EMPTY_DESTINATION ? "" : t;
}

/** 旧版全局订单 key，首次绑定用户时迁移到按用户隔离的存储 */
const LEGACY_ORDERS_KEY = "hicar_orders_v1";

export const ORDERS_UPDATED_EVENT = "hicar-orders-updated";

let activeOrdersUserId: string | null = null;

/** 与 localStorage 中的用户资料同步当前订单命名空间（应用启动时调用） */
export function hydrateOrdersUserFromStorage() {
  if (typeof window === "undefined") return;
  activeOrdersUserId = loadPersistedProfile()?.id ?? null;
}

export function getActiveOrdersUserId(): string | null {
  return activeOrdersUserId;
}

export function setActiveOrdersUserId(userId: string | null) {
  activeOrdersUserId = userId;
  notify();
}

function storageKeyForUser(userId: string) {
  return `hicar_orders_uid_${userId}_v1`;
}

/** 将旧版 `hicar_orders_v1` 迁入当前用户（仅当该用户尚无订单文件时） */
export function migrateLegacyOrdersIfNeeded(userId: string) {
  if (typeof window === "undefined") return;
  const legacy = localStorage.getItem(LEGACY_ORDERS_KEY);
  if (legacy == null) return;
  const nextKey = storageKeyForUser(userId);
  if (localStorage.getItem(nextKey) != null) {
    localStorage.removeItem(LEGACY_ORDERS_KEY);
    return;
  }
  localStorage.setItem(nextKey, legacy);
  localStorage.removeItem(LEGACY_ORDERS_KEY);
}

function parseStored(raw: string | null): OrderItem[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as OrderItem[];
  } catch {
    return null;
  }
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
}

export function loadOrders(): OrderItem[] {
  if (typeof window === "undefined") return [];
  if (!activeOrdersUserId) return [];
  const raw = localStorage.getItem(storageKeyForUser(activeOrdersUserId));
  if (raw == null) return [];
  const parsed = parseStored(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveOrders(orders: OrderItem[]) {
  if (typeof window === "undefined") return;
  if (!activeOrdersUserId) return;
  localStorage.setItem(storageKeyForUser(activeOrdersUserId), JSON.stringify(orders));
  notify();
}

/** 新订单插到列表前；相同 id 已存在则跳过（防重复提交） */
export function prependOrder(order: OrderItem) {
  if (!activeOrdersUserId) return;
  const existing = loadOrders();
  if (existing.some((o) => o.id === order.id)) return;
  saveOrders([order, ...existing]);
}

export function getOrderById(id: string): OrderItem | undefined {
  return loadOrders().find((o) => o.id === id);
}

/** 待确认 → 租赁中（例如已联系司机并开始行程） */
export function startTripById(id: string): boolean {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx < 0) return false;
  if (orders[idx].status !== "pending") return false;
  const next = [...orders];
  next[idx] = { ...next[idx], status: "ongoing" };
  saveOrders(next);
  return true;
}

/** 仅「待确认」可取消，取消后变为已取消 */
export function cancelOrderById(id: string): boolean {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx < 0) return false;
  if (orders[idx].status !== "pending") return false;
  const next = [...orders];
  next[idx] = { ...next[idx], status: "cancelled" };
  saveOrders(next);
  return true;
}

export function deleteOrderById(id: string): boolean {
  const orders = loadOrders();
  const next = orders.filter((o) => o.id !== id);
  if (next.length === orders.length) return false;
  saveOrders(next);
  return true;
}

/** 费用结算后：租赁中 → 已完成，并写入结算明细 */
export function completeOrderWithSettlement(id: string, snapshot: OrderSettlementSnapshot): boolean {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx < 0) return false;
  if (orders[idx].status !== "ongoing") return false;
  const next = [...orders];
  next[idx] = { ...next[idx], status: "completed", settlementSnapshot: snapshot };
  saveOrders(next);
  return true;
}
