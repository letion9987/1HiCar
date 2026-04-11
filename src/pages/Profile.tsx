import { useNavigate } from "react-router-dom";

const orders = [
  { id: "CZ20231025001", status: "待确认", statusClass: "text-orange-600 bg-orange-50", from: "广州白云机场", to: "广州花园酒店" },
  { id: "CZ20231024008", status: "租赁中", statusClass: "text-blue-600 bg-blue-50", from: "广州东站", to: "番禺长隆景区" },
  { id: "CZ20231023002", status: "已完成", statusClass: "text-emerald-600 bg-emerald-50", from: "白云国际会议中心", to: "广州南站" },
];

export default function Profile() {
  const navigate = useNavigate();
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
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-full border-2 border-primary/20 bg-neutral-200" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">广州老张</span>
                <span className="rounded-full bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] px-2.5 py-1 text-[10px] font-black text-white">
                  钻石会员
                </span>
              </div>
              <p className="text-base text-slate-500">138 **** 8888</p>
            </div>
          </div>
        </section>

        <section className="sticky top-[61px] z-40 border-b border-neutral-100 bg-white">
          <div className="flex justify-around">
            <button className="flex-1 border-b-4 border-primary py-4 text-base font-bold text-primary">预约中</button>
            <button className="flex-1 py-4 text-base font-medium text-slate-500">租赁中</button>
            <button className="flex-1 py-4 text-base font-medium text-slate-500">已完成</button>
            <button className="flex-1 py-4 text-base font-medium text-slate-500">已取消</button>
          </div>
        </section>

        <section className="space-y-4 p-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-neutral-50 pb-3">
                <span className="text-sm font-medium text-slate-500">订单号：{o.id}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${o.statusClass}`}>{o.status}</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">起点</span>
                    <p className="text-base font-semibold text-slate-800">{o.from}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-orange-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">终点</span>
                    <p className="text-base font-semibold text-slate-800">{o.to}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button className="rounded-lg border border-slate-800 px-6 py-2 text-sm font-bold text-slate-900">取消订单</button>
                <button
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-md shadow-primary/20"
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

