import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type PendingUser = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
};

export default function PendingAccountsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading, refetch, isRefetching } = useQuery<PendingUser[]>({
    queryKey: ["mobile-admin-pending", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/pending"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load pending accounts");
      return res.json();
    },
    enabled: !!token,
  });

  const handleApprove = (user: PendingUser) => {
    Alert.alert(
      "Approve account?",
      `Allow ${user.fullName} to join your organization?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/pending/${user.id}/approve`), {
              method: "POST",
              headers: { Authorization: `Bearer ${token ?? ""}` },
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-pending"] });
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
              refetch();
            } else {
              const d = await res.json().catch(() => ({}));
              Alert.alert("Failed", d?.message ?? "Try again.");
            }
          },
        },
      ],
    );
  };

  const handleReject = (user: PendingUser) => {
    Alert.alert(
      "Reject & delete?",
      `Remove ${user.fullName}'s pending account? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/pending/${user.id}`), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token ?? ""}` },
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-pending"] });
              refetch();
            } else {
              const d = await res.json().catch(() => ({}));
              Alert.alert("Failed", d?.message ?? "Try again.");
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={pending}
      keyExtractor={(u) => String(u.id)}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={brand.green} />
      }
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: insets.bottom + 32 },
        pending.length === 0 && styles.center,
      ]}
      ListEmptyComponent={
        <View style={{ alignItems: "center", gap: 12 }}>
          <Ionicons name="checkmark-circle-outline" size={48} color={brand.green} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending account requests.</Text>
        </View>
      }
      ListHeaderComponent={
        pending.length > 0 ? (
          <Text style={styles.countText}>
            {pending.length} pending request{pending.length !== 1 ? "s" : ""}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.fullName?.charAt(0)?.toUpperCase() ?? "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={styles.username}>@{item.username}</Text>
            {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
            <Text style={styles.date}>
              Requested {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
              <Ionicons name="checkmark" size={18} color={brand.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
              <Ionicons name="close" size={18} color={brand.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 10 },
  countText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: brand.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(249,168,37,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#F9A825", fontFamily: "Inter_700Bold", fontSize: 18 },
  name: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  username: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  email: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  date: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 },
  actions: { flexDirection: "column", gap: 8 },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: brand.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  emptySubtitle: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
});
