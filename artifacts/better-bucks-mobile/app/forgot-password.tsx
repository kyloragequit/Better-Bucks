import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: trimmed }),
      });
      if (!res.ok && res.status !== 200) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Logo size={80} />
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.body}>
            If that email is on file, you'll receive a reset link shortly.
          </Text>
          <View style={{ height: 28 }} />
          <Button
            testID="forgot-password-back"
            title="Back to Log In"
            onPress={() => router.replace("/login")}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Logo size={72} />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.body}>
          Enter the email address on your account and we'll send you a reset link.
        </Text>
      </View>

      <TextField
        label="Email address"
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        testID="forgot-password-submit"
        title="Send Reset Link"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <View style={{ height: 16 }} />
      <Button
        title="Back to Log In"
        variant="ghost"
        onPress={() => router.back()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 28,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    textAlign: "center",
    marginTop: 4,
  },
  body: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  error: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 8,
  },
});
