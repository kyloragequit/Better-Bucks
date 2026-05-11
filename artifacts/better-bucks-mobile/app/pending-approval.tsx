import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { brand } from "@/constants/colors";

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.content}>
        <Logo size={72} />

        <View style={styles.badge}>
          <Ionicons name="time-outline" size={14} color={brand.warning} />
          <Text style={styles.badgeText}>Pending Approval</Text>
        </View>

        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Your account has been created and is waiting for your administrator to
          approve it. You'll be able to log in once they review your request.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <View style={styles.infoRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.infoItem}>
              Your admin has been notified of your sign-up request.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.infoItem}>
              Once approved, you can log in with your social account.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.infoItem}>
              If you have questions, contact your manager directly.
            </Text>
          </View>
        </View>
      </View>

      <Button
        title="Back to Log In"
        variant="outline"
        onPress={() => router.replace("/login")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.white,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(249,168,37,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,168,37,0.30)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  badgeText: {
    color: brand.warning,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    padding: 18,
    width: "100%",
    marginTop: 8,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 12,
  },
  infoTitle: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNum: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  infoItem: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
});
