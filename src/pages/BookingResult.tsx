import { useNavigate } from "react-router-dom";

export default function BookingResult() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-backgroundLight font-display text-slate-900">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
        <div className="flex items-center border-b border-slate-100 bg-white p-4">
          <button className="flex size-10 items-center justify-center" onClick={() => navigate("/")}>
            <span className="material-symbols-outlined">close</span>
          </button>
          <h2 className="flex-1 pr-10 text-center text-lg font-bold leading-tight">预约结果</h2>
        </div>

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
                  <p className="font-medium text-slate-700">商务7座 · 丰田埃尔法或同级</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-1 text-slate-400">schedule</span>
                <div className="flex flex-col">
                  <p className="text-xs uppercase tracking-wider text-slate-400">出发时间</p>
                  <p className="font-medium text-slate-700">2023-11-20 10:00</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined mt-1 text-slate-400">location_on</span>
                <div className="flex flex-col">
                  <p className="text-xs uppercase tracking-wider text-slate-400">出发地点</p>
                  <p className="font-medium text-slate-700">上海市 虹桥国际机场 T2航站楼</p>
                </div>
              </div>
            </div>
            <div className="relative mt-6 h-32 overflow-hidden rounded-lg bg-slate-200">
              <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                <span className="rounded bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600">路线已规划</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4 p-6">
          <button
            className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20"
            onClick={() => navigate("/")}
          >
            返回首页
          </button>
          <button
            className="w-full rounded-xl border border-slate-200 bg-white py-4 font-bold text-slate-700"
            onClick={() => navigate("/orders/BCY20231120889")}
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

