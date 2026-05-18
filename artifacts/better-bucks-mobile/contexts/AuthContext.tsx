import * as AppleAuthentication from "expo-apple-authentication";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiUrl } from "@/constants/api";
import { setPendingSocialSignup } from "@/lib/socialSignupStore";
import { clearDashboardCache } from "@/hooks/useDashboardData";

const TOKEN_KEY = "bb_mobile_token";
const USER_KEY = "bb_mobile_user";
const BIOMETRIC_ENROLLED_KEY = "bb_biometric_enrolled";

const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  email?: string | null;
  role: string;
  organizationId?: number | null;
  mustChangePassword?: boolean;
  shippingAddressLine1?: string | null;
};

export function needsAccountSetup(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "prime_admin" || user.role === "developer") return false;
  return !!(user.mustChangePassword || !user.email || !user.shippingAddressLine1);
}

export type SocialLink = { provider: "google" | "apple"; email: string | null };

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  user: AuthUser | null;
  biometricCapable: boolean;
  biometricEnrolled: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  login: (
    username: string,
    password: string,
    orgCode?: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  joinAsEmployee: (
    siteId: string,
    username: string,
    fullName?: string,
    email?: string,
    password?: string,
  ) => Promise<
    | { ok: true }
    | { ok: false; message: string }
    | { ok: "needs_registration"; allowPasswordCreation: boolean; orgName: string }
    | { ok: "pending_approval" }
  >;
  loginWithBiometrics: () => Promise<
    { ok: true } | { ok: false; message: string }
  >;
  loginWithApple: () => Promise<
    { ok: true } | { ok: false; message: string; providerEmail?: string | null; needsSignup?: true }
  >;
  loginWithGoogle: (idToken: string) => Promise<
    { ok: true } | { ok: false; message: string; providerEmail?: string | null; needsSignup?: true }
  >;
  linkSocialProvider: (
    provider: "google" | "apple",
    identityToken: string,
  ) => Promise<{ ok: true; links: SocialLink[] } | { ok: false; message: string }>;
  unlinkSocialProvider: (
    provider: "google" | "apple",
  ) => Promise<{ ok: true; links: SocialLink[] } | { ok: false; message: string }>;
  fetchSocialLinks: () => Promise<SocialLink[]>;
  enrollBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeTokenExpiry(token: string): number | null {
  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const parts = decoded.split(".");
    const exp = Number(parts[parts.length - 1]);
    return isNaN(exp) ? null : exp;
  } catch {
    return null;
  }
}

