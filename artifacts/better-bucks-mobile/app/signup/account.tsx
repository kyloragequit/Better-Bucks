import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { brand } from "@/constants/colors";
import { useSignup } from "@/contexts/SignupContext";

export default function SignupAccountScreen() {
  const { draft, update } = useSignup();
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    const next: Record<string, string> = {};
    if (draft.organizationName.trim().length < 2)
      next.organizationName = "Business name is required.";
    if (draft.fullName.trim().length < 2)
      next.fullName = "Full name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email))
      next.email = "Enter a valid work email.";
    if (draft.password.length < 6)
      next.password = "Password must be at least 6 characters.";
    if (draft.password !== confirm)
      next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length === 0) router.push("/signup/plan");
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Tell us about your business</Text>
      <Text style={styles.sub}>Step 1 of 3</Text>

      <View style={{ height: 16 }} />

      <TextField
        label="Business name"
        placeholder="Acme Coffee Co."
        autoCapitalize="words"
        value={draft.organizationName}
        onChangeText={(v) => update({ organizationName: v })}
        error={errors.organizationName}
      />
      <TextField
        label="Your full name"
        placeholder="Jane Doe"
        autoCapitalize="words"
        value={draft.fullName}
        onChangeText={(v) => update({ fullName: v })}
        error={errors.fullName}
      />
      <TextField
        label="Work email"
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        value={draft.email}
        onChangeText={(v) => update({ email: v })}
        error={errors.email}
      />
      <TextField
        label="Create password"
        placeholder="At least 6 characters"
        secureTextEntry
        textContentType="newPassword"
        value={draft.password}
        onChangeText={(v) => update({ password: v })}
        error={errors.password}
      />
      <TextField
        label="Confirm password"
        secureTextEntry
        textContentType="newPassword"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
      />

      <Button
        testID="signup-account-next"
        title="Continue"
        onPress={handleNext}
        style={{ marginTop: 8 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  sub: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
});
