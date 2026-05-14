import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type StoreItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  url: string | null;
  available: boolean;
  requiresSize: boolean;
  requiresColor: boolean;
  sizes: string[] | null;
  colors: string[] | null;
};

function ItemForm({
  initial,
  onSave,
  saving,
}: {
  initial: Partial<StoreItem>;
  onSave: (data: Partial<StoreItem>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [desc, setDesc] = useState(initial.description ?? "");
  const [price, setPrice] = useState(initial.price ? String(initial.price) : "");
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [available, setAvailable] = useState(initial.available ?? true);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>Item Name *</Text>
      <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder="e.g. Gift Card" placeholderTextColor={brand.textMuted} />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.textInput, { minHeight: 70, textAlignVertical: "top" }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Optional description…"
        placeholderTextColor={brand.textMuted}
        multiline
      />

      <Text style={styles.fieldLabel}>Price (Bucks) *</Text>
      <TextInput style={styles.textInput} value={price} onChangeText={setPrice} placeholder="e.g. 500" placeholderTextColor={brand.textMuted} keyboardType="numeric" />

      <Text style={styles.fieldLabel}>Image URL</Text>
      <TextInput style={styles.textInput} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" placeholderTextColor={brand.textMuted} autoCapitalize="none" keyboardType="url" />

      <Text style={styles.fieldLabel}>Item URL (link to product)</Text>
      <TextInput style={styles.textInput} value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={brand.textMuted} autoCapitalize="none" keyboardType="url" />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Available in store</Text>
          <Text style={styles.switchSub}>Employees can see and redeem this item</Text>
        </View>
        <Switch
          value={available}
          onValueChange={setAvailable}
          trackColor={{ false: brand.border, true: brand.green }}
          thumbColor={brand.white}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={() => {
          Keyboard.dismiss();
          onSave({ name, description: desc || null, price: parseInt(price), imageUrl: imageUrl || null, url: url || null, available });
        }}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Item"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </TouchableWithoutFeedback>
  );
}

export default function StoreItemsScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [createModal, setCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<StoreItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Preferred store URL
  const [storeUrlInput, setStoreUrlInput] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const isPrimeAdmin = user?.role === "prime_admin";

  const { data: urlData, refetch: refetchUrl } = useQuery<{ url: string | null }>({
    queryKey: ["mobile-admin-preferred-store-url", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/preferred-store-url"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token && isPrimeAdmin,
  });

  useEffect(() => {
    if (urlData !== undefined) {
      setStoreUrlInput(urlData.url ?? "");
    }
  }, [urlData]);

  const handleSaveUrl = async () => {
    Keyboard.dismiss();
    const trimmed = storeUrlInput.trim();
    setSavingUrl(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/admin/preferred-store-url"), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Error", d?.message ?? "Could not save URL."); return; }
      await refetchUrl();
      queryClient.invalidateQueries({ queryKey: ["mobile-approved-sites"] });
      Alert.alert("Saved", trimmed ? "Preferred store website updated." : "Preferred store website cleared.");
    } catch {
      Alert.alert("Error", "Network error. Try again.");
    } finally {
      setSavingUrl(false);
    }
  };

  const { data: items = [], isLoading, refetch, isRefetching } = useQuery<StoreItem[]>({
    queryKey: ["mobile-admin-store-items", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/store-items"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load store items");
      return res.json();
    },
    enabled: !!token,
  });

  const handleCreate = async (data: Partial<StoreItem>) => {
    if (!data.name?.trim()) { Alert.alert("Required", "Enter an item name."); return; }
    if (!data.price || data.price < 1) { Alert.alert("Invalid", "Enter a valid Bucks price."); return; }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/admin/store-items"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", d?.message ?? "Try again."); return; }
      setCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-store-items"] });
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data: Partial<StoreItem>) => {
    if (!editItem) return;
    if (!data.name?.trim()) { Alert.alert("Required", "Enter an item name."); return; }
    if (!data.price || data.price < 1) { Alert.alert("Invalid", "Enter a valid Bucks price."); return; }
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/mobile/admin/store-items/${editItem.id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", d?.message ?? "Try again."); return; }
      setEditItem(null);
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-store-items"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-store"] });
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (item: StoreItem) => {
    try {
      await fetch(apiUrl(`/api/mobile/admin/store-items/${item.id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-store-items"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-store"] });
      refetch();
    } catch { /* ignore */ }
  };

  const handleDelete = (item: StoreItem) => {
    Alert.alert("Delete item?", `Remove "${item.name}" from the store? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await fetch(apiUrl(`/api/mobile/admin/store-items/${item.id}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token ?? ""}` },
          });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["mobile-admin-store-items"] });
            queryClient.invalidateQueries({ queryKey: ["mobile-store"] });
            refetch();
          } else {
            const d = await res.json().catch(() => ({}));
            Alert.alert("Failed", d?.message ?? "Try again.");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={brand.green} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
          items.length === 0 && styles.center,
        ]}
        ListHeaderComponent={
          <>
            {isPrimeAdmin && (
              <View style={styles.urlCard}>
                <View style={styles.urlCardHeader}>
                  <Ionicons name="globe-outline" size={18} color={brand.navy} />
                  <Text style={styles.urlCardTitle}>Preferred Store Website</Text>
                </View>
                <Text style={styles.urlCardSub}>
                  Employees will see this as a shortcut when they open the store tab.
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={storeUrlInput}
                  onChangeText={setStoreUrlInput}
                  placeholder="https://example.com"
                  placeholderTextColor={brand.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, savingUrl && { opacity: 0.6 }]}
                  onPress={handleSaveUrl}
                  disabled={savingUrl}
                >
                  <Text style={styles.saveBtnText}>{savingUrl ? "Saving…" : "Save Website"}</Text>
                </TouchableOpacity>
              </View>
            )}
            {items.length > 0 && (
              <Text style={[styles.countText, { marginTop: isPrimeAdmin ? 8 : 0 }]}>
                {items.length} item{items.length !== 1 ? "s" : ""}
                {" "}· {items.filter((i) => i.available).length} available
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 12 }}>
            <Ionicons name="storefront-outline" size={48} color={brand.textMuted} />
            <Text style={styles.emptyTitle}>No store items</Text>
            <Text style={styles.emptySubtitle}>Add your first reward item below.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.itemIcon, { backgroundColor: item.available ? "rgba(46,125,50,0.1)" : brand.offWhite }]}>
                <Ionicons name="gift-outline" size={22} color={item.available ? brand.green : brand.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
                <Text style={styles.itemPrice}>{item.price.toLocaleString()} Bucks</Text>
              </View>
              <View style={[styles.availBadge, { backgroundColor: item.available ? "rgba(46,125,50,0.1)" : "rgba(198,40,40,0.08)" }]}>
                <Text style={[styles.availText, { color: item.available ? brand.green : brand.danger }]}>
                  {item.available ? "Live" : "Hidden"}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionChip} onPress={() => setEditItem(item)}>
                <Ionicons name="pencil-outline" size={13} color={brand.navy} />
                <Text style={[styles.actionChipText, { color: brand.navy }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: item.available ? "rgba(198,40,40,0.08)" : "rgba(46,125,50,0.08)" }]}
                onPress={() => handleToggleAvailability(item)}
              >
                <Ionicons name={item.available ? "eye-off-outline" : "eye-outline"} size={13} color={item.available ? brand.danger : brand.green} />
                <Text style={[styles.actionChipText, { color: item.available ? brand.danger : brand.green }]}>
                  {item.available ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: "rgba(10,25,50,0.08)" }]}
                onPress={() => router.push({ pathname: "/admin/store-nfc", params: { itemId: item.id, itemName: item.name, itemPrice: item.price } })}
              >
                <Ionicons name="radio-outline" size={13} color={brand.navy} />
                <Text style={[styles.actionChipText, { color: brand.navy }]}>NFC</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: "rgba(198,40,40,0.08)" }]} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={13} color={brand.danger} />
                <Text style={[styles.actionChipText, { color: brand.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setCreateModal(true)}
      >
        <Ionicons name="add" size={28} color={brand.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)} hitSlop={12}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Item</Text>
            <View style={{ width: 60 }} />
          </View>
          <ItemForm initial={{ available: true }} onSave={handleCreate} saving={saving} />
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editItem} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setEditItem(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditItem(null)} hitSlop={12}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <View style={{ width: 60 }} />
          </View>
          {editItem && <ItemForm initial={editItem} onSave={handleEdit} saving={saving} />}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 12 },
  countText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 4 },
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemName: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  itemDesc: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  itemPrice: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 4 },
  availBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  availText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(26,35,126,0.08)",
  },
  actionChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  emptyTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  emptySubtitle: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
  urlCard: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
    marginBottom: 4,
  },
  urlCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  urlCardTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  urlCardSub: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.white,
  },
  modalTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  modalCancel: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 16 },
  formBody: { padding: 20, gap: 16 },
  fieldLabel: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: brand.text,
    backgroundColor: brand.white,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: brand.border,
  },
  switchLabel: { color: brand.text, fontFamily: "Inter_500Medium", fontSize: 15 },
  switchSub: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  saveBtn: {
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: brand.white, fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
