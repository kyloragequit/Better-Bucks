import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && token) {
      router.replace("/dashboard");
    }
  }, [loading, token]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.center}>
        <Logo size={140} />
        <Text style={styles.wordmark}>Better Bucks</Text>
        <Text style={styles.tagline}>Reward your team. Build your culture.</Text>
      </View>

      <View style={styles.actions}>
        <Button
          testID="cta-login"
          title="Log In"
          variant="primary"
          onPress={() => router.push("/login")}
        />
        <View style={{ height: 12 }} />
        <Button
          testID="cta-signup"
          title="Sign Up"
          variant="outline"
          onPress={() => router.push("/signup/account")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.navy,
    paddingHorizontal: 28,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  wordmark: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: 0.5,
    marginTop: 12,
  },
  tagline: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  actions: {
    paddingTop: 16,
  },
});
