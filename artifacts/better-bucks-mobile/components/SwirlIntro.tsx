import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

const NAVY = "#162E4B";
const GREEN = "#2E7D32";

const AnimatedG = Animated.createAnimatedComponent(G);

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function buildSlices(cx: number, cy: number, r: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const s = i * 45 - 90;
    const e = s + 45;
    const x1 = cx + r * Math.cos(toRad(s));
    const y1 = cy + r * Math.sin(toRad(s));
    const x2 = cx + r * Math.cos(toRad(e));
    const y2 = cy + r * Math.sin(toRad(e));
    return {
      d: `M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      fill: i % 2 === 0 ? NAVY : GREEN,
      delay: i * 60,
    };
  });
}

// ─── Individual slice ────────────────────────────────────────────────────────

function SwirlSlice({
  d,
  fill,
  delay,
  cx,
  cy,
}: {
  d: string;
  fill: string;
  delay: number;
  cx: number;
  cy: number;
}) {
  const rotation = useSharedValue(-180);
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 120 }));
    // cubic-bezier(0.22,1,0.36,1) — spring that snaps fast with very little overshoot
    rotation.value = withDelay(
      delay,
      withSpring(0, { damping: 15, stiffness: 100, mass: 1 }),
    );
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 15, stiffness: 100, mass: 1 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animProps = useAnimatedProps(() => ({
    rotation: rotation.value,
    scale: scale.value,
    opacity: opacity.value,
  }));

  return (
    <AnimatedG animatedProps={animProps} originX={cx} originY={cy}>
      <Path d={d} fill={fill} />
    </AnimatedG>
  );
}

// ─── Logo circle ─────────────────────────────────────────────────────────────

function SwirlLogo({ cx, cy }: { cx: number; cy: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(550, withTiming(1, { duration: 80 }));
    // cubic-bezier(0.34,1.56,0.64,1) — big overshoot bounce
    scale.value = withDelay(
      550,
      withSpring(1, { damping: 7, stiffness: 180, mass: 0.5 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animProps = useAnimatedProps(() => ({
    scale: scale.value,
    opacity: opacity.value,
  }));

  return (
    <AnimatedG animatedProps={animProps} originX={cx} originY={cy}>
      {/* Face circle */}
      <Circle
        cx={cx}
        cy={cy}
        r={62}
        fill="white"
        stroke={NAVY}
        strokeWidth={3.5}
      />
      {/* Eyes */}
      <Circle cx={cx - 20} cy={cy - 14} r={5} fill={NAVY} />
      <Circle cx={cx + 20} cy={cy - 14} r={5} fill={NAVY} />
      {/* Smile */}
      <Path
        d={`M ${cx - 22} ${cy + 10} Q ${cx} ${cy + 32} ${cx + 22} ${cy + 10}`}
        stroke={NAVY}
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Dollar tick — top */}
      <Line
        x1={cx}
        y1={cy - 32}
        x2={cx}
        y2={cy - 44}
        stroke={NAVY}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Line
        x1={cx - 8}
        y1={cy - 40}
        x2={cx + 8}
        y2={cy - 40}
        stroke={NAVY}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Dollar tick — bottom */}
      <Line
        x1={cx}
        y1={cy + 32}
        x2={cx}
        y2={cy + 44}
        stroke={NAVY}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Line
        x1={cx - 8}
        y1={cy + 40}
        x2={cx + 8}
        y2={cy + 40}
        stroke={NAVY}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </AnimatedG>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function SwirlIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.ceil(Math.sqrt(cx * cx + cy * cy)) + 20;

  const slices = useMemo(
    () => buildSlices(cx, cy, r),
    // stable once mounted — dimensions don't change mid-animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const overlayOpacity = useSharedValue(1);
  const overlayScale = useSharedValue(1);

  const triggerDone = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    // swirlFadeOut at 1400ms, 350ms duration, ease-in
    overlayOpacity.value = withDelay(
      1400,
      withTiming(
        0,
        { duration: 350, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(triggerDone)();
        },
      ),
    );
    overlayScale.value = withDelay(
      1400,
      withTiming(1.08, { duration: 350, easing: Easing.in(Easing.quad) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      pointerEvents="none"
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {slices.map((s, i) => (
          <SwirlSlice
            key={i}
            d={s.d}
            fill={s.fill}
            delay={s.delay}
            cx={cx}
            cy={cy}
          />
        ))}
        <SwirlLogo cx={cx} cy={cy} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    backgroundColor: NAVY,
  },
});
