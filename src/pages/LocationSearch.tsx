import { useNavigate } from "react-router-dom";

const items = [
  ["history", "虹桥国际机场-T2航站楼", "上海市长宁区虹桥路2550号", "12.4km"],
  ["location_on", "静安寺", "上海市静安区南京西路1686号", "3.2km"],
  ["location_on", "新天地时尚", "上海市黄浦区马当路245号", "1.8km"],
  ["history", "上海火车站", "上海市静安区秣陵路303号", "4.5km"],
];

export default function LocationSearch() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="sticky top-0 z-50 bg-white px-4 pb-4 pt-4">
        <div className="flex items-center gap-2">
          <button className="flex h-10 w-10 items-center justify-center -ml-2" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
          </button>
          <div className="flex h-10 flex-1 items-center rounded-lg bg-slate-100 px-3">
            <span className="material-symbols-outlined mr-2 text-xl text-slate-400">search</span>
            <input
              className="w-full border-none bg-transparent p-0 text-base placeholder:text-slate-400 focus:ring-0"
              placeholder="搜索上车地点"
            />
            <div className="mx-3 h-4 w-[1px] bg-slate-300" />
            <button type="button" className="flex items-center gap-1 whitespace-nowrap text-primary">
              <span className="material-symbols-outlined text-xl">map</span>
              <span className="text-sm font-medium">地图</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white p-4">
        <div className="mb-8">
          <h3 className="mb-4 ml-1 text-xs font-bold uppercase tracking-wider text-slate-400">我的位置</h3>
          <button className="flex w-full items-start gap-4 p-2 text-left" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined mt-0.5 text-primary">near_me</span>
            <div className="flex-1">
              <p className="text-base font-bold">上海市浦东新区陆家嘴中心</p>
              <p className="mt-0.5 text-sm text-slate-500">世纪大道8号</p>
            </div>
            <span className="self-center text-xs text-slate-400">当前</span>
          </button>
        </div>

        <div>
          <h3 className="mb-4 ml-1 text-xs font-bold uppercase tracking-wider text-slate-400">历史搜索</h3>
          <div className="space-y-1">
            {items.map(([icon, title, desc, distance]) => (
              <button
                key={title}
                type="button"
                onClick={() => navigate(-1)}
                className="flex w-full cursor-pointer items-start gap-4 rounded-xl border-b border-slate-50 p-3 text-left transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined mt-1 text-slate-400">{icon}</span>
                <div className="flex-1">
                  <p className="text-base font-bold">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
                </div>
                <span className="self-center text-xs text-slate-400">{distance}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

