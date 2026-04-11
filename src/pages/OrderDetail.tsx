import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import SettlementSheet from "../components/SettlementSheet";
import OrderRouteMap from "../components/OrderRouteMap";
import { useOrders } from "../hooks/useOrders";
import {
  cancelOrderById,
  computeDepositPaidYuan,
  deleteOrderById,
  orderDestinationDisplay,
  startTripById,
  type OrderItem,
  type OrderStatus,
} from "../services/ordersStore";
import {
  clearProfileReturnContext,
  peekProfileReturnOrderId,
} from "../services/profileReturnContext";

type UrlStatus = "pending" | "ongoing" | "completed" | "cancelled";

function normalizeUrlStatus(raw: string | null): UrlStatus {
  if (raw === "ongoing" || raw === "completed" || raw === "cancelled" || raw === "pending") {
    return raw;
  }
  return "pending";
}

function effectiveStatus(order: OrderItem | undefined, urlStatus: UrlStatus): OrderStatus {
  return order?.status ?? urlStatus;
}

function fmtYuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

export default function OrderDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: rawId } = useParams();
  const id = rawId ? decodeURIComponent(rawId) : "";
  const [search] = useSearchParams();
  const urlStatus = normalizeUrlStatus(search.get("status"));
  const [confirmKind, setConfirmKind] = useState<null | "cancel" | "delete" | "contactDriver">(null);
  const [settlementOpen, setSettlementOpen] = useState(false);

  const { orders } = useOrders();
  const order = useMemo(
    () => (id ? orders.find((o) => o.id === id) : undefined),
    [orders, id],
  );

  const status = effectiveStatus(order, urlStatus);

  const handleHeaderBack = () => {
    const storedOrderId = peekProfileReturnOrderId();
    if (storedOrderId !== null && storedOrderId === id) {
      navigate("/profile");
      return;
    }
    if (storedOrderId !== null && storedOrderId !== id) {
      clearProfileReturnContext();
    }
    navigate(-1);
  };

  useEffect(() => {
    const st = (location.state as { openSettlement?: boolean } | null)?.openSettlement;
    if (!st || !id) return;
    if (!order) return;
    navigate(`/orders/${encodeURIComponent(id)}?status=ongoing`, { replace: true, state: {} });
    if (order.status === "ongoing") {
      setSettlementOpen(true);
    }
  }, [location.state, id, order, navigate]);

  const pathLeg1 = order?.routeLeg1Path ?? [];
  const pathLeg2 = order?.routeLeg2Path ?? [];

  const statusText = (() => {
    if (status === "ongoing") return "司机正在服务中";
    if (status === "completed") return "行程已完成";
    if (status === "cancelled") return "订单已取消";
    return "司机正前往起点";
  })();

  const statusBadge = (() => {
    if (status === "ongoing") return "租赁中";
    if (status === "completed") return "已完成";
    if (status === "cancelled") return "已取消";
    return "待确认";
  })();

  const requestCancel = () => {
    if (!id || !order || order.status !== "pending") return;
    setConfirmKind("cancel");
  };

  const requestDelete = () => {
    if (!id || !order) return;
    if (order.status !== "completed" && order.status !== "cancelled") return;
    setConfirmKind("delete");
  };

  const requestContactDriver = () => {
    if (!id || !order || order.status !== "pending") return;
    setConfirmKind("contactDriver");
  };

  const openSettlementSheet = () => setSettlementOpen(true);

  const handleConfirmDialog = () => {
    if (!id || !confirmKind) return;
    if (confirmKind === "cancel") {
      cancelOrderById(id);
    } else if (confirmKind === "contactDriver") {
      if (startTripById(id)) {
        navigate(`/orders/${encodeURIComponent(id)}?status=ongoing`, { replace: true });
      }
    } else if (confirmKind === "delete" && deleteOrderById(id)) {
      navigate(-1);
    }
    setConfirmKind(null);
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-backgroundLight font-display p-4 text-slate-900">
        <p className="text-center text-sm text-slate-500">无效的订单链接</p>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-white"
          onClick={() => navigate(-1)}
        >
          返回
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-backgroundLight font-display text-slate-900">
        <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
          <div className="flex items-center p-4">
          <button className="flex items-center justify-center p-1" onClick={handleHeaderBack}>
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
            <h1 className="flex-1 pr-8 text-center text-lg font-bold">订单详情</h1>
            <div className="h-10 w-10" />
          </div>
        </header>
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="text-slate-600">订单不存在或已被删除</p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-white"
            onClick={() => navigate("/profile")}
          >
            返回个人中心
          </button>
        </div>
      </div>
    );
  }

  const fromLabel = order.from ?? "上海市 虹桥国际机场 T2航站楼";
  const toLabel = orderDestinationDisplay(order.to);
  const useTimeLabel = order.useTime ?? "2023-11-20 10:00";
  const remarkLine = order.remark?.trim() ?? "";
  const showRemarkRow = remarkLine.length > 0;

  const hasStoredEstimate = order.estimatedTotalYuan != null;
  const displayTotalYuan =
    order.settlementSnapshot?.paidTotalYuan ??
    order.estimatedTotalYuan ??
    (status === "completed" ? 669.5 : 320.5);
  const showLegacyCompletedExtras =
    status === "completed" && !order.settlementSnapshot && !hasStoredEstimate;
  const tempDetail = order.tempFeeDetail;
  const snap = order.settlementSnapshot;
  const showPaidDeposit = status === "pending" || status === "ongoing";
  const paidDepositYuan = showPaidDeposit ? computeDepositPaidYuan(order) : 0;

  return (
    <div className="min-h-screen bg-backgroundLight font-display text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="flex items-center p-4">
          <button className="flex items-center justify-center p-1" onClick={handleHeaderBack}>
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="flex-1 pr-8 text-center">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold">订单详情</span>
              <span className="mt-0.5 text-xs font-normal text-slate-500">订单号：{id}</span>
            </div>
          </h1>
          <button type="button" className="flex h-10 w-10 items-center justify-center text-slate-700">
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
        </div>
      </header>

      <main className="pb-32">
        <div className="p-4">
          <div className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm">
            {status === "completed" ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">行程已完成</h2>
                    <p className="text-sm text-slate-500">感谢您选择包车易服务</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">完成时间</p>
                  <p className="text-sm font-medium">
                    {snap?.completedAtLabel ?? "10-24 15:30"}
                  </p>
                </div>
              </>
            ) : status === "cancelled" ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="inline-flex w-fit items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                    {statusBadge}
                  </span>
                  <h2 className="mt-1 text-xl font-bold">{statusText}</h2>
                  <p className="text-sm text-slate-500">该订单已取消，可删除记录</p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                  <span className="material-symbols-outlined text-3xl text-neutral-400">cancel</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="inline-flex w-fit items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                    {statusBadge}
                  </span>
                  <h2 className="mt-1 text-xl font-bold">{statusText}</h2>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-3xl text-primary">directions_car</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 px-4">
          {order.pickupLatLng ? (
            <OrderRouteMap
              driverLatLng={order.driverLatLng ?? null}
              pickupLatLng={order.pickupLatLng}
              dropoffLatLng={order.dropoffLatLng ?? null}
              pathLeg1={pathLeg1}
              pathLeg2={pathLeg2}
              className="aspect-video w-full border border-slate-200 shadow-inner"
            />
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-inner" />
          )}
        </div>

        <div className="space-y-4 px-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between border-b border-slate-50 pb-4">
              <p className="text-lg font-bold">
                {order.vehicleLabel ?? "商务7座 · 丰田埃尔法或同级"}
              </p>
              <div className="h-12 w-20 rounded-lg bg-slate-100" />
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-0.5 text-slate-400">schedule</span>
                <div className="flex flex-col">
                  <p className="font-medium">{useTimeLabel}</p>
                  <p className="text-xs text-slate-400">预约出发时间</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-0.5 text-slate-400">group</span>
                <div className="flex flex-col">
                  <p className="font-medium">{order.passengers ?? 1}人</p>
                  <p className="text-xs text-slate-400">乘车人数</p>
                </div>
              </div>
              {showRemarkRow ? (
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined mt-0.5 text-slate-400">notes</span>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">{remarkLine}</p>
                    <p className="text-xs text-slate-400">行程备注</p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-4">
                <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                <p className="text-sm font-medium">{fromLabel}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
                <p className="min-h-[1.25rem] text-sm font-medium">{toLabel}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div
              className={[
                "flex items-center justify-between",
                status === "completed" && snap ? "mb-5" : "mb-4",
              ].join(" ")}
            >
              <h3 className="text-base font-bold">费用明细</h3>
              <span className="material-symbols-outlined text-sm text-slate-400">info</span>
            </div>
            {status === "completed" && snap ? (
              <div className="space-y-4">
                {order.pricingMode === "temporary" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{snap.baseLineLabel}</span>
                      <span className="text-sm font-medium">{fmtYuan(snap.baseYuan)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{snap.emptyLineLabel}</span>
                      <span className="text-sm font-medium">{fmtYuan(snap.emptyYuan)}</span>
                    </div>
                  </>
                ) : order.pricingMode === "package" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">套餐预估（8h / 200km）</span>
                    <span className="text-sm font-medium">
                      {fmtYuan(snap.baseYuan + snap.emptyYuan)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">{snap.baseLineLabel}</span>
                    <span className="text-sm font-medium">
                      {fmtYuan(snap.baseYuan + snap.emptyYuan)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-500">超时补差</span>
                    <span className="text-[10px] leading-none text-slate-400">
                      {snap.overtimeMinutes}分钟
                    </span>
                  </div>
                  <span className="text-sm font-medium">{fmtYuan(snap.overtimeYuan)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-500">超距补差</span>
                    <span className="text-[10px] leading-none text-slate-400">
                      {snap.overDistanceKm}km x {snap.overDistanceYuanPerKm.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{fmtYuan(snap.overDistanceYuan)}</span>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-slate-500">高速路桥费</span>
                  <span className="text-sm font-medium">{fmtYuan(snap.tollYuan)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <span className="font-bold text-slate-900">实付总额</span>
                  <span className="text-2xl font-bold text-accent">{fmtYuan(snap.paidTotalYuan)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {order.pricingMode === "temporary" && tempDetail ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        基础行程（约 {tempDetail.baseKm.toFixed(1)} km）
                      </span>
                      <span className="font-medium">{fmtYuan(tempDetail.baseYuan)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        空驶补偿（约 {tempDetail.deadKm.toFixed(1)} km）
                      </span>
                      <span className="font-medium">{fmtYuan(tempDetail.emptyYuan)}</span>
                    </div>
                  </>
                ) : order.pricingMode === "package" ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">套餐预估（8h / 200km）</span>
                    <span className="font-medium">
                      {fmtYuan(order.estimatedTotalYuan ?? 500)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">基础行程 (128.2km × 2.5)</span>
                      <span className="font-medium">¥320.50</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">空驶补偿 (15.0km × 0 × 2)</span>
                      <span className="font-medium">¥0.00</span>
                    </div>
                  </>
                )}
                {showLegacyCompletedExtras ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">超时补差</span>
                      <span className="font-medium">¥45.00</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">超距补差</span>
                      <span className="font-medium">¥100.00</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">高速路桥费</span>
                      <span className="font-medium">¥28.00</span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                  <span className="font-bold">{status === "completed" ? "总额" : "预估总额"}</span>
                  <span className="text-2xl font-bold text-accent">{fmtYuan(displayTotalYuan)}</span>
                </div>
                {showPaidDeposit ? (
                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-600">已付定金</span>
                    <span className="font-bold text-slate-900">{fmtYuan(paidDepositYuan)}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t border-slate-100 bg-white p-4 pb-8 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {status === "ongoing" ? (
          <>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 active:bg-slate-50"
              onClick={openSettlementSheet}
            >
              费用结算
            </button>
            <button
              type="button"
              className="flex-[2] rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/20 active:opacity-90"
              onClick={openSettlementSheet}
            >
              结束行程
            </button>
          </>
        ) : status === "completed" ? (
          <>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 active:bg-slate-50"
              onClick={requestDelete}
            >
              删除订单
            </button>
            <button
              type="button"
              className="flex-[2] rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/20 active:opacity-90"
              onClick={() => navigate("/")}
            >
              再次预约
            </button>
          </>
        ) : status === "cancelled" ? (
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 py-3 font-semibold text-red-500 active:bg-slate-50"
            onClick={requestDelete}
          >
            删除订单
          </button>
        ) : (
          <>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 active:bg-slate-50"
              onClick={requestCancel}
            >
              取消订单
            </button>
            <button
              type="button"
              className="flex-[2] rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/20 active:opacity-90"
              onClick={requestContactDriver}
            >
              联系司机
            </button>
          </>
        )}
      </div>

      {id ? (
        <SettlementSheet
          open={settlementOpen}
          onClose={() => setSettlementOpen(false)}
          orderId={id}
          order={order}
          onSettled={() => {
            navigate(`/orders/${encodeURIComponent(id)}?status=completed`, { replace: true });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmKind !== null}
        title={
          confirmKind === "cancel"
            ? "取消订单"
            : confirmKind === "delete"
              ? "删除订单"
              : confirmKind === "contactDriver"
                ? "联系司机"
                : undefined
        }
        message={
          confirmKind === "cancel"
            ? "确定要取消该订单吗？取消后订单状态将更新为已取消。"
            : confirmKind === "delete"
              ? "确定删除该订单？删除后不可恢复。"
              : confirmKind === "contactDriver"
                ? "确认已联系上司机并将开始行程？确认后订单将进入「租赁中」状态。"
                : ""
        }
        cancelLabel="再想想"
        confirmLabel={
          confirmKind === "cancel"
            ? "确定取消"
            : confirmKind === "delete"
              ? "确定删除"
              : "确定"
        }
        confirmVariant={confirmKind === "delete" ? "danger" : "primary"}
        onCancel={() => setConfirmKind(null)}
        onConfirm={handleConfirmDialog}
      />
    </div>
  );
}
