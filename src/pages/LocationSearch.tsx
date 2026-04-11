import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  describeTencentGeocoderError,
  reverseGeocodeAdministrativeLine,
  reverseGeocodeLabels,
} from "../services/tencentGeocode";
import {
  pushHistory,
  loadHistory,
  clearHistory,
  type HistoryItem,
} from "../services/locationHistory";
import { searchPoiByKeyword, type SearchPoiResult } from "../services/tencentSearch";
import { formatDistanceLabel, haversineMeters } from "../utils/geoDistance";

type LatLng = { lat: number; lng: number };
type Role = "pickup" | "dropoff";

type SearchLocationState = {
  role?: Role;
  initialLatLng?: LatLng;
  currentLabel?: string;
};

function labelFromPoi(poi: SearchPoiResult) {
  return poi.address ? poi.address : poi.name;
}

function latLngKey(ll: LatLng) {
  return `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
}

function distanceFromOrigin(origin: LatLng | null, dest: LatLng): string | null {
  if (!origin) return null;
  return formatDistanceLabel(haversineMeters(origin, dest));
}

export default function LocationSearch() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const routeState = routeLocation.state as SearchLocationState | null;
  const role: Role = routeState?.role ?? "pickup";

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchPoiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string>("");
  const [searchDisabled, setSearchDisabled] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());

  const [myLatLng, setMyLatLng] = useState<LatLng | null>(null);
  const [myAddress, setMyAddress] = useState<string>("");
  const [myAdminLine, setMyAdminLine] = useState<string>("");
  const [myGeocodeError, setMyGeocodeError] = useState("");
  const [myGeocodeDisabled, setMyGeocodeDisabled] = useState(false);
  const [myGeocodeRetryKey, setMyGeocodeRetryKey] = useState(0);

  const debounceRef = useRef<number | null>(null);
  const historyAdminFetchedRef = useRef<Set<string>>(new Set());
  const historyAdminExtraRef = useRef<Record<string, string>>({});
  const [, historyAdminBump] = useState(0);

  const placeholder = useMemo(() => {
    return role === "pickup" ? "搜索上车地点" : "搜索下车地点";
  }, [role]);

  const myLocationLabel = useMemo(() => {
    if (!myLatLng) return "正在定位…";
    if (myAddress) return myAddress;
    if (myGeocodeError) return "地址未解析";
    return "正在定位…";
  }, [myAddress, myGeocodeError, myLatLng]);
  const mapInitialLatLng = useMemo(
    () => routeState?.initialLatLng ?? myLatLng ?? undefined,
    [routeState?.initialLatLng, myLatLng],
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const ll = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          if (cancelled) return;
          setMyLatLng(ll);
        },
        () => {
          // silent
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!myLatLng || myGeocodeDisabled) return;

    let cancelled = false;

    async function resolveAddress() {
      setMyGeocodeError("");
      try {
        const { primary, adminLine } = await reverseGeocodeLabels(myLatLng!);
        if (cancelled) return;
        if (primary) {
          setMyAddress(primary);
          setMyAdminLine(adminLine);
          setMyGeocodeError("");
        } else {
          setMyAdminLine("");
          setMyGeocodeError("未能解析当前位置地址，请尝试地图选点。");
        }
      } catch (e) {
        if (cancelled) return;
        const { message, quotaExceeded } = describeTencentGeocoderError(e);
        setMyAdminLine("");
        setMyGeocodeError(message);
        if (quotaExceeded) setMyGeocodeDisabled(true);
      }
    }

    resolveAddress();
    return () => {
      cancelled = true;
    };
  }, [myLatLng, myGeocodeRetryKey, myGeocodeDisabled]);

  const retryMyGeocode = () => {
    setMyGeocodeDisabled(false);
    setMyGeocodeRetryKey((k) => k + 1);
  };

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      setErrorText("");
      setLoading(false);
      return;
    }

    if (searchDisabled) return;

    setErrorText("");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchPoiByKeyword({
          keyword,
          location: "广州",
          pageCapacity: 10,
        });
        setResults(list);
        setErrorText("");
      } catch (e: any) {
        setResults([]);
        const status = e?.tencentStatus;
        if (status === 121) {
          setSearchDisabled(true);
          setErrorText("搜索失败：此 Key 每日调用量已达到上限，请更换 Key 或稍后重试。");
        } else {
          setErrorText("搜索失败，请稍后重试。");
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [keyword]);

  useEffect(() => {
    if (keyword.trim()) return;

    for (const it of history) {
      const k = latLngKey(it.latLng);
      if (
        it.adminLine?.trim() ||
        historyAdminExtraRef.current[k] ||
        historyAdminFetchedRef.current.has(k)
      ) {
        continue;
      }
      historyAdminFetchedRef.current.add(k);
      void reverseGeocodeAdministrativeLine(it.latLng)
        .then((line) => {
          const t = line.trim();
          if (!t) return;
          if (historyAdminExtraRef.current[k]) return;
          historyAdminExtraRef.current[k] = t;
          historyAdminBump((n) => n + 1);
        })
        .catch(() => {
          historyAdminFetchedRef.current.delete(k);
        });
    }
  }, [history, keyword]);

  const pickResolved = (poi: { label: string; latLng: LatLng; adminLine?: string }) => {
    const picked = { role, label: poi.label, latLng: poi.latLng };
    const adminLine = poi.adminLine?.trim() || undefined;
    pushHistory({ label: picked.label, latLng: picked.latLng, adminLine });
    setHistory(loadHistory());
    navigate("/", {
      replace: true,
      state: { pickedLocation: picked },
    });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="sticky top-0 z-50 bg-white px-4 pb-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center -ml-2"
            type="button"
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
          </button>
          <div className="flex h-10 flex-1 items-center rounded-lg bg-slate-100 px-3 focus-within:outline-none focus-within:ring-0">
            <span className="material-symbols-outlined mr-2 text-xl text-slate-400">search</span>
            <input
              value={keyword}
              onChange={(e) => {
                setSearchDisabled(false);
                setErrorText("");
                setKeyword(e.target.value);
              }}
              className="w-full border-0 border-none bg-transparent p-0 text-base shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              placeholder={placeholder}
            />
            <div className="mx-3 h-4 w-[1px] bg-slate-300" />
            <button
              type="button"
              className="flex items-center gap-1 whitespace-nowrap text-primary"
              onClick={() =>
                navigate("/location/map", {
                  state: {
                    role,
                    initialLatLng: mapInitialLatLng,
                  },
                })
              }
            >
              <span className="material-symbols-outlined text-xl">map</span>
              <span className="text-sm font-medium">地图</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white p-4">
        <div className="mb-8">
          <div className="mb-4 ml-1 flex items-center justify-between pr-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">我的位置</h3>
            {myGeocodeError ? (
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={retryMyGeocode}
              >
                重试解析
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!myLatLng || (!!myGeocodeError && !myAddress)}
            className="flex w-full items-start gap-4 p-2 text-left disabled:opacity-50"
            onClick={() => {
              if (!myLatLng || !myAddress) return;
              pickResolved({
                label: myAddress,
                latLng: myLatLng,
                adminLine: myAdminLine || undefined,
              });
            }}
          >
            <span className="material-symbols-outlined mt-0.5 text-primary">near_me</span>
            <div className="flex-1">
              <p className="text-base font-bold">{myLocationLabel}</p>
              <p className="mt-0.5 text-sm text-slate-500">当前定位</p>
              {myGeocodeError ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-700">{myGeocodeError}</p>
              ) : null}
            </div>
            <span className="self-center text-xs text-slate-400">当前</span>
          </button>
        </div>

        {!keyword.trim() && history.length > 0 ? (
          <div>
            <div className="mb-4 ml-1 flex items-center justify-between pr-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                历史搜索
              </h3>
              <button
                type="button"
                className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 active:text-slate-700"
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
              >
                清空历史记录
              </button>
            </div>
            <div className="space-y-1">
              {history.map((it, idx) => {
                const adminSub =
                  it.adminLine?.trim() || historyAdminExtraRef.current[latLngKey(it.latLng)] || "";
                const dist = distanceFromOrigin(myLatLng, it.latLng);
                return (
                  <button
                    key={`${it.label}-${idx}`}
                    type="button"
                    onClick={() =>
                      pickResolved({
                        label: it.label,
                        latLng: it.latLng,
                        adminLine: it.adminLine,
                      })
                    }
                    className="flex w-full cursor-pointer items-start gap-4 rounded-xl border-b border-slate-50 p-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined mt-1 shrink-0 text-slate-400">
                      history
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold">{it.label}</p>
                      {adminSub ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{adminSub}</p>
                      ) : null}
                    </div>
                    {dist ? (
                      <span className="shrink-0 self-center text-xs tabular-nums text-slate-400">
                        {dist}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {keyword.trim() && (
          <div className="mt-8">
            <div className="mb-4 ml-1 flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                搜索结果
              </h3>
              {loading && (
                <span
                  className="material-symbols-outlined text-[14px] text-slate-400 animate-spin"
                  aria-label="加载中"
                >
                  *
                </span>
              )}
            </div>
            <div className="space-y-1">
              {!!errorText && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
                  {errorText}
                </div>
              )}
              {results.map((poi) => {
                const label = labelFromPoi(poi);
                const dist = distanceFromOrigin(myLatLng, poi.latLng);
                return (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() =>
                      pickResolved({
                        label,
                        latLng: poi.latLng,
                        adminLine: poi.adminLine,
                      })
                    }
                    className="flex w-full cursor-pointer items-start gap-4 rounded-xl border-b border-slate-50 p-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined mt-1 shrink-0 text-slate-400">
                      location_on
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold">{poi.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{poi.address ?? label}</p>
                    </div>
                    {dist ? (
                      <span className="shrink-0 self-center text-xs tabular-nums text-slate-400">
                        {dist}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

