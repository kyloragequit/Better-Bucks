import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Transaction = {
  id: number;
  amount: number;
  reason: string | null;
  createdAt: string;
};

type Goal = {
  id: number;
  name: string;
  type: string;
  targetQuantity: number | null;
  currentQuantity: number | null;
  bucksReward: number;
  deadline: string | null;
};

type DashboardData = {
  balance: number;
  recentTransactions: Transaction[];
  activeGoals: Goal[];
  adminStats: {
    totalEmployees: number;
    pendingOrdersCount: number;
    totalBucksGiven: number;
  } | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomeTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["mobile-dashboard", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/dashboard"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const admin = user?.role === "admin" || user?.role === "prime_admin";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
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
      </View>

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
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {data!.recentTransactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </View>
      )}

      {!isLoading && (data?.recentTransactions ?? []).length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No activity yet</Text>
        </View>
      )}
    </ScrollView>
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
    <View style={txStyles.row}>
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
    </View>
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
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
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
});
