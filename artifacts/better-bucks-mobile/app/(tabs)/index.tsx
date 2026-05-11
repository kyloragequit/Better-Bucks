import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { OnboardingModal } from "@/components/OnboardingModal";
import { File as EFSFile, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useDashboardData, type Goal, type Transaction } from "@/hooks/useDashboardData";

type MonthlySummary = {
  earned: number;
  spent: number;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function walletStorageKey(userId: number | string) {
  return `wallet_pass_added_at_${userId}`;
}

function formatPassDate(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatLastUpdated(cachedAt: number): string {
  const diffMs = Date.now() - cachedAt;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

export default function HomeTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { visible: onboardingVisible, dismiss: dismissOnboarding } = useOnboarding();
  const [walletLoading, setWalletLoading] = useState(false);
  const [passAddedAt, setPassAddedAt] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEmployee = user?.role === "employee";
  const admin = user?.role === "admin" || user?.role === "prime_admin";

  const { data, isLoading, isFetching, isFromCache, cachedAt, refetch } =
    useDashboardData(token, user?.id ?? null);

  const { data: summary, refetch: refetchSummary } = useQuery<MonthlySummary>({
    queryKey: ["mobile-monthly-summary", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/summary"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    enabled: !!token && isEmployee,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) {
      setPassAddedAt(null);
      return;
    }
    AsyncStorage.getItem(walletStorageKey(user.id)).then((val) => {
      setPassAddedAt(val ?? null);
    });
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  async function handleAddToWallet() {
    if (!token) return;
    setWalletLoading(true);
    try {
      if (Platform.OS === "android") {
        const res = await fetch(apiUrl("/api/mobile/wallet-pass/android"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          Alert.alert(
            "Google Wallet",
            (body as any)?.message ?? "Could not generate your wallet pass. Please try again.",
          );
          return;
        }
        const { saveUrl } = (await res.json()) as { saveUrl: string };
        await Linking.openURL(saveUrl);
      } else {
        const url = apiUrl("/api/mobile/wallet-pass");
        const destFile = new EFSFile(Paths.cache, "betterbucks.pkpass");
        const downloaded = await EFSFile.downloadFileAsync(url, destFile, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!downloaded.exists) {
          Alert.alert("Apple Wallet", "Could not download your wallet pass. Please try again.");
          return;
        }
        await Linking.openURL(downloaded.uri);
      }
      const now = new Date().toISOString();
      setPassAddedAt(now);
      if (user?.id) {
        AsyncStorage.setItem(walletStorageKey(user.id), now).catch(() => {});
      }
      setShowConfirmation(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setShowConfirmation(false), 4000);
    } catch {
      Alert.alert("Wallet Pass", "Something went wrong. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([refetch(), refetchSummary()]);
  }

  return (
    <>
      <OnboardingModal
        visible={onboardingVisible}
        onDismiss={dismissOnboarding}
      />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            tintColor={brand.gold}
          />
        }
      >
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>
            Hello, {user?.fullName?.split(" ")[0] ?? "there"} 👋
          </Text>
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {admin ? "Your Bucks Balance" : "Your Balance"}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={brand.gold} size="large" style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.balanceAmount}>
              {(data?.balance ?? 0).toLocaleString()}
            </Text>
          )}
          <Text style={styles.balanceUnit}>Bucks</Text>
          {isFromCache && cachedAt !== null && (
            <Text style={styles.cachedLabel}>
              Last updated {formatLastUpdated(cachedAt)}
            </Text>
          )}
        </View>

        {/* Monthly earned/spent summary — employees only */}
        {isEmployee && summary && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryBarLabel}>
              {new Date().toLocaleString("default", { month: "long" })} summary
            </Text>
            <View style={styles.summaryBarRow}>
              <View style={styles.summaryBarItem}>
                <Ionicons name="arrow-down-circle" size={18} color="#4ADE80" />
                <View>
                  <Text style={styles.summaryBarItemLabel}>Earned</Text>
                  <Text style={[styles.summaryBarItemValue, { color: "#4ADE80" }]}>
                    {summary.earned.toLocaleString()} Bucks
                  </Text>
                </View>
              </View>
              <View style={styles.summaryBarDivider} />
              <View style={styles.summaryBarItem}>
                <Ionicons name="arrow-up-circle" size={18} color="#FCA5A5" />
                <View>
                  <Text style={styles.summaryBarItemLabel}>Spent</Text>
                  <Text style={[styles.summaryBarItemValue, { color: "#FCA5A5" }]}>
                    {summary.spent.toLocaleString()} Bucks
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Wallet pass section — employees only */}
        {isEmployee && (
          <View style={styles.walletSection}>
            {showConfirmation && (
              <View style={styles.confirmationBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                <Text style={styles.confirmationText}>Pass Added! Open the Wallet app to view your Bucks card.</Text>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.walletButton,
                passAddedAt ? styles.walletButtonUpdate : null,
                pressed && { opacity: 0.75 },
                walletLoading && { opacity: 0.6 },
              ]}
              onPress={handleAddToWallet}
              disabled={walletLoading}
              accessibilityLabel={passAddedAt ? "Re-download Bucks card to Wallet" : "Add to Apple Wallet"}
              accessibilityRole="button"
            >
              {walletLoading ? (
                <ActivityIndicator color={passAddedAt ? brand.gold : brand.navy} size="small" />
              ) : (
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={passAddedAt ? brand.gold : brand.navy}
                />
              )}
              <Text style={[styles.walletButtonText, passAddedAt ? styles.walletButtonTextUpdate : null]}>
                {walletLoading ? "Downloading…" : passAddedAt ? "Update Pass" : "Add to Wallet"}
              </Text>
            </Pressable>
            {passAddedAt && !showConfirmation && (
              <View style={styles.passStatusRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#4ADE80" />
                <Text style={styles.passStatusText}>Added on {formatPassDate(passAddedAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Admin stats */}
        {admin && data?.adminStats && (
          <View style={styles.statsRow}>
            <StatCard
              icon="people"
              label="Employees"
              value={String(data.adminStats.totalEmployees)}
            />
            <StatCard
              icon="time"
              label="Pending Orders"
              value={String(data.adminStats.pendingOrdersCount)}
              accent={data.adminStats.pendingOrdersCount > 0}
            />
            <StatCard
              icon="trending-up"
              label="Bucks Given"
              value={(data.adminStats.totalBucksGiven ?? 0).toLocaleString()}
            />
          </View>
        )}

        {/* Active goals */}
        {(data?.activeGoals ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Goals</Text>
            {data!.activeGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </View>
        )}

        {/* Recent transactions */}
        {(data?.recentTransactions ?? []).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <Pressable
                onPress={() => router.push("/transaction/history")}
                accessibilityRole="button"
                accessibilityLabel="View all transactions"
                hitSlop={8}
              >
                <Text style={styles.viewAllLink}>View all</Text>
              </Pressable>
            </View>
            {data!.recentTransactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
            <Pressable
              style={({ pressed }) => [styles.viewAllButton, pressed && { opacity: 0.75 }]}
              onPress={() => router.push("/transaction/history")}
              accessibilityRole="button"
              accessibilityLabel="View full transaction history"
            >
              <Text style={styles.viewAllButtonText}>View Full History</Text>
              <Ionicons name="chevron-forward" size={14} color={brand.gold} />
            </Pressable>
          </View>
        )}

        {!isLoading && (data?.recentTransactions ?? []).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No activity yet</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={statStyles.card}>
      <Ionicons
        name={icon}
        size={20}
        color={accent ? brand.gold : "rgba(255,255,255,0.6)"}
      />
      <Text style={[statStyles.value, accent ? { color: brand.gold } : null]}>
        {value}
      </Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  value: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
  },
});

function GoalCard({ goal }: { goal: Goal }) {
  const progress =
    goal.type === "quantity" && goal.targetQuantity
      ? Math.min((goal.currentQuantity ?? 0) / goal.targetQuantity, 1)
      : null;

  return (
    <View style={goalStyles.card}>
      <View style={goalStyles.header}>
        <Text style={goalStyles.name}>{goal.name}</Text>
        <Text style={goalStyles.reward}>+{goal.bucksReward} Bucks</Text>
      </View>
      {progress !== null && (
        <View style={goalStyles.progressBg}>
          <View style={[goalStyles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
      {goal.type === "quantity" && goal.targetQuantity != null && (
        <Text style={goalStyles.progressText}>
          {goal.currentQuantity ?? 0} / {goal.targetQuantity}
        </Text>
      )}
    </View>
  );
}

const goalStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  reward: {
    color: brand.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  progressBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: brand.green,
    borderRadius: 3,
  },
  progressText: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});

function TransactionRow({ tx }: { tx: Transaction }) {
  const positive = tx.amount > 0;
  return (
    <Pressable
      style={({ pressed }) => [txStyles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${tx.reason ?? "transaction"}`}
    >
      <View
        style={[
          txStyles.icon,
          { backgroundColor: positive ? "rgba(78,159,61,0.15)" : "rgba(220,38,38,0.12)" },
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
      <Text style={[txStyles.amount, { color: positive ? brand.green : "#FCA5A5" }]}>
        {positive ? "+" : ""}
        {tx.amount.toLocaleString()}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
    </Pressable>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
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
    color: brand.white,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  date: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  amount: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.navy },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 0,
  },
  greeting: {
    marginBottom: 20,
  },
  greetingText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  balanceCard: {
    backgroundColor: brand.navyLight,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: brand.gold,
    fontFamily: "Inter_700Bold",
    fontSize: 52,
    lineHeight: 60,
  },
  balanceUnit: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  cachedLabel: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 6,
  },
  walletSection: {
    marginBottom: 20,
    gap: 8,
  },
  confirmationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  confirmationText: {
    color: "#4ADE80",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.gold,
    borderRadius: 14,
    paddingVertical: 14,
  },
  walletButtonUpdate: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: brand.gold,
  },
  walletButtonText: {
    color: brand.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  walletButtonTextUpdate: {
    color: brand.gold,
  },
  passStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  passStatusText: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  viewAllLink: {
    color: brand.gold,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  viewAllButtonText: {
    color: brand.gold,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  summaryBar: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  summaryBarLabel: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryBarItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryBarDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 12,
  },
  summaryBarItemLabel: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginBottom: 2,
  },
  summaryBarItemValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
