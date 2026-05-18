import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { brand } from "@/constants/colors";
import { needsAccountSetup, useAuth } from "@/contexts/AuthContext";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (token) {
      if (needsAccountSetup(user)) {
        router.replace("/account-setup" as any);
      } else {
        router.replace("/(tabs)" as any);
      }
    }
  }, [loading, token, user]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.center}>
        <Logo size={160} />
        <Button
          testID="cta-signup"
          title="Create a New Organization"
          variant="navy"
          style={{ width: "100%", marginTop: 8 }}
          onPress={() => router.push("/signup/plan")}
        />
        <Text style={styles.tagline}>Rewards that actually work.</Text>

        <View style={styles.secondaryActions}>
          <Button
            testID="cta-login"
            title="Log In"
            variant="primary"
            style={styles.smallButton}
            onPress={() => router.push("/login")}
          />
          <Button
            testID="cta-get-started"
            title="New Employee?"
            variant="outline"
            style={styles.smallButton}
            onPress={() => router.push("/get-started" as any)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.white,
    paddingHorizontal: 28,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
  },
  tagline: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 4,
  },
  secondaryActions: {
    alignItems: "center",
    gap: 8,
  },
  smallButton: {
    height: 42,
    width: 220,
  },
});
