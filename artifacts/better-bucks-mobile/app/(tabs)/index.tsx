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
  ToastAndroid,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
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

  const { data, isLoading, isFetching, isFromCache, cachedAt, isOffline, refetch } =
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

  const handleRefresh = useCallback(async () => {
    if (isOffline) {
      if (Platform.OS === "android") {
        ToastAndroid.show("You're offline. Pull-to-refresh is unavailable.", ToastAndroid.SHORT);
      } else {
        Alert.alert("You're Offline", "Pull-to-refresh is unavailable without a network connection.");
      }
      return;
    }
    await Promise.all([refetch(), refetchSummary()]);
  }, [isOffline, refetch, refetchSummary]);

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
            refreshing={!isOffline && isFetching}
            onRefresh={handleRefresh}
            tintColor={brand.green}
          />
        }
      >
        {/* Offline banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={brand.danger} />
            <Text style={styles.offlineBannerText}>
              You're offline — pull-to-refresh is unavailable
            </Text>
          </View>
        )}

        <View style={styles.greeting}>
          <Text style={styles.greetingText}>
            Hello, {user?.fullName?.split(" ")[0] ?? "there"} 👋
          </Text>
        </View>

        {/* Balance card — employees only; admins see org stats below */}
        {!admin && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardChip}>
              <Ionicons name="cash-outline" size={14} color={brand.green} />
              <Text style={styles.balanceLabel}>BetterBucks Balance</Text>
            </View>
            {isLoading ? (
              <ActivityIndicator color={brand.white} size="large" style={{ marginVertical: 12 }} />
            ) : (
              <Text style={styles.balanceAmount}>
                {(data?.balance ?? 0).toLocaleString()}
              </Text>
            )}
            <View style={styles.balanceDivider} />
            {isOffline && isFromCache && cachedAt !== null ? (
              <View style={styles.offlineBadgeRow}>
                <Ionicons name="cloud-offline-outline" size={12} color="#FCA5A5" />
                <Text style={styles.offlineBadgeText}>Offline – showing saved balance</Text>
              </View>
            ) : isFromCache && cachedAt !== null ? (
              <Text style={styles.cachedLabel}>
                Last updated {formatLastUpdated(cachedAt)}
              </Text>
            ) : (
              <Text style={styles.cachedLabel}> </Text>
            )}
          </View>
        )}

        {/* Monthly earned/spent summary — employees only */}
        {isEmployee && summary && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryBarLabel}>
              {new Date().toLocaleString("default", { month: "long" })} summary
            </Text>
            <View style={styles.summaryBarRow}>
              <View style={styles.summaryBarItem}>
                <Ionicons name="arrow-down-circle" size={18} color={brand.green} />
                <View>
                  <Text style={styles.summaryBarItemLabel}>Earned</Text>
                  <Text style={[styles.summaryBarItemValue, { color: brand.green }]}>
                    {summary.earned.toLocaleString()} Bucks
                  </Text>
                </View>
              </View>
              <View style={styles.summaryBarDivider} />
              <View style={styles.summaryBarItem}>
                <Ionicons name="arrow-up-circle" size={18} color={brand.danger} />
                <View>
                  <Text style={styles.summaryBarItemLabel}>Spent</Text>
                  <Text style={[styles.summaryBarItemValue, { color: brand.danger }]}>
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
                <Ionicons name="checkmark-circle" size={16} color={brand.green} />
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
                <ActivityIndicator color={passAddedAt ? brand.green : brand.white} size="small" />
              ) : (
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={passAddedAt ? brand.green : brand.white}
                />
              )}
              <Text style={[styles.walletButtonText, passAddedAt ? styles.walletButtonTextUpdate : null]}>
                {walletLoading ? "Downloading…" : passAddedAt ? "Update Pass" : "Add to Wallet"}
              </Text>
            </Pressable>
            {passAddedAt && !showConfirmation && (
              <View style={styles.passStatusRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color={brand.green} />
                <Text style={styles.passStatusText}>Added on {formatPassDate(passAddedAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Admin org dashboard */}
        {admin && data?.adminStats && (
          <>
            <View style={styles.adminDashCard}>
              <View style={styles.adminDashHeader}>
                <Ionicons name="bar-chart-outline" size={16} color={brand.navy} />
                <Text style={styles.adminDashTitle}>Organization Overview</Text>
                {(isFromCache && cachedAt !== null) ? (
                  <Text style={styles.adminDashCached}>· {formatLastUpdated(cachedAt)}</Text>
                ) : null}
              </View>
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
            </View>
          </>
        )}

        {/* Admin Tools */}
        {admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Tools</Text>
            <View style={adminToolStyles.grid}>
              {ADMIN_TOOLS.map((tool) => (
                <AdminToolCard key={tool.route} {...tool} />
              ))}
            </View>
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
              <Ionicons name="chevron-forward" size={14} color={brand.green} />
            </Pressable>
          </View>
        )}

        {!isLoading && (data?.recentTransactions ?? []).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={brand.textMuted} />
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
        color={accent ? brand.warning : brand.green}
      />
      <Text style={[statStyles.value, accent ? { color: brand.warning } : null]}>
        {value}
      </Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: brand.white,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: brand.border,
  },
  value: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
  },
  label: {
    color: brand.textSecondary,
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
    backgroundColor: brand.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  reward: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  progressBg: {
    height: 6,
    backgroundColor: brand.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: brand.green,
    borderRadius: 3,
  },
  progressText: {
    color: brand.textMuted,
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

const ADMIN_TOOLS: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route: string;
}[] = [
  { icon: "people-outline", label: "Pending Accounts", route: "/admin/pending" },
  { icon: "trophy-outline", label: "Goals", route: "/admin/goals" },
  { icon: "document-text-outline", label: "Surveys", route: "/admin/surveys" },
  { icon: "storefront-outline", label: "Store Items", route: "/admin/store-items" },
  { icon: "settings-outline", label: "Organization Settings", route: "/admin/org-settings" },
];

function AdminToolCard({
  icon,
  label,
  route,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        adminToolStyles.card,
        pressed && { opacity: 0.8 },
      ]}
      onPress={() => router.push(route as any)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={adminToolStyles.iconWrap}>
        <Ionicons name={icon} size={22} color={brand.green} />
      </View>
      <Text style={adminToolStyles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const adminToolStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "47.5%",
    backgroundColor: brand.navy,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(46,125,50,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
});

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
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
  root: { flex: 1, backgroundColor: brand.white },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 0,
  },
  greeting: {
    marginBottom: 20,
  },
  greetingText: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  // Wallet balance card — dark navy per spec
  balanceCard: {
    backgroundColor: brand.navyCard,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  balanceCardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  balanceLabel: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  balanceAmount: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    lineHeight: 52,
  },
  balanceDivider: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 12,
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
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(198,40,40,0.08)",
    borderWidth: 1,
    borderColor: "rgba(198,40,40,0.20)",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 16,
  },
  offlineBannerText: {
    color: brand.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  offlineBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  offlineBadgeText: {
    color: "#FCA5A5",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  summaryBar: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  summaryBarLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryBarItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryBarItemLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  summaryBarItemValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  summaryBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: brand.border,
    marginHorizontal: 12,
  },
  walletSection: {
    marginBottom: 20,
    gap: 8,
  },
  confirmationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.20)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  confirmationText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.green,
    borderRadius: 10,
    paddingVertical: 14,
  },
  walletButtonUpdate: {
    backgroundColor: brand.white,
    borderWidth: 1.5,
    borderColor: brand.green,
  },
  walletButtonText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  walletButtonTextUpdate: {
    color: brand.green,
  },
  passStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  passStatusText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  adminDashCard: {
    backgroundColor: brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: brand.border,
  },
  adminDashHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adminDashTitle: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  adminDashCached: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
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
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  viewAllLink: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 14,
  },
  viewAllButtonText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
});
