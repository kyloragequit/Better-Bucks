import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type MenuRowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  testID?: string;
};

function MenuRow({ icon, label, sublabel, onPress, destructive, chevron = true }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View
        style={[
          styles.menuIcon,
          destructive
            ? { backgroundColor: "rgba(198,40,40,0.08)" }
            : { backgroundColor: brand.offWhite },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? brand.danger : brand.navy}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.menuLabel,
            destructive ? { color: brand.danger } : null,
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.menuSublabel}>{sublabel}</Text>
        ) : null}
      </View>
      {chevron && onPress ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={brand.textMuted}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export default function ProfileTab() {
  const { user, token, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const isAdmin = user?.role === "admin" || user?.role === "prime_admin";

  const handleSignOut = async () => {
    Alert.alert("Sign out?", "You'll need to log in again to access your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
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

  const roleLabel = (role: string) => {
    switch (role) {
      case "prime_admin": return "Organization Owner";
      case "admin": return "Admin";
      case "employee": return "Employee";
      default: return role;
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Avatar / identity */}
      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.fullName?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.fullName ?? "—"}</Text>
        <Text style={styles.username}>@{user?.username ?? ""}</Text>
        {user?.email ? (
          <Text style={styles.email}>{user.email}</Text>
        ) : null}
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel(user?.role ?? "")}</Text>
        </View>
      </View>

      {/* Account info */}
      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.menuGroup}>
        <MenuRow
          icon="person-outline"
          label="Full name"
          sublabel={user?.fullName ?? "—"}
          chevron={false}
        />
        <MenuRow
          icon="at-outline"
          label="Username"
          sublabel={user?.username ?? "—"}
          chevron={false}
        />
        {user?.email ? (
          <MenuRow
            icon="mail-outline"
            label="Email"
            sublabel={user.email}
            chevron={false}
          />
        ) : null}
        {user?.organizationId ? (
          <MenuRow
            icon="business-outline"
            label="Organization ID"
            sublabel={String(user.organizationId)}
            chevron={false}
          />
        ) : null}
      </View>

      {/* Sign out */}
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
          sublabel={
            isAdmin
              ? "Cancels your subscription and removes all data"
              : "Permanently removes your account"
          }
          onPress={handleDeleteAccount}
          destructive
          testID="delete-account"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  identityCard: {
    alignItems: "center",
    backgroundColor: brand.white,
    borderRadius: 20,
    padding: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: brand.offWhite,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: brand.green,
    marginBottom: 8,
  },
  avatarText: {
    color: brand.navy,
    fontFamily: "Inter_700Bold",
    fontSize: 30,
  },
  name: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  username: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  email: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.20)",
  },
  roleText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
});
