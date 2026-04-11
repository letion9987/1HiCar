import { useNavigate, useSearchParams } from "react-router-dom";

export default function OrderDetail() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const status = search.get("status") ?? "pending";
  const statusText =
    status === "ongoing" ? "司机正在服务中" : status === "completed" ? "行程已完成" : "司机正前往起点";

  return (
    <div className="min-h-screen bg-backgroundLight font-display text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="flex items-center p-4">
          <button className="flex items-center justify-center p-1" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="flex-1 pr-8 text-center">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold">订单详情</span>
              <span className="mt-0.5 text-xs font-normal text-slate-500">订单号：BCY20231120889</span>
            </div>
          </h1>
        </div>
      </header>

      <main className="pb-32">
        <div className="p-4">
          <div className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                {status === "completed" ? "已完成" : status === "ongoing" ? "租赁中" : "待确认"}
              </span>
              <h2 className="mt-1 text-xl font-bold">{statusText}</h2>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="material-symbols-outlined text-3xl text-primary">directions_car</span>
            </div>
          </div>
        </div>

        <div className="mb-4 px-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-inner" />
        </div>

        <div className="space-y-4 px-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between border-b border-slate-50 pb-4">
              <p className="text-lg font-bold">商务7座 · 丰田埃尔法或同级</p>
              <div className="h-12 w-20 rounded-lg bg-slate-100" />
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-0.5 text-slate-400">schedule</span>
                <div className="flex flex-col">
                  <p className="font-medium">2023-11-20 10:00</p>
                  <p className="text-xs text-slate-400">预约出发时间</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-0.5 text-slate-400">group</span>
                <div className="flex flex-col">
                  <p className="font-medium">3人</p>
                  <p className="text-xs text-slate-400">乘车人数</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-0.5 text-slate-400">notes</span>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">有大件行李、需走高架</p>
                  <p className="text-xs text-slate-400">行程备注</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                <p className="text-sm font-medium">上海市 虹桥国际机场 T2航站楼</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
                <p className="text-sm font-medium">上海市 静安区 嘉里中心</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">费用明细</h3>
              <span className="material-symbols-outlined text-sm text-slate-400">info</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">基础行程 (128.2km × 2.5)</span>
                <span className="font-medium">¥320.50</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">空驶补偿 (15.0km × 0 × 2)</span>
                <span className="font-medium">¥0.00</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <span className="font-bold">预估总额</span>
                <span className="text-2xl font-bold text-accent">¥320.50</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t border-slate-100 bg-white p-4 pb-8 shadow-bottomBar">
        <button className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-700">取消订单</button>
        <button className="flex-[2] rounded-xl bg-primary py-3 font-semibold text-white">联系司机</button>
      </div>
    </div>
  );
}

