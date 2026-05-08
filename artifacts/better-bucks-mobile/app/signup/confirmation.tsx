import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useSignup } from "@/contexts/SignupContext";

export default function SignupConfirmationScreen() {
  const { reset } = useSignup();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ contact?: string }>();
  const isContactPending = params.contact === "1";

  const handleContinue = () => {
    reset();
    if (isContactPending) {
      router.replace("/");
    } else if (token) {
      // Signup already signed the user in — drop them straight on the dashboard.
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Logo size={96} />
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
          title={
            isContactPending
              ? "Back to home"
              : token
                ? "Go to dashboard"
                : "Log in"
          }
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
  title: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    marginTop: 8,
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
