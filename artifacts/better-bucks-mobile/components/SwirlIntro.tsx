import React, { useCallback, useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const NAVY = "#162E4B";
const GREEN = "#2E7D32";

const logoImage = require("../assets/images/logo.png");

export function SwirlIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoScale = useSharedValue(0.55);
  const logoOpacity = useSharedValue(0);

  // ── "Better Bucks" wordmark ───────────────────────────────────────────────
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(18);

  // ── Tagline ───────────────────────────────────────────────────────────────
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(10);

  // ── Exit overlay ──────────────────────────────────────────────────────────
  const screenOpacity = useSharedValue(1);

  const triggerDone = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    // Logo pops in with spring bounce — starts immediately
    logoOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 140, mass: 0.8 });

    // Wordmark slides up and fades in
    wordmarkOpacity.value = withDelay(220, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
    wordmarkY.value = withDelay(220, withSpring(0, { damping: 18, stiffness: 160 }));

    // Tagline follows 120ms after wordmark
    taglineOpacity.value = withDelay(420, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }));
    taglineY.value = withDelay(420, withSpring(0, { damping: 18, stiffness: 160 }));

    // Whole screen fades out after 1 700ms hold
    screenOpacity.value = withDelay(
      1700,
      withTiming(
        0,
        { duration: 380, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(triggerDone)();
        },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const logoSize = Math.min(width * 0.38, 160);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}
      pointerEvents="none"
    >
      {/* Subtle radial glow behind the logo */}
      <View
        style={[
          styles.glow,
          {
            width: logoSize * 2.4,
            height: logoSize * 2.4,
            borderRadius: logoSize * 1.2,
          },
        ]}
      />

      {/* Logo image */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={logoImage}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* "Better Bucks" wordmark */}
      <Animated.Text style={[styles.wordmark, wordmarkStyle]}>
        Better Bucks
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineStyle]}>
        Rewards that inspire
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    zIndex: 50,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    backgroundColor: "transparent",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 80,
    elevation: 0,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  wordmark: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.3,
  },
});
