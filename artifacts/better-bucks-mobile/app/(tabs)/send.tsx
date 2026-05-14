import {
  ActivityIndicator,
  Alert,
  Image,
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

type StoreItemRow = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
};

type AdminRow = { id: number; fullName: string; username: string };

type TransferRow = {
  id: number;
  itemId: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "declined" | "recalled";
  notes: string | null;
  createdAt: string;
  item: StoreItemRow;
  fromUser?: { id: number; fullName: string; username: string };
  toUser?: { id: number; fullName: string; username: string };
};

type Tab = "send" | "inbox" | "sent";

export default function SendReceiveTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin" || user?.role === "prime_admin";

  const [activeTab, setActiveTab] = useState<Tab>("send");
  const [selectedItem, setSelectedItem] = useState<StoreItemRow | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<AdminRow | null>(null);
  const [note, setNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  // Fetch org's available store items (catalog)
  const { data: catalog = [], isLoading: catalogLoading, refetch: refetchCatalog } = useQuery<StoreItemRow[]>({
    queryKey: ["item-catalog", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/items/catalog"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  // Fetch admins (for employees to send to) or employees (for admins to send to)
  const { data: targets = [], isLoading: targetsLoading } = useQuery<AdminRow[]>({
    queryKey: ["item-targets", token, user?.role],
    queryFn: async () => {
      const endpoint = isEmployee
        ? "/api/mobile/items/admins"
        : "/api/mobile/items/employees";
      const res = await fetch(apiUrl(endpoint), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load targets");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  // Inbox (pending items sent TO me)
  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery<TransferRow[]>({
    queryKey: ["item-inbox", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/items/inbox"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  // Sent items
  const { data: sent = [], isLoading: sentLoading, refetch: refetchSent } = useQuery<TransferRow[]>({
    queryKey: ["item-sent", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/items/sent"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load sent items");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const pendingInboxCount = inbox.filter((t) => t.status === "pending").length;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchCatalog(), refetchInbox(), refetchSent()]);
  }, [refetchCatalog, refetchInbox, refetchSent]);

  async function handleSend() {
    if (!token || !selectedItem || !selectedTarget) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSendLoading(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/items/send"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: selectedItem.id,
          toUserId: selectedTarget.id,
          notes: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Error", (body as any)?.message ?? "Could not send item");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSelectedItem(null);
      setSelectedTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["item-sent", token] });
      qc.invalidateQueries({ queryKey: ["item-inbox", token] });
      Alert.alert("Sent!", `"${selectedItem.name}" was sent to ${selectedTarget.fullName}.`);
    } catch {
      Alert.alert("Error", "Network error — please try again");
    } finally {
      setSendLoading(false);
    }
  }

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/items/${id}/accept`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to accept");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-inbox", token] });
      qc.invalidateQueries({ queryKey: ["item-mine", token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: () => Alert.alert("Error", "Could not accept item"),
  });

  const declineMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/items/${id}/decline`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to decline");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-inbox", token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    },
    onError: () => Alert.alert("Error", "Could not decline item"),
  });

  const recallMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/mobile/items/${id}/recall`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to recall");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-sent", token] });
    },
    onError: () => Alert.alert("Error", "Could not recall item"),
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={brand.green} />
      }
    >
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(["send", "inbox", "sent"] as Tab[]).map((t) => {
          const active = activeTab === t;
          const label = t === "send" ? "Send" : t === "inbox" ? "Inbox" : "Sent";
          return (
            <Pressable
              key={t}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab(t);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                {label}
                {t === "inbox" && pendingInboxCount > 0 ? ` (${pendingInboxCount})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Send tab ── */}
      {activeTab === "send" && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isEmployee ? "Select an item to send to an admin" : "Select an item to send to an employee"}
            </Text>

            {catalogLoading ? (
              <ActivityIndicator color={brand.green} style={{ marginTop: 12 }} />
            ) : catalog.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cube-outline" size={32} color={brand.textMuted} />
                <Text style={styles.emptyText}>
                  No items in your org's catalog yet.
                </Text>
              </View>
            ) : (
              <View style={styles.catalogGrid}>
                {catalog.map((item) => {
                  const selected = selectedItem?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.catalogCard, selected && styles.catalogCardSelected]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelectedItem(selected ? null : item);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.catalogImg} />
                      ) : (
                        <View style={styles.catalogImgPlaceholder}>
                          <Ionicons name="cube-outline" size={28} color={brand.textMuted} />
                        </View>
                      )}
                      <Text style={[styles.catalogName, selected && styles.catalogNameSelected]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {selected && (
                        <View style={styles.catalogCheck}>
                          <Ionicons name="checkmark-circle" size={18} color={brand.green} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {selectedItem && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isEmployee ? "Send to which admin?" : "Send to which employee?"}
              </Text>
              {targetsLoading ? (
                <ActivityIndicator color={brand.green} />
              ) : targets.length === 0 ? (
                <Text style={styles.emptyText}>No targets found</Text>
              ) : (
                targets.map((t) => {
                  const sel = selectedTarget?.id === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.targetRow, sel && styles.targetRowSelected]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelectedTarget(sel ? null : t);
                      }}
                    >
                      <View style={styles.targetAvatar}>
                        <Text style={styles.targetAvatarText}>
                          {t.fullName?.[0]?.toUpperCase() ?? "?"}
                        </Text>
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

          {selectedItem && selectedTarget && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Note (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                placeholderTextColor={brand.textMuted}
                maxLength={200}
                returnKeyType="done"
              />
            </View>
          )}

          {selectedItem && selectedTarget && (
            <View style={styles.sendSummary}>
              <Ionicons name="cube-outline" size={16} color={brand.navy} />
              <Text style={styles.sendSummaryText} numberOfLines={2}>
                Sending <Text style={{ fontFamily: "Inter_600SemiBold" }}>"{selectedItem.name}"</Text> to{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>{selectedTarget.fullName}</Text>
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!selectedItem || !selectedTarget || sendLoading) && styles.sendBtnDisabled,
              pressed && selectedItem && selectedTarget && { opacity: 0.85 },
            ]}
            onPress={handleSend}
            disabled={!selectedItem || !selectedTarget || sendLoading}
            accessibilityRole="button"
            accessibilityLabel="Send item"
          >
            {sendLoading ? (
              <ActivityIndicator color={brand.white} size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color={brand.white} />
                <Text style={styles.sendBtnText}>Send Item</Text>
              </>
            )}
          </Pressable>
        </>
      )}

      {/* ── Inbox tab ── */}
      {activeTab === "inbox" && (
        <View style={styles.section}>
          {inboxLoading ? (
            <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
          ) : inbox.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="mail-open-outline" size={40} color={brand.textMuted} />
              <Text style={styles.emptyText}>No incoming items</Text>
            </View>
          ) : (
            inbox.map((tr) => (
              <InboxCard
                key={tr.id}
                transfer={tr}
                onAccept={() => acceptMutation.mutate(tr.id)}
                onDecline={() => declineMutation.mutate(tr.id)}
                accepting={acceptMutation.isPending}
                declining={declineMutation.isPending}
              />
            ))
          )}
        </View>
      )}

      {/* ── Sent tab ── */}
      {activeTab === "sent" && (
        <View style={styles.section}>
          {sentLoading ? (
            <ActivityIndicator color={brand.green} style={{ marginTop: 20 }} />
          ) : sent.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="paper-plane-outline" size={40} color={brand.textMuted} />
              <Text style={styles.emptyText}>No sent items yet</Text>
            </View>
          ) : (
            sent.map((tr) => (
              <SentCard
                key={tr.id}
                transfer={tr}
                onRecall={() => recallMutation.mutate(tr.id)}
                recalling={recallMutation.isPending}
              />
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: TransferRow["status"] }) {
  const config = {
    pending: { color: "#F59E0B", bg: "#FEF3C7", label: "Pending" },
    accepted: { color: brand.green, bg: "#D1FAE5", label: "Accepted" },
    declined: { color: brand.danger, bg: "#FEE2E2", label: "Declined" },
    recalled: { color: brand.textMuted, bg: brand.offWhite, label: "Recalled" },
  }[status];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.bg }]}>
      <Text style={[badgeStyles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

function InboxCard({
  transfer,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  transfer: TransferRow;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <View style={cardStyles.iconBox}>
          {transfer.item.imageUrl ? (
            <Image source={{ uri: transfer.item.imageUrl }} style={cardStyles.itemImg} />
          ) : (
            <Ionicons name="cube-outline" size={22} color={brand.navy} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.itemName}>{transfer.item.name}</Text>
          <Text style={cardStyles.meta}>
            From: {transfer.fromUser?.fullName ?? "—"}
          </Text>
          {transfer.notes ? (
            <Text style={cardStyles.note} numberOfLines={2}>"{transfer.notes}"</Text>
          ) : null}
        </View>
        <StatusBadge status={transfer.status} />
      </View>
      {transfer.status === "pending" && (
        <View style={cardStyles.actionRow}>
          <Pressable
            style={[cardStyles.acceptBtn, accepting && { opacity: 0.6 }]}
            onPress={onAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color={brand.white} />
            ) : (
              <Text style={cardStyles.acceptText}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            style={[cardStyles.declineBtn, declining && { opacity: 0.6 }]}
            onPress={onDecline}
            disabled={declining}
          >
            {declining ? (
              <ActivityIndicator size="small" color={brand.danger} />
            ) : (
              <Text style={cardStyles.declineText}>Decline</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SentCard({
  transfer,
  onRecall,
  recalling,
}: {
  transfer: TransferRow;
  onRecall: () => void;
  recalling: boolean;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <View style={cardStyles.iconBox}>
          {transfer.item.imageUrl ? (
            <Image source={{ uri: transfer.item.imageUrl }} style={cardStyles.itemImg} />
          ) : (
            <Ionicons name="cube-outline" size={22} color={brand.navy} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.itemName}>{transfer.item.name}</Text>
          <Text style={cardStyles.meta}>
            To: {transfer.toUser?.fullName ?? "—"}
          </Text>
          {transfer.notes ? (
            <Text style={cardStyles.note} numberOfLines={2}>"{transfer.notes}"</Text>
          ) : null}
        </View>
        <StatusBadge status={transfer.status} />
      </View>
      {transfer.status === "pending" && (
        <View style={cardStyles.actionRow}>
          <Pressable
            style={[cardStyles.declineBtn, recalling && { opacity: 0.6 }]}
            onPress={onRecall}
            disabled={recalling}
          >
            {recalling ? (
              <ActivityIndicator size="small" color={brand.danger} />
            ) : (
              <Text style={cardStyles.declineText}>Recall</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: brand.offWhite,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemImg: { width: 44, height: 44, borderRadius: 10 },
  itemName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: brand.text,
    marginBottom: 2,
  },
  meta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: brand.textSecondary,
  },
  note: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: brand.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: brand.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: brand.white,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: brand.border,
  },
  declineText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: brand.danger,
  },
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
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: brand.white, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: brand.textMuted },
  tabBtnTextActive: { color: brand.navy, fontFamily: "Inter_600SemiBold" },
  section: { gap: 10 },
  sectionLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catalogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catalogCard: {
    width: "47%",
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  catalogCardSelected: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.05)",
  },
  catalogImg: { width: 64, height: 64, borderRadius: 8 },
  catalogImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogName: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: brand.text,
    textAlign: "center",
  },
  catalogNameSelected: { color: brand.navy, fontFamily: "Inter_600SemiBold" },
  catalogCheck: {
    position: "absolute",
    top: 6,
    right: 6,
  },
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
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(26,35,126,0.05)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(26,35,126,0.1)",
  },
  sendSummaryText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: brand.navy,
    flex: 1,
    lineHeight: 19,
  },
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
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sendBtnDisabled: { backgroundColor: brand.border },
  sendBtnText: { color: brand.white, fontFamily: "Inter_700Bold", fontSize: 16 },
  emptyBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: brand.textMuted,
    textAlign: "center",
  },
});
