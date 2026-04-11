/** 从个人中心进入订单详情时写入，返回个人中心后由个人中心读取并在滚动定位后清除 */
export const PROFILE_RETURN_STORAGE_KEY = "hicar_profile_return";

export type ProfileReturnPayload = {
  tab: "pending" | "ongoing" | "completed" | "cancelled";
  orderId: string;
};

export function saveProfileReturnContext(payload: ProfileReturnPayload) {
  try {
    sessionStorage.setItem(PROFILE_RETURN_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function parsePayload(raw: string): ProfileReturnPayload | null {
  try {
    const parsed = JSON.parse(raw) as ProfileReturnPayload;
    if (
      parsed &&
      typeof parsed.orderId === "string" &&
      (parsed.tab === "pending" ||
        parsed.tab === "ongoing" ||
        parsed.tab === "completed" ||
        parsed.tab === "cancelled")
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 读取但不删除（个人中心首屏用 lazy state + 滚动完成后 clear） */
export function peekProfileReturnContext(): ProfileReturnPayload | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_RETURN_STORAGE_KEY);
    if (!raw) return null;
    return parsePayload(raw);
  } catch {
    return null;
  }
}

export function clearProfileReturnContext() {
  try {
    sessionStorage.removeItem(PROFILE_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function peekProfileReturnOrderId(): string | null {
  return peekProfileReturnContext()?.orderId ?? null;
}
