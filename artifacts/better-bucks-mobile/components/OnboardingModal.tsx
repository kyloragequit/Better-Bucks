import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { brand } from "@/constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");

type Slide = {
  key: string;
  emoji: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "welcome",
    emoji: "🎉",
    title: "Welcome to Better Bucks",
    body: "Better Bucks helps you recognise and reward your frontline team — the people who make your business run.",
  },
  {
    key: "budget",
    emoji: "💰",
    title: "Set your monthly budget",
    body: "Decide how many Bucks your organisation has to give each month. Open the dashboard and tap 'Monthly Incentive Budget' to get started.",
  },
  {
    key: "allocate",
    emoji: "🏦",
    title: "Allocate to administrators",
    body: "Distribute Bucks to your admin team at the start of each month. They'll use their balance to reward employees directly.",
  },
  {
    key: "reward",
    emoji: "⭐",
    title: "Reward your team",
    body: "Admins can give Bucks to any employee for great work. Employees spend their Bucks in the rewards store.",
  },
];

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function OnboardingModal({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onDismiss();
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/*
       * Outer overlay — pointerEvents="box-none" so touch events pass through
       * to children rather than being absorbed by the overlay view itself.
       */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Card */}
        <View
          style={[
            styles.card,
            { paddingBottom: Math.max(insets.bottom, 20) + 8 },
          ]}
        >
          {/*
           * Skip button container — zIndex: 999 ensures it sits above every
           * other element on iOS, preventing any overlapping view from
           * swallowing the tap.
           */}
          <View style={styles.skipContainer} pointerEvents="box-none">
            <Pressable
              testID="onboarding-skip"
              accessibilityLabel="Skip tutorial"
              accessibilityRole="button"
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipButtonPressed,
              ]}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {/* Slides */}
          <FlatList
            ref={listRef}
            data={SLIDES}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => <SlideView slide={item} />}
          />

          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.key}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>

          {/* Next / Get started button */}
          <View style={styles.footer}>
            <Pressable
              testID="onboarding-next"
              onPress={goNext}
              style={({ pressed }) => [
                styles.nextButton,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.nextText}>
                {isLast ? "Get started" : "Next →"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={[styles.slide, { width: SCREEN_W - 48 }]}>
      <Text style={styles.emoji}>{slide.emoji}</Text>
      <Text style={styles.slideTitle}>{slide.title}</Text>
      <Text style={styles.slideBody}>{slide.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: brand.navy,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    overflow: "hidden",
    // Ensure the card itself never absorbs touches meant for children
    // (belt-and-suspenders alongside pointerEvents="box-none" on overlay)
  },
  skipContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 8,
    zIndex: 999,
    // Elevate above all sibling views on iOS
    ...Platform.select({ ios: { zIndex: 999 } }),
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 999,
  },
  skipButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  skipText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  slide: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
    gap: 14,
  },
  emoji: {
    fontSize: 56,
    lineHeight: 72,
  },
  slideTitle: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    lineHeight: 30,
  },
  slideBody: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 20,
    marginBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotActive: {
    backgroundColor: brand.gold,
    width: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  nextButton: {
    backgroundColor: brand.gold,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    color: brand.navy,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
