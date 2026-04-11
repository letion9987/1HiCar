import { useNavigate } from "react-router-dom";

export default function LocationMap() {
  const navigate = useNavigate();

  return (
    <div className="h-screen overflow-hidden bg-backgroundLight text-slate-900">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined text-slate-700">arrow_back</span>
          </button>
          <div className="relative flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            <input
              className="h-10 w-full rounded-lg border-none bg-slate-100 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50"
              placeholder="搜索地点或目的地"
            />
          </div>
        </div>
      </div>

      <div className="relative h-screen w-full bg-slate-200 pt-[66px]">
        <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-slate-400" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <div className="mb-1 rounded-full bg-primary p-2 text-white shadow-lg">
            <span className="material-symbols-outlined">location_on</span>
          </div>
          <div className="h-2 w-2 rounded-full bg-black/20 blur-[1px]" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] bg-white p-6 pb-10 shadow-sheetUp">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="mt-1 shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">location_on</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">上海浦东 international 机场 T2</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                上海市浦东新区迎宾大道6000号，2号航站楼出发层
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full rounded-xl bg-[#07C160] py-4 text-lg font-bold text-white shadow-md transition-colors hover:bg-[#06ae56]"
          >
            确认选择该地址
          </button>
        </div>
      </div>
    </div>
  );
}

