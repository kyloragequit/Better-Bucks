import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login, loginWithBiometrics, enrollBiometrics, biometricCapable, biometricEnrolled } =
    useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bioSubmitting, setBioSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (biometricEnrolled) {
      handleBiometricLogin();
    }
  }, [biometricEnrolled]);

  const handleBiometricLogin = async () => {
    setBioSubmitting(true);
    setError(null);
    const result = await loginWithBiometrics();
    setBioSubmitting(false);
    if (result.ok) {
      router.replace("/dashboard");
    } else if (result.message !== "Cancelled") {
      setError(result.message);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(username.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (biometricCapable && !biometricEnrolled) {
      Alert.alert(
        "Enable Face ID / Touch ID?",
        "Sign in faster next time using biometrics.",
        [
          { text: "Not now", style: "cancel", onPress: () => router.replace("/(tabs)" as any) },
          {
            text: "Enable",
            onPress: async () => {
              await enrollBiometrics();
              router.replace("/(tabs)" as any);
            },
          },
        ],
      );
    } else {
      router.replace("/(tabs)" as any);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Logo size={72} />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Log in to your Better Bucks account.
        </Text>
      </View>

      {biometricEnrolled ? (
        <View style={styles.biometricSection}>
          <Pressable
            onPress={handleBiometricLogin}
            style={styles.biometricButton}
            disabled={bioSubmitting}
            accessibilityLabel="Sign in with Face ID or Touch ID"
          >
            <Ionicons
              name="finger-print"
              size={36}
              color={bioSubmitting ? "rgba(255,255,255,0.3)" : brand.gold}
            />
            <Text style={styles.biometricText}>
              {bioSubmitting ? "Authenticating…" : "Sign in with Face ID / Touch ID"}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or use password</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>
      ) : null}

      <TextField
        label="Email or username"
        placeholder="you@company.com"
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        value={username}
        onChangeText={setUsername}
      />

      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        testID="login-submit"
        title="Log In"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <View style={{ height: 8 }} />
      <Button
        title="Forgot Password?"
        variant="ghost"
        onPress={() => router.push("/forgot-password")}
      />

      <View style={{ height: 4 }} />
      <Button
        title="Create a new account"
        variant="ghost"
        onPress={() => router.push("/signup/account")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  title: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    marginTop: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  biometricSection: {
    width: "100%",
    marginBottom: 12,
  },
  biometricButton: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  biometricText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
