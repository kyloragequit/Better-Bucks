import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { brand } from "@/constants/colors";
import { apiUrl } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";

type Step = "site-id" | "employee-code" | "register" | "pending";

export default function GetStartedScreen() {
  const { joinAsEmployee } = useAuth();

  const [step, setStep] = useState<Step>("site-id");
  const [siteId, setSiteId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [allowPasswordCreation, setAllowPasswordCreation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSiteIdContinue = async () => {
    const trimmed = siteId.trim();
    if (!trimmed) {
      setError("Please enter your Site ID.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/join/${encodeURIComponent(trimmed.toLowerCase())}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Site ID not found. Check with your manager.");
        return;
      }
      setOrgName(data.orgName ?? "");
      setSiteId(trimmed.toLowerCase());
      setStep("employee-code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeCodeContinue = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Please enter your employee code.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await joinAsEmployee(siteId, trimmedUsername);
    setLoading(false);

    if (result.ok === true) {
      router.replace("/(tabs)" as any);
    } else if (result.ok === "needs_registration") {
      setAllowPasswordCreation(result.allowPasswordCreation);
      setStep("register");
    } else if (result.ok === "pending_approval") {
      setStep("pending");
    } else {
      setError(result.message);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (allowPasswordCreation && password && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await joinAsEmployee(
      siteId,
      username.trim(),
      fullName.trim(),
      email.trim() || undefined,
      allowPasswordCreation && password ? password : undefined,
    );
    setLoading(false);

    if (result.ok === true) {
      router.replace("/(tabs)" as any);
    } else if (result.ok === "pending_approval") {
      setStep("pending");
    } else if (result.ok !== "needs_registration") {
      setError(result.message);
    }
  };

  if (step === "pending") {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.pendingCenter}>
          <Ionicons name="time-outline" size={56} color={brand.green} />
          <Text style={styles.pendingTitle}>Almost there!</Text>
          <Text style={styles.pendingBody}>
            Your account is waiting for approval by your manager. You'll be able to log in once they approve it.
          </Text>
          <Button title="Back to Login" onPress={() => router.replace("/login")} style={{ marginTop: 24 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Logo size={64} />
        {orgName ? (
          <View style={styles.orgBadge}>
            <Text style={styles.orgBadgeText}>{orgName}</Text>
          </View>
        ) : null}
      </View>

      {step === "site-id" && (
        <View style={styles.form}>
          <Text style={styles.stepLabel}>Step 1 of 2</Text>
          <Text style={styles.stepTitle}>Enter your Site ID</Text>
          <Text style={styles.stepHint}>
            Your manager or HR team will have given you this code. It usually looks like a short word or number sequence.
          </Text>
          <TextField
            label="Site ID"
            placeholder="Enter your Site ID"
            autoCapitalize="none"
            value={siteId}
            onChangeText={(v) => { setSiteId(v); setError(null); }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Continue" onPress={handleSiteIdContinue} loading={loading} style={{ marginTop: 8 }} />
        </View>
      )}

      {step === "employee-code" && (
        <View style={styles.form}>
          <Text style={styles.stepLabel}>Step 2 of 2</Text>
          <Text style={styles.stepTitle}>Enter your employee code</Text>
          <Text style={styles.stepHint}>
            This is the code or number your employer assigned to you.
          </Text>
          <TextField
            label="Employee Code / Username"
            placeholder="Enter your employee code"
            autoCapitalize="none"
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Continue" onPress={handleEmployeeCodeContinue} loading={loading} style={{ marginTop: 8 }} />
          <View style={{ height: 8 }} />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => { setStep("site-id"); setError(null); }}
          />
        </View>
      )}

      {step === "register" && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Create your account</Text>
          <Text style={styles.stepHint}>
            You're joining {orgName || "your organization"}. Fill in your details below.
          </Text>
          <TextField
            label="Full Name"
            placeholder="Jane Smith"
            value={fullName}
            onChangeText={(v) => { setFullName(v); setError(null); }}
          />
          <TextField
            label="Email (optional)"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
          />
          {allowPasswordCreation && (
            <TextField
              label="Password (optional)"
              placeholder="At least 6 characters"
              secureTextEntry
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Submit" onPress={handleRegister} loading={loading} style={{ marginTop: 8 }} />
          <View style={{ height: 8 }} />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => { setStep("employee-code"); setError(null); }}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 28,
    gap: 10,
  },
  orgBadge: {
    backgroundColor: brand.greenLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  orgBadgeText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  form: {
    gap: 4,
  },
  stepLabel: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginBottom: 2,
  },
  stepTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 6,
  },
  stepHint: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  error: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
  pendingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  pendingTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  pendingBody: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
