import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
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
import Constants from "expo-constants";
import { Platform } from "react-native";

// react-native-nfc-manager is a native-only module — require it lazily so the
// web bundle doesn't crash trying to load it. All call-sites are already
// guarded by the `isExpoGo` / `!supported` checks below.
const _nfc = Platform.OS !== "web"
  ? (() => { try { return require("react-native-nfc-manager"); } catch { return null; } })()
  : null;
const NfcManager: typeof import("react-native-nfc-manager").default = _nfc?.default ?? ({} as any);
const Ndef: typeof import("react-native-nfc-manager").Ndef = _nfc?.Ndef ?? ({} as any);
const NfcTech: typeof import("react-native-nfc-manager").NfcTech = _nfc?.NfcTech ?? ({} as any);
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

// ─── Employee: Store ──────────────────────────────────────────────────────────

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

  const [pendingItem, setPendingItem] = useState<StoreItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const minVal = minPrice === "" ? null : Number(minPrice);
  const maxVal = maxPrice === "" ? null : Number(maxPrice);
  const priceFilterActive =
    (minVal !== null && !isNaN(minVal)) || (maxVal !== null && !isNaN(maxVal));

  const sortKey = `store_sort_order_${user?.id ?? "guest"}`;

  useEffect(() => {
    AsyncStorage.getItem(sortKey)
      .then((saved) => {
        if (saved === "asc" || saved === "desc" || saved === "none") {
          setSortOrder(saved);
        }
      })
      .catch(() => {});
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

  const [scanningNfc, setScanningNfc] = useState(false);
  const isExpoGo = Constants.appOwnership === "expo";

  const handleNfcScan = useCallback(async () => {
    if (scanningNfc) return;
    if (isExpoGo) {
      Alert.alert(
        "Native build required",
        "NFC tap-to-order uses hardware features that are not available in Expo Go.\n\nTo use this feature, install the Better Bucks development build on your device.",
        [{ text: "OK" }],
      );
      return;
    }
    let supported = false;
    try {
      supported = await NfcManager.isSupported();
    } catch {}
    if (!supported) {
      Alert.alert("NFC not available", "Your device does not support NFC.");
      return;
    }
    setScanningNfc(true);
    Alert.alert("Tap NFC", "Hold your phone near your manager's device.", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => {
          try { void NfcManager.cancelTechnologyRequest().catch(() => {}); } catch {}
          setScanningNfc(false);
        },
      },
    ]);
    try {
      await NfcManager.start().catch(() => {});
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const record = tag?.ndefMessage?.[0];
      if (!record) throw new Error("No NFC data found");
      const rawPayload = new Uint8Array(record.payload as number[]);
      const nfcToken = Ndef.text.decodePayload(rawPayload);
      if (!nfcToken) throw new Error("Unreadable NFC tag");
      const res = await fetch(apiUrl("/api/mobile/shop/nfc-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ token: nfcToken }),
      });
      const data = await res.json().catch(() => ({})) as { message?: string; item?: string; cost?: number; newBalance?: number };
      if (!res.ok) {
        Alert.alert("Order failed", data.message ?? "Try again.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
      Alert.alert(
        "Order placed!",
        `${data.item ?? "Item"} ordered for ${(data.cost ?? 0).toLocaleString()} Bucks.\nNew balance: ${(data.newBalance ?? 0).toLocaleString()} Bucks.`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "NFC scan failed";
      if (!msg.toLowerCase().includes("cancel")) {
        Alert.alert("Scan failed", msg);
      }
    } finally {
      try { void NfcManager.cancelTechnologyRequest().catch(() => {}); } catch {}
      setScanningNfc(false);
    }
  }, [scanningNfc, token, queryClient]);

  const executePurchase = useCallback(
    async (item: StoreItem, size: string | null, color: string | null) => {
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
            body: JSON.stringify({
              quantity: 1,
              ...(size ? { selectedSize: size } : {}),
              ...(color ? { selectedColor: color } : {}),
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          Alert.alert("Purchase failed", data?.message ?? "Try again.");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
        Alert.alert("Purchased!", "Your order has been placed.");
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Network error.");
      } finally {
        setPurchasing(null);
      }
    },
    [token, queryClient],
  );

  const handlePurchase = useCallback(
    (item: StoreItem) => {
      const needsAttrs =
        (item.requiresSize && (item.sizes ?? []).length > 0) ||
        (item.requiresColor && (item.colors ?? []).length > 0);
      if (needsAttrs) {
        setSelectedSize(null);
        setSelectedColor(null);
        setPendingItem(item);
        return;
      }
      Alert.alert(
        `Buy "${item.name}"?`,
        `This will cost ${item.price.toLocaleString()} Bucks.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Buy", onPress: () => executePurchase(item, null, null) },
        ],
      );
    },
    [executePurchase],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: brand.white }}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor={brand.green}
        />
      }
      ListHeaderComponent={
        <View>
          {isFromCache && cachedAt !== null && (
            <View style={searchStyles.cacheBanner}>
              <Ionicons name="time-outline" size={13} color={brand.textMuted} />
              <Text style={searchStyles.cacheBannerText}>
                Last updated {formatCacheAge(cachedAt)}
                {isFetching ? " · Refreshing…" : ""}
              </Text>
            </View>
          )}

          <View style={searchStyles.headerRow}>
            <View style={searchStyles.searchBar}>
              <Ionicons name="search-outline" size={18} color={brand.textMuted} />
              <TextInput
                style={searchStyles.searchInput}
                placeholder="Search items…"
                placeholderTextColor={brand.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={brand.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                searchStyles.filterBtn,
                sortOrder !== "none" && searchStyles.filterBtnActive,
              ]}
              onPress={cycleSortOrder}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={15}
                color={sortOrder !== "none" ? brand.white : brand.green}
              />
              <Text
                style={[
                  searchStyles.filterBtnText,
                  sortOrder !== "none" && searchStyles.filterBtnTextActive,
                ]}
              >
                {sortLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                searchStyles.filterBtn,
                (filterOpen || priceFilterActive) && searchStyles.filterBtnActive,
              ]}
              onPress={() => setFilterOpen((v) => !v)}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={(filterOpen || priceFilterActive) ? brand.white : brand.green}
              />
              <Text
                style={[
                  searchStyles.filterBtnText,
                  (filterOpen || priceFilterActive) && searchStyles.filterBtnTextActive,
                ]}
              >
                Filter{priceFilterActive ? " ●" : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {filterOpen && (
            <View style={searchStyles.filterPanel}>
              {minVal !== null &&
                maxVal !== null &&
                !isNaN(minVal) &&
                !isNaN(maxVal) &&
                minVal > maxVal && (
                  <Text style={searchStyles.filterWarn}>
                    Min must be less than or equal to max
                  </Text>
                )}
              <View style={searchStyles.filterRow}>
                <View style={searchStyles.filterInputWrap}>
                  <Text style={searchStyles.filterLabel}>Min Bucks</Text>
                  <TextInput
                    style={searchStyles.filterInput}
                    placeholder="0"
                    placeholderTextColor={brand.textMuted}
                    value={minPrice}
                    onChangeText={(v) => setMinPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                <Text style={searchStyles.filterDash}>–</Text>
                <View style={searchStyles.filterInputWrap}>
                  <Text style={searchStyles.filterLabel}>Max Bucks</Text>
                  <TextInput
                    style={searchStyles.filterInput}
                    placeholder="Any"
                    placeholderTextColor={brand.textMuted}
                    value={maxPrice}
                    onChangeText={(v) => setMaxPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                {priceFilterActive && (
                  <TouchableOpacity
                    style={searchStyles.clearBtn}
                    onPress={clearPriceFilter}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={brand.textMuted} />
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
              <Ionicons name="storefront-outline" size={48} color={brand.textMuted} />
              <Text style={styles.emptyText}>No items in the store yet</Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={48} color={brand.textMuted} />
              <Text style={styles.emptyText}>No items match your search</Text>
            </>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const hasAttrs =
          (item.requiresSize && (item.sizes ?? []).length > 0) ||
          (item.requiresColor && (item.colors ?? []).length > 0);
        return (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemIconBox}>
                <Ionicons name="gift-outline" size={26} color={brand.green} />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {hasAttrs && (
                  <View style={attrStyles.badgeRow}>
                    {item.requiresSize &&
                      (item.sizes ?? []).slice(0, 5).map((s) => (
                        <View key={s} style={attrStyles.badge}>
                          <Text style={attrStyles.badgeText}>{s}</Text>
                        </View>
                      ))}
                    {item.requiresColor &&
                      (item.colors ?? []).slice(0, 5).map((c) => (
                        <View key={c} style={attrStyles.badge}>
                          <Text style={attrStyles.badgeText}>{c}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.itemFooter}>
              <Text style={styles.itemPrice}>
                {item.price.toLocaleString()} Bucks
              </Text>
              <TouchableOpacity
                style={[
                  styles.buyBtn,
                  hasAttrs ? attrStyles.selectBtn : null,
                  purchasing === item.id ? { opacity: 0.6 } : null,
                ]}
                onPress={() => handlePurchase(item)}
                disabled={purchasing === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Redeem ${item.name} for ${item.price} Bucks`}
              >
                {purchasing === item.id ? (
                  <ActivityIndicator size="small" color={brand.white} />
                ) : (
                  <Text style={styles.buyBtnText}>
                    {hasAttrs ? "Select & Buy" : "Redeem"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
    <TouchableOpacity
      style={[styles.nfcFab, { bottom: insets.bottom + 24 }]}
      onPress={() => void handleNfcScan()}
      disabled={scanningNfc}
      accessibilityLabel="Scan NFC to order"
    >
      {scanningNfc ? (
        <ActivityIndicator color={brand.white} size="small" />
      ) : (
        <>
          <Ionicons name="radio-outline" size={18} color={brand.white} />
          <Text style={styles.nfcFabText}>Scan NFC</Text>
        </>
      )}
    </TouchableOpacity>

    {/* ── Attribute selection sheet ── */}
    <Modal
      visible={pendingItem !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setPendingItem(null)}
    >
      <Pressable style={attrStyles.overlay} onPress={() => setPendingItem(null)}>
        <Pressable style={attrStyles.sheet} onPress={() => {}}>
          <View style={attrStyles.sheetHandle} />
          {pendingItem && (
            <>
              <View style={attrStyles.sheetHeader}>
                <View style={attrStyles.sheetIconBox}>
                  <Ionicons name="gift-outline" size={22} color={brand.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={attrStyles.sheetTitle}>{pendingItem.name}</Text>
                  <Text style={attrStyles.sheetPrice}>
                    {pendingItem.price.toLocaleString()} Bucks
                  </Text>
                </View>
              </View>

              {pendingItem.requiresSize && (pendingItem.sizes ?? []).length > 0 && (
                <View style={attrStyles.optionSection}>
                  <Text style={attrStyles.optionLabel}>
                    Size{selectedSize ? ` — ${selectedSize}` : " (required)"}
                  </Text>
                  <View style={attrStyles.optionsRow}>
                    {(pendingItem.sizes ?? []).map((s) => (
                      <Pressable
                        key={s}
                        style={[
                          attrStyles.optionChip,
                          selectedSize === s && attrStyles.optionChipActive,
                        ]}
                        onPress={() => setSelectedSize(s)}
                      >
                        <Text
                          style={[
                            attrStyles.optionChipText,
                            selectedSize === s && attrStyles.optionChipTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {pendingItem.requiresColor && (pendingItem.colors ?? []).length > 0 && (
                <View style={attrStyles.optionSection}>
                  <Text style={attrStyles.optionLabel}>
                    Color{selectedColor ? ` — ${selectedColor}` : " (required)"}
                  </Text>
                  <View style={attrStyles.optionsRow}>
                    {(pendingItem.colors ?? []).map((c) => (
                      <Pressable
                        key={c}
                        style={[
                          attrStyles.optionChip,
                          selectedColor === c && attrStyles.optionChipActive,
                        ]}
                        onPress={() => setSelectedColor(c)}
                      >
                        <Text
                          style={[
                            attrStyles.optionChipText,
                            selectedColor === c && attrStyles.optionChipTextActive,
                          ]}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <View style={attrStyles.sheetButtons}>
                <TouchableOpacity
                  style={attrStyles.cancelBtn}
                  onPress={() => setPendingItem(null)}
                >
                  <Text style={attrStyles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    attrStyles.confirmBtn,
                    ((pendingItem.requiresSize && !selectedSize) ||
                      (pendingItem.requiresColor && !selectedColor)) &&
                      attrStyles.confirmBtnDisabled,
                  ]}
                  disabled={
                    (pendingItem.requiresSize && !selectedSize) ||
                    (pendingItem.requiresColor && !selectedColor)
                  }
                  onPress={() => {
                    const item = pendingItem;
                    const size = selectedSize;
                    const color = selectedColor;
                    setPendingItem(null);
                    Alert.alert(
                      "Confirm Purchase",
                      `${item.name}${[size, color].filter(Boolean).length ? `\n${[size, color].filter(Boolean).join(" · ")}` : ""}\n\n${item.price.toLocaleString()} Bucks`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Buy", onPress: () => executePurchase(item, size, color) },
                      ],
                    );
                  }}
                >
                  <Text style={attrStyles.confirmBtnText}>
                    Confirm — {pendingItem.price.toLocaleString()} Bucks
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </View>
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
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (selected) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: brand.white }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <TouchableOpacity
          style={rewardStyles.backRow}
          onPress={() => setSelected(null)}
        >
          <Ionicons name="arrow-back" size={18} color={brand.navy} />
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
    <View style={{ flex: 1, backgroundColor: brand.white }}>
      <View style={[rewardStyles.searchBar, { marginHorizontal: 20, marginTop: 16 }]}>
        <Ionicons name="search-outline" size={18} color={brand.textMuted} />
        <TextInput
          style={rewardStyles.searchInput}
          placeholder="Search employees…"
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

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={40} color={brand.textMuted} />
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
              accessibilityRole="button"
              accessibilityLabel={`Reward ${item.fullName}`}
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
              <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ─── Root: switches between employee store and admin reward ───────────────────

export default function StoreTab() {
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "prime_admin";
  return admin ? <AdminReward /> : <EmployeeStore />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const searchStyles = StyleSheet.create({
  cacheBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: brand.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  cacheBannerText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: brand.border,
  },
  searchInput: {
    flex: 1,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: brand.offWhite,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  filterBtnActive: {
    backgroundColor: brand.green,
    borderColor: brand.green,
  },
  filterBtnText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  filterBtnTextActive: {
    color: brand.white,
  },
  filterPanel: {
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  filterWarn: {
    color: brand.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
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
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  filterInput: {
    backgroundColor: brand.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  filterDash: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    marginBottom: 8,
  },
  clearBtn: {
    paddingBottom: 6,
  },
});

const rewardStyles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    color: brand.navy,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: brand.border,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(46,125,50,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: brand.green,
  },
  avatarText: {
    color: brand.green,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  selectedName: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  selectedBalance: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: brand.border,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  avatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(46,125,50,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(46,125,50,0.20)",
  },
  avatarSmallText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  employeeName: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  employeeBalance: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
  },
  center: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  itemCard: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  itemIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(46,125,50,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 21,
  },
  itemDesc: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: brand.border,
  },
  itemPrice: {
    color: brand.navy,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  buyBtn: {
    backgroundColor: brand.green,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: "center",
  },
  buyBtnText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  nfcFab: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: brand.navy,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nfcFabText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});

const attrStyles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  badge: {
    backgroundColor: brand.offWhite,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: brand.border,
  },
  badgeText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  selectBtn: {
    backgroundColor: brand.navy,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 18,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: brand.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sheetIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(46,125,50,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    lineHeight: 22,
  },
  sheetPrice: {
    color: brand.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginTop: 2,
  },
  optionSection: {
    gap: 10,
  },
  optionLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: brand.white,
  },
  optionChipActive: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  optionChipText: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  optionChipTextActive: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
  },
  sheetButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: brand.border,
  },
  confirmBtnText: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textAlign: "center",
  },
});
