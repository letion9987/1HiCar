import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchUserProfileFromApi,
  loadPersistedProfile,
  savePersistedProfile,
  type UserProfile,
} from "../services/userProfileApi";
import {
  migrateLegacyOrdersIfNeeded,
  setActiveOrdersUserId,
} from "../services/ordersStore";

type UserSessionValue = {
  profile: UserProfile | null;
  /** 已成功持久化过资料（含从本地恢复） */
  hasUser: boolean;
  profileFetchLoading: boolean;
  profileFetchError: string | null;
  refreshProfile: () => Promise<void>;
};

const UserSessionContext = createContext<UserSessionValue | null>(null);

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadPersistedProfile());
  const [profileFetchLoading, setProfileFetchLoading] = useState(false);
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);

  const hasUser = profile !== null;

  const bindUserToOrders = useCallback((p: UserProfile) => {
    migrateLegacyOrdersIfNeeded(p.id);
    setActiveOrdersUserId(p.id);
  }, []);

  useEffect(() => {
    if (profile) {
      bindUserToOrders(profile);
    } else {
      setActiveOrdersUserId(null);
    }
  }, [profile, bindUserToOrders]);

  const refreshProfile = useCallback(async () => {
    setProfileFetchLoading(true);
    setProfileFetchError(null);
    try {
      const p = await fetchUserProfileFromApi();
      bindUserToOrders(p);
      savePersistedProfile(p);
      setProfile(p);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "获取用户信息失败";
      setProfileFetchError(msg);
    } finally {
      setProfileFetchLoading(false);
    }
  }, [bindUserToOrders]);

  const value = useMemo<UserSessionValue>(
    () => ({
      profile,
      hasUser,
      profileFetchLoading,
      profileFetchError,
      refreshProfile,
    }),
    [profile, hasUser, profileFetchLoading, profileFetchError, refreshProfile],
  );

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const ctx = useContext(UserSessionContext);
  if (!ctx) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return ctx;
}
