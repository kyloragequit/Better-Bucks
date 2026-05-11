import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingModal } from "@/components/OnboardingModal";
import { Logo } from "@/components/Logo";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth, type SocialLink } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type MenuRowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
  testID?: string;
};

function MenuRow({ icon, label, sublabel, onPress, destructive, right, testID }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      <View
        style={[
          styles.menuIcon,
          destructive ? { backgroundColor: "rgba(198,40,40,0.08)" } : { backgroundColor: brand.offWhite },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? brand.danger : brand.navy}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, destructive ? { color: brand.danger } : null]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={brand.textMuted} /> : null)}
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const {
    user,
    token,
    signOut,
    biometricEnrolled,
    enrollBiometrics,
    disableBiometrics,
    linkSocialProvider,
    unlinkSocialProvider,
    fetchSocialLinks,
  } = useAuth();
  const { visible: onboardingVisible, dismiss: dismissOnboarding } = useOnboarding();
  const insets = useSafeAreaInsets();
  const [walletLoading, setWalletLoading] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [linkingProvider, setLinkingProvider] = useState<"apple" | "google" | null>(null);

  const [_googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  });

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) {
        handleLinkResult("google", idToken);
      } else {
        setLinkingProvider(null);
        Alert.alert("Error", "Google did not return an ID token.");
      }
    } else if (googleResponse?.type === "error") {
      setLinkingProvider(null);
      Alert.alert("Error", "Google sign-in failed. Please try again.");
    } else if (googleResponse?.type === "dismiss" || googleResponse?.type === "cancel") {
      setLinkingProvider(null);
    }
  }, [googleResponse]);

  const handleLinkResult = async (provider: "google" | "apple", identityToken: string) => {
    const result = await linkSocialProvider(provider, identityToken);
    setLinkingProvider(null);
    if (result.ok) {
      setSocialLinks(result.links);
      Alert.alert(
        "Linked",
        `Your ${provider === "apple" ? "Apple" : "Google"} account has been linked.`,
      );
    } else {
      Alert.alert("Could not link account", result.message);
    }
  };

  const handleLinkApple = async () => {
    try {
      setLinkingProvider("apple");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setLinkingProvider(null);
        Alert.alert("Error", "Apple did not return an identity token.");
        return;
      }
      await handleLinkResult("apple", credential.identityToken);
    } catch (err: any) {
      setLinkingProvider(null);
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", err?.message ?? "Apple sign-in failed.");
      }
    }
  };

  const handleLinkGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert("Not configured", "Google sign-in is not configured for this build.");
      return;
    }
    setLinkingProvider("google");
    await promptGoogleAsync();
  };

  const handleUnlinkProvider = (provider: "google" | "apple") => {
    Alert.alert(
      `Unlink ${provider === "apple" ? "Apple" : "Google"}?`,
      `Your ${provider === "apple" ? "Apple ID" : "Google"} account will no longer be used to sign in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            const result = await unlinkSocialProvider(provider);
            if (result.ok) {
              setSocialLinks(result.links);
            } else {
              Alert.alert("Error", result.message);
            }
          },
        },
      ],
    );
  };

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
              Alert.alert("Couldn't delete account", err?.message ?? "Network error.");
            }
          },
        },
      ],
    );
  };

  const appleAvailable = Platform.OS === "ios";
  const appleLinked = socialLinks.some((l) => l.provider === "apple");
  const googleLinked = socialLinks.some((l) => l.provider === "google");

  return (
    <>
      <OnboardingModal visible={onboardingVisible} onDismiss={dismissOnboarding} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Identity */}
        <View style={styles.identityCard}>
          <Logo size={64} />
          <Text style={styles.welcome}>Welcome to Better Bucks.</Text>
          {user?.fullName ? (
            <Text style={styles.subtle}>Signed in as {user.fullName}</Text>
          ) : null}
        </View>

        {/* Apple Wallet */}
        <Text style={styles.sectionHeader}>Wallet Pass</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="wallet-outline"
            label={walletLoading ? "Downloading…" : "Add to Apple Wallet"}
            onPress={walletLoading ? undefined : handleAddToWallet}
          />
        </View>

        {/* Social sign-in */}
        <Text style={styles.sectionHeader}>Linked Sign-In Accounts</Text>
        <View style={styles.menuGroup}>
          {appleAvailable ? (
            appleLinked ? (
              <MenuRow
                icon="logo-apple"
                label="Apple ID linked"
                right={
                  <Pressable onPress={() => handleUnlinkProvider("apple")} hitSlop={8}>
                    <Text style={styles.unlinkText}>Remove</Text>
                  </Pressable>
                }
              />
            ) : (
              <MenuRow
                icon="logo-apple"
                label={linkingProvider === "apple" ? "Linking…" : "Link Apple ID"}
                onPress={linkingProvider === null ? handleLinkApple : undefined}
              />
            )
          ) : null}

          {googleLinked ? (
            <MenuRow
              icon="logo-google"
              label="Google account linked"
              right={
                <Pressable onPress={() => handleUnlinkProvider("google")} hitSlop={8}>
                  <Text style={styles.unlinkText}>Remove</Text>
                </Pressable>
              }
            />
          ) : (
            <MenuRow
              icon="logo-google"
              label={linkingProvider === "google" ? "Linking…" : "Link Google account"}
              onPress={linkingProvider === null ? handleLinkGoogle : undefined}
            />
          )}
        </View>

        {/* Security */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="finger-print"
            label={biometricEnrolled ? "Disable Face ID / Touch ID" : "Enable Face ID / Touch ID"}
            onPress={handleToggleBiometrics}
          />
          <MenuRow
            icon="lock-closed-outline"
            label="Change password"
            onPress={() => router.push("/change-password")}
          />
        </View>

        {/* Session */}
        <Text style={styles.sectionHeader}>Session</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="log-out-outline"
            label="Sign out"
            onPress={handleSignOut}
          />
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionHeader}>Danger zone</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="trash-outline"
            label="Delete account"
            sublabel="Permanently removes your account and subscription"
            onPress={handleDeleteAccount}
            destructive
            testID="delete-account"
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
  },
  content: {
    paddingHorizontal: 20,
    gap: 0,
  },
  identityCard: {
    alignItems: "center",
    backgroundColor: brand.white,
    borderRadius: 20,
    padding: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 6,
  },
  welcome: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 8,
  },
  subtle: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  sectionHeader: {
    color: brand.textMuted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  menuGroup: {
    backgroundColor: brand.white,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  menuSublabel: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  unlinkText: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
