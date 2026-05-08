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
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
            },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.viewContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * A scrollable form container for use inside a Modal.
 * Handles keyboard avoidance, full-height layout, and inset-aware padding.
 */
export function ModalFormContainer({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: any;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 40,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.navy },
  scrollContent: { paddingHorizontal: 24, flexGrow: 1 },
  viewContent: { flex: 1, paddingHorizontal: 24 },
});
