import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

type StoreItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  requiresSize: boolean;
  requiresColor: boolean;
  sizes: string[] | null;
  colors: string[] | null;
};

type Employee = {
  id: number;
  fullName: string;
  username: string;
  balance: number;
  role: string;
};

// ─── Employee: Store ──────────────────────────────────────────────────────────

function EmployeeStore() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch, isRefetching } = useQuery<StoreItem[]>({
    queryKey: ["mobile-store", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/store-items"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load store");
      return res.json();
    },
    enabled: !!token,
  });

  const [purchasing, setPurchasing] = useState<number | null>(null);

  const handlePurchase = useCallback(
    async (item: StoreItem) => {
      Alert.alert(
        `Buy "${item.name}"?`,
        `This will cost ${item.price.toLocaleString()} Bucks.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Buy",
            onPress: async () => {
              setPurchasing(item.id);
              try {
                const res = await fetch(
                  apiUrl(`/api/mobile/store-items/${item.id}/purchase`),
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token ?? ""}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ quantity: 1 }),
                  },
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  Alert.alert("Purchase failed", data?.message ?? "Try again.");
                  return;
                }
                queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
                Alert.alert("Purchased!", `Your order has been placed.`);
              } catch (e: any) {
                Alert.alert("Error", e?.message ?? "Network error.");
              } finally {
                setPurchasing(null);
              }
            },
          },
        ],
      );
    },
    [token, queryClient],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.gold} size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="storefront-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.emptyText}>No items in the store yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={brand.gold}
        />
      }
      renderItem={({ item }) => (
        <View style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.itemIconBox}>
              <Ionicons name="gift-outline" size={28} color={brand.gold} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>
              {item.price.toLocaleString()} Bucks
            </Text>
            <TouchableOpacity
              style={[
                styles.buyBtn,
                purchasing === item.id ? { opacity: 0.6 } : null,
              ]}
              onPress={() => handlePurchase(item)}
              disabled={purchasing === item.id}
            >
              {purchasing === item.id ? (
                <ActivityIndicator size="small" color={brand.navy} />
              ) : (
                <Text style={styles.buyBtnText}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

// ─── Admin: Reward Employee ───────────────────────────────────────────────────

function AdminReward() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["mobile-employees", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/employees"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
    enabled: !!token,
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = employees.filter(
    (e) =>
      e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.username?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleReward = async () => {
    if (!selected) return;
    const amt = parseInt(amount);
    if (!amt || amt < 1) {
      Alert.alert("Invalid amount", "Enter a positive number of Bucks.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Required", "Please enter a reason for the reward.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/mobile/employees/${selected.id}/reward`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount: amt, reason: reason.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Failed", data?.message ?? "Try again.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mobile-employees"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
      Alert.alert(
        "Reward sent!",
        `${selected.fullName} received ${amt.toLocaleString()} Bucks.`,
      );
      setSelected(null);
      setAmount("");
      setReason("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.gold} size="large" />
      </View>
    );
  }

  if (selected) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <TouchableOpacity
          style={rewardStyles.backRow}
          onPress={() => setSelected(null)}
        >
          <Ionicons name="arrow-back" size={18} color={brand.gold} />
          <Text style={rewardStyles.backText}>Back to employee list</Text>
        </TouchableOpacity>

        <View style={rewardStyles.selectedCard}>
          <View style={rewardStyles.avatarCircle}>
            <Text style={rewardStyles.avatarText}>
              {selected.fullName?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View>
            <Text style={rewardStyles.selectedName}>{selected.fullName}</Text>
            <Text style={rewardStyles.selectedBalance}>
              Balance: {(selected.balance ?? 0).toLocaleString()} Bucks
            </Text>
          </View>
        </View>

        <TextField
          label="Amount (Bucks)"
          placeholder="e.g. 100"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextField
          label="Reason"
          placeholder="Great work on the project!"
          value={reason}
          onChangeText={setReason}
          multiline
        />

        <Button
          title={`Send ${amount ? Number(amount).toLocaleString() : "0"} Bucks`}
          onPress={handleReward}
          loading={submitting}
          variant="secondary"
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { flex: 1 }]}>
      <View style={[rewardStyles.searchBar, { marginHorizontal: 20, marginTop: 16 }]}>
        <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={rewardStyles.searchInput}
          placeholder="Search employees…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No employees found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={[
            { paddingHorizontal: 20, paddingTop: 12 },
            { paddingBottom: insets.bottom + 32 },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={rewardStyles.employeeRow}
              onPress={() => setSelected(item)}
            >
              <View style={rewardStyles.avatarSmall}>
                <Text style={rewardStyles.avatarSmallText}>
                  {item.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rewardStyles.employeeName}>{item.fullName}</Text>
                <Text style={rewardStyles.employeeBalance}>
                  {(item.balance ?? 0).toLocaleString()} Bucks
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const rewardStyles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    color: brand.gold,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: brand.navyLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: brand.gold,
  },
  avatarText: {
    color: brand.gold,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  selectedName: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  selectedBalance: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    color: brand.white,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brand.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    color: brand.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  employeeName: {
    color: brand.white,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  employeeBalance: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});

// ─── Export ───────────────────────────────────────────────────────────────────

export default function StoreTab() {
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "prime_admin";
  return admin ? <AdminReward /> : <EmployeeStore />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.navy },
  center: {
    flex: 1,
    backgroundColor: brand.navy,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  itemCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 14,
  },
  itemHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  itemIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(245,200,66,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  itemDesc: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemPrice: {
    color: brand.gold,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  buyBtn: {
    backgroundColor: brand.green,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
});
