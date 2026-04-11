import { useEffect, useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import {
  buildSettlementSnapshot,
  completeOrderWithSettlement,
  type OrderItem,
} from "../services/ordersStore";

type SettlementSheetProps = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  order: OrderItem;
  onSettled: () => void;
};

/** 输入为空或非数字时，预览/合计按 0；输入框本身保持空字符串不显示 0 */
function previewAmount(s: string): number {
  const t = s.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export default function SettlementSheet({
  open,
  onClose,
  orderId,
  order,
  onSettled,
}: SettlementSheetProps) {
  const [overtimeStr, setOvertimeStr] = useState("");
  const [overDistanceStr, setOverDistanceStr] = useState("");
  const [tollStr, setTollStr] = useState("");

  const overtimeMin = useMemo(() => previewAmount(overtimeStr), [overtimeStr]);
  const overDistanceKm = useMemo(() => previewAmount(overDistanceStr), [overDistanceStr]);
  const tollYuan = useMemo(() => previewAmount(tollStr), [tollStr]);
  const overtimeYuan = overtimeMin;
  const overDistanceYuan = overDistanceKm * 2;
  const extrasTotal = overtimeYuan + overDistanceYuan + tollYuan;

  useEffect(() => {
    if (!open) return;
    setOvertimeStr("");
    setOverDistanceStr("");
    setTollStr("");
  }, [open]);

  const handleConfirm = () => {
    if (!orderId) return;
    const snapshot = buildSettlementSnapshot(order, {
      overtimeMinutes: overtimeMin,
      overDistanceKm,
      tollYuan,
    });
    if (completeOrderWithSettlement(orderId, snapshot)) {
      onSettled();
      onClose();
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      backdropClassName="bg-black/40"
      maxHeightClassName="max-h-[84vh]"
      sheetClassName="bg-white rounded-t-xl overflow-hidden shadow-2xl"
      handleClassName="flex h-6 w-full items-center justify-center pt-2"
      handleBarClassName="h-1.5 w-10 rounded-full bg-slate-200"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footerClassName="shrink-0 border-t border-slate-100 bg-white px-6 pt-4 pb-10"
      footer={
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:brightness-110"
          onClick={handleConfirm}
        >
          确认结算
        </button>
      }
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-50 px-6 py-4">
        <button type="button" className="text-slate-400" onClick={onClose} aria-label="关闭">
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
        <h2 className="text-lg font-semibold text-slate-900">确认行程费用</h2>
        <div className="w-8" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
        <p className="mb-4 text-sm text-slate-500">请核对并输入产生的额外费用</p>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-slate-700">超时</label>
              <span className="text-xs text-slate-400">1元/分钟</span>
            </div>
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4"
              type="number"
              inputMode="decimal"
              value={overtimeStr}
              onChange={(e) => setOvertimeStr(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-slate-700">超距</label>
              <span className="text-xs text-slate-400">2元/公里</span>
            </div>
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4"
              type="number"
              inputMode="decimal"
              value={overDistanceStr}
              onChange={(e) => setOverDistanceStr(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-slate-700">高速路桥费</label>
              <span className="text-xs text-slate-400">实报实销</span>
            </div>
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4"
              type="number"
              inputMode="decimal"
              value={tollStr}
              onChange={(e) => setTollStr(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="font-medium text-slate-600">费用合计</span>
            <span className="text-3xl font-bold text-primary">¥{extrasTotal.toFixed(2)}</span>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>超时 ({overtimeMin}min × ¥1)</span>
              <span className="font-medium text-slate-700">¥{overtimeYuan.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>超距 ({overDistanceKm}km × ¥2)</span>
              <span className="font-medium text-slate-700">¥{overDistanceYuan.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>路桥费</span>
              <span className="font-medium text-slate-700">¥{tollYuan.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
