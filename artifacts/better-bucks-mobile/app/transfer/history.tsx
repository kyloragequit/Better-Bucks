import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Transfer = {
  id: number;
  senderId: number;
  recipientId: number | null;
  amount: number;
  method: "nfc" | "qr" | "direct";
  status: "pending" | "completed" | "declined" | "expired" | "reversed";
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  senderName: string;
  recipientName: string | null;
};

const METHOD_ICON: Record<Transfer["method"], React.ComponentProps<typeof Ionicons>["name"]> = {
  nfc: "radio-outline",
  qr: "qr-code-outline",
  direct: "person-outline",
};

const METHOD_LABEL: Record<Transfer["method"], string> = {
  nfc: "NFC",
  qr: "QR",
  direct: "Direct",
};

const STATUS_CONFIG: Record<
  Transfer["status"],
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: brand.warning },
  completed: { label: "Done", color: brand.green },
  declined: { label: "Declined", color: brand.danger },
  expired: { label: "Expired", color: brand.textMuted },
  reversed: { label: "Reversed", color: brand.textMuted },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TransferRow({ item, myId }: { item: Transfer; myId: number }) {
  const sent = item.senderId === myId;
  const sign = sent ? "-" : "+";
  const amountColor = sent ? brand.danger : brand.green;
  const counterpart = sent
    ? (item.recipientName ?? "Pending recipient")
    : item.senderName;
  const status = STATUS_CONFIG[item.status];

  return (
    <View style={styles.row}>
      <View style={[styles.methodIcon, { backgroundColor: sent ? "rgba(198,40,40,0.08)" : "rgba(46,125,50,0.08)" }]}>
        <Ionicons name={METHOD_ICON[item.method]} size={18} color={sent ? brand.danger : brand.green} />
      </View>

      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.counterpart} numberOfLines={1}>
            {sent ? `To ${counterpart}` : `From ${counterpart}`}
          </Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {sign}{item.amount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.methodLabel}>{METHOD_LABEL[item.method]}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}18` }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {item.note ? (
          <Text style={styles.note} numberOfLines={1}>"{item.note}"</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function TransferHistoryScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery<Transfer[]>({
    queryKey: ["transfer-history", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/transfers/history?limit=100"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load transfer history");
      return res.json();
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const myId = user?.id ?? 0;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={brand.green} size="large" />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <TransferRow item={item} myId={myId} />}
          contentContainerStyle={
            (data ?? []).length === 0
              ? styles.emptyContainer
              : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={brand.green}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="swap-horizontal-outline" size={48} color={brand.textMuted} />
              <Text style={styles.emptyTitle}>No transfers yet</Text>
              <Text style={styles.emptyBody}>
                Send or receive Bucks and your history will appear here.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyState: { alignItems: "center", gap: 12 },
  emptyTitle: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  emptyBody: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    gap: 12,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rowInfo: { flex: 1, gap: 5 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  counterpart: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  amount: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  methodLabel: {
    color: brand.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  dot: { color: brand.textMuted, fontSize: 12 },
  date: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  note: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
  },
  separator: {
    height: 1,
    backgroundColor: brand.border,
  },
});
