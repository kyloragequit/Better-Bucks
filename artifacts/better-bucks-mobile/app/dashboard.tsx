import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Logo } from "@/components/Logo";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardScreen() {
  const { user, token, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
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
  signOut: {
    marginTop: 32,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  signOutText: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
