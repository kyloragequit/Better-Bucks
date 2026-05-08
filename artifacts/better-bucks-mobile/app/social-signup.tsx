import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { consumePendingSocialSignup } from "@/lib/socialSignupStore";
import type { PendingSocialSignup } from "@/lib/socialSignupStore";

export default function SocialSignupScreen() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState<PendingSocialSignup | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!pending) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedCode = orgCode.trim().toUpperCase();

    if (trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (trimmedCode.length < 4) {
      setError("Please enter the org code your employer gave you.");
      return;
    }

    setSubmitting(true);
    setError(null);

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
        setError(data?.message ?? "Sign-up failed. Please try again.");
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
        value={orgCode}
        onChangeText={setOrgCode}
      />
      <Text style={styles.hint}>
        Ask your employer or manager for this code.
      </Text>

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
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
});
