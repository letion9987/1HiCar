const DEFAULT_TENCENT_MAP_KEY = "SHABZ-6TXWW-2ESRD-3WHDF-6R5KO-SSBJN";

export function getTencentMapKey(): string {
  const key = import.meta.env.VITE_TENCENT_MAP_KEY as string | undefined;
  return key && key.trim().length > 0 ? key : DEFAULT_TENCENT_MAP_KEY;
}

