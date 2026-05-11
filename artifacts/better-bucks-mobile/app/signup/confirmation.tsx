import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useSignup } from "@/contexts/SignupContext";

export default function SignupConfirmationScreen() {
  const { reset } = useSignup();
  const { signOut } = useAuth();
  const params = useLocalSearchParams<{ contact?: string }>();
  const isContactPending = params.contact === "1";

  const handleContinue = async () => {
    reset();
    if (isContactPending) {
      router.replace("/");
      return;
    }
    await signOut();
    router.replace("/login");
  };

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Logo size={96} />
        <View style={styles.iconRow}>
          <Ionicons
            name={isContactPending ? "mail" : "checkmark-circle"}
            size={48}
            color={brand.green}
          />
        </View>
        <Text style={styles.title}>
          {isContactPending ? "We'll be in touch" : "Account created!"}
        </Text>
        <Text style={styles.body}>
          {isContactPending
            ? "Thanks for your interest in Better Bucks Enterprise. Our team will reach out shortly with a custom quote."
            : "Your 60-day free trial has started. Log in to set up your team and start rewarding employees."}
        </Text>

        <View style={{ height: 24 }} />
        <Button
          testID="confirmation-continue"
          title={isContactPending ? "Back to home" : "Log in"}
          onPress={handleContinue}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 12,
  },
  iconRow: {
    marginTop: 8,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
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
