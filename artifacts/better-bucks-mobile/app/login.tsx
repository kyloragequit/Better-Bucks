import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.replace("/dashboard");
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
});
