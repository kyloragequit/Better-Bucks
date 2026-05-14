import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { brand } from "@/constants/colors";

// ── Confetti particle ─────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  brand.green,
  brand.navy,
  "#FFD54F",
  "#4FC3F7",
  "#FF8A65",
  "#CE93D8",
];

function ConfettiParticle({
  index,
  screenWidth,
}: {
  index: number;
  screenWidth: number;
}) {
  const size = 8 + (index % 4) * 3;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const startX = (index / 18) * screenWidth + Math.sin(index * 1.7) * 30;
  const duration = 900 + (index % 5) * 200;
  const delay = index * 60;

  const y = useSharedValue(-20);
  const x = useSharedValue(startX);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 150 }));
    y.value = withDelay(
      delay,
      withTiming(420, { duration, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) }),
    );
    x.value = withDelay(
      delay,
      withTiming(startX + Math.sin(index) * 40, { duration }),
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 * (index % 2 === 0 ? 1 : -1), { duration }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const isCircle = index % 3 === 0;

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: isCircle ? size / 2 : 2,
          position: "absolute",
          top: 0,
          left: 0,
        },
        style,
      ]}
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TransferSuccessScreen() {
  const { amount, recipientName, senderName, direction, newBalance } =
    useLocalSearchParams<{
      amount: string;
      recipientName?: string;
      senderName?: string;
      direction: "sent" | "received";
      newBalance?: string;
    }>();
  const insets = useSafeAreaInsets();

  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const cardY = useSharedValue(40);
  const cardOpacity = useSharedValue(0);

  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    checkOpacity.value = withTiming(1, { duration: 200 });
    checkScale.value = withSpring(1, { damping: 12, stiffness: 220 });
    cardOpacity.value = withDelay(300, withTiming(1, { duration: 350 }));
    cardY.value = withDelay(300, withSpring(0, { damping: 14, stiffness: 160 }));
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const isSent = direction !== "received";
  const parsedAmount = parseInt(amount ?? "0", 10);
  const name = isSent ? (recipientName ?? "recipient") : (senderName ?? "sender");

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 20 }]}>
      {/* Confetti */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {Array.from({ length: 18 }, (_, i) => (
          <ConfettiParticle key={i} index={i} screenWidth={375} />
        ))}
      </View>

      {/* Checkmark */}
      <Animated.View style={[styles.checkWrap, checkStyle]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={52} color={brand.white} />
        </View>
      </Animated.View>

      {/* Details card */}
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.successTitle}>Transfer Complete!</Text>
        <Text style={styles.successSub}>
          {isSent
            ? `You sent BB ${parsedAmount.toLocaleString()} to ${name}`
            : `You received BB ${parsedAmount.toLocaleString()} from ${name}`}
        </Text>

        {newBalance !== undefined && newBalance !== "" && (
          <View style={styles.balanceRow}>
            <Ionicons name="wallet-outline" size={16} color={brand.textMuted} />
            <Text style={styles.balanceText}>
              New balance:{" "}
              <Text style={styles.balanceBold}>
                BB {parseInt(newBalance, 10).toLocaleString()}
              </Text>
            </Text>
          </View>
        )}
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[styles.ctaWrap, cardStyle]}>
        <Pressable
          style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace("/(tabs)")}
          accessibilityRole="button"
          accessibilityLabel="Done — return to home"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.historyButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/transfer/history")}
          accessibilityRole="button"
          accessibilityLabel="View transfer history"
        >
          <Ionicons name="time-outline" size={15} color={brand.green} />
          <Text style={styles.historyButtonText}>View history</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 28,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  confettiParticle: {},
  checkWrap: {
    alignItems: "center",
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: brand.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    width: "100%",
    backgroundColor: brand.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  successTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  successSub: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: brand.border,
    width: "100%",
    justifyContent: "center",
  },
  balanceText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  balanceBold: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
  },
  ctaWrap: {
    width: "100%",
    gap: 14,
    alignItems: "center",
  },
  doneButton: {
    width: "100%",
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
  },
  doneButtonText: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyButtonText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
