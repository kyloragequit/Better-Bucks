import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { brand } from "@/constants/colors";
import { useTransferWs, type TransferWsEvent } from "@/hooks/useTransferWs";

// ── NFC ring — each ring is its own component to keep hooks at top level ──────
function NfcRing({
  size,
  delayMs,
}: {
  size: number;
  delayMs: number;
}) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      scale.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 0 }),
          withTiming(1.65, {
            duration: 1400,
            easing: Easing.out(Easing.cubic),
          }),
        ),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 280 }),
          withTiming(0, { duration: 1120 }),
        ),
        -1,
        false,
      );
    };

    if (delayMs === 0) {
      startAnimation();
    } else {
      const id = setTimeout(startAnimation, delayMs);
      return () => clearTimeout(id);
    }
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animStyle,
      ]}
    />
  );
}

function NfcDisplay() {
  return (
    <View style={styles.nfcContainer}>
      <NfcRing size={80} delayMs={0} />
      <NfcRing size={130} delayMs={460} />
      <NfcRing size={180} delayMs={920} />
      <View style={styles.nfcCentre}>
        <Ionicons name="radio" size={38} color={brand.white} />
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TransferReceiveScreen() {
  const {
    method,
    token: transferToken,
    transferId,
    amount,
    expiresIn,
  } = useLocalSearchParams<{
    method: "nfc" | "qr";
    token: string;
    transferId: string;
    amount: string;
    expiresIn: string;
  }>();

  const insets = useSafeAreaInsets();
  const expirySeconds = parseInt(expiresIn ?? "60", 10);
  const [secondsLeft, setSecondsLeft] = useState(expirySeconds);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const expired = secondsLeft === 0 && !completed;

  // WebSocket — fires when recipient completes the transfer
  useTransferWs((event: TransferWsEvent) => {
    if (
      event.type === "balance_updated" &&
      event.transferId === parseInt(transferId ?? "0", 10)
    ) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/transfer/success",
        params: {
          amount: amount ?? "0",
          direction: "sent",
          newBalance: String(event.balance),
        },
      });
    }
  });

  function handleCancel() {
    Alert.alert(
      "Cancel Transfer",
      "Are you sure? The recipient will no longer be able to complete this transfer.",
      [
        { text: "Keep waiting", style: "cancel" },
        { text: "Cancel transfer", style: "destructive", onPress: () => router.back() },
      ],
    );
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr =
    mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 20 }]}>
      {/* Amount badge */}
      <View style={styles.amountBadge}>
        <Text style={styles.amountLabel}>Sending</Text>
        <Text style={styles.amountValue}>
          BB {parseInt(amount ?? "0", 10).toLocaleString()}
        </Text>
      </View>

      {/* NFC animation or QR code */}
      <View style={styles.vizArea}>
        {method === "nfc" ? (
          <>
            <NfcDisplay />
            <Text style={styles.vizTitle}>Hold devices close together</Text>
          </>
        ) : (
          <>
            {transferToken ? (
              <View style={styles.qrCard}>
                <QRCode
                  value={transferToken}
                  size={200}
                  color={brand.navy}
                  backgroundColor={brand.white}
                />
              </View>
            ) : null}
            <Text style={styles.vizTitle}>Let the recipient scan this code</Text>
          </>
        )}
      </View>

      {/* Status / expired */}
      {expired ? (
        <View style={styles.expiredBanner}>
          <Ionicons name="time-outline" size={17} color={brand.danger} />
          <Text style={styles.expiredText}>Token expired</Text>
        </View>
      ) : (
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {completed ? "Completing…" : "Waiting for recipient"}
          </Text>
          <Text style={styles.timerText}>{timeStr}</Text>
        </View>
      )}

      {/* Hint */}
      <Text style={styles.hint}>
        {method === "nfc"
          ? "The recipient should open Better Bucks and choose Receive → Tap."
          : "Once they scan, the Bucks will transfer instantly."}
      </Text>

      {/* Cancel */}
      {!completed && (
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
          onPress={expired ? () => router.back() : handleCancel}
          accessibilityRole="button"
          accessibilityLabel={expired ? "Go back" : "Cancel transfer"}
        >
          <Text style={styles.cancelText}>{expired ? "Go back" : "Cancel"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 28,
  },
  amountBadge: {
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    color: brand.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  amountValue: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 36,
  },
  vizArea: {
    alignItems: "center",
    gap: 22,
    minHeight: 260,
    justifyContent: "center",
  },
  vizTitle: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  // NFC rings
  nfcContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: brand.green,
  },
  nfcCentre: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: brand.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 8,
  },
  // QR
  qrCard: {
    backgroundColor: brand.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  // Status
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: brand.offWhite,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: brand.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.green,
  },
  statusText: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
  timerText: {
    color: brand.textMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    minWidth: 36,
    textAlign: "right",
  },
  expiredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(198,40,40,0.08)",
    borderWidth: 1,
    borderColor: "rgba(198,40,40,0.20)",
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  expiredText: {
    color: brand.danger,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  hint: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: brand.border,
  },
  cancelText: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
