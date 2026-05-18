import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { TextField } from "@/components/TextField";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Step = 0 | 1 | 2;

const STEPS = [
  { label: "Password", icon: "lock-closed-outline" as const },
  { label: "Email", icon: "mail-outline" as const },
  { label: "Address", icon: "home-outline" as const },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={i} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                done && styles.stepDone,
                active && styles.stepActive,
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color={brand.white} />
              ) : (
                <Text style={[styles.stepNum, active && styles.stepNumActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
              {s.label}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function AccountSetupScreen() {
  const { token, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const handlePasswordNext = () => {
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setStep(1);
    scrollTop();
  };

  const handleEmailNext = () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    setStep(2);
    scrollTop();
  };

  const handleAddressSubmit = async () => {
    setError(null);
    if (!addressLine1.trim()) {
      setError("Street address is required.");
      return;
    }
    if (!city.trim()) {
      setError("City is required.");
      return;
    }
    if (!state.trim()) {
      setError("State / province is required.");
      return;
    }
    if (!zip.trim()) {
      setError("ZIP / postal code is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/account/setup"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          newPassword,
          email: email.trim(),
          shippingAddressLine1: addressLine1.trim(),
          shippingAddressLine2: addressLine2.trim() || undefined,
          shippingCity: city.trim(),
          shippingState: state.trim(),
          shippingZip: zip.trim(),
          shippingCountry: country.trim() || "US",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Setup failed. Please try again.");
        return;
      }
      await updateUser(data.user);
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      setError(err?.message ?? "Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: brand.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Logo size={52} />
          <Text style={styles.title}>Set up your account</Text>
          <Text style={styles.subtitle}>
            Complete these steps before you get started.
          </Text>
        </View>

        <StepIndicator current={step} />

        {step === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Create a new password</Text>
            <Text style={styles.sectionHint}>
              Your account was created with a temporary password. Choose a secure one now.
            </Text>
            <TextField
              label="New password"
              placeholder="At least 6 characters"
              secureTextEntry
              textContentType="newPassword"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setError(null); }}
            />
            <TextField
              label="Confirm new password"
              placeholder="••••••••"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Continue" onPress={handlePasswordNext} style={{ marginTop: 8 }} />
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add your email</Text>
            <Text style={styles.sectionHint}>
              We'll use this to send you order updates, reward notifications, and account alerts.
            </Text>
            <TextField
              label="Email address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Continue" onPress={handleEmailNext} style={{ marginTop: 8 }} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping address</Text>
            <Text style={styles.sectionHint}>
              Used to deliver any physical rewards you redeem in the store.
            </Text>
            <TextField
              label="Street address"
              placeholder="123 Main St"
              autoCapitalize="words"
              textContentType="streetAddressLine1"
              value={addressLine1}
              onChangeText={(v) => { setAddressLine1(v); setError(null); }}
            />
            <TextField
              label="Apt, suite, floor (optional)"
              placeholder="Apt 4B"
              autoCapitalize="words"
              textContentType="streetAddressLine2"
              value={addressLine2}
              onChangeText={setAddressLine2}
            />
            <TextField
              label="City"
              placeholder="New York"
              autoCapitalize="words"
              textContentType="addressCity"
              value={city}
              onChangeText={(v) => { setCity(v); setError(null); }}
            />
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <TextField
                  label="State / Province"
                  placeholder="NY"
                  autoCapitalize="characters"
                  textContentType="addressState"
                  value={state}
                  onChangeText={(v) => { setState(v); setError(null); }}
                />
              </View>
              <View style={styles.rowHalf}>
                <TextField
                  label="ZIP / Postal code"
                  placeholder="10001"
                  keyboardType="numbers-and-punctuation"
                  textContentType="postalCode"
                  value={zip}
                  onChangeText={(v) => { setZip(v); setError(null); }}
                />
              </View>
            </View>
            <TextField
              label="Country"
              placeholder="US"
              autoCapitalize="characters"
              textContentType="countryName"
              value={country}
              onChangeText={setCountry}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Complete Setup"
              onPress={handleAddressSubmit}
              loading={submitting}
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    gap: 0,
  },
  header: {
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginTop: 8,
  },
  subtitle: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 32,
    gap: 0,
  },
  stepItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: {
    backgroundColor: brand.green,
  },
  stepActive: {
    backgroundColor: brand.navy,
  },
  stepNum: {
    color: brand.textMuted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  stepNumActive: {
    color: brand.white,
  },
  stepLabel: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginLeft: 4,
  },
  stepLabelActive: {
    color: brand.navy,
    fontFamily: "Inter_600SemiBold",
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: brand.border,
    marginHorizontal: 4,
    marginBottom: 0,
    alignSelf: "center",
  },
  stepLineDone: {
    backgroundColor: brand.green,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 4,
  },
  sectionHint: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowHalf: {
    flex: 1,
  },
  error: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 4,
  },
});
