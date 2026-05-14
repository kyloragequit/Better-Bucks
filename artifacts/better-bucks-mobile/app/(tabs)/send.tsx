import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type RewardItem = {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  active: boolean;
};

type TargetUser = { id: number; fullName: string; username: string };

type Transfer = {
  id: number;
  rewardCardId: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "used" | "declined" | "recalled";
  notes: string | null;
  createdAt: string;
  card: RewardItem;
  fromUser?: TargetUser;
  toUser?: TargetUser;
};

// ── Admin tabs ──────────────────────────────────────────────────────────────────
function AdminView() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"send" | "sent">("send");
  const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetUser | null>(null);
  const [note, setNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  const { data: catalog = [], isLoading: catalogLoading, refetch: refetchCatalog } = useQuery<RewardItem[]>({
    queryKey: ["rc-catalog", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/catalog"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const { data: employees = [], isLoading: empLoading } = useQuery<TargetUser[]>({
    queryKey: ["rc-employees", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/employees"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: sent = [], isLoading: sentLoading, refetch: refetchSent } = useQuery<Transfer[]>({
    queryKey: ["rc-sent", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/sent"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const recallMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/recall`), { method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rc-sent", token] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
    onError: () => Alert.alert("Error", "Could not recall"),
  });

  const handleRefresh = useCallback(async () => { await Promise.all([refetchCatalog(), refetchSent()]); }, [refetchCatalog, refetchSent]);

  const activeItems = catalog.filter((c) => c.active);

  async function handleSend() {
    if (!token || !selectedItem || !selectedTarget) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSendLoading(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rewardCardId: selectedItem.id, toUserId: selectedTarget.id, notes: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Error", (body as any)?.message ?? "Could not send item");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSelectedItem(null); setSelectedTarget(null); setNote("");
      qc.invalidateQueries({ queryKey: ["rc-sent", token] });
      Alert.alert("Sent!", `"${selectedItem.name}" sent to ${selectedTarget.fullName}.`);
    } catch { Alert.alert("Error", "Network error — please try again"); }
    finally { setSendLoading(false); }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={brand.green} />}
    >
      <View style={styles.tabBar}>
        {(["send", "sent"] as const).map((t) => {
          const label = t === "send" ? "Send Item" : "History";
          const active = activeTab === t;
          return (
            <Pressable key={t} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab(t); }}>
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "send" && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Choose a reward item to send</Text>
            {catalogLoading ? <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} /> : activeItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎴</Text>
                <Text style={styles.emptyTitle}>No item types yet</Text>
                <Text style={styles.emptyText}>Create item types in Reward Items management.</Text>
              </View>
            ) : (
              <View style={styles.itemGrid}>
                {activeItems.map((item) => {
                  const sel = selectedItem?.id === item.id;
                  return (
                    <Pressable key={item.id} style={[styles.itemChip, sel && styles.itemChipSelected, { borderColor: sel ? item.color : "transparent" }]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedItem(sel ? null : item); }}>
                      <View style={[styles.itemChipEmoji, { backgroundColor: item.color + "22" }]}>
                        <Text style={styles.itemChipEmojiText}>{item.emoji}</Text>
                      </View>
                      <Text style={[styles.itemChipName, sel && { color: item.color }]} numberOfLines={2}>{item.name}</Text>
                      {sel && <View style={styles.itemChipCheck}><Ionicons name="checkmark-circle" size={16} color={item.color} /></View>}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {selectedItem && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Send to which employee?</Text>
              {empLoading ? <ActivityIndicator color={brand.green} /> : employees.length === 0 ? (
                <Text style={styles.emptyText}>No employees found</Text>
              ) : (
                employees.map((t) => {
                  const sel = selectedTarget?.id === t.id;
                  return (
                    <Pressable key={t.id} style={[styles.targetRow, sel && styles.targetRowSelected]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedTarget(sel ? null : t); }}>
                      <View style={styles.targetAvatar}><Text style={styles.targetAvatarText}>{t.fullName?.[0]?.toUpperCase() ?? "?"}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.targetName}>{t.fullName}</Text>
                        <Text style={styles.targetUsername}>@{t.username}</Text>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={brand.green} />}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {selectedItem && selectedTarget && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Note (optional)</Text>
              <TextInput style={styles.textInput} value={note} onChangeText={setNote} placeholder="Add a message..." placeholderTextColor={brand.textMuted} maxLength={200} returnKeyType="done" />
            </View>
          )}

          {selectedItem && selectedTarget && (
            <View style={[styles.sendSummary, { borderColor: selectedItem.color + "44", backgroundColor: selectedItem.color + "0D" }]}>
              <Text style={styles.sendSummaryEmoji}>{selectedItem.emoji}</Text>
              <Text style={[styles.sendSummaryText, { color: selectedItem.color }]}>
                Sending <Text style={{ fontFamily: "Inter_700Bold" }}>"{selectedItem.name}"</Text> to {selectedTarget.fullName}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: selectedItem ? selectedItem.color : brand.border }, (!selectedItem || !selectedTarget || sendLoading) && styles.actionBtnDisabled, pressed && selectedItem && selectedTarget && { opacity: 0.85 }]}
            onPress={handleSend} disabled={!selectedItem || !selectedTarget || sendLoading}
          >
            {sendLoading ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Text style={styles.actionBtnEmoji}>{selectedItem?.emoji ?? "🎫"}</Text><Text style={styles.actionBtnText}>Send Item</Text></>
            )}
          </Pressable>
        </>
      )}

      {activeTab === "sent" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>History</Text>
          {sentLoading ? <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} /> : sent.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyEmoji}>📋</Text><Text style={styles.emptyTitle}>Nothing sent yet</Text></View>
          ) : (
            sent.map((tr) => <SentCard key={tr.id} transfer={tr} onRecall={() => recallMut.mutate(tr.id)} recalling={recallMut.isPending} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Employee view ────────────────────────────────────────────────────────────────
function EmployeeView() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"wallet" | "inbox" | "history">("wallet");

  const { data: wallet = [], isLoading: walletLoading, refetch: refetchWallet } = useQuery<Transfer[]>({
    queryKey: ["rc-mine", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/mine"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery<Transfer[]>({
    queryKey: ["rc-inbox", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/inbox"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery<Transfer[]>({
    queryKey: ["rc-sent", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/sent"), { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const handleRefresh = useCallback(async () => { await Promise.all([refetchWallet(), refetchInbox(), refetchHistory()]); }, [refetchWallet, refetchInbox, refetchHistory]);

  const acceptMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/accept`), { method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rc-inbox", token] }); qc.invalidateQueries({ queryKey: ["rc-mine", token] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
    onError: () => Alert.alert("Error", "Could not accept"),
  });

  const declineMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/decline`), { method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rc-inbox", token] }),
    onError: () => Alert.alert("Error", "Could not decline"),
  });

  // Only allow redeeming items the employee actually holds (status = accepted)
  const redeemMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/use`), { method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.message ?? "Failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rc-mine", token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Redeemed!", "Your item has been marked as redeemed.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message || "Could not redeem"),
  });

  function confirmRedeem(transfer: Transfer) {
    Alert.alert(
      `Redeem "${transfer.card.name}"?`,
      "This marks the item as used and removes it from your wallet.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Redeem Item", style: "default", onPress: () => redeemMut.mutate(transfer.id) },
      ]
    );
  }

  const TABS = [
    { key: "wallet" as const, label: `My Items${wallet.length > 0 ? ` (${wallet.length})` : ""}` },
    { key: "inbox" as const, label: `Inbox${inbox.length > 0 ? ` (${inbox.length})` : ""}` },
    { key: "history" as const, label: "History" },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={brand.green} />}
    >
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <Pressable key={t.key} style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab(t.key); }}>
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* My Items wallet */}
      {activeTab === "wallet" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Items you hold</Text>
          {walletLoading ? <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} /> : wallet.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🎫</Text>
              <Text style={styles.emptyTitle}>No items yet</Text>
              <Text style={styles.emptyText}>Your manager can send you reward items here. Check your Inbox for incoming items.</Text>
            </View>
          ) : (
            wallet.map((tr) => (
              <View key={tr.id} style={[styles.transferCard, { borderLeftWidth: 4, borderLeftColor: tr.card.color }]}>
                <View style={cStyles.row}>
                  <View style={[cStyles.emojiBox, { backgroundColor: tr.card.color + "1A" }]}>
                    <Text style={cStyles.emoji}>{tr.card.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cStyles.name}>{tr.card.name}</Text>
                    {tr.card.description ? <Text style={cStyles.desc} numberOfLines={1}>{tr.card.description}</Text> : null}
                    <Text style={cStyles.meta}>From: {tr.fromUser?.fullName ?? "—"}</Text>
                  </View>
                </View>
                <Pressable
                  style={[cStyles.redeemBtn, { backgroundColor: tr.card.color }, redeemMut.isPending && { opacity: 0.6 }]}
                  onPress={() => confirmRedeem(tr)}
                  disabled={redeemMut.isPending}
                >
                  {redeemMut.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                    <><Text style={{ fontSize: 14, marginRight: 4 }}>✅</Text><Text style={cStyles.redeemBtnText}>Redeem Item</Text></>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Inbox */}
      {activeTab === "inbox" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Incoming items</Text>
          {inboxLoading ? <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} /> : inbox.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📬</Text>
              <Text style={styles.emptyTitle}>Empty inbox</Text>
              <Text style={styles.emptyText}>Nothing pending right now.</Text>
            </View>
          ) : (
            inbox.map((tr) => <InboxCard key={tr.id} transfer={tr} onAccept={() => acceptMut.mutate(tr.id)} onDecline={() => declineMut.mutate(tr.id)} accepting={acceptMut.isPending} declining={declineMut.isPending} />)
          )}
        </View>
      )}

      {/* History */}
      {activeTab === "history" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>History</Text>
          {historyLoading ? <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} /> : history.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyEmoji}>📋</Text><Text style={styles.emptyTitle}>No history yet</Text></View>
          ) : (
            history.map((tr) => (
              <View key={tr.id} style={[styles.transferCard, { borderLeftWidth: 4, borderLeftColor: tr.card.color }]}>
                <View style={cStyles.row}>
                  <View style={[cStyles.emojiBox, { backgroundColor: tr.card.color + "1A" }]}><Text style={cStyles.emoji}>{tr.card.emoji}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={cStyles.name}>{tr.card.name}</Text>
                    <Text style={cStyles.meta}>To: {tr.toUser?.fullName ?? "—"}</Text>
                    {tr.notes ? <Text style={cStyles.note}>"{tr.notes}"</Text> : null}
                  </View>
                  <StatusBadge status={tr.status} />
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Root component — route to admin or employee view ─────────────────────────────
export default function RewardItemsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "prime_admin";
  return isAdmin ? <AdminView /> : <EmployeeView />;
}

// ── Shared sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Transfer["status"] }) {
  const cfg = {
    pending: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
    accepted: { bg: "#D1FAE5", text: "#065F46", label: "Accepted" },
    used: { bg: "#EDE9FE", text: "#5B21B6", label: "Redeemed" },
    declined: { bg: "#FEE2E2", text: "#991B1B", label: "Declined" },
    recalled: { bg: brand.offWhite, text: brand.textMuted, label: "Recalled" },
  }[status];
  return (
    <View style={[bStyles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[bStyles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}
const bStyles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

function InboxCard({ transfer, onAccept, onDecline, accepting, declining }: { transfer: Transfer; onAccept: () => void; onDecline: () => void; accepting: boolean; declining: boolean }) {
  return (
    <View style={[styles.transferCard, { borderLeftWidth: 4, borderLeftColor: transfer.card.color }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.emojiBox, { backgroundColor: transfer.card.color + "1A" }]}><Text style={cStyles.emoji}>{transfer.card.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={cStyles.name}>{transfer.card.name}</Text>
          {transfer.card.description ? <Text style={cStyles.desc} numberOfLines={1}>{transfer.card.description}</Text> : null}
          <Text style={cStyles.meta}>From: {transfer.fromUser?.fullName ?? "—"}</Text>
          {transfer.notes ? <Text style={cStyles.note}>"{transfer.notes}"</Text> : null}
        </View>
        <StatusBadge status={transfer.status} />
      </View>
      <View style={cStyles.actionRow}>
        <Pressable style={[cStyles.acceptBtn, accepting && { opacity: 0.6 }]} onPress={onAccept} disabled={accepting}>
          {accepting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={cStyles.acceptText}>Accept</Text>}
        </Pressable>
        <Pressable style={[cStyles.declineBtn, declining && { opacity: 0.6 }]} onPress={onDecline} disabled={declining}>
          {declining ? <ActivityIndicator size="small" color={brand.danger} /> : <Text style={cStyles.declineText}>Decline</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function SentCard({ transfer, onRecall, recalling }: { transfer: Transfer; onRecall: () => void; recalling: boolean }) {
  return (
    <View style={[styles.transferCard, { borderLeftWidth: 4, borderLeftColor: transfer.card.color }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.emojiBox, { backgroundColor: transfer.card.color + "1A" }]}><Text style={cStyles.emoji}>{transfer.card.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={cStyles.name}>{transfer.card.name}</Text>
          <Text style={cStyles.meta}>To: {transfer.toUser?.fullName ?? "—"}</Text>
          {transfer.notes ? <Text style={cStyles.note}>"{transfer.notes}"</Text> : null}
        </View>
        <StatusBadge status={transfer.status} />
      </View>
      {transfer.status === "pending" && (
        <Pressable style={[cStyles.declineBtn, recalling && { opacity: 0.6 }]} onPress={onRecall} disabled={recalling}>
          {recalling ? <ActivityIndicator size="small" color={brand.danger} /> : <Text style={cStyles.declineText}>Recall</Text>}
        </Pressable>
      )}
    </View>
  );
}

const cStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emojiBox: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: brand.text, marginBottom: 2 },
  desc: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textMuted, marginBottom: 2 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textSecondary },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textMuted, fontStyle: "italic", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: brand.green, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  acceptText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  declineBtn: { flex: 1, backgroundColor: brand.offWhite, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: brand.border },
  declineText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: brand.danger },
  redeemBtn: { flexDirection: "row", borderRadius: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 4 },
  redeemBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },
  tabBar: { flexDirection: "row", backgroundColor: brand.offWhite, borderRadius: 12, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: brand.white, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: brand.textMuted },
  tabBtnTextActive: { color: brand.navy, fontFamily: "Inter_600SemiBold" },
  section: { gap: 10 },
  sectionLabel: { color: brand.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  itemChip: { width: "47%", backgroundColor: brand.offWhite, borderRadius: 14, padding: 14, alignItems: "center", gap: 8, borderWidth: 2, position: "relative" },
  itemChipSelected: { backgroundColor: brand.white },
  itemChipEmoji: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemChipEmojiText: { fontSize: 26 },
  itemChipName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: brand.text, textAlign: "center" },
  itemChipCheck: { position: "absolute", top: 6, right: 6 },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: brand.offWhite, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: "transparent" },
  targetRowSelected: { borderColor: brand.green, backgroundColor: "rgba(46,125,50,0.05)" },
  targetAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: brand.navy, alignItems: "center", justifyContent: "center" },
  targetAvatarText: { color: brand.white, fontFamily: "Inter_700Bold", fontSize: 15 },
  targetName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: brand.text },
  targetUsername: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textMuted },
  sendSummary: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, borderWidth: 1 },
  sendSummaryEmoji: { fontSize: 22 },
  sendSummaryText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, lineHeight: 19 },
  textInput: { backgroundColor: brand.offWhite, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: brand.text, fontFamily: "Inter_500Medium", fontSize: 15, borderWidth: 1, borderColor: brand.border },
  actionBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  actionBtnDisabled: { backgroundColor: brand.border },
  actionBtnEmoji: { fontSize: 18 },
  actionBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  transferCard: { backgroundColor: brand.white, borderRadius: 14, padding: 14, marginBottom: 2, borderWidth: 1, borderColor: brand.border, gap: 10 },
  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 36 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: brand.text },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: brand.textMuted, textAlign: "center", lineHeight: 19 },
});
