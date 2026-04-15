import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { OrderItem, OrderStatus } from "../services/ordersStore";

export const PROFILE_ORDERS_PAGE_SIZE = 10;

export type ProfileOrderTab = OrderStatus;

type TabPaging = { initialized: boolean; take: number };

function emptyPaging(): Record<ProfileOrderTab, TabPaging> {
  return {
    pending: { initialized: false, take: 0 },
    ongoing: { initialized: false, take: 0 },
    completed: { initialized: false, take: 0 },
    cancelled: { initialized: false, take: 0 },
  };
}

function filterByTab(orders: OrderItem[], tab: ProfileOrderTab) {
  return orders.filter((o) => o.status === tab);
}

/**
 * 与小程序个人中心一致：按 Tab 懒加载首屏、分页累加 take；订单数据指纹或 resetSignal 变化时清空各 Tab。
 */
export function useProfileOrderPaging(
  orders: OrderItem[],
  activeTab: ProfileOrderTab,
  resetSignal: number,
) {
  const [paging, setPaging] = useState(emptyPaging);

  const ordersFingerprint = useMemo(
    () => orders.map((o) => `${o.id}:${o.status}`).join("\u001f"),
    [orders],
  );

  useLayoutEffect(() => {
    setPaging(emptyPaging());
  }, [ordersFingerprint, resetSignal]);

  const filtered = useMemo(() => filterByTab(orders, activeTab), [orders, activeTab]);

  useLayoutEffect(() => {
    setPaging((prev) => {
      const cur = prev[activeTab];
      if (cur.initialized) return prev;
      const len = filtered.length;
      return {
        ...prev,
        [activeTab]: {
          initialized: true,
          take: Math.min(PROFILE_ORDERS_PAGE_SIZE, len),
        },
      };
    });
  }, [activeTab, filtered, ordersFingerprint, resetSignal]);

  const take = paging[activeTab].take;
  const initialized = paging[activeTab].initialized;

  const visibleList = useMemo(() => filtered.slice(0, take), [filtered, take]);

  const hasMore = initialized && take < filtered.length;

  const tabListLoading = !initialized;

  const loadMore = useCallback(() => {
    setPaging((prev) => {
      const cur = prev[activeTab];
      if (!cur.initialized) return prev;
      const len = filterByTab(orders, activeTab).length;
      const nextTake = Math.min(cur.take + PROFILE_ORDERS_PAGE_SIZE, len);
      if (nextTake === cur.take) return prev;
      return { ...prev, [activeTab]: { ...cur, take: nextTake } };
    });
  }, [activeTab, orders]);

  const ensureOrderVisible = useCallback(
    (orderId: string) => {
      setPaging((prev) => {
        const list = filterByTab(orders, activeTab);
        const indexInTab = list.findIndex((o) => o.id === orderId);
        if (indexInTab < 0) return prev;
        const need = indexInTab + 1;
        const cur = prev[activeTab];
        if (cur.take >= need) return prev;
        return {
          ...prev,
          [activeTab]: { initialized: true, take: need },
        };
      });
    },
    [activeTab, orders],
  );

  /** 从详情返回：在已知 Tab 下把该订单扩进当前页（用于滚动定位） */
  const expandToShowOrderForTab = useCallback(
    (tab: ProfileOrderTab, orderId: string) => {
      setPaging((prev) => {
        const list = filterByTab(orders, tab);
        const indexInTab = list.findIndex((o) => o.id === orderId);
        if (indexInTab < 0) return prev;
        const need = indexInTab + 1;
        const cur = prev[tab];
        return {
          ...prev,
          [tab]: { initialized: true, take: Math.max(cur.take, need) },
        };
      });
    },
    [orders],
  );

  return {
    visibleList,
    hasMore,
    tabListLoading,
    loadMore,
    ensureOrderVisible,
    expandToShowOrderForTab,
  };
}
