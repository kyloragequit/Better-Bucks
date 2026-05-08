import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { brand } from "@/constants/colors";

export function ScreenContainer({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: any;
}) {
  const insets = useSafeAreaInsets();
  const Inner = scroll ? ScrollView : View;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <Inner
        contentContainerStyle={
          scroll
            ? [
                styles.scrollContent,
                {
                  paddingTop: insets.top + 24,
                  paddingBottom: insets.bottom + 32,
                },
                contentStyle,
              ]
            : undefined
        }
        style={
          scroll
            ? undefined
            : [
                styles.viewContent,
                {
                  paddingTop: insets.top + 24,
                  paddingBottom: insets.bottom + 32,
                },
                contentStyle,
              ]
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Inner>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.navy },
  scrollContent: { paddingHorizontal: 24, flexGrow: 1 },
  viewContent: { flex: 1, paddingHorizontal: 24 },
});
