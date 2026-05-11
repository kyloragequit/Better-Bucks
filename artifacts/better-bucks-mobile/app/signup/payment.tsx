import { CardField, useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { HCaptchaModal, HCaptchaModalHandle } from "@/components/HCaptchaModal";
import { ScreenContainer } from "@/components/ScreenContainer";
import {
  apiUrl,
  HCAPTCHA_SITE_KEY,
  STRIPE_PUBLISHABLE_KEY,
} from "@/constants/api";
import { brand } from "@/constants/colors";
import { useSignup } from "@/contexts/SignupContext";

export default function SignupPaymentScreen() {
  const { draft } = useSignup();
  const { createPaymentMethod } = useStripe();
  const captchaRef = useRef<HCaptchaModalHandle>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeConfigured = !!STRIPE_PUBLISHABLE_KEY;
  const captchaEnabled = !!HCAPTCHA_SITE_KEY;

  const handleSubmit = () => {
    setError(null);
    if (!stripeConfigured) {
      setError(
        "Stripe is not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable signup.",
      );
      return;
    }
    if (!cardComplete) {
      setError("Enter your card details to continue.");
      return;
    }

    if (captchaEnabled) {
      captchaRef.current?.show();
    } else {
      runSignup("");
    }
  };

  const runSignup = async (hcaptchaToken: string) => {
    setSubmitting(true);
    try {
      const pm = await createPaymentMethod({
        paymentMethodType: "Card",
        paymentMethodData: {
          billingDetails: { email: draft.email, name: draft.fullName },
        },
      });
      if (pm.error || !pm.paymentMethod) {
        setError(pm.error?.message ?? "Could not validate your card.");
        setSubmitting(false);
        return;
      }

      const res = await fetch(apiUrl("/api/mobile/organizations/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: draft.organizationName,
          fullName: draft.fullName,
          email: draft.email,
          password: draft.password,
          tier: draft.tier,
          paymentMethodId: pm.paymentMethod.id,
          licenseAccepted: true,
          hcaptchaToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg: string = data?.message ?? "";
        if (msg.toLowerCase().includes("human verification failed")) {
          setError(
            "Verification failed. Please complete the challenge again to continue.",
          );
          setSubmitting(false);
          captchaRef.current?.show();
          return;
        }
        setError(msg || "Signup failed. Please try again.");
        setSubmitting(false);
        return;
      }

      router.replace("/signup/confirmation");
    } catch (err: any) {
      setError(err?.message ?? "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaptchaToken = (token: string) => {
    runSignup(token);
  };

  const handleCaptchaCancel = () => {
    setSubmitting(false);
  };

  const handleCaptchaError = (err: string) => {
    setError(`Verification failed: ${err}. Please try again.`);
    setSubmitting(false);
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Add a payment method</Text>
      <Text style={styles.sub}>
        Step 3 of 3 · No charge during your 60-day free trial
      </Text>

      <View style={{ height: 18 }} />

      <Text style={styles.label}>Card details</Text>
      <View style={styles.cardWrap}>
        <CardField
          postalCodeEnabled
          placeholders={{ number: "4242 4242 4242 4242" }}
          cardStyle={{
            backgroundColor: "rgba(255,255,255,0.06)",
            textColor: brand.white,
            placeholderColor: "rgba(255,255,255,0.45)",
            borderRadius: 10,
          }}
          style={styles.card}
          onCardChange={(d) => setCardComplete(d.complete)}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        testID="signup-payment-submit"
        title="Start free trial"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <Text style={styles.fine}>
        Your card won&apos;t be charged until your free trial ends. You can
        cancel anytime from your dashboard.
      </Text>

      {captchaEnabled ? (
        <HCaptchaModal
          ref={captchaRef}
          siteKey={HCAPTCHA_SITE_KEY}
          onToken={handleCaptchaToken}
          onCancel={handleCaptchaCancel}
          onError={handleCaptchaError}
        />
      ) : null}
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
  label: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 6,
  },
  cardWrap: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
  },
  card: { width: "100%", height: 50 },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    marginTop: 12,
  },
  fine: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
});
