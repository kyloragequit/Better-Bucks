import { StripeProvider } from "@stripe/stripe-react-native";
import React from "react";
import { STRIPE_PUBLISHABLE_KEY } from "@/constants/api";

export function StripeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.net.betterbucks.app"
    >
      <>{children}</>
    </StripeProvider>
  );
}
