import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePasswordScreen() {
  const { token, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState(user?.email ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    if (!currentPassword) return "Enter your current password.";
    if (newPassword.length < 6) return "New password must be at least 6 characters.";
    if (newPassword !== confirmPassword) return "New passwords do not match.";
    const trimmed = recoveryEmail.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes("."))
      return "Enter a valid recovery email address.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/mobile/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          recoveryEmail: recoveryEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Password change failed. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={brand.green} />
          </View>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.body}>Your recovery email has also been saved.</Text>
          <View style={{ height: 24 }} />
          <Button
            testID="change-password-done"
            title="Back to Dashboard"
            onPress={() => router.replace("/dashboard")}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Change Password</Text>
      <Text style={styles.sub}>Enter your current password and choose a new one.</Text>

      <View style={{ height: 20 }} />

      <TextField
        label="Current password"
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />

      <TextField
        label="New password"
        placeholder="At least 6 characters"
        secureTextEntry
        textContentType="newPassword"
        value={newPassword}
        onChangeText={setNewPassword}
      />

      <TextField
        label="Confirm new password"
        placeholder="••••••••"
        secureTextEntry
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TextField
        label="Recovery email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        value={recoveryEmail}
        onChangeText={setRecoveryEmail}
      />
      <Text style={styles.hint}>
        We'll use this to help you regain access if you're ever locked out.
        {user?.email
          ? " Your current email has been pre-filled — confirm it to save."
          : ""}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ height: 8 }} />
      <Button
        testID="change-password-submit"
        title="Update Password"
        onPress={handleSubmit}
        loading={submitting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  sub: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  hint: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: -6,
    marginBottom: 14,
  },
  error: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  successIcon: {
    marginBottom: 4,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    textAlign: "center",
  },
  body: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
