import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import UserIdentityDisplay from "../components/UserIdentityDisplay";
import { useUserSession } from "../contexts/UserSessionContext";
import { useOrders } from "../hooks/useOrders";
import {
  clearProfileReturnContext,
  peekProfileReturnContext,
  saveProfileReturnContext,
} from "../services/profileReturnContext";
import {
  cancelOrderById,
  deleteOrderById,
  orderDestinationDisplay,
  type OrderItem,
  type OrderStatus,
} from "../services/ordersStore";

type OrderTab = "pending" | "ongoing" | "completed" | "cancelled";

const tabs: Array<{ key: OrderTab; label: string }> = [
  { key: "pending", label: "预约中" },
  { key: "ongoing", label: "租赁中" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

function statusBadgeClass(status: OrderStatus) {
  if (status === "pending") return "text-orange-600 bg-orange-50";
  if (status === "ongoing") return "text-blue-600 bg-blue-50";
  if (status === "completed") return "text-emerald-600 bg-emerald-50";
  return "text-neutral-500 bg-neutral-100";
}

function statusLabel(status: OrderStatus) {
  if (status === "pending") return "待确认";
  if (status === "ongoing") return "租赁中";
  if (status === "completed") return "已完成";
  return "已取消";
}

function statusQuery(status: OrderStatus) {
  if (status === "pending") return "pending";
  if (status === "ongoing") return "ongoing";
  if (status === "completed") return "completed";
  return "cancelled";
}

function initialProfileTab(): OrderTab {
  return peekProfileReturnContext()?.tab ?? "pending";
}

export default function Profile() {
  const navigate = useNavigate();
  const { profile, hasUser } = useUserSession();
  const { orders } = useOrders();

  useEffect(() => {
    if (!hasUser) {
      navigate("/", { replace: true });
    }
  }, [hasUser, navigate]);
  const [activeTab, setActiveTab] = useState<OrderTab>(() => initialProfileTab());
  const [confirmTarget, setConfirmTarget] = useState<
    null | { kind: "cancel" | "delete"; order: OrderItem }
  >(null);
  const [pendingScrollOrderId, setPendingScrollOrderId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const ctx = peekProfileReturnContext();
    if (!ctx) return;
    setPendingScrollOrderId(ctx.orderId);
  }, []);

  const currentList = useMemo(
    () => orders.filter((item) => item.status === activeTab),
    [orders, activeTab],
  );

  useEffect(() => {
    if (!pendingScrollOrderId) return;
    const targetId = pendingScrollOrderId;
    const inList = currentList.some((o) => o.id === targetId);
    if (!inList) {
      clearProfileReturnContext();
      setPendingScrollOrderId(null);
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(`profile-order-${targetId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      clearProfileReturnContext();
      setPendingScrollOrderId(null);
    });
  }, [pendingScrollOrderId, currentList]);

  const requestCancel = (o: OrderItem) => {
    if (o.status !== "pending") return;
    setConfirmTarget({ kind: "cancel", order: o });
  };

  const requestDelete = (o: OrderItem) => {
    if (o.status !== "completed" && o.status !== "cancelled") return;
    setConfirmTarget({ kind: "delete", order: o });
  };

  const handleConfirmAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "cancel") {
      if (cancelOrderById(confirmTarget.order.id)) setActiveTab("cancelled");
    } else {
      deleteOrderById(confirmTarget.order.id);
    }
    setConfirmTarget(null);
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-backgroundLight font-display text-slate-500">
        正在跳转…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-backgroundLight font-display">
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
        <div className="flex items-center p-4">
          <button className="flex items-center text-slate-900" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <h1 className="mr-8 flex-1 text-center text-lg font-bold text-slate-900">个人中心</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-md pb-10">
        <section className="mb-3 bg-white p-6 shadow-sm">
          <UserIdentityDisplay
            profile={profile}
            onMembershipClick={() => navigate("/profile/membership-levels")}
          />
        </section>

        <section className="sticky top-[61px] z-40 border-b border-neutral-100 bg-white">
          <div className="flex justify-around">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "flex-1 py-4 text-base",
                  activeTab === tab.key
                    ? "border-b-4 border-primary font-bold text-primary"
                    : "font-medium text-slate-500",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 p-4">
          {currentList.length === 0 ? (
            <section className="flex min-h-[400px] flex-col items-center justify-center p-10">
              <div className="mb-6 flex size-32 items-center justify-center rounded-full bg-neutral-100">
                <span className="material-symbols-outlined text-6xl text-neutral-300">
                  directions_car
                </span>
              </div>
              <h2 className="mb-2 text-xl font-bold text-slate-800">暂无相关订单</h2>
              <p className="mb-8 max-w-[240px] text-center text-sm text-slate-400">
                您还没有相关的包车订单，快去开启行程吧
              </p>
              <button
                className="w-full max-w-[160px] rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-primary/20"
                onClick={() => navigate("/")}
              >
                去预约
              </button>
            </section>
          ) : (
            currentList.map((o) => (
              <div
                key={o.id}
                id={`profile-order-${o.id}`}
                className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between border-b border-neutral-50 pb-3">
                  <span className="text-sm font-medium text-slate-500">订单号：{o.id}</span>
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 text-[13px] font-bold",
                      statusBadgeClass(o.status),
                    ].join(" ")}
                  >
                    {statusLabel(o.status)}
                  </span>
                </div>
                <div className={["space-y-4", o.status === "cancelled" ? "opacity-60" : ""].join(" ")}>
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        o.status === "cancelled" ? "bg-neutral-300" : "bg-primary",
                      ].join(" ")}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">起点</span>
                      <p className="text-base font-semibold text-slate-800">{o.from}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        o.status === "cancelled" ? "bg-neutral-300" : "bg-orange-500",
                      ].join(" ")}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">终点</span>
                      <p className="min-h-[1.5rem] text-base font-semibold text-slate-800">
                        {orderDestinationDisplay(o.to)}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={[
                    "mt-4 flex items-center",
                    o.status === "cancelled" ? "text-slate-400" : "text-slate-600",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined mr-2 text-[20px]">schedule</span>
                  <p className="text-sm font-medium">用车时间：{o.useTime}</p>
                </div>
                {o.remark ? (
                  <div
                    className={[
                      "mt-3 flex items-start",
                      o.status === "cancelled" ? "text-slate-400" : "text-slate-600",
                    ].join(" ")}
                  >
                    <span className="material-symbols-outlined mr-2 text-[20px]">notes</span>
                    <p className="text-sm font-medium">备注：{o.remark}</p>
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                  {o.status === "pending" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-800 px-6 py-2 text-sm font-bold text-slate-900"
                      onClick={() => requestCancel(o)}
                    >
                      取消订单
                    </button>
                  ) : null}
                  {o.status === "completed" || o.status === "cancelled" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-200 px-6 py-2 text-sm font-bold text-red-500"
                      onClick={() => requestDelete(o)}
                    >
                      删除
                    </button>
                  ) : null}
                  {(o.status === "pending" ||
                    o.status === "ongoing" ||
                    o.status === "completed") && (
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-md shadow-primary/20"
                      onClick={() => {
                        saveProfileReturnContext({ tab: activeTab, orderId: o.id });
                        navigate(`/orders/${encodeURIComponent(o.id)}?status=${statusQuery(o.status)}`);
                      }}
                    >
                      查看详情
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget?.kind === "cancel" ? "取消订单" : "删除订单"}
        message={
          confirmTarget?.kind === "cancel"
            ? "确定要取消该订单吗？取消后可在「已取消」中查看。"
            : "确定删除该订单？删除后不可恢复。"
        }
        cancelLabel="再想想"
        confirmLabel={confirmTarget?.kind === "cancel" ? "确定取消" : "确定删除"}
        confirmVariant={confirmTarget?.kind === "delete" ? "danger" : "primary"}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
