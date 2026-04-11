import { useCallback, useEffect, useState } from "react";
import {
  ORDERS_UPDATED_EVENT,
  loadOrders,
  type OrderItem,
} from "../services/ordersStore";
import { USER_SESSION_UPDATED_EVENT } from "../services/userProfileApi";

export function useOrders() {
  const [orders, setOrders] = useState<OrderItem[]>(() => loadOrders());

  const refresh = useCallback(() => {
    setOrders(loadOrders());
  }, []);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(ORDERS_UPDATED_EVENT, onUpdate);
    window.addEventListener(USER_SESSION_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(USER_SESSION_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  return { orders, refresh };
}
