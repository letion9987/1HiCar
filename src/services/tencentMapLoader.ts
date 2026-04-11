import { getTencentMapKey } from "../config/tencentMap";

let loadPromise: Promise<void> | null = null;

function ensureGlobalReady(): boolean {
  const qqAny: any = (window as any).qq;
  return Boolean(
    qqAny &&
      qqAny.maps &&
      typeof qqAny.maps.Map === "function" &&
      typeof qqAny.maps.Marker === "function" &&
      // service lib（SearchService / Geocoder）可能加载在 Map/Overlay 之后
      typeof qqAny.maps.SearchService === "function" &&
      typeof qqAny.maps.Geocoder === "function",
  );
}

export function loadTencentMap(): Promise<void> {
  if (ensureGlobalReady()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-tencent-map="true"]',
    );
    if (existing) {
      // If the script tag already exists, wait for it to become ready.
      const t = window.setInterval(() => {
        if (ensureGlobalReady()) {
          window.clearInterval(t);
          resolve();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(t);
        const qqAny: any = (window as any).qq;
        // eslint-disable-next-line no-console
        console.error("[TencentMap] load timeout (existing script). qq.maps=", qqAny?.maps);
        reject(new Error("Tencent Map SDK load timeout"));
      }, 20000);
      return;
    }

    const script = document.createElement("script");
    // Tencent SDK internally uses `document.write` in some versions.
    // Browsers disallow `document.write` from asynchronously loaded scripts,
    // so we must load it in a "non-async" mode.
    script.async = false;
    script.defer = false;
    script.dataset.tencentMap = "true";

    const key = getTencentMapKey();
    // v=2.exp matches the JS v2 API docs (qq.maps.*).
    script.src = `https://map.qq.com/api/js?v=2.exp&key=${encodeURIComponent(
      key,
    )}&libraries=service`;

    // eslint-disable-next-line no-console
    console.log(`[TencentMap] loading: ${script.src}`);

    script.onload = () => {
      const startedAt = Date.now();
      const t = window.setInterval(() => {
        if (ensureGlobalReady()) {
          window.clearInterval(t);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 20000) {
          window.clearInterval(t);
          const msg = `Tencent Map SDK onload but qq.maps not ready. src=${script.src}`;
          // eslint-disable-next-line no-console
          console.error(msg);
          reject(new Error(msg));
        }
      }, 100);
    };
    script.onerror = () => {
      const msg = `Failed to load Tencent Map SDK. src=${script.src}`;
      // eslint-disable-next-line no-console
      console.error(msg);
      reject(new Error(msg));
    };

    document.head.appendChild(script);
  }).catch((err) => {
    // If load fails, allow future retries.
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

