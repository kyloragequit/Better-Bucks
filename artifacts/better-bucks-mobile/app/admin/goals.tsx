import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Goal = {
  id: number;
  title: string;
  type: "time" | "quantity";
  status: "active" | "completed" | "failed" | "pending_distribution";
  bucksReward: number;
  targetQuantity: number | null;
  currentQuantity: number;
  targetDays: number | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: brand.green,
  completed: "#1565C0",
  failed: brand.danger,
  pending_distribution: brand.warning,
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  pending_distribution: "Pending Payout",
};

function GoalCard({ goal, onIncrement, onDelete }: { goal: Goal; onIncrement: () => void; onDelete: () => void }) {
  const isQty = goal.type === "quantity";
  const pct = isQty && goal.targetQuantity
    ? Math.min(100, Math.round((goal.currentQuantity / goal.targetQuantity) * 100))
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[goal.status] ?? brand.textMuted }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[goal.status] ?? brand.textMuted }]}>
              {STATUS_LABELS[goal.status] ?? goal.status}
            </Text>
          </View>
        </View>
        <View style={styles.rewardBadge}>
          <Ionicons name="star" size={12} color={brand.white} />
          <Text style={styles.rewardText}>{goal.bucksReward.toLocaleString()} Bucks</Text>
        </View>
      </View>

      {isQty && goal.targetQuantity ? (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {goal.currentQuantity}/{goal.targetQuantity} ({pct}%)
          </Text>
        </View>
      ) : goal.type === "time" && goal.endDate ? (
        <Text style={styles.timeMeta}>
          Ends {new Date(goal.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        {isQty && goal.status === "active" && (
          <TouchableOpacity style={styles.actionChip} onPress={onIncrement}>
            <Ionicons name="add" size={14} color={brand.green} />
            <Text style={styles.actionChipText}>Increment</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionChip, styles.deleteChip]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={14} color={brand.danger} />
          <Text style={[styles.actionChipText, { color: brand.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [createModal, setCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"time" | "quantity">("quantity");
  const [newBucks, setNewBucks] = useState("");
  const [newTargetQty, setNewTargetQty] = useState("");
  const [newTargetDays, setNewTargetDays] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: goals = [], isLoading, refetch, isRefetching } = useQuery<Goal[]>({
    queryKey: ["mobile-admin-goals", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/goals"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load goals");
      return res.json();
    },
    enabled: !!token,
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) { Alert.alert("Required", "Enter a goal title."); return; }
    const bucks = parseInt(newBucks);
    if (!bucks || bucks < 1) { Alert.alert("Invalid", "Enter a valid Bucks reward."); return; }
    if (newType === "quantity" && (!newTargetQty || parseInt(newTargetQty) < 1)) {
      Alert.alert("Required", "Enter the target quantity."); return;
    }
    if (newType === "time" && (!newTargetDays || parseInt(newTargetDays) < 1)) {
      Alert.alert("Required", "Enter the target number of days."); return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: newTitle.trim(),
        type: newType,
        bucksReward: bucks,
      };
      if (newType === "quantity") body.targetQuantity = parseInt(newTargetQty);
      if (newType === "time") body.targetDays = parseInt(newTargetDays);

      const res = await fetch(apiUrl("/api/mobile/admin/goals"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", data?.message ?? "Try again."); return; }
      setCreateModal(false);
      setNewTitle(""); setNewBucks(""); setNewTargetQty(""); setNewTargetDays("");
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-goals"] });
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setCreating(false);
    }
  };

  const handleIncrement = (goal: Goal) => {
    Alert.alert(
      "Increment goal?",
      `Add 1 to "${goal.title}" progress? (${goal.currentQuantity + 1}/${goal.targetQuantity})`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Increment",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/goals/${goal.id}/increment`), {
              method: "POST",
              headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
              body: JSON.stringify({ amount: 1 }),
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-goals"] });
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

  const handleDelete = (goal: Goal) => {
    Alert.alert("Delete goal?", `Remove "${goal.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await fetch(apiUrl(`/api/mobile/admin/goals/${goal.id}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token ?? ""}` },
          });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["mobile-admin-goals"] });
            refetch();
          } else {
            const d = await res.json().catch(() => ({}));
            Alert.alert("Failed", d?.message ?? "Try again.");
          }
        },
      },
    ]);
  };

  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status !== "active");

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
        data={[...active, ...done]}
        keyExtractor={(g) => String(g.id)}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={brand.green} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
          goals.length === 0 && styles.center,
        ]}
        ListHeaderComponent={
          goals.length > 0 ? (
            <Text style={styles.countText}>
              {active.length} active · {done.length} completed
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 12 }}>
            <Ionicons name="trophy-outline" size={48} color={brand.textMuted} />
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptySubtitle}>Create your first team goal below.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onIncrement={() => handleIncrement(item)}
            onDelete={() => handleDelete(item)}
          />
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
            <Text style={styles.modalTitle}>New Goal</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating} hitSlop={12}>
              <Text style={[styles.modalSave, creating && { opacity: 0.5 }]}>
                {creating ? "Creating…" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.fieldLabel}>Goal Title</Text>
            <TextInput
              style={styles.textInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Serve 100 customers"
              placeholderTextColor={brand.textMuted}
            />

            <Text style={styles.fieldLabel}>Goal Type</Text>
            <View style={styles.typeToggle}>
              {(["quantity", "time"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, newType === t && styles.typeBtnActive]}
                  onPress={() => setNewType(t)}
                >
                  <Ionicons
                    name={t === "quantity" ? "layers-outline" : "time-outline"}
                    size={16}
                    color={newType === t ? brand.white : brand.textSecondary}
                  />
                  <Text style={[styles.typeBtnText, newType === t && styles.typeBtnTextActive]}>
                    {t === "quantity" ? "Quantity" : "Time-Based"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Bucks Reward</Text>
            <TextInput
              style={styles.textInput}
              value={newBucks}
              onChangeText={setNewBucks}
              placeholder="e.g. 200"
              placeholderTextColor={brand.textMuted}
              keyboardType="numeric"
            />

            {newType === "quantity" ? (
              <>
                <Text style={styles.fieldLabel}>Target Count</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTargetQty}
                  onChangeText={setNewTargetQty}
                  placeholder="e.g. 100"
                  placeholderTextColor={brand.textMuted}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Duration (days)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTargetDays}
                  onChangeText={setNewTargetDays}
                  placeholder="e.g. 30"
                  placeholderTextColor={brand.textMuted}
                  keyboardType="numeric"
                />
              </>
            )}
          </ScrollView>
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
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  goalTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: brand.green,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rewardText: { color: brand.white, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  progressSection: { gap: 6 },
  progressBar: { height: 8, backgroundColor: brand.offWhite, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: brand.green, borderRadius: 4 },
  progressText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  timeMeta: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  deleteChip: { backgroundColor: "rgba(198,40,40,0.08)" },
  actionChipText: { color: brand.green, fontFamily: "Inter_500Medium", fontSize: 13 },
  emptyTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  emptySubtitle: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
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
  // Modal
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
  modalSave: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  modalBody: { padding: 20, gap: 16 },
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
  typeToggle: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.offWhite,
  },
  typeBtnActive: { backgroundColor: brand.green, borderColor: brand.green },
  typeBtnText: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 14 },
  typeBtnTextActive: { color: brand.white },
});
