import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadTencentMap } from "../services/tencentMapLoader";
import {
  describeTencentGeocoderError,
  reverseGeocodeDetail,
} from "../services/tencentGeocode";

type LatLng = { lat: number; lng: number };
type Role = "pickup" | "dropoff";

type LocationMapState = {
  role: Role;
  initialLatLng?: LatLng;
};

function latLngToObj(ll: any): LatLng | null {
  if (!ll) return null;
  const lat =
    typeof ll.lat === "function" ? ll.lat() : ll?.lat ?? ll?.getLat?.();
  const lng =
    typeof ll.lng === "function" ? ll.lng() : ll?.lng ?? ll?.getLng?.();
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return { lat: latNum, lng: lngNum };
}

export default function LocationMapClean() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const state = (routeLocation.state ?? {}) as LocationMapState;
  const role: Role = state.role ?? "pickup";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  const [selectedLatLng, setSelectedLatLng] = useState<LatLng | null>(
    state.initialLatLng ?? null,
  );
  const [detailLabel, setDetailLabel] = useState("");

  const [pinAnimating, setPinAnimating] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [detailReady, setDetailReady] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  const geocodeReqId = useRef(0);
  const geocodeTimerRef = useRef<number | null>(null);
  const pinAnimTimerRef = useRef<number | null>(null);

  const dragHint =
    role === "pickup"
      ? "拖动地图可以更换上车点"
      : "拖动地图可以更换下车点";
  const confirmButtonLabel = role === "pickup" ? "确认上车点" : "确认下车点";

  const canConfirm = Boolean(
    selectedLatLng && detailReady && !isInteracting && detailLabel,
  );

  const playPinAnimationAndGeocode = async (ll: LatLng) => {
    setIsInteracting(false);
    setDetailReady(false);
    setGeocodeError("");

    setPinAnimating(true);
    if (pinAnimTimerRef.current) window.clearTimeout(pinAnimTimerRef.current);
    pinAnimTimerRef.current = window.setTimeout(() => {
      setPinAnimating(false);
    }, 650);

    const id = ++geocodeReqId.current;
    try {
      const info = await reverseGeocodeDetail(ll);
      if (id !== geocodeReqId.current) return;
      const label = info.poiName?.trim() || info.address?.trim() || "";
      if (!label) return;

      setDetailLabel(label);

      window.setTimeout(() => {
        if (id !== geocodeReqId.current) return;
        setDetailReady(true);
      }, 650);
    } catch (e) {
      setGeocodeError(describeTencentGeocoderError(e).message);
    }
  };

  const scheduleGeocodeFromMapCenter = () => {
    if (geocodeTimerRef.current) window.clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = window.setTimeout(() => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter?.();
      const ll = latLngToObj(center);
      if (!ll) return;
      setSelectedLatLng(ll);
      playPinAnimationAndGeocode(ll);
    }, 250);
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      await loadTencentMap();
      if (cancelled) return;

      const initCenter = (() => {
        if (!selectedLatLng) return null;
        const ll = selectedLatLng;
        const LatLngCtor = (qq as any)?.maps?.LatLng;
        if (typeof LatLngCtor === "function") {
          try {
            // eslint-disable-next-line new-cap
            return new LatLngCtor(ll.lat, ll.lng);
          } catch {
            // ignore
          }
        }
        return { lat: ll.lat, lng: ll.lng };
      })();

      const map = new qq.maps.Map(containerRef.current, {
        center: initCenter ?? new (qq as any).maps.LatLng(23.1291, 113.2644),
        zoom: 13,
        draggable: true,
        scrollwheel: true,
        zoomControl: true,
        /** 关闭卫星/路网等图层切换，仅保留标准地图 */
        mapTypeControl: false,
        disableDoubleClickZoom: true,
      });

      mapRef.current = map;

      const onStart = () => {
        setIsInteracting(true);
        setDetailReady(false);
      };
      const onEnd = () => {
        setIsInteracting(false);
        scheduleGeocodeFromMapCenter();
      };

      try {
        qq.maps.event.addListener(map, "dragstart", onStart);
        qq.maps.event.addListener(map, "dragend", onEnd);
      } catch {
        // ignore
      }
      try {
        qq.maps.event.addListener(map, "zoom_changed", onEnd);
      } catch {
        // ignore
      }

      if (selectedLatLng) {
        playPinAnimationAndGeocode(selectedLatLng);
        return;
      }

      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setSelectedLatLng(ll);
          try {
            const LatLngCtor = (qq as any)?.maps?.LatLng;
            if (typeof LatLngCtor === "function") {
              // eslint-disable-next-line new-cap
              map.setCenter(new LatLngCtor(ll.lat, ll.lng));
            }
          } catch {
            // ignore
          }
          playPinAnimationAndGeocode(ll);
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
      if (geocodeTimerRef.current)
        window.clearTimeout(geocodeTimerRef.current);
      if (pinAnimTimerRef.current) window.clearTimeout(pinAnimTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = () => {
    if (!selectedLatLng || !detailReady) return;
    navigate("/", {
      replace: true,
      state: {
        pickedLocation: {
          role,
          label: detailLabel,
          latLng: selectedLatLng,
        },
      },
    });
  };

  const recenterToCurrent = () => {
    if (!mapRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSelectedLatLng(ll);
        try {
          const LatLngCtor = (qq as any)?.maps?.LatLng;
          if (typeof LatLngCtor === "function") {
            // eslint-disable-next-line new-cap
            mapRef.current.setCenter(new LatLngCtor(ll.lat, ll.lng));
          }
        } catch {
          // ignore
        }
        playPinAnimationAndGeocode(ll);
      },
      () => {
        // silent
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const zoomMap = (delta: number) => {
    if (!mapRef.current) return;
    const current = Number(mapRef.current.getZoom?.() ?? 13);
    const next = Math.min(20, Math.max(3, current + delta));
    mapRef.current.setZoom?.(next);
    setIsInteracting(true);
    setDetailReady(false);
    scheduleGeocodeFromMapCenter();
  };

  return (
    <div className="h-screen overflow-hidden bg-backgroundLight text-slate-900">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined text-slate-700">
              arrow_back
            </span>
          </button>
          <div className="relative flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            <input
              className="h-10 w-full rounded-lg border-none bg-slate-100 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50"
              placeholder="拖动地图选点"
              readOnly
            />
          </div>
        </div>
      </div>

      <div className="relative h-screen w-full pt-[66px]">
        <div ref={containerRef} className="h-full w-full" />

        {/* center pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="flex items-center justify-center rounded-full bg-white/90 px-2 py-1 shadow-sm ring-2 ring-white/60">
            <span
              className={[
                "material-symbols-outlined text-primary",
                pinAnimating ? "animate-bounce" : "",
              ].join(" ")}
              style={{ fontSize: 34 }}
            >
              location_on
            </span>
          </div>
        </div>

        <div className="absolute bottom-72 right-4 z-10 flex flex-col gap-3">
          <button
            type="button"
            onClick={recenterToCurrent}
            className="h-12 w-12 rounded-xl border border-slate-100 bg-white text-slate-700 shadow-lg"
          >
            <span className="material-symbols-outlined">my_location</span>
          </button>
          <div className="overflow-hidden rounded-xl border border-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => zoomMap(1)}
              className="flex h-12 w-12 items-center justify-center border-b border-slate-100 bg-white text-slate-700"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button
              type="button"
              onClick={() => zoomMap(-1)}
              className="flex h-12 w-12 items-center justify-center bg-white text-slate-700"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] bg-white p-6 pb-10 shadow-sheetUp">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="mt-1 shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">
                location_on
              </span>
            </div>

            <div className="flex-1">
              <div className="flex flex-col">
                {geocodeError ? (
                  <p className="text-sm leading-relaxed text-amber-700">{geocodeError}</p>
                ) : (
                  <p
                    className={[
                      "line-clamp-2 text-xl font-bold leading-tight tracking-tight",
                      detailLabel ? "text-slate-900" : "min-h-[1.75rem] text-slate-400",
                    ].join(" ")}
                  >
                    {detailLabel || ""}
                  </p>
                )}
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{dragHint}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirm}
            className="w-full rounded-xl bg-[#07C160] py-4 text-lg font-bold text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#06ae56]"
          >
            {confirmButtonLabel}
          </button>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-4 bg-white" />
    </div>
  );
}

