import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useStoreCatalog, type StoreItem } from "@/hooks/useStoreCatalog";

type Employee = {
  id: number;
  fullName: string;
  username: string;
  balance: number;
  role: string;
};

// ─── Employee: Store ──────────────────────────────────────────────────────────

type SortOrder = "none" | "asc" | "desc";

function formatCacheAge(cachedAt: number): string {
  const diffMs = Date.now() - cachedAt;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

function EmployeeStore() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { items, isLoading, isFetching, isFromCache, cachedAt, refetch } =
    useStoreCatalog(token, user?.id ?? null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const minVal = minPrice === "" ? null : Number(minPrice);
  const maxVal = maxPrice === "" ? null : Number(maxPrice);
  const priceFilterActive =
    (minVal !== null && !isNaN(minVal)) || (maxVal !== null && !isNaN(maxVal));

  const sortKey = `store_sort_order_${user?.id ?? "guest"}`;

  useEffect(() => {
    AsyncStorage.getItem(sortKey).then((saved) => {
      if (saved === "asc" || saved === "desc" || saved === "none") {
        setSortOrder(saved);
      }
    }).catch(() => {});
  }, [sortKey]);

  const filteredItems = (() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q),
        )
      : items;
    if (minVal !== null && !isNaN(minVal)) result = result.filter((item) => item.price >= minVal);
    if (maxVal !== null && !isNaN(maxVal)) result = result.filter((item) => item.price <= maxVal);
    if (sortOrder === "asc") result = [...result].sort((a, b) => a.price - b.price);
    else if (sortOrder === "desc") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  })();

  const clearPriceFilter = () => {
    setMinPrice("");
    setMaxPrice("");
  };

  const cycleSortOrder = () => {
    setSortOrder((prev) => {
      const next: SortOrder = prev === "none" ? "asc" : prev === "asc" ? "desc" : "none";
      AsyncStorage.setItem(sortKey, next).catch(() => {});
      return next;
    });
  };

  const sortLabel =
    sortOrder === "asc" ? "Price ↑" : sortOrder === "desc" ? "Price ↓" : "Sort";

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

  return (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor={brand.gold}
        />
      }
      ListHeaderComponent={
        <View>
          {isFromCache && cachedAt !== null && (
            <View style={storeSearchStyles.cacheBanner}>
              <Ionicons
                name="time-outline"
                size={13}
                color="rgba(255,255,255,0.45)"
              />
              <Text style={storeSearchStyles.cacheBannerText}>
                Last updated {formatCacheAge(cachedAt)}
                {isFetching ? " · Refreshing…" : ""}
              </Text>
            </View>
          )}
          <View style={storeSearchStyles.headerRow}>
            <View style={storeSearchStyles.searchBar}>
              <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={storeSearchStyles.searchInput}
                placeholder="Search items…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[
                storeSearchStyles.sortBtn,
                sortOrder !== "none" && storeSearchStyles.sortBtnActive,
              ]}
              onPress={cycleSortOrder}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={15}
                color={sortOrder !== "none" ? brand.navy : brand.gold}
              />
              <Text
                style={[
                  storeSearchStyles.sortBtnText,
                  sortOrder !== "none" && storeSearchStyles.sortBtnTextActive,
                ]}
              >
                {sortLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                storeSearchStyles.sortBtn,
                (filterOpen || priceFilterActive) && storeSearchStyles.sortBtnActive,
              ]}
              onPress={() => setFilterOpen((v) => !v)}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={(filterOpen || priceFilterActive) ? brand.navy : brand.gold}
              />
              <Text
                style={[
                  storeSearchStyles.sortBtnText,
                  (filterOpen || priceFilterActive) && storeSearchStyles.sortBtnTextActive,
                ]}
              >
                Filter{priceFilterActive ? " ●" : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {filterOpen && (
            <View style={storeSearchStyles.filterPanel}>
              {minVal !== null && maxVal !== null && !isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal && (
                <Text style={storeSearchStyles.filterWarn}>
                  Min must be less than or equal to max
                </Text>
              )}
              <View style={storeSearchStyles.filterRow}>
                <View style={storeSearchStyles.filterInputWrap}>
                  <Text style={storeSearchStyles.filterLabel}>Min Bucks</Text>
                  <TextInput
                    style={storeSearchStyles.filterInput}
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={minPrice}
                    onChangeText={(v) => setMinPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                <Text style={storeSearchStyles.filterDash}>–</Text>
                <View style={storeSearchStyles.filterInputWrap}>
                  <Text style={storeSearchStyles.filterLabel}>Max Bucks</Text>
                  <TextInput
                    style={storeSearchStyles.filterInput}
                    placeholder="Any"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={maxPrice}
                    onChangeText={(v) => setMaxPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                {priceFilterActive && (
                  <TouchableOpacity
                    style={storeSearchStyles.clearBtn}
                    onPress={clearPriceFilter}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          {items.length === 0 ? (
            <>
              <Ionicons name="storefront-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No items in the store yet</Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No items match your search</Text>
            </>
          )}
        </View>
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

// ─── Employee Store Search Styles ─────────────────────────────────────────────

const storeSearchStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  searchInput: {
    flex: 1,
    color: brand.white,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sortBtnActive: {
    backgroundColor: brand.gold,
    borderColor: brand.gold,
  },
  sortBtnText: {
    color: brand.gold,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  sortBtnTextActive: {
    color: brand.navy,
  },
  filterPanel: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  filterInputWrap: {
    flex: 1,
    gap: 4,
  },
  filterLabel: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterInput: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    color: brand.white,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterDash: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    paddingBottom: 8,
  },
  clearBtn: {
    paddingBottom: 8,
  },
  filterWarn: {
    color: "#f87171",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginBottom: 8,
  },
  cacheBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  cacheBannerText: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
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
