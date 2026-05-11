import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type TransactionDetail = {
  id: number;
  amount: number;
  reason: string;
  type: "credit" | "debit";
  createdAt: string;
  performedByName: string | null;
  merchantName?: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const isMerchant = typeof id === "string" && id.startsWith("mt-");
  const numericId = typeof id === "string" && id.startsWith("tx-")
    ? id.slice(3)
    : typeof id === "string" && id.startsWith("mt-")
      ? id.slice(3)
      : id;
  const apiPath = isMerchant
    ? `/api/mobile/merchant-transactions/${numericId}`
    : `/api/mobile/transactions/${numericId}`;

  const { data, isLoading, isError } = useQuery<TransactionDetail>({
    queryKey: ["transaction-detail", id],
    queryFn: async () => {
      const res = await fetch(apiUrl(apiPath), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load transaction");
      return res.json();
    },
    enabled: !!token && !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={brand.textMuted} />
        <Text style={styles.errorText}>Could not load transaction</Text>
      </View>
    );
  }

  const positive = data.amount >= 0;
  const iconName = positive ? "arrow-down-circle" : "arrow-up-circle";
  const iconColor = positive ? brand.green : brand.danger;
  const iconBg = positive ? "rgba(46,125,50,0.10)" : "rgba(198,40,40,0.08)";
  const amountLabel = positive
    ? `+${data.amount.toLocaleString()} Bucks`
    : `${data.amount.toLocaleString()} Bucks`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* Amount hero */}
      <View style={[styles.heroIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={48} color={iconColor} />
      </View>
      <Text style={[styles.heroAmount, { color: positive ? brand.green : brand.danger }]}>
        {amountLabel}
      </Text>
      <Text style={styles.heroType}>
        {positive ? "Bucks Received" : "Bucks Spent"}
      </Text>

      {/* Detail rows */}
      <View style={styles.card}>
        {data.merchantName ? (
          <DetailRow icon="storefront-outline" label="Merchant" value={data.merchantName} />
        ) : (
          <DetailRow icon="document-text-outline" label="Reason" value={data.reason || "No reason provided"} />
        )}

        <DetailRow
          icon="calendar-outline"
          label="Date"
          value={`${formatDate(data.createdAt)} at ${formatTime(data.createdAt)}`}
        />

        {data.performedByName ? (
          <DetailRow icon="person-outline" label="Awarded by" value={data.performedByName} />
        ) : null}

        {data.categoryName ? (
          <DetailRow
            icon="pricetag-outline"
            label="Category"
            value={data.categoryName}
            accentColor={data.categoryColor ?? undefined}
          />
        ) : null}

        <DetailRow
          icon="receipt-outline"
          label="Transaction ID"
          value={`#${data.id}`}
          subtle
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  accentColor,
  subtle,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  accentColor?: string;
  subtle?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={brand.textMuted} />
      </View>
      <View style={rowStyles.body}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text
          style={[
            rowStyles.value,
            accentColor ? { color: accentColor } : null,
            subtle ? rowStyles.subtle : null,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  iconWrap: {
    width: 28,
    alignItems: "center",
    paddingTop: 2,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  subtle: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: "center",
  },
  centered: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    marginBottom: 4,
  },
  heroType: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 32,
  },
  card: {
    width: "100%",
    backgroundColor: brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  errorText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    marginTop: 8,
  },
});
