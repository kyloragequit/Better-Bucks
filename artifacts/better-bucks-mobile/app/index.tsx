import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && token) {
      router.replace("/(tabs)" as any);
    }
  }, [loading, token]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.center}>
        <Logo size={160} />
        <Text style={styles.tagline}>Rewards that actually work.</Text>
      </View>

      <View style={styles.actions}>
        <Button
          testID="cta-signup"
          title="Create a New Organization"
          variant="navy"
          onPress={() => router.push("/signup/plan")}
        />
        <View style={{ height: 12 }} />
        <Button
          testID="cta-login"
          title="Log In"
          variant="primary"
          onPress={() => router.push("/login")}
        />
        <View style={{ height: 12 }} />
        <Button
          testID="cta-get-started"
          title="New Employee? Get Started"
          variant="outline"
          onPress={() => router.push("/get-started" as any)}
        />
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
  },
  tagline: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  actions: {
    paddingTop: 16,
  },
});
