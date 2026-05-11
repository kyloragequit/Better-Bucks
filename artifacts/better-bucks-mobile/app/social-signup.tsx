import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { consumePendingSocialSignup } from "@/lib/socialSignupStore";
import type { PendingSocialSignup } from "@/lib/socialSignupStore";

const ORG_CODE_REGEX = /^[A-Z0-9]{8}$/;

export default function SocialSignupScreen() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState<PendingSocialSignup | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgCodeError, setOrgCodeError] = useState<string | null>(null);
  const [orgNotFound, setOrgNotFound] = useState(false);

  useEffect(() => {
    const p = consumePendingSocialSignup();
    if (!p) {
      router.replace("/login");
      return;
    }
    setPending(p);
    setFullName(p.providerName ?? "");
    setEmail(p.providerEmail ?? "");
  }, []);

  const handleOrgCodeChange = (value: string) => {
    setOrgCode(value);
    if (orgCodeError) {
      setOrgCodeError(null);
      setOrgNotFound(false);
    }
  };

  const handleSubmit = async () => {
    if (!pending) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedCode = orgCode.trim().toUpperCase();

    setError(null);
    setOrgCodeError(null);

    if (trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!ORG_CODE_REGEX.test(trimmedCode)) {
      setOrgCodeError(
        trimmedCode.length === 0
          ? "Please enter the org code your employer gave you."
          : "Org codes are 8 characters (letters and numbers). Double-check with your manager.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(apiUrl("/api/mobile/auth/social/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: pending.provider,
          identityToken: pending.identityToken,
          orgCode: trimmedCode,
          fullName: trimmedName,
          email: trimmedEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setOrgCodeError(
            "That code doesn't match any organization — double-check with your manager.",
          );
          setOrgNotFound(true);
        } else {
          setError(data?.message ?? "Sign-up failed. Please try again.");
        }
        return;
      }
      if (data.pendingApproval) {
        router.replace("/pending-approval" as any);
        return;
      }
      await signIn(data.token, data.user);
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      setError(err?.message ?? "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const providerLabel = pending?.provider === "apple" ? "Apple" : "Google";

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Logo size={60} />
        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Finish setting up your Better Bucks account using {providerLabel}.
        </Text>
      </View>

      <TextField
        label="Full name"
        placeholder="Jane Doe"
        autoCapitalize="words"
        textContentType="name"
        value={fullName}
        onChangeText={setFullName}
      />

      <TextField
        label="Email"
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />

      <TextField
        label="Org code"
        placeholder="e.g. AB12CD34"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        value={orgCode}
        onChangeText={handleOrgCodeChange}
      />

      {orgCodeError ? (
        <View style={styles.orgCodeErrorContainer}>
          <Text style={styles.orgCodeError}>{orgCodeError}</Text>
          {orgNotFound && (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("mailto:support@betterbucks.app?subject=Org%20Code%20Help")
              }
              accessibilityRole="link"
              accessibilityLabel="Contact Better Bucks support for help with your org code"
            >
              <Text style={styles.contactLink}>Contact support for help</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>Ask your employer or manager for this code.</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Create Account"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 16 }}
      />

      <View style={{ height: 8 }} />
      <Button
        title="Back to Log In"
        variant="ghost"
        onPress={() => router.replace("/login")}
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
    textAlign: "center",
  },
  hint: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
  orgCodeErrorContainer: {
    marginTop: -4,
    marginBottom: 8,
    gap: 4,
  },
  orgCodeError: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  contactLink: {
    color: "#93C5FD",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
});
