/** 用户信息：由接口返回并持久化 localStorage；用于首页/个人中心展示与订单用户隔离 */

export const USER_PROFILE_STORAGE_KEY = "hicar_user_profile_v1";

export const USER_SESSION_UPDATED_EVENT = "hicar-user-session-updated";

export type UserProfile = {
  id: string;
  displayName: string;
  phoneMasked: string;
  avatarUrl: string;
  membershipLevelLabel: string;
  membershipLevelKey: string;
};

function notifySessionUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_SESSION_UPDATED_EVENT));
}

export function parseUserProfile(json: unknown): UserProfile | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const displayName = String(o.displayName ?? "").trim();
  const phoneMasked = String(o.phoneMasked ?? "").trim();
  const avatarUrl = String(o.avatarUrl ?? "").trim();
  const membershipLevelLabel = String(o.membershipLevelLabel ?? "").trim();
  const membershipLevelKey = String(o.membershipLevelKey ?? "").trim();
  if (!id || !displayName || !avatarUrl || !membershipLevelLabel) return null;
  return {
    id,
    displayName,
    phoneMasked: phoneMasked || "—",
    avatarUrl,
    membershipLevelLabel,
    membershipLevelKey: membershipLevelKey || "normal",
  };
}

export function loadPersistedProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return parseUserProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function savePersistedProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    notifySessionUpdated();
  } catch {
    // ignore
  }
}

export function clearPersistedProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    notifySessionUpdated();
  } catch {
    // ignore
  }
}

function defaultProfileUrl() {
  const v = import.meta.env.VITE_USER_PROFILE_URL;
  if (typeof v === "string" && v.trim()) return v.trim();
  return "/mock/user-profile.json";
}

/**
 * 从接口拉取用户信息（GET）。生产环境设置 VITE_USER_PROFILE_URL 指向真实后端。
 */
export async function fetchUserProfileFromApi(): Promise<UserProfile> {
  const url = defaultProfileUrl();
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`获取用户信息失败（${res.status}）`);
  }
  const json: unknown = await res.json();
  const p = parseUserProfile(json);
  if (!p) {
    throw new Error("用户信息格式无效");
  }
  return p;
}
