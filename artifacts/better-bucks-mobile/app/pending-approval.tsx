import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
          <Text style={styles.badgeText}>Pending Approval</Text>
        </View>

        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Your account has been created and is waiting for your administrator to
          approve it. You'll be able to log in once they review your request.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoItem}>
            1. Your admin has been notified of your sign-up request.
          </Text>
          <Text style={styles.infoItem}>
            2. Once approved, you can log in with your {"\u00A0"}social account.
          </Text>
          <Text style={styles.infoItem}>
            3. If you have questions, contact your manager directly.
          </Text>
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
    backgroundColor: brand.navy,
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
    backgroundColor: "rgba(255,193,7,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,193,7,0.4)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  badgeText: {
    color: "#FFC107",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  title: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 18,
    width: "100%",
    marginTop: 8,
    gap: 8,
  },
  infoTitle: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 4,
  },
  infoItem: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
