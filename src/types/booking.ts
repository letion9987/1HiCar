import type { OrderLatLng } from "../services/ordersStore";

/** 首页支付后传入预约结果页的状态 */
export type BookingSubmitState = {
  clientOrderId: string;
  pickup: { label: string; latLng: OrderLatLng };
  dropoff: { label: string; latLng: OrderLatLng } | null;
  driverLatLng: OrderLatLng | null;
  useTime: string;
  remark: string;
  pricingMode: "package" | "temporary";
  estimatedTotalYuan: number;
  /** 与首页「应付定金」一致 */
  depositPaidYuan: number;
  passengers: number;
  vehicleLabel: string;
  /** 临时包车费用明细（套餐无） */
  tempFeeDetail?: {
    baseYuan: number;
    emptyYuan: number;
    baseKm: number;
    deadKm: number;
  };
};
