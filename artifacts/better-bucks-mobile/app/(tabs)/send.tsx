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

type RewardCard = {
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
  card: RewardCard;
  fromUser?: TargetUser;
  toUser?: TargetUser;
};

type Tab = "send" | "inbox" | "wallet" | "sent";

export default function SendReceiveTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin" || user?.role === "prime_admin";

  const [activeTab, setActiveTab] = useState<Tab>("send");
  const [selectedCard, setSelectedCard] = useState<RewardCard | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetUser | null>(null);
  const [note, setNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  const { data: catalog = [], isLoading: catalogLoading, refetch: refetchCatalog } = useQuery<RewardCard[]>({
    queryKey: ["rc-catalog", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/catalog"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const targetEndpoint = isEmployee ? "/api/mobile/reward-cards/admins" : "/api/mobile/reward-cards/employees";
  const { data: targets = [], isLoading: targetsLoading } = useQuery<TargetUser[]>({
    queryKey: ["rc-targets", token, user?.role],
    queryFn: async () => {
      const res = await fetch(apiUrl(targetEndpoint), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery<Transfer[]>({
    queryKey: ["rc-inbox", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/inbox"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const { data: wallet = [], isLoading: walletLoading, refetch: refetchWallet } = useQuery<Transfer[]>({
    queryKey: ["rc-mine", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/mine"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const { data: sent = [], isLoading: sentLoading, refetch: refetchSent } = useQuery<Transfer[]>({
    queryKey: ["rc-sent", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/sent"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const pendingInbox = inbox.length;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchCatalog(), refetchInbox(), refetchWallet(), refetchSent()]);
  }, [refetchCatalog, refetchInbox, refetchWallet, refetchSent]);

  const activeCards = catalog.filter((c) => c.active);

  async function handleSend() {
    if (!token || !selectedCard || !selectedTarget) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSendLoading(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/reward-cards/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rewardCardId: selectedCard.id, toUserId: selectedTarget.id, notes: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Error", (body as any)?.message ?? "Could not send card");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSelectedCard(null);
      setSelectedTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["rc-sent", token] });
      qc.invalidateQueries({ queryKey: ["rc-inbox", token] });
      Alert.alert("Sent!", `"${selectedCard.name}" sent to ${selectedTarget.fullName}.`);
    } catch {
      Alert.alert("Error", "Network error — please try again");
    } finally {
      setSendLoading(false);
    }
  }

  const acceptMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/accept`), {
        method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rc-inbox", token] });
      qc.invalidateQueries({ queryKey: ["rc-mine", token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: () => Alert.alert("Error", "Could not accept"),
  });

  const useMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/use`), {
        method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rc-mine", token] });
      qc.invalidateQueries({ queryKey: ["rc-wallet", token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: () => Alert.alert("Error", "Could not mark as used"),
  });

  const declineMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/decline`), {
        method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rc-inbox", token] }),
    onError: () => Alert.alert("Error", "Could not decline"),
  });

  const recallMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/reward-cards/${id}/recall`), {
        method: "PUT", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rc-sent", token] }),
    onError: () => Alert.alert("Error", "Could not recall"),
  });

  const TABS: { key: Tab; label: string }[] = isEmployee
    ? [
        { key: "wallet", label: `Cards${wallet.length > 0 ? ` (${wallet.length})` : ""}` },
        { key: "inbox", label: `Inbox${pendingInbox > 0 ? ` (${pendingInbox})` : ""}` },
        { key: "send", label: "Return" },
        { key: "sent", label: "History" },
      ]
    : [
        { key: "send", label: "Send" },
        { key: "inbox", label: `Inbox${pendingInbox > 0 ? ` (${pendingInbox})` : ""}` },
        { key: "sent", label: "History" },
      ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={brand.green} />}
    >
      {/* Segment tabs */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab(t.key); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Wallet / My Cards (employees) ── */}
      {activeTab === "wallet" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your reward cards</Text>
          {walletLoading ? (
            <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
          ) : wallet.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🎫</Text>
              <Text style={styles.emptyTitle}>No cards yet</Text>
              <Text style={styles.emptyText}>Your manager can send you reward cards here.</Text>
            </View>
          ) : (
            wallet.map((tr) => (
              <WalletCard key={tr.id} transfer={tr} onUse={() => useMut.mutate(tr.id)} using={useMut.isPending} />
            ))
          )}
        </View>
      )}

      {/* ── Inbox ── */}
      {activeTab === "inbox" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Incoming cards</Text>
          {inboxLoading ? (
            <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
          ) : inbox.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📬</Text>
              <Text style={styles.emptyTitle}>Empty inbox</Text>
              <Text style={styles.emptyText}>Nothing pending right now.</Text>
            </View>
          ) : (
            inbox.map((tr) => (
              <InboxCard
                key={tr.id}
                transfer={tr}
                onAccept={() => acceptMut.mutate(tr.id)}
                onDecline={() => declineMut.mutate(tr.id)}
                accepting={acceptMut.isPending}
                declining={declineMut.isPending}
              />
            ))
          )}
        </View>
      )}

      {/* ── Send / Return card ── */}
      {activeTab === "send" && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isEmployee ? "Choose a card to return to an admin" : "Choose a card to send to an employee"}
            </Text>

            {catalogLoading ? (
              <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
            ) : activeCards.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎴</Text>
                <Text style={styles.emptyTitle}>No card types yet</Text>
                <Text style={styles.emptyText}>
                  {isAdmin
                    ? "Create card types in Reward Cards management."
                    : "Your admin hasn't set up any reward cards yet."}
                </Text>
              </View>
            ) : (
              <View style={styles.cardGrid}>
                {activeCards.map((card) => {
                  const sel = selectedCard?.id === card.id;
                  return (
                    <Pressable
                      key={card.id}
                      style={[styles.cardChip, sel && styles.cardChipSelected, { borderColor: sel ? card.color : "transparent" }]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedCard(sel ? null : card); }}
                    >
                      <View style={[styles.cardChipEmoji, { backgroundColor: card.color + "22" }]}>
                        <Text style={styles.cardChipEmojiText}>{card.emoji}</Text>
                      </View>
                      <Text style={[styles.cardChipName, sel && { color: card.color }]} numberOfLines={2}>
                        {card.name}
                      </Text>
                      {sel && (
                        <View style={styles.cardChipCheck}>
                          <Ionicons name="checkmark-circle" size={16} color={card.color} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {selectedCard && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isEmployee ? "Send to which admin?" : "Send to which employee?"}
              </Text>
              {targetsLoading ? (
                <ActivityIndicator color={brand.green} />
              ) : targets.length === 0 ? (
                <Text style={styles.emptyText}>No recipients found</Text>
              ) : (
                targets.map((t) => {
                  const sel = selectedTarget?.id === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.targetRow, sel && styles.targetRowSelected]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedTarget(sel ? null : t); }}
                    >
                      <View style={styles.targetAvatar}>
                        <Text style={styles.targetAvatarText}>{t.fullName?.[0]?.toUpperCase() ?? "?"}</Text>
                      </View>
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

          {selectedCard && selectedTarget && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Note (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="Add a message..."
                placeholderTextColor={brand.textMuted}
                maxLength={200}
                returnKeyType="done"
              />
            </View>
          )}

          {selectedCard && selectedTarget && (
            <View style={[styles.sendSummary, { borderColor: selectedCard.color + "44", backgroundColor: selectedCard.color + "0D" }]}>
              <Text style={styles.sendSummaryEmoji}>{selectedCard.emoji}</Text>
              <Text style={[styles.sendSummaryText, { color: selectedCard.color }]}>
                Sending <Text style={{ fontFamily: "Inter_700Bold" }}>"{selectedCard.name}"</Text> to {selectedTarget.fullName}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: selectedCard ? selectedCard.color : brand.border },
              (!selectedCard || !selectedTarget || sendLoading) && styles.sendBtnDisabled,
              pressed && selectedCard && selectedTarget && { opacity: 0.85 },
            ]}
            onPress={handleSend}
            disabled={!selectedCard || !selectedTarget || sendLoading}
          >
            {sendLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.sendBtnEmoji}>{selectedCard?.emoji ?? "🎫"}</Text>
                <Text style={styles.sendBtnText}>
                  {isEmployee ? "Return Card" : "Send Card"}
                </Text>
              </>
            )}
          </Pressable>
        </>
      )}

      {/* ── History / Sent ── */}
      {activeTab === "sent" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>History</Text>
          {sentLoading ? (
            <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
          ) : sent.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Nothing sent yet</Text>
            </View>
          ) : (
            sent.map((tr) => (
              <SentCard key={tr.id} transfer={tr} onRecall={() => recallMut.mutate(tr.id)} recalling={recallMut.isPending} />
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function StatusBadge({ status, color }: { status: Transfer["status"]; color?: string }) {
  const cfg = {
    pending: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
    accepted: { bg: "#D1FAE5", text: "#065F46", label: "Accepted" },
    used: { bg: "#EDE9FE", text: "#5B21B6", label: "Used" },
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

function WalletCard({ transfer, onUse, using }: { transfer: Transfer; onUse: () => void; using: boolean }) {
  return (
    <View style={[cStyles.card, { borderLeftWidth: 4, borderLeftColor: transfer.card.color }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.emojiBox, { backgroundColor: transfer.card.color + "1A" }]}>
          <Text style={cStyles.emoji}>{transfer.card.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cStyles.name}>{transfer.card.name}</Text>
          {transfer.card.description ? (
            <Text style={cStyles.desc} numberOfLines={2}>{transfer.card.description}</Text>
          ) : null}
          <Text style={cStyles.meta}>From: {transfer.fromUser?.fullName ?? "—"}</Text>
        </View>
      </View>
      <Pressable
        style={[cStyles.useBtn, { backgroundColor: transfer.card.color }, using && { opacity: 0.6 }]}
        onPress={onUse}
        disabled={using}
      >
        {using ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={cStyles.useBtnText}>Mark as Used</Text>
        )}
      </Pressable>
    </View>
  );
}

function InboxCard({
  transfer, onAccept, onDecline, accepting, declining,
}: {
  transfer: Transfer; onAccept: () => void; onDecline: () => void; accepting: boolean; declining: boolean;
}) {
  return (
    <View style={[cStyles.card, { borderLeftWidth: 4, borderLeftColor: transfer.card.color }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.emojiBox, { backgroundColor: transfer.card.color + "1A" }]}>
          <Text style={cStyles.emoji}>{transfer.card.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cStyles.name}>{transfer.card.name}</Text>
          {transfer.card.description ? (
            <Text style={cStyles.desc} numberOfLines={1}>{transfer.card.description}</Text>
          ) : null}
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
    <View style={[cStyles.card, { borderLeftWidth: 4, borderLeftColor: transfer.card.color }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.emojiBox, { backgroundColor: transfer.card.color + "1A" }]}>
          <Text style={cStyles.emoji}>{transfer.card.emoji}</Text>
        </View>
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
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emojiBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
  useBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  useBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: brand.white, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: brand.textMuted },
  tabBtnTextActive: { color: brand.navy, fontFamily: "Inter_600SemiBold" },
  section: { gap: 10 },
  sectionLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardChip: {
    width: "47%",
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    position: "relative",
  },
  cardChipSelected: { backgroundColor: brand.white },
  cardChipEmoji: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardChipEmojiText: { fontSize: 26 },
  cardChipName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: brand.text, textAlign: "center" },
  cardChipCheck: { position: "absolute", top: 6, right: 6 },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  targetRowSelected: { borderColor: brand.green, backgroundColor: "rgba(46,125,50,0.05)" },
  targetAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: brand.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  targetAvatarText: { color: brand.white, fontFamily: "Inter_700Bold", fontSize: 15 },
  targetName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: brand.text },
  targetUsername: { fontFamily: "Inter_400Regular", fontSize: 12, color: brand.textMuted },
  sendSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  sendSummaryEmoji: { fontSize: 22 },
  sendSummaryText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, lineHeight: 19 },
  textInput: {
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    borderWidth: 1,
    borderColor: brand.border,
  },
  sendBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sendBtnDisabled: { backgroundColor: brand.border },
  sendBtnEmoji: { fontSize: 18 },
  sendBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 36 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: brand.text },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: brand.textMuted, textAlign: "center", lineHeight: 19 },
});
