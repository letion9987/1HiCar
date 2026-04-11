import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OrderRouteMap from "../components/OrderRouteMap";
import { getDrivingRoutePolyline } from "../services/tencentDrivingWeb";
import {
  getActiveOrdersUserId,
  getOrderById,
  prependOrder,
  type OrderItem,
  type OrderLatLng,
} from "../services/ordersStore";
import type { BookingSubmitState } from "../types/booking";

export default function BookingResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as BookingSubmitState | null;

  const [order, setOrder] = useState<OrderItem | null>(null);
  const [leg1, setLeg1] = useState<OrderLatLng[]>([]);
  const [leg2, setLeg2] = useState<OrderLatLng[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getActiveOrdersUserId()) {
      navigate("/", { replace: true });
      return;
    }
    if (!state?.clientOrderId || !state.pickup?.latLng) {
      navigate("/", { replace: true });
      return;
    }

    const existing = getOrderById(state.clientOrderId);
    if (existing) {
      setOrder(existing);
      setLeg1(existing.routeLeg1Path ?? []);
      setLeg2(existing.routeLeg2Path ?? []);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        let p1: OrderLatLng[] = [];
        let p2: OrderLatLng[] = [];
        if (state.driverLatLng) {
          p1 = await getDrivingRoutePolyline(state.driverLatLng, state.pickup.latLng);
        }
        if (state.dropoff?.latLng) {
          p2 = await getDrivingRoutePolyline(state.pickup.latLng, state.dropoff.latLng);
        }
        if (cancelled) return;

        const row: OrderItem = {
          id: state.clientOrderId,
          status: "pending",
          from: state.pickup.label,
          to: state.dropoff?.label ?? "",
          useTime: state.useTime,
          remark: state.remark || undefined,
          passengers: state.passengers,
          pricingMode: state.pricingMode,
          vehicleLabel: state.vehicleLabel,
          estimatedTotalYuan: state.estimatedTotalYuan,
          depositPaidYuan: state.depositPaidYuan,
          driverLatLng: state.driverLatLng,
          pickupLatLng: state.pickup.latLng,
          dropoffLatLng: state.dropoff?.latLng ?? null,
          routeLeg1Path: p1.length > 0 ? p1 : undefined,
          routeLeg2Path: p2.length > 0 ? p2 : undefined,
          tempFeeDetail: state.tempFeeDetail,
        };
        prependOrder(row);
        const saved = getOrderById(state.clientOrderId);
        if (saved) setOrder(saved);
        setLeg1(p1);
        setLeg2(p2);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, navigate]);

  const displayOrder = order;
  const vehicleText =
    displayOrder?.vehicleLabel ?? "商务7座 · 丰田埃尔法或同级";
  const useTimeText = displayOrder?.useTime ?? state?.useTime ?? "—";
  const fromText = displayOrder?.from ?? state?.pickup.label ?? "—";
  const orderId = state?.clientOrderId ?? displayOrder?.id ?? "";

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-backgroundLight font-display text-slate-900">
      <header className="z-50 flex shrink-0 items-center border-b border-slate-100 bg-white p-4">
        <button className="flex size-10 items-center justify-center" onClick={() => navigate("/")}>
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="flex-1 pr-10 text-center text-lg font-bold leading-tight">预约结果</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <div className="flex flex-col items-center justify-center px-6 pb-8 pt-12">
          <div className="mb-6 flex items-center justify-center rounded-full bg-primary/10 p-4">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 64 }}>
              check_circle
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-bold leading-tight">预约成功</h3>
          <p className="max-w-xs text-center text-sm font-normal leading-relaxed text-slate-500">
            预约成功，请保持手机畅通，司机将尽快与您电话联系沟通详情。
          </p>
        </div>

        <div className="px-4 py-2">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-4 border-b border-slate-50 pb-3 text-lg font-bold">预约详情</p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-1 text-slate-400">directions_car</span>
                <div className="flex flex-col">
                  <p className="text-xs uppercase tracking-wider text-slate-400">预约车型</p>
                  <p className="font-medium text-slate-700">{vehicleText}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-1 text-slate-400">schedule</span>
                <div className="flex flex-col">
                  <p className="text-xs uppercase tracking-wider text-slate-400">出发时间</p>
                  <p className="font-medium text-slate-700">{useTimeText}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-1 text-slate-400">location_on</span>
                <div className="flex flex-col">
                  <p className="text-xs uppercase tracking-wider text-slate-400">出发地点</p>
                  <p className="font-medium text-slate-700">{fromText}</p>
                </div>
              </div>
            </div>
            <div className="relative mt-6">
              {loading ? (
                <div className="flex h-32 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                  路线加载中…
                </div>
              ) : state?.pickup.latLng ? (
                <OrderRouteMap
                  driverLatLng={state.driverLatLng}
                  pickupLatLng={state.pickup.latLng}
                  dropoffLatLng={state.dropoff?.latLng ?? null}
                  pathLeg1={leg1}
                  pathLeg2={leg2}
                  className="aspect-video w-full"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-600">
                  暂无路线
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4 p-6">
          <button
            type="button"
            className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20"
            onClick={() => navigate("/")}
          >
            返回首页
          </button>
          <button
            type="button"
            disabled={!orderId}
            className="w-full rounded-xl border border-slate-200 bg-white py-4 font-bold text-slate-700 disabled:opacity-50"
            onClick={() =>
              navigate(`/orders/${encodeURIComponent(orderId)}?status=pending`, {
                replace: true,
              })
            }
          >
            查看订单详情
          </button>
        </div>

        <div className="p-6 text-center">
          <p className="text-xs text-slate-400">
            如有疑问，请拨打客服电话 <span className="font-medium text-primary">400-888-9999</span>
          </p>
        </div>
      </div>
    </div>
  );
}
