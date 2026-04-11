import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserSession } from "../contexts/UserSessionContext";

const levels = [
  { name: "张小三", phone: "138 **** 8888", badge: "普通会员", cls: "bg-gray-100 text-gray-500" },
  { name: "李思源", phone: "139 **** 6666", badge: "白银会员", cls: "bg-slate-100 text-slate-600 border border-slate-200" },
  { name: "王金发", phone: "136 **** 9999", badge: "黄金会员", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  { name: "赵伯爵", phone: "188 **** 0001", badge: "铂金会员", cls: "bg-slate-700 text-slate-100" },
  { name: "陈钻钻", phone: "199 **** 9999", badge: "钻石会员", cls: "bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] text-white" },
] as const;

export default function MembershipLevels() {
  const navigate = useNavigate();
  const { hasUser } = useUserSession();

  useEffect(() => {
    if (!hasUser) {
      navigate("/", { replace: true });
    }
  }, [hasUser, navigate]);

  return (
    <div className="min-h-screen bg-backgroundLight font-display">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white px-4 py-4">
        <div className="flex items-center">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 pr-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">全等级个人信息展示</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Membership Profile Comparison</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4 pb-10">
        {levels.map((lv) => (
          <section
            key={lv.name}
            className="flex items-center rounded-2xl border border-gray-50 bg-white p-5 shadow-iosCard"
          >
            <div className="size-16 rounded-full border border-gray-100 bg-gray-100" />
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">{lv.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${lv.cls}`}>
                  {lv.badge}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{lv.phone}</p>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

