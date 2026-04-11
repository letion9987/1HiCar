import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "../components/BottomSheet";

const remarkTagsA = ["有大件行李", "携带宠物"];
const remarkTagsB = [
  "赶时间",
  "电话联系",
  "不便接电话",
  "请勿抽烟",
  "有老人",
  "有孕妇",
  "时间可协商",
  "地点可协商",
  "需走高架",
];

const dateOptions = ["今天", "明天", "10月28日", "10月29日"];
const hourOptions = ["10时", "11时", "12时", "13时"];
const minuteOptions = ["00分", "15分", "30分", "45分"];

export default function Home() {
  const navigate = useNavigate();
  const [openSheet, setOpenSheet] = useState<"time" | "remark" | "deposit" | null>(null);
  const [pickup] = useState("白云机场T2航站楼");
  const [dropoff] = useState("广州四季酒店 (珠江新城)");
  const [date, setDate] = useState("今天");
  const [hour, setHour] = useState("14");
  const [minute, setMinute] = useState("30");
  const [passengers, setPassengers] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>(["有大件行李", "赶时间", "有老人"]);
  const [remarkText, setRemarkText] = useState("");

  const baseDistance = 128.2;
  const baseRate = 2;
  const emptyDistance = 15.4;
  const emptyRate = 1;
  const emptyMulti = 2;
  const packageAdjust = 272.8;

  const basePrice = useMemo(() => baseDistance * baseRate, [baseDistance, baseRate]);
  const emptyPrice = useMemo(
    () => emptyDistance * emptyRate * emptyMulti,
    [emptyDistance, emptyRate, emptyMulti],
  );
  const estimatedTotal = useMemo(
    () => basePrice + emptyPrice + packageAdjust,
    [basePrice, emptyPrice, packageAdjust],
  );
  const deposit = useMemo(() => Math.max(estimatedTotal * 0.2, emptyPrice), [estimatedTotal, emptyPrice]);
  const remarkSummary = selectedTags.length > 0 ? selectedTags.join("、") : "无";

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const renderTag = (tag: string) => {
    const active = selectedTags.includes(tag);
    return (
      <button
        key={tag}
        type="button"
        onClick={() => toggleTag(tag)}
        className={
          active
            ? "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
            : "rounded-lg border border-transparent bg-[#F5F5F5] px-3 py-2 text-sm font-medium text-[#666666]"
        }
      >
        {tag}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-backgroundLight text-slate-900">
      <div className="mx-auto max-w-md bg-backgroundLight pb-32">
        <header className="bg-white px-4 pb-4 pt-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full border-2 border-primary bg-slate-200" />
              <div>
                <h1 className="text-xl font-bold leading-tight">包车易</h1>
                <p className="text-xs text-slate-500">专业包车服务</p>
              </div>
            </div>
            <div className="flex items-center font-semibold text-primary">
              <span className="material-symbols-outlined mr-1 text-sm">location_on</span>
              <span>Guangzhou</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4">
            <div>
              <p className="text-sm text-slate-600">今日可用里程</p>
              <p className="text-xl font-bold text-primary">200km</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-medium text-slate-600">可约</span>
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </header>

        <section className="m-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button className="rounded-full p-1">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2 className="font-bold text-slate-800">2023年10月</h2>
            <button className="rounded-full p-1">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {"日一二三四五六".split("").map((x) => (
              <div key={x} className="pb-2 text-[10px] font-bold uppercase text-slate-400">
                {x}
              </div>
            ))}
            {["28", "29", "30", "1", "2", "3", "4", "5", "6", "7"].map((d) => (
              <div
                key={d}
                className={
                  d === "5"
                    ? "flex aspect-square flex-col items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-md shadow-primary/30"
                    : "flex aspect-square items-center justify-center rounded-lg text-sm font-medium text-slate-700"
                }
              >
                {d}
              </div>
            ))}
          </div>
        </section>

        <div className="mb-4 px-4">
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="relative aspect-[16/9] w-full bg-slate-200">
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          </div>
        </div>

        <section className="mx-4 space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => navigate("/location/search")}
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
            <div className="flex-1">
              <p className="mb-0.5 text-xs text-slate-400">上车地点</p>
              <p className="text-base font-medium text-slate-800">{pickup}</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
          <div className="ml-1 h-6 w-px bg-slate-100" />
          <button
            type="button"
            onClick={() => navigate("/location/map")}
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent ring-4 ring-accent/20" />
            <div className="flex-1">
              <p className="mb-0.5 text-xs text-slate-400">下车地点</p>
              <p className="text-base font-medium text-slate-800">{dropoff}</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
        </section>

        <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpenSheet("time")}
            className="flex w-full items-center justify-between border-b border-slate-50 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">schedule</span>
              <span className="text-slate-700">出发时间</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-900">
                {date} {hour}:{minute}
              </span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpenSheet("time")}
            className="flex w-full items-center justify-between border-b border-slate-50 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">person</span>
              <span className="text-slate-700">乘车人数</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-900">{passengers}人</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpenSheet("remark")}
            className="flex w-full items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">edit_note</span>
              <span className="text-slate-700">行程备注</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="max-w-[160px] truncate font-medium text-slate-900">{remarkSummary}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
          </button>
        </section>

        <section className="mx-4 mt-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">费用明细</h3>
            <div className="flex rounded-full bg-primary/10 p-1">
              <div className="px-3 py-1 text-[10px] font-bold text-primary">8h / 200km</div>
              <div className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">临时包车</div>
            </div>
          </div>
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">基础行程 ({baseDistance}km × {baseRate})</span>
              <span className="font-medium text-slate-700">¥{basePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                空驶补偿 ({emptyDistance}km × {emptyRate} × {emptyMulti})
              </span>
              <span className="font-medium text-slate-700">¥{emptyPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">套餐补差</span>
              <span className="font-medium text-slate-700">¥{packageAdjust.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-50 pt-2 text-sm">
              <span className="font-bold text-slate-900">预估总价</span>
              <span className="text-2xl font-bold text-accent">¥{estimatedTotal.toFixed(0)}</span>
            </div>
          </div>
        </section>

        <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-white p-4 shadow-bottomBar">
          <button
            type="button"
            onClick={() => setOpenSheet("deposit")}
            className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            立即预约
          </button>
        </div>
      </div>

      <BottomSheet
        open={openSheet === "time"}
        onClose={() => setOpenSheet(null)}
        title="选择出发时间和人数"
        footer={
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-primary text-lg font-bold text-white"
            onClick={() => setOpenSheet(null)}
          >
            确定
          </button>
        }
      >
        <section className="mb-8">
          <div className="mb-4">
            <h3 className="text-base font-bold">出发时间</h3>
            <p className="mt-1 text-xs text-slate-500">请提前合理规划好时间</p>
          </div>
          <div className="flex h-44 gap-2 overflow-hidden">
            <div className="no-scrollbar flex-1 overflow-y-auto border-r border-slate-50">
              <div className="py-16">
                {dateOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDate(item)}
                    className={
                      item === date
                        ? "flex h-12 w-full items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
                        : "flex h-12 w-full items-center justify-center text-sm text-slate-400"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto border-r border-slate-50">
              <div className="py-16">
                {hourOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setHour(item.slice(0, 2))}
                    className={
                      item.startsWith(hour)
                        ? "flex h-12 w-full items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
                        : "flex h-12 w-full items-center justify-center text-sm text-slate-400"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto">
              <div className="py-16">
                {minuteOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMinute(item.slice(0, 2))}
                    className={
                      item.startsWith(minute)
                        ? "flex h-12 w-full items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
                        : "flex h-12 w-full items-center justify-center text-sm text-slate-400"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="text-base font-bold">乘车人数</h3>
            <p className="mt-1 text-xs text-slate-500">婴幼儿、儿童需一同计入乘车人数</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-600">group</span>
              <span className="font-medium">乘车人数</span>
            </div>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setPassengers((v) => Math.max(1, v - 1))}
                className="flex size-8 items-center justify-center rounded-full border-2 border-slate-200 text-slate-400"
              >
                <span className="material-symbols-outlined text-xl">remove</span>
              </button>
              <span className="w-4 text-center text-xl font-bold">{passengers}</span>
              <button
                type="button"
                onClick={() => setPassengers((v) => Math.min(4, v + 1))}
                className="flex size-8 items-center justify-center rounded-full border-2 border-primary text-primary"
              >
                <span className="material-symbols-outlined text-xl">add</span>
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPassengers(count)}
                className={
                  passengers === count
                    ? "rounded-full border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
                    : "rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                }
              >
                {count}人
              </button>
            ))}
          </div>
        </section>
      </BottomSheet>

      <BottomSheet
        open={openSheet === "remark"}
        onClose={() => setOpenSheet(null)}
        title="行程备注"
        maxHeightClassName="max-h-[85vh]"
        footer={
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-lg font-bold text-white"
            onClick={() => setOpenSheet(null)}
          >
            确定
          </button>
        }
      >
        <div className="mb-6">
          <h3 className="mb-3 text-[15px] font-semibold text-slate-500">宠物与行李</h3>
          <div className="flex flex-wrap gap-2">{remarkTagsA.map(renderTag)}</div>
        </div>
        <div className="mb-6">
          <h3 className="mb-3 text-[15px] font-semibold text-slate-500">其他需求</h3>
          <div className="flex flex-wrap gap-2">{remarkTagsB.map(renderTag)}</div>
        </div>
        <div className="mb-4">
          <textarea
            rows={3}
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm focus:border-primary focus:ring-primary"
            placeholder="请输入其他补充信息..."
          />
        </div>
      </BottomSheet>

      <BottomSheet
        open={openSheet === "deposit"}
        onClose={() => setOpenSheet(null)}
        title="确认预约并支付定金"
        maxHeightClassName="max-h-[84vh]"
      >
        <div className="px-1 pb-3 pt-2 text-center">
          <p className="mb-1 text-sm text-slate-500">应付定金</p>
          <div className="flex items-baseline justify-center text-slate-900">
            <span className="mr-1 text-2xl font-bold">¥</span>
            <span className="text-5xl font-bold tracking-tight">{deposit.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">预估总金额</span>
              <span className="font-medium text-slate-900">¥{estimatedTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">定金比例</span>
              <span className="font-medium text-slate-900">20%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">空驶补偿金额</span>
              <span className="font-medium text-slate-900">¥{emptyPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-sm font-semibold text-slate-900">最终定金</span>
              <span className="font-bold text-primary">¥{deposit.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate("/booking/result")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-white"
          >
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            <span>微信支付 ¥{deposit.toFixed(2)}</span>
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">支付即表示同意《包车服务协议》</p>
        </div>
      </BottomSheet>
    </div>
  );
}