async function refreshTokenIfNeeded(
  token: string,
): Promise<{ token: string; user: AuthUser } | null> {
  const exp = decodeTokenExpiry(token);
  if (!exp) return null;
  if (exp - Date.now() > REFRESH_THRESHOLD_MS) return null;
  try {
    const res = await fetch(apiUrl("/api/mobile/token/refresh"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.token) return null;
    return { token: data.token, user: data.user };
  } catch {
    return null;
  }
}

async function registerPushToken(authToken: string): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    const res = await fetch(apiUrl("/api/mobile/push-token"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
    if (!res.ok) {
      console.warn("[pushToken] registration failed:", res.status);
    }
  } catch (err) {
    console.warn("[pushToken] registration error:", err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [biometricCapable, setBiometricCapable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, u, bioPref, hasHardware, isEnrolled] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
          SecureStore.getItemAsync(BIOMETRIC_ENROLLED_KEY),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        const deviceCapable = hasHardware && isEnrolled;
        setBiometricCapable(deviceCapable);
        setBiometricEnrolled(deviceCapable && bioPref === "true");

        if (t && u) {
          let activeToken = t;
          let activeUser: AuthUser = JSON.parse(u);

          const refreshed = await refreshTokenIfNeeded(t);
          if (refreshed) {
            await SecureStore.setItemAsync(TOKEN_KEY, refreshed.token);
            await SecureStore.setItemAsync(
              USER_KEY,
              JSON.stringify(refreshed.user),
            );
            activeToken = refreshed.token;
            activeUser = refreshed.user;
          }

          setToken(activeToken);
          setUser(activeUser);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (t: string, u: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
    registerPushToken(t);
  }, []);

  const updateUser = useCallback(async (u: AuthUser) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    const currentUser = user;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENROLLED_KEY);
    if (currentUser?.id) {
      await clearDashboardCache(currentUser.id);
    }
    setToken(null);
    setUser(null);
    setBiometricEnrolled(false);
    router.replace("/login");
  }, [user]);

  const login = useCallback<AuthContextValue["login"]>(
    async (username, password, orgCode) => {
      try {
        const res = await fetch(apiUrl("/api/mobile/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, ...(orgCode ? { orgCode } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false as const,
            message: data?.message ?? "Login failed",
          };
        }
        await signIn(data.token, data.user);
        return { ok: true as const };
      } catch (err: any) {
        return {
          ok: false as const,
          message: err?.message ?? "Network error",
        };
      }
    },
    [signIn],
  );

  const joinAsEmployee = useCallback<AuthContextValue["joinAsEmployee"]>(
    async (siteId, username, fullName, email, password) => {
      try {
        const res = await fetch(apiUrl("/api/mobile/join"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId, username, fullName, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 201 && data.pendingApproval) {
          return { ok: "pending_approval" as const };
        }
        if (res.status === 200 && data.needsRegistration) {
          return {
            ok: "needs_registration" as const,
            allowPasswordCreation: data.allowPasswordCreation ?? true,
            orgName: data.orgName ?? "",
          };
        }
        if (!res.ok) {
          return { ok: false as const, message: data?.message ?? "Request failed" };
        }
        await signIn(data.token, data.user);
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, message: err?.message ?? "Network error" };
      }
    },
    [signIn],
  );

  const loginWithBiometrics = useCallback<
    AuthContextValue["loginWithBiometrics"]
  >(async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) {
        return { ok: false as const, message: "No stored session" };
      }
      const exp = decodeTokenExpiry(storedToken);
      if (!exp || Date.now() > exp) {
        return { ok: false as const, message: "Session expired" };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Better Bucks",
        fallbackLabel: "Use password",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return {
          ok: false as const,
          message:
            result.error === "user_cancel" ? "Cancelled" : "Authentication failed",
        };
      }

      const u = await SecureStore.getItemAsync(USER_KEY);
      if (!u) return { ok: false as const, message: "No stored session" };

      let activeToken = storedToken;
      let activeUser: AuthUser = JSON.parse(u);
      const refreshed = await refreshTokenIfNeeded(storedToken);
      if (refreshed) {
        await SecureStore.setItemAsync(TOKEN_KEY, refreshed.token);
        await SecureStore.setItemAsync(
          USER_KEY,
          JSON.stringify(refreshed.user),
        );
        activeToken = refreshed.token;
        activeUser = refreshed.user;
      }

      setToken(activeToken);
      setUser(activeUser);
      return { ok: true as const };
    } catch (err: any) {
      return {
        ok: false as const,
        message: err?.message ?? "Biometric authentication failed",
      };
    }
  }, []);

  const callSocialAuth = useCallback(
    async (
      provider: "google" | "apple",
      identityToken: string,
      providerName?: string | null,
    ): Promise<{ ok: true } | { ok: false; message: string; providerEmail?: string | null; needsSignup?: true }> => {
      try {
        const res = await fetch(apiUrl("/api/mobile/auth/social"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, identityToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 404) {
            setPendingSocialSignup({
              provider,
              identityToken,
              providerEmail: data?.providerEmail ?? null,
              providerName: providerName ?? null,
            });
            return {
              ok: false as const,
              needsSignup: true as const,
              message: data?.message ?? "No account found",
              providerEmail: data?.providerEmail ?? null,
            };
          }
          return {
            ok: false as const,
            message: data?.message ?? "Sign-in failed",
            providerEmail: data?.providerEmail ?? null,
          };
        }
        await signIn(data.token, data.user);
        return { ok: true as const };
      } catch (err: any) {
        return {
          ok: false as const,
          message: err?.message ?? "Network error",
        };
      }
    },
    [signIn],
  );

  const loginWithApple = useCallback<AuthContextValue["loginWithApple"]>(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { ok: false as const, message: "Apple did not return an identity token" };
      }
      const parts = credential.fullName;
      const providerName =
        parts
          ? [parts.givenName, parts.familyName].filter(Boolean).join(" ") || null
          : null;
      return callSocialAuth("apple", credential.identityToken, providerName);
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return { ok: false as const, message: "Cancelled" };
      }
      return { ok: false as const, message: err?.message ?? "Apple sign-in failed" };
    }
  }, [callSocialAuth]);

  const loginWithGoogle = useCallback<AuthContextValue["loginWithGoogle"]>(
    async (idToken: string) => {
      let providerName: string | null = null;
      try {
        const parts = idToken.split(".");
        if (parts.length >= 2) {
          const padded = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
          const payload = JSON.parse(atob(padded + "=".repeat((4 - padded.length % 4) % 4)));
          providerName = (payload.name as string) ?? null;
        }
      } catch { /* ignore decode errors */ }
      return callSocialAuth("google", idToken, providerName);
    },
    [callSocialAuth],
  );

  const linkSocialProvider = useCallback<AuthContextValue["linkSocialProvider"]>(
    async (provider, identityToken) => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) return { ok: false as const, message: "Not signed in" };
      try {
        const res = await fetch(apiUrl("/api/mobile/account/social/link"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedToken}`,
          },
          body: JSON.stringify({ provider, identityToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false as const, message: data?.message ?? "Could not link account" };
        }
        return { ok: true as const, links: data.links ?? [] };
      } catch (err: any) {
        return { ok: false as const, message: err?.message ?? "Network error" };
      }
    },
    [],
  );

  const unlinkSocialProvider = useCallback<AuthContextValue["unlinkSocialProvider"]>(
    async (provider) => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) return { ok: false as const, message: "Not signed in" };
      try {
        const res = await fetch(apiUrl(`/api/mobile/account/social/link/${provider}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false as const, message: data?.message ?? "Could not unlink account" };
        }
        return { ok: true as const, links: data.links ?? [] };
      } catch (err: any) {
        return { ok: false as const, message: err?.message ?? "Network error" };
      }
    },
    [],
  );

  const fetchSocialLinks = useCallback<AuthContextValue["fetchSocialLinks"]>(async () => {
    const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!storedToken) return [];
    try {
      const res = await fetch(apiUrl("/api/mobile/account/social/links"), {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      return data?.links ?? [];
    } catch {
      return [];
    }
  }, []);

  const enrollBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm to enable biometric login",
        cancelLabel: "Not now",
        disableDeviceFallback: false,
      });
      if (!result.success) return false;

      await SecureStore.setItemAsync(BIOMETRIC_ENROLLED_KEY, "true");
      setBiometricEnrolled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disableBiometrics = useCallback(async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENROLLED_KEY);
    setBiometricEnrolled(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      token,
      user,
      biometricCapable,
      biometricEnrolled,
      signIn,
      updateUser,
      signOut,
      login,
      joinAsEmployee,
      loginWithBiometrics,
      loginWithApple,
      loginWithGoogle,
      linkSocialProvider,
      unlinkSocialProvider,
      fetchSocialLinks,
      enrollBiometrics,
      disableBiometrics,
    }),
    [
      loading,
      token,
      user,
      biometricCapable,
      biometricEnrolled,
      signIn,
      updateUser,
      signOut,
      login,
      joinAsEmployee,
      loginWithBiometrics,
      loginWithApple,
      loginWithGoogle,
      linkSocialProvider,
      unlinkSocialProvider,
      fetchSocialLinks,
      enrollBiometrics,
      disableBiometrics,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
