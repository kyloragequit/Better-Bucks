import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { brand } from "@/constants/colors";
import { STRIPE_PUBLISHABLE_KEY } from "@/constants/api";
import { AuthProvider } from "@/contexts/AuthContext";
import { SignupProvider } from "@/contexts/SignupContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: brand.navy },
        headerTintColor: brand.white,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        contentStyle: { backgroundColor: brand.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Log In" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
      <Stack.Screen name="change-password" options={{ title: "Change Password" }} />
      <Stack.Screen name="social-signup" options={{ title: "Finish Sign-Up" }} />
      <Stack.Screen name="pending-approval" options={{ title: "Account Pending", gestureEnabled: false }} />
      <Stack.Screen name="signup/account" options={{ title: "Create Account" }} />
      <Stack.Screen name="signup/plan" options={{ title: "Choose Plan" }} />
      <Stack.Screen name="signup/payment" options={{ title: "Payment" }} />
      <Stack.Screen
        name="signup/confirmation"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="dashboard"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="transaction/[id]"
        options={{ title: "Transaction Details" }}
      />
      <Stack.Screen
        name="transaction/history"
        options={{ title: "Transaction History" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <StripeProvider
                publishableKey={STRIPE_PUBLISHABLE_KEY}
                merchantIdentifier="merchant.net.betterbucks.app"
              >
                <AuthProvider>
                  <SignupProvider>
                    <StatusBar style="dark" />
                    <RootLayoutNav />
                  </SignupProvider>
                </AuthProvider>
              </StripeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
