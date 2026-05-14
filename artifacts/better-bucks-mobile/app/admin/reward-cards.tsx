import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type RewardCard = {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  active: boolean;
  createdAt: string;
};

const PRESET_EMOJIS = ["🎫", "☕", "🍕", "⏰", "🏆", "🌟", "🎁", "🍔", "🎯", "💪", "🚀", "🎉", "🛑", "🏅", "🍦"];
const PRESET_COLORS = [
  "#1A237E", "#2E7D32", "#B71C1C", "#E65100",
  "#4A148C", "#006064", "#1565C0", "#37474F",
];

type FormState = {
  name: string;
  description: string;
  emoji: string;
  color: string;
  active: boolean;
};

const DEFAULT_FORM: FormState = { name: "", description: "", emoji: "🎫", color: "#1A237E", active: true };

export default function RewardCardsAdmin() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<RewardCard | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const { data: cards = [], isLoading, refetch } = useQuery<RewardCard[]>({
    queryKey: ["admin-reward-cards", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/catalog"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setModalVisible(true);
  }

  function openEdit(card: RewardCard) {
    setEditing(card);
    setForm({ name: card.name, description: card.description ?? "", emoji: card.emoji, color: card.color, active: card.active });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert("Name required"); return; }
    setSaving(true);
    try {
      const url = editing
        ? apiUrl(`/api/mobile/admin/reward-cards/${editing.id}`)
        : apiUrl("/api/mobile/admin/reward-cards");
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ ...form, description: form.description || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Error", (body as any)?.message ?? "Could not save");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setModalVisible(false);
      qc.invalidateQueries({ queryKey: ["admin-reward-cards", token] });
      qc.invalidateQueries({ queryKey: ["rc-catalog", token] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(card: RewardCard) {
    Alert.alert("Delete card?", `"${card.name}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await fetch(apiUrl(`/api/mobile/admin/reward-cards/${card.id}`), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token ?? ""}` },
            });
            qc.invalidateQueries({ queryKey: ["admin-reward-cards", token] });
            qc.invalidateQueries({ queryKey: ["rc-catalog", token] });
          } catch {
            Alert.alert("Error", "Could not delete");
          }
        },
      },
    ]);
  }

  async function handleToggleActive(card: RewardCard) {
    try {
      await fetch(apiUrl(`/api/mobile/admin/reward-cards/${card.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: !card.active }),
      });
      qc.invalidateQueries({ queryKey: ["admin-reward-cards", token] });
      qc.invalidateQueries({ queryKey: ["rc-catalog", token] });
    } catch {
      Alert.alert("Error", "Could not update");
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reward Card Types</Text>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color={brand.white} />
          <Text style={styles.addBtnText}>New Card</Text>
        </Pressable>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={15} color={brand.navy} />
        <Text style={styles.infoText}>
          Create perk cards (e.g. "15-min break", "Free lunch") to hand out to employees. No Bucks required.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={brand.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🎫</Text>
              <Text style={styles.emptyTitle}>No reward cards yet</Text>
              <Text style={styles.emptyText}>Tap "New Card" to create your first one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.cardRow, !item.active && styles.cardRowInactive]}>
              <View style={[styles.cardEmoji, { backgroundColor: item.color + "22" }]}>
                <Text style={styles.cardEmojiText}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={[styles.cardStatus, { color: item.active ? brand.green : brand.textMuted }]}>
                  {item.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <Switch
                value={item.active}
                onValueChange={() => handleToggleActive(item)}
                trackColor={{ false: brand.border, true: brand.green }}
                thumbColor={brand.white}
              />
              <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil-outline" size={16} color={brand.navy} />
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={16} color={brand.danger} />
              </Pressable>
            </View>
          )}
          refreshing={isLoading}
          onRefresh={refetch}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{editing ? "Edit Card" : "New Card Type"}</Text>

                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder='e.g. "15-Minute Break"'
                  placeholderTextColor={brand.textMuted}
                  maxLength={80}
                />

                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Optional description..."
                  placeholderTextColor={brand.textMuted}
                  multiline
                  maxLength={300}
                />

                <Text style={styles.fieldLabel}>Emoji</Text>
                <View style={styles.emojiRow}>
                  {PRESET_EMOJIS.map((e) => (
                    <Pressable
                      key={e}
                      style={[styles.emojiOption, form.emoji === e && styles.emojiOptionSelected]}
                      onPress={() => setForm((f) => ({ ...f, emoji: e }))}
                    >
                      <Text style={styles.emojiOptionText}>{e}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.colorRow}>
                  {PRESET_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, form.color === c && styles.colorSwatchSelected]}
                      onPress={() => setForm((f) => ({ ...f, color: c }))}
                    />
                  ))}
                </View>

                <View style={styles.activeRow}>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Switch
                    value={form.active}
                    onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                    trackColor={{ false: brand.border, true: brand.green }}
                    thumbColor={brand.white}
                  />
                </View>

                {/* Preview */}
                <View style={[styles.preview, { borderColor: form.color }]}>
                  <View style={[styles.previewEmoji, { backgroundColor: form.color + "22" }]}>
                    <Text style={{ fontSize: 24 }}>{form.emoji}</Text>
                  </View>
                  <Text style={[styles.previewName, { color: form.color }]}>{form.name || "Card Name"}</Text>
                </View>

                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveBtn, { backgroundColor: form.color }, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Save Card</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: brand.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: brand.green,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: brand.white },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 16,
    marginBottom: 4,
    backgroundColor: "rgba(26,35,126,0.05)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(26,35,126,0.1)",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: brand.navy, flex: 1, lineHeight: 18 },
  list: { padding: 16, gap: 10 },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: brand.border,
  },
  cardRowInactive: { opacity: 0.55 },
  cardEmoji: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardEmojiText: { fontSize: 22 },
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: brand.text },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textMuted, marginTop: 1 },
  cardStatus: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: brand.text },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: brand.textMuted, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: brand.border, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: brand.text, marginBottom: 4 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: brand.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  textInput: {
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: brand.text,
    borderWidth: 1,
    borderColor: brand.border,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: brand.offWhite,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiOptionSelected: { borderColor: brand.navy, backgroundColor: "rgba(26,35,126,0.08)" },
  emojiOptionText: { fontSize: 22 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: "transparent" },
  colorSwatchSelected: { borderColor: brand.text },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    marginTop: 4,
  },
  previewEmoji: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  previewName: { fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: brand.border,
  },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: brand.textSecondary },
  saveBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveText: { fontFamily: "Inter_700Bold", fontSize: 14, color: brand.white },
});
