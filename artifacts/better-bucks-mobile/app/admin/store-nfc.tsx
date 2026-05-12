import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import NfcManager, { Ndef } from "react-native-nfc-manager";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type NfcTokenResponse = {
  token: string;
  exp: number;
  item: { id: number; name: string; price: number };
};

const REFRESH_INTERVAL_MS = 20_000;

export default function StoreNfcScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { itemId, itemName, itemPrice } = useLocalSearchParams<{
    itemId: string;
    itemName: string;
    itemPrice: string;
  }>();

  const [nfcToken, setNfcToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const hceActive = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHce = useCallback(() => {
    if (!hceActive.current) return;
    hceActive.current = false;
    setBroadcasting(false);
    try {
      void NfcManager.cancelTechnologyRequest().catch(() => {});
    } catch {}
  }, []);

  const startHce = useCallback(async (tok: string) => {
    if (Platform.OS !== "android") return;
    try {
      const message = [Ndef.textRecord(tok)];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (NfcManager as any).setNdefEmulatorMessage(message);
      hceActive.current = true;
      setBroadcasting(true);
    } catch {
      hceActive.current = false;
      setBroadcasting(false);
    }
  }, []);

  const fetchToken = useCallback(async () => {
    if (!token || !itemId) return;
    try {
      setError(null);
      const res = await fetch(apiUrl(`/api/mobile/admin/store-items/${itemId}/nfc-token`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        setError(d.message ?? "Failed to generate token");
        return;
      }
      const data = (await res.json()) as NfcTokenResponse;
      setNfcToken(data.token);
      setExpiresAt(data.exp);
      setTimeLeft(Math.round((data.exp - Date.now()) / 1000));

      stopHce();
      if (Platform.OS === "android" && nfcSupported && nfcEnabled) {
        await startHce(data.token);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, itemId, nfcSupported, nfcEnabled, stopHce, startHce]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (!mounted) return;
        setNfcSupported(supported);
        if (supported) {
          await NfcManager.start();
          if (Platform.OS === "android") {
            const enabled = await NfcManager.isEnabled();
            if (mounted) setNfcEnabled(enabled);
          } else {
            if (mounted) setNfcEnabled(null);
          }
        }
      } catch {
        if (mounted) setNfcSupported(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    refreshTimer.current = setTimeout(() => {
      void fetchToken();
      refreshTimer.current = null;
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [nfcToken, fetchToken]);

  useEffect(() => {
    countdownTimer.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    }, 1000);
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [nfcToken]);

  useEffect(() => {
    return () => { stopHce(); };
  }, [stopHce]);

  const price = parseInt(itemPrice ?? "0") || 0;
  const isAndroid = Platform.OS === "android";

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => { stopHce(); router.back(); }} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={brand.navy} />
        </Pressable>
        <Text style={styles.topTitle}>NFC Tap-to-Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.itemCard}>
        <View style={styles.itemIconWrap}>
          <Ionicons name="gift-outline" size={28} color={brand.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{itemName}</Text>
          <Text style={styles.itemPrice}>{price.toLocaleString()} Bucks</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={brand.green} size="large" />
          <Text style={styles.loadingText}>Generating NFC token…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); void fetchToken(); }}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : !isAndroid ? (
        <View style={styles.center}>
          <Ionicons name="phone-portrait-outline" size={56} color={brand.textMuted} />
          <Text style={styles.iosTitle}>Android required</Text>
          <Text style={styles.iosBody}>
            NFC broadcasting (HCE) is only supported on Android devices. Please use an Android phone to broadcast this item to employees.
          </Text>
        </View>
      ) : nfcSupported === false ? (
        <View style={styles.center}>
          <Ionicons name="radio-outline" size={56} color={brand.textMuted} />
          <Text style={styles.iosTitle}>NFC not supported</Text>
          <Text style={styles.iosBody}>This device does not support NFC.</Text>
        </View>
      ) : nfcEnabled === false ? (
        <View style={styles.center}>
          <Ionicons name="radio-outline" size={56} color={brand.danger} />
          <Text style={styles.iosTitle}>NFC is off</Text>
          <Text style={styles.iosBody}>
            Please enable NFC in your device settings, then come back.
          </Text>
        </View>
      ) : (
        <View style={styles.broadcastArea}>
          <View style={[styles.ringOuter, broadcasting && styles.ringOuterActive]}>
            <View style={[styles.ringInner, broadcasting && styles.ringInnerActive]}>
              <Ionicons
                name={broadcasting ? "radio" : "radio-outline"}
                size={56}
                color={broadcasting ? brand.white : brand.textMuted}
              />
            </View>
          </View>

          <Text style={styles.broadcastLabel}>
            {broadcasting ? "Broadcasting — hold employee phone near" : "Activating NFC…"}
          </Text>

          {nfcToken && (
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color={brand.textMuted} />
              <Text style={styles.timerText}>
                Refreshes in {timeLeft}s
              </Text>
              <Pressable onPress={() => { setLoading(true); void fetchToken(); }} hitSlop={8}>
                <Text style={styles.refreshLink}>Refresh now</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.instructionCard}>
            <Ionicons name="information-circle-outline" size={18} color={brand.navy} />
            <Text style={styles.instructionText}>
              The employee opens the store and taps "Scan NFC", then brings their phone near yours. A purchase order for <Text style={{ fontFamily: "Inter_600SemiBold" }}>{itemName}</Text> will be placed automatically.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  backBtn: { width: 40 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: brand.text,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    margin: 16,
    padding: 16,
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
  },
  itemIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(46,125,50,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: brand.text },
  itemPrice: { fontFamily: "Inter_400Regular", fontSize: 13, color: brand.green, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 15, color: brand.textMuted },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 15, color: brand.danger, textAlign: "center" },
  retryBtn: {
    backgroundColor: brand.navy,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: { color: brand.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  iosTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: brand.text, textAlign: "center" },
  iosBody: { fontFamily: "Inter_400Regular", fontSize: 14, color: brand.textMuted, textAlign: "center", lineHeight: 22 },
  broadcastArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 24 },
  ringOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.offWhite,
  },
  ringOuterActive: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.06)",
  },
  ringInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.white,
  },
  ringInnerActive: {
    borderColor: brand.green,
    backgroundColor: brand.green,
  },
  broadcastLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: brand.text,
    textAlign: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timerText: { fontFamily: "Inter_400Regular", fontSize: 13, color: brand.textMuted },
  refreshLink: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: brand.green },
  instructionCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "rgba(10,25,50,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(10,25,50,0.10)",
    alignItems: "flex-start",
  },
  instructionText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: brand.navy,
    lineHeight: 20,
  },
});
