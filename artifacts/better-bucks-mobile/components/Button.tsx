import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { brand } from "@/constants/colors";

type Variant = "primary" | "secondary" | "outline" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const isDisabled = disabled || loading;
  const palette = paletteFor(variant);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !isDisabled ? { opacity: 0.85 } : null,
        isDisabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.text, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

function paletteFor(v: Variant) {
  switch (v) {
    case "secondary":
      return { bg: brand.green, fg: brand.white, border: brand.green };
    case "outline":
      return {
        bg: "transparent",
        fg: brand.white,
        border: "rgba(255,255,255,0.6)",
      };
    case "ghost":
      return { bg: "transparent", fg: brand.white, border: "transparent" };
    case "primary":
    default:
      return { bg: brand.gold, fg: brand.navy, border: brand.gold };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1.5,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
