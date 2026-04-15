import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import UserIdentityDisplay from "../components/UserIdentityDisplay";
import { useUserSession } from "../contexts/UserSessionContext";
import { useOrders } from "../hooks/useOrders";
import { useProfileOrderPaging } from "../hooks/useProfileOrderPaging";
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

const PULL_THRESHOLD_PX = 56;
const PULL_MAX_PX = 100;
const PULL_DAMP = 0.42;
const REFRESH_DONE_MS = 520;

function windowScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export default function Profile() {
  const navigate = useNavigate();
  const { profile, hasUser } = useUserSession();
  const { orders, refresh } = useOrders();
  const [listResetSig, setListResetSig] = useState(0);

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
  const [pullPx, setPullPx] = useState(0);
  const [pullDragging, setPullDragging] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const pullRootRef = useRef<HTMLDivElement | null>(null);
  const pullPxRef = useRef(0);
  const pullStartYRef = useRef(0);
  const pullActiveRef = useRef(false);
  const pullRefreshingRef = useRef(false);
  const confirmOpenRef = useRef(false);
  const pullRefreshTimerRef = useRef<number | null>(null);
  pullRefreshingRef.current = pullRefreshing;
  confirmOpenRef.current = confirmTarget !== null;

  const runPullRefresh = useCallback(() => {
    refresh();
    setListResetSig((s) => s + 1);
    setPullRefreshing(true);
    if (pullRefreshTimerRef.current != null) window.clearTimeout(pullRefreshTimerRef.current);
    pullRefreshTimerRef.current = window.setTimeout(() => {
      pullRefreshTimerRef.current = null;
      setPullRefreshing(false);
    }, REFRESH_DONE_MS);
  }, [refresh]);

  useEffect(
    () => () => {
      if (pullRefreshTimerRef.current != null) window.clearTimeout(pullRefreshTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const el = pullRootRef.current;
    if (!el) return;

    const damp = (dy: number) => Math.min(Math.max(0, dy) * PULL_DAMP, PULL_MAX_PX);

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshingRef.current || confirmOpenRef.current) return;
      if (windowScrollTop() > 2) return;
      pullActiveRef.current = true;
      pullStartYRef.current = e.touches[0].clientY;
      setPullDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullActiveRef.current || pullRefreshingRef.current || confirmOpenRef.current) return;
      if (windowScrollTop() > 2) {
        pullActiveRef.current = false;
        pullPxRef.current = 0;
        setPullPx(0);
        setPullDragging(false);
        return;
      }
      const dy = e.touches[0].clientY - pullStartYRef.current;
      if (dy > 0) {
        e.preventDefault();
        const p = damp(dy);
        pullPxRef.current = p;
        setPullPx(p);
      } else {
        pullPxRef.current = 0;
        setPullPx(0);
      }
    };

    const onTouchEnd = () => {
      if (!pullActiveRef.current) return;
      pullActiveRef.current = false;
      setPullDragging(false);
      const p = pullPxRef.current;
      pullPxRef.current = 0;
      if (pullRefreshingRef.current || confirmOpenRef.current) {
        setPullPx(0);
        return;
      }
      if (p >= PULL_THRESHOLD_PX) {
        setPullPx(0);
        runPullRefresh();
      } else {
        setPullPx(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [runPullRefresh]);

  const {
    visibleList,
    hasMore,
    tabListLoading,
    loadMore,
    expandToShowOrderForTab,
  } = useProfileOrderPaging(orders, activeTab, listResetSig);

  const tabOrderCount = useMemo(
    () => orders.filter((item) => item.status === activeTab).length,
    [orders, activeTab],
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const expandToShowOrderForTabRef = useRef(expandToShowOrderForTab);
  expandToShowOrderForTabRef.current = expandToShowOrderForTab;

  useLayoutEffect(() => {
    const ctx = peekProfileReturnContext();
    if (!ctx) return;
    setPendingScrollOrderId(ctx.orderId);
    expandToShowOrderForTabRef.current(ctx.tab, ctx.orderId);
  }, []);

  useEffect(() => {
    if (!pendingScrollOrderId) return;
    const targetId = pendingScrollOrderId;
    const inList = visibleList.some((o) => o.id === targetId);
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
  }, [pendingScrollOrderId, visibleList]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore || tabListLoading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, tabListLoading, visibleList.length, activeTab]);

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

  const pullContentStyle: CSSProperties = {
    transform: `translateY(${pullPx}px)`,
    transition: pullDragging ? "none" : "transform 0.22s ease-out",
  };

  return (
    <div
      ref={pullRootRef}
      className="min-h-screen overflow-x-hidden bg-backgroundLight font-display [overscroll-behavior-y:contain]"
    >
      <div
        className="pointer-events-none fixed left-1/2 top-3 z-[55] -translate-x-1/2 text-primary"
        style={{
          opacity:
            pullRefreshing || pullPx > 6 ? 1 : 0,
          transition: "opacity 0.15s ease-out",
        }}
        aria-hidden
      >
        <span
          className={[
            "material-symbols-outlined block text-[30px]",
            pullRefreshing ? "animate-spin" : "",
          ].join(" ")}
        >
          {pullRefreshing ? "progress_activity" : pullPx >= PULL_THRESHOLD_PX ? "refresh" : "arrow_downward"}
        </span>
      </div>

      <div style={pullContentStyle}>
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
        <div className="flex items-center p-4">
          <button className="flex items-center text-slate-900" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <h1 className="mr-8 flex-1 text-center text-lg font-bold text-slate-900">个人中心</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-md pb-10" aria-busy={pullRefreshing}>
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
          {tabListLoading ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
              加载中…
            </div>
          ) : tabOrderCount === 0 ? (
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
            <>
            {visibleList.map((o) => (
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
            ))}
            {hasMore ? (
              <div
                ref={loadMoreRef}
                className="flex h-10 items-center justify-center text-xs text-slate-400"
                aria-hidden
              >
                上拉加载更多
              </div>
            ) : null}
            </>
          )}
        </section>
      </main>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget?.kind === "cancel" ? "取消订单" : "删除订单"}
        message={
          confirmTarget?.kind === "cancel"
            ? "确定要取消该订单吗？取消后可在「已取消」中查看。"
            : "确定删除该订单？删除后不可恢复。"
        }
        cancelLabel="再想想"
        confirmLabel={confirmTarget?.kind === "cancel" ? "取消" : "删除"}
        confirmVariant={confirmTarget?.kind === "delete" ? "danger" : "primary"}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
