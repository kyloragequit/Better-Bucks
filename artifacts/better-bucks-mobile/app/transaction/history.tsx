import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 20;

type TxItem = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reason: string;
  performedByName: string | null;
  createdAt: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TransactionHistoryScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<TxItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (nextOffset: number) => {
      if (!token) return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const url = apiUrl(
          `/api/mobile/transactions?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        );
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = (await res.json()) as {
          transactions: TxItem[];
          total: number;
          offset: number;
          limit: number;
        };
        setTotal(data.total);
        setItems((prev) =>
          nextOffset === 0 ? data.transactions : [...prev, ...data.transactions],
        );
        setOffset(nextOffset + data.transactions.length);
      } catch {
        setError("Could not load transaction history. Pull down to retry.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadPage(0);
  }, []);

  const loadMore = useCallback(() => {
    if (total !== null && offset >= total) return;
    loadPage(offset);
  }, [loadPage, offset, total]);

  const handleRefresh = useCallback(async () => {
    setItems([]);
    setOffset(0);
    setTotal(null);
    setInitialLoading(true);
    await loadPage(0);
  }, [token]);

  if (initialLoading) {
    return (
      <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
        <Ionicons name="alert-circle-outline" size={40} color={brand.textMuted} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Retry loading transactions"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const hasMore = total === null || offset < total;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionRow tx={item} />}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.3}
      onRefresh={handleRefresh}
      refreshing={initialLoading}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Transaction History</Text>
          {total !== null && (
            <Text style={styles.headerSubtitle}>{total} total transactions</Text>
          )}
        </View>
      }
      ListFooterComponent={
        loading && !initialLoading ? (
          <View style={styles.footer}>
            <ActivityIndicator color={brand.green} size="small" />
          </View>
        ) : !hasMore && items.length > 0 ? (
          <Text style={styles.endText}>All transactions loaded</Text>
        ) : null
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={brand.textMuted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : null
      }
    />
  );
}

function TransactionRow({ tx }: { tx: TxItem }) {
  const positive = tx.amount > 0;

  function handlePress() {
    router.push({ pathname: "/transaction/[id]", params: { id: tx.id } });
  }

  return (
    <Pressable
      style={({ pressed }) => [txStyles.row, pressed && { opacity: 0.7 }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${tx.reason ?? "transaction"}, ${positive ? "+" : ""}${tx.amount.toLocaleString()} Bucks`}
    >
      <View
        style={[
          txStyles.icon,
          { backgroundColor: positive ? "rgba(46,125,50,0.10)" : "rgba(198,40,40,0.08)" },
        ]}
      >
        <Ionicons
          name={positive ? "arrow-down" : "arrow-up"}
          size={16}
          color={positive ? brand.green : brand.danger}
        />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.reason} numberOfLines={1}>
          {tx.reason ?? "Transaction"}
        </Text>
        <Text style={txStyles.date}>{formatDate(tx.createdAt)}</Text>
      </View>
      <Text style={[txStyles.amount, { color: positive ? brand.green : brand.danger }]}>
        {positive ? "+" : ""}
        {tx.amount.toLocaleString()}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={brand.textMuted} />
    </Pressable>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  reason: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  date: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  amount: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  headerTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  headerSubtitle: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  centered: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  errorText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: brand.green,
    borderRadius: 10,
  },
  retryBtnText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
});
