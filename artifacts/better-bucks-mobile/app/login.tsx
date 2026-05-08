import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function LoginScreen() {
  const {
    login,
    loginWithBiometrics,
    loginWithApple,
    loginWithGoogle,
    enrollBiometrics,
    biometricCapable,
    biometricEnrolled,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bioSubmitting, setBioSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [_googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (biometricEnrolled) {
      handleBiometricLogin();
    }
  }, [biometricEnrolled]);

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) {
        handleSocialResult(loginWithGoogle(idToken));
      } else {
        setSocialSubmitting(null);
        setError("Google did not return an ID token.");
      }
    } else if (googleResponse?.type === "error") {
      setSocialSubmitting(null);
      setError("Google sign-in failed. Please try again.");
    } else if (googleResponse?.type === "dismiss" || googleResponse?.type === "cancel") {
      setSocialSubmitting(null);
    }
  }, [googleResponse]);

  const handleSocialResult = async (promise: ReturnType<typeof loginWithGoogle>) => {
    const result = await promise;
    setSocialSubmitting(null);
    if (result.ok) {
      router.replace("/dashboard");
    } else if (result.message !== "Cancelled") {
      if ("providerEmail" in result && result.providerEmail) {
        setError(`${result.message} (${result.providerEmail})`);
      } else {
        setError(result.message);
      }
    }
  };

  const handleBiometricLogin = async () => {
    setBioSubmitting(true);
    setError(null);
    const result = await loginWithBiometrics();
    setBioSubmitting(false);
    if (result.ok) {
      router.replace("/dashboard");
    } else if (result.message !== "Cancelled") {
      setError(result.message);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialSubmitting("apple");
    setError(null);
    handleSocialResult(loginWithApple());
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured for this build.");
      return;
    }
    setSocialSubmitting("google");
    setError(null);
    await promptGoogleAsync();
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(username.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (biometricCapable && !biometricEnrolled) {
      Alert.alert(
        "Enable Face ID / Touch ID?",
        "Sign in faster next time using biometrics.",
        [
          { text: "Not now", style: "cancel", onPress: () => router.replace("/(tabs)" as any) },
          {
            text: "Enable",
            onPress: async () => {
              await enrollBiometrics();
              router.replace("/(tabs)" as any);
            },
          },
        ],
      );
    } else {
      router.replace("/(tabs)" as any);
    }
  };

  const appleAvailable = Platform.OS === "ios";

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Logo size={72} />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Log in to your Better Bucks account.
        </Text>
      </View>

      {biometricEnrolled ? (
        <View style={styles.biometricSection}>
          <Pressable
            onPress={handleBiometricLogin}
            style={styles.biometricButton}
            disabled={bioSubmitting}
            accessibilityLabel="Sign in with Face ID or Touch ID"
          >
            <Ionicons
              name="finger-print"
              size={36}
              color={bioSubmitting ? "rgba(255,255,255,0.3)" : brand.gold}
            />
            <Text style={styles.biometricText}>
              {bioSubmitting ? "Authenticating…" : "Sign in with Face ID / Touch ID"}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or use password</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>
      ) : null}

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={10}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      ) : null}

      <Pressable
        onPress={handleGoogleSignIn}
        style={[styles.googleButton, socialSubmitting === "google" && styles.socialButtonDisabled]}
        disabled={socialSubmitting !== null}
        accessibilityLabel="Sign in with Google"
      >
        <GoogleIcon />
        <Text style={styles.googleText}>
          {socialSubmitting === "google" ? "Signing in…" : "Sign in with Google"}
        </Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>or use email & password</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextField
        label="Email or username"
        placeholder="you@company.com"
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        value={username}
        onChangeText={setUsername}
      />

      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        testID="login-submit"
        title="Log In"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <View style={{ height: 8 }} />
      <Button
        title="Forgot Password?"
        variant="ghost"
        onPress={() => router.push("/forgot-password")}
      />

      <View style={{ height: 4 }} />
      <Button
        title="Create a new account"
        variant="ghost"
        onPress={() => router.push("/signup/account")}
      />
    </ScreenContainer>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={styles.googleIconText}>G</Text>
    </View>
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
  },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  biometricSection: {
    width: "100%",
    marginBottom: 12,
  },
  biometricButton: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  biometricText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  appleButton: {
    width: "100%",
    height: 48,
    marginBottom: 10,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    height: 48,
    width: "100%",
    marginBottom: 4,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  googleText: {
    color: "#1f1f1f",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    lineHeight: 14,
  },
});
