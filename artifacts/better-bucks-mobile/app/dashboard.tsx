import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { OnboardingModal } from "@/components/OnboardingModal";
import { Logo } from "@/components/Logo";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function DashboardScreen() {
  const { user, token, signOut, biometricEnrolled, enrollBiometrics, disableBiometrics } =
    useAuth();
  const { visible: onboardingVisible, dismiss: dismissOnboarding } = useOnboarding();
  const [walletLoading, setWalletLoading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleAddToWallet = async () => {
    if (!token) return;
    setWalletLoading(true);
    try {
      const res = await fetch(apiUrl("/api/wallet/pass.pkpass"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert(
          "Couldn't get pass",
          data?.message ??
            "Apple Wallet isn't configured yet. Ask your administrator to set it up.",
        );
        return;
      }

      const blob = await res.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const path = `${FileSystem.cacheDirectory}betterbucks.pkpass`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          "Sharing not available",
          "Open this app on an iPhone to add your pass to Apple Wallet.",
        );
        return;
      }

      await Sharing.shareAsync(path, {
        mimeType: "application/vnd.apple.pkpass",
        UTI: "com.apple.pkpass",
        dialogTitle: "Add to Apple Wallet",
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not download pass.");
    } finally {
      setWalletLoading(false);
    }
  };

  const handleToggleBiometrics = async () => {
    if (biometricEnrolled) {
      Alert.alert(
        "Disable biometric login?",
        "You'll need to use your password to sign in next time.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await disableBiometrics();
              Alert.alert("Done", "Biometric login disabled.");
            },
          },
        ],
      );
    } else {
      const enrolled = await enrollBiometrics();
      if (enrolled) {
        Alert.alert("Enabled", "Biometric login is now active for this device.");
      } else {
        Alert.alert(
          "Not available",
          "Face ID / Touch ID is not configured on this device.",
        );
      }
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your Better Bucks account. If you're the organization owner, your subscription will also be canceled. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(apiUrl("/api/mobile/account/delete"), {
                method: "POST",
                headers: { Authorization: `Bearer ${token ?? ""}` },
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert(
                  "Couldn't delete account",
                  data?.message ?? "Please try again later.",
                );
                return;
              }
              await signOut();
              router.replace("/");
            } catch (err: any) {
              Alert.alert(
                "Couldn't delete account",
                err?.message ?? "Network error.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <OnboardingModal
        visible={onboardingVisible}
        onDismiss={dismissOnboarding}
      />
      <Logo size={88} />
      <Text style={styles.welcome}>Welcome to Better Bucks.</Text>
      {user?.fullName ? (
        <Text style={styles.subtle}>Signed in as {user.fullName}</Text>
      ) : null}

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Your dashboard</Text>
        <Text style={styles.placeholderBody}>
          Your full Better Bucks experience is coming soon to mobile.
        </Text>
      </View>

      <Pressable
        onPress={handleAddToWallet}
        style={[styles.walletButton, walletLoading && styles.walletButtonDisabled]}
        disabled={walletLoading}
        accessibilityLabel="Add to Apple Wallet"
      >
        <Ionicons name="wallet" size={20} color="#ffffff" />
        <Text style={styles.walletText}>
          {walletLoading ? "Loading pass…" : "Add to Apple Wallet"}
        </Text>
      </Pressable>

      <Pressable onPress={handleToggleBiometrics} style={styles.secondaryAction}>
        <Text style={styles.secondaryText}>
          {biometricEnrolled
            ? "Disable Face ID / Touch ID"
            : "Enable Face ID / Touch ID"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/change-password")}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Change password</Text>
      </Pressable>

      <Pressable onPress={handleSignOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Pressable
        onPress={handleDeleteAccount}
        style={styles.signOut}
        testID="delete-account"
      >
        <Text style={[styles.signOutText, { color: "#FCA5A5" }]}>
          Delete account
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  welcome: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    textAlign: "center",
    marginTop: 8,
  },
  subtle: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  placeholder: {
    marginTop: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    width: "100%",
  },
  placeholderTitle: {
    color: brand.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginBottom: 4,
  },
  placeholderBody: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  walletButton: {
    marginTop: 20,
    backgroundColor: "#000000",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },
  walletButtonDisabled: {
    opacity: 0.6,
  },
  walletText: {
    color: "#ffffff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  secondaryAction: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  signOut: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  signOutText: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
