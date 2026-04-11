/** 腾讯位置服务 WebService 常用 JSONP 请求（绕过浏览器 CORS） */
export function tencentJsonp<T = unknown>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cbName = `__qq_jsonp_cb_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const w = window as unknown as Record<string, unknown>;

    const cleanup = (script: HTMLScriptElement) => {
      try {
        delete w[cbName];
      } catch {
        // ignore
      }
      try {
        script.remove();
      } catch {
        // ignore
      }
    };

    const script = document.createElement("script");
    w[cbName] = (data: T) => {
      cleanup(script);
      resolve(data);
    };

    script.onerror = () => {
      cleanup(script);
      reject(new Error(`Tencent JSONP request failed: ${url}`));
    };

    const joiner = url.includes("?") ? "&" : "?";
    script.src = `${url}${joiner}callback=${encodeURIComponent(cbName)}`;
    document.body.appendChild(script);
  });
}
