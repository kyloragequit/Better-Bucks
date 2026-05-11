import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Employee = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: "admin" | "employee" | "prime_admin";
  balance: number;
  status: string;
  createdAt: string;
};

function roleLabel(role: string) {
  if (role === "prime_admin") return "Owner";
  if (role === "admin") return "Admin";
  return "Employee";
}

function roleBadgeColor(role: string) {
  if (role === "prime_admin") return brand.navy;
  if (role === "admin") return "#1565C0";
  return brand.green;
}

export default function TeamTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: employees = [], isLoading, refetch, isRefetching } = useQuery<Employee[]>({
    queryKey: ["mobile-admin-employees", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/employees"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load team");
      return res.json();
    },
    enabled: !!token,
  });

  const filtered = employees.filter(
    (e) =>
      e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.username?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const admins = filtered.filter((e) => e.role !== "employee");
  const staff = filtered.filter((e) => e.role === "employee");

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.offWhite }}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or username…"
            placeholderTextColor={brand.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={brand.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={search.length > 0 ? filtered : [...admins, ...staff]}
        keyExtractor={(e) => String(e.id)}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={brand.green}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        ListHeaderComponent={
          search.length === 0 && (admins.length > 0 || staff.length > 0) ? (
            <Text style={styles.countText}>
              {employees.length} team member{employees.length !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="people-outline" size={40} color={brand.textMuted} />
            <Text style={styles.emptyText}>No team members found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/admin/employee/${item.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.fullName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.fullName}</Text>
                <View style={[styles.badge, { backgroundColor: `${roleBadgeColor(item.role)}15` }]}>
                  <Text style={[styles.badgeText, { color: roleBadgeColor(item.role) }]}>
                    {roleLabel(item.role)}
                  </Text>
                </View>
              </View>
              <Text style={styles.username}>@{item.username}</Text>
              <Text style={styles.balance}>
                {(item.balance ?? 0).toLocaleString()} Bucks
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  searchWrap: { padding: 16, backgroundColor: brand.white, borderBottomWidth: 1, borderBottomColor: brand.border },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: brand.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: brand.text,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  countText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: brand.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(46,125,50,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: brand.green, fontFamily: "Inter_700Bold", fontSize: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  name: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  username: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  balance: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 },
});
