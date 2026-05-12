import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, G, Line } from "react-native-svg";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: number;
  description: string | null;
  pointsCost: number;
  quantity: number;
  status: "pending" | "approved" | "denied" | "shipped" | "fulfilled";
  createdAt: string;
  adminNotes: string | null;
  selectedSize: string | null;
  selectedColor: string | null;
  user?: { fullName: string; username: string };
};

type MonthlySpend = { month: string; total: number };
type ChartPoint = { label: string; total: number; monthKey: string };

const STATUS_CONFIG: Record<
  Order["status"],
  { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  pending: { label: "Pending", color: brand.warning, icon: "time-outline" },
  approved: { label: "Approved", color: brand.green, icon: "checkmark-circle-outline" },
  denied: { label: "Denied", color: brand.danger, icon: "close-circle-outline" },
  shipped: { label: "Shipped", color: "#1565C0", icon: "airplane-outline" },
  fulfilled: { label: "Fulfilled", color: brand.textMuted, icon: "archive-outline" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildChartData(history: MonthlySpend[]): ChartPoint[] {
  if (history.length === 0) return [];
  const byMonth = new Map(history.map((h) => [h.month, h.total]));
  const earliest = history[0].month;
  const [eYear, eMon] = earliest.split("-").map(Number);
  const now = new Date();
  const result: ChartPoint[] = [];
  let y = eYear;
  let m = eMon;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const d = new Date(y, m - 1, 1);
    const monthStr = d.toLocaleDateString("en-US", { month: "short" });
    const yearStr = d.toLocaleDateString("en-US", { year: "2-digit" });
    const label = `${monthStr} '${yearStr}`;
    result.push({ label, total: byMonth.get(key) ?? 0, monthKey: key });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000 % 1 === 0 ? n / 1000 : (n / 1000).toFixed(1))}k`;
  return String(n);
}

function SpendingChart({
  token,
  onMonthSelect,
  selectedMonthKey,
}: {
  token: string | null;
  onMonthSelect: (monthKey: string | null, label: string | null) => void;
  selectedMonthKey: string | null;
}) {
  const { width: screenWidth } = useWindowDimensions();

  const { data: history = [], isError } = useQuery<MonthlySpend[]>({
    queryKey: ["mobile-redemptions-history", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/wallet/redemptions/history?months=12"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load spending history");
      return res.json();
    },
    enabled: !!token,
  });

  const chartData = buildChartData(history);

  useEffect(() => {
    onMonthSelect(null, null);
  }, [chartData.length]);

  if (isError) {
    return (
      <View style={chartStyles.errorRow}>
        <Ionicons name="alert-circle-outline" size={16} color={brand.danger} />
        <Text style={chartStyles.errorText}>Could not load spending history.</Text>
      </View>
    );
  }

  if (chartData.length === 0) return null;

  const PAD_LEFT = 40;
  const PAD_RIGHT = 12;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 28;
  const svgWidth = screenWidth - 40;
  const svgHeight = 190;
  const chartW = svgWidth - PAD_LEFT - PAD_RIGHT;
  const chartH = svgHeight - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxVal / tickCount) * i)
  );

  const barCount = chartData.length;
  const barGap = Math.max(2, chartW / barCount * 0.2);
  const barWidth = (chartW - barGap * (barCount - 1)) / barCount;

  const selectedBarIndex = selectedMonthKey
    ? chartData.findIndex((d) => d.monthKey === selectedMonthKey)
    : -1;
  const sel = selectedBarIndex >= 0 ? chartData[selectedBarIndex] : null;
  const selX = selectedBarIndex >= 0 ? PAD_LEFT + selectedBarIndex * (barWidth + barGap) : 0;
  const tooltipW = 70;
  const tooltipX = Math.min(
    Math.max(selX + barWidth / 2 - tooltipW / 2, PAD_LEFT),
    svgWidth - PAD_RIGHT - tooltipW,
  );

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.cardHeader}>
        <Ionicons name="bar-chart-outline" size={16} color={brand.navy} />
        <Text style={chartStyles.cardTitle}>Spending over time</Text>
        {sel && (
          <Text style={chartStyles.tapHint}>Tap again or use filter to clear</Text>
        )}
        {!sel && (
          <Text style={chartStyles.tapHint}>Tap a bar to filter orders</Text>
        )}
      </View>
      <Svg width={svgWidth} height={svgHeight}>
        {/* Y-axis grid lines and labels */}
        {ticks.map((tick) => {
          const y = PAD_TOP + chartH - (tick / maxVal) * chartH;
          return (
            <G key={tick}>
              <Line
                x1={PAD_LEFT}
                y1={y}
                x2={svgWidth - PAD_RIGHT}
                y2={y}
                stroke="#F0F0F0"
                strokeWidth={1}
              />
              <SvgText
                x={PAD_LEFT - 4}
                y={y + 4}
                fontSize={9}
                fill={brand.textMuted}
                textAnchor="end"
              >
                {tick >= 1000 ? `${Math.round(tick / 100) / 10}k` : String(tick)}
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {chartData.map((d, i) => {
          const x = PAD_LEFT + i * (barWidth + barGap);
          const barH = Math.max(2, (d.total / maxVal) * chartH);
          const y = PAD_TOP + chartH - barH;
          const showXLabel = barCount <= 12 || i % Math.ceil(barCount / 8) === 0 || i === barCount - 1;
          const isSelected = d.monthKey === selectedMonthKey;
          const barFill = isSelected ? brand.green : brand.navy;
          const labelY = Math.max(PAD_TOP - 3, y - 4);
          return (
            <G
              key={d.label}
              onPress={() =>
                onMonthSelect(
                  isSelected ? null : d.monthKey,
                  isSelected ? null : d.label,
                )
              }
            >
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={barFill}
                rx={3}
                ry={3}
              />
              {/* Hit area so thin bars are easier to tap */}
              <Rect
                x={x - 4}
                y={PAD_TOP}
                width={barWidth + 8}
                height={chartH}
                fill="transparent"
              />
              {/* Compact value label above bar */}
              {d.total > 0 && !isSelected && (
                <SvgText
                  x={x + barWidth / 2}
                  y={labelY}
                  fontSize={8}
                  fill={brand.textMuted}
                  textAnchor="middle"
                >
                  {formatCompact(d.total)}
                </SvgText>
              )}
              {showXLabel && (
                <SvgText
                  x={x + barWidth / 2}
                  y={svgHeight - 4}
                  fontSize={8}
                  fill={isSelected ? brand.green : brand.textMuted}
                  textAnchor="middle"
                >
                  {d.label.split(" ")[0]}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Tooltip for selected bar — rendered last so it sits on top */}
        {sel !== null && selectedBarIndex >= 0 && (
          <G>
            <Rect
              x={tooltipX}
              y={2}
              width={tooltipW}
              height={17}
              fill={brand.navy}
              rx={4}
              ry={4}
            />
            <SvgText
              x={tooltipX + tooltipW / 2}
              y={13}
              fontSize={9}
              fill="#ffffff"
              textAnchor="middle"
            >
              {`${sel.total.toLocaleString()} Bucks`}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: brand.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  cardTitle: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  tapHint: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginLeft: "auto",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  errorText: {
    color: brand.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});

export default function OrdersTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const admin = user?.role === "admin" || user?.role === "prime_admin";

  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string | null>(null);

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["mobile-orders", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/orders"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
    enabled: !!token,
  });

  function handleMonthSelect(monthKey: string | null, label: string | null) {
    setSelectedMonthKey(monthKey);
    setSelectedMonthLabel(label);
  }

  function clearMonthFilter() {
    setSelectedMonthKey(null);
    setSelectedMonthLabel(null);
  }

  const filteredOrders = selectedMonthKey
    ? orders.filter((o) => {
        const d = new Date(o.createdAt);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        return key === selectedMonthKey;
      })
    : orders;

  const handleStatusChange = async (order: Order, newStatus: Order["status"]) => {
    Alert.alert(
      `Mark as ${STATUS_CONFIG[newStatus].label}?`,
      newStatus === "denied"
        ? `This will refund ${order.pointsCost.toLocaleString()} Bucks to the employee.`
        : undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const res = await fetch(
                apiUrl(`/api/mobile/orders/${order.id}/status`),
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token ?? ""}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: newStatus }),
                },
              );
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert("Error", data?.message ?? "Could not update order.");
                return;
              }
              queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
              queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Network error.");
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  const filterBanner = !admin && selectedMonthKey ? (
    <View style={styles.filterBanner}>
      <Ionicons name="calendar-outline" size={14} color={brand.navy} />
      <Text style={styles.filterBannerText}>Viewing: {selectedMonthLabel}</Text>
      <TouchableOpacity onPress={clearMonthFilter} style={styles.filterClearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={16} color={brand.navy} />
      </TouchableOpacity>
    </View>
  ) : null;

  const listHeader = !admin ? (
    <>
      <SpendingChart
        token={token}
        onMonthSelect={handleMonthSelect}
        selectedMonthKey={selectedMonthKey}
      />
      {filterBanner}
    </>
  ) : null;

  if (orders.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.white }}>
        {!admin && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <SpendingChart
              token={token}
              onMonthSelect={handleMonthSelect}
              selectedMonthKey={selectedMonthKey}
            />
          </View>
        )}
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={brand.textMuted} />
          <Text style={styles.emptyText}>
            {admin ? "No orders yet" : "No orders placed yet"}
          </Text>
          {!admin && (
            <Text style={styles.emptySubtext}>
              Visit the Store tab to redeem your Bucks.
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredOrders}
      keyExtractor={(o) => String(o.id)}
      style={{ backgroundColor: brand.white }}
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingTop: 16 },
        { paddingBottom: insets.bottom + 32 },
      ]}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        selectedMonthKey ? (
          <View style={styles.emptyFiltered}>
            <Ionicons name="receipt-outline" size={36} color={brand.textMuted} />
            <Text style={styles.emptyFilteredText}>
              No orders in {selectedMonthLabel}
            </Text>
            <TouchableOpacity onPress={clearMonthFilter} style={styles.clearFilterLink}>
              <Text style={styles.clearFilterLinkText}>Show all orders</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={brand.green}
        />
      }
      renderItem={({ item }) => {
        const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description ?? "Order"}
                </Text>
                {admin && item.user ? (
                  <Text style={styles.empName}>{item.user.fullName}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { borderColor: statusCfg.color + "55", backgroundColor: statusCfg.color + "10" },
                ]}
              >
                <Ionicons
                  name={statusCfg.icon}
                  size={13}
                  color={statusCfg.color}
                />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
              </View>
            </View>

            <View style={styles.meta}>
              <Text style={styles.metaItem}>
                {item.pointsCost.toLocaleString()} Bucks
              </Text>
              {item.quantity > 1 ? (
                <Text style={styles.metaItem}>×{item.quantity}</Text>
              ) : null}
              {item.selectedSize ? (
                <Text style={styles.metaItem}>Size: {item.selectedSize}</Text>
              ) : null}
              {item.selectedColor ? (
                <Text style={styles.metaItem}>
                  Color: {item.selectedColor}
                </Text>
              ) : null}
              <Text style={[styles.metaItem, { marginLeft: "auto" }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>

            {item.adminNotes ? (
              <Text style={styles.adminNotes}>Note: {item.adminNotes}</Text>
            ) : null}

            {admin && item.status === "pending" && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: brand.green, backgroundColor: "rgba(46,125,50,0.06)" }]}
                  onPress={() => handleStatusChange(item, "approved")}
                >
                  <Ionicons name="checkmark" size={16} color={brand.green} />
                  <Text style={[styles.actionBtnText, { color: brand.green }]}>
                    Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: brand.danger, backgroundColor: "rgba(198,40,40,0.06)" }]}
                  onPress={() => handleStatusChange(item, "denied")}
                >
                  <Ionicons name="close" size={16} color={brand.danger} />
                  <Text
                    style={[styles.actionBtnText, { color: brand.danger }]}
                  >
                    Deny
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#1565C0", backgroundColor: "rgba(21,101,192,0.06)" }]}
                  onPress={() => handleStatusChange(item, "shipped")}
                >
                  <Ionicons name="airplane-outline" size={16} color="#1565C0" />
                  <Text style={[styles.actionBtnText, { color: "#1565C0" }]}>
                    Ship
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {admin && item.status === "approved" && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#1565C0", backgroundColor: "rgba(21,101,192,0.06)" }]}
                  onPress={() => handleStatusChange(item, "shipped")}
                >
                  <Ionicons name="airplane-outline" size={16} color="#1565C0" />
                  <Text style={[styles.actionBtnText, { color: "#1565C0" }]}>
                    Mark Shipped
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: brand.border }]}
                  onPress={() => handleStatusChange(item, "fulfilled")}
                >
                  <Ionicons
                    name="archive-outline"
                    size={16}
                    color={brand.textMuted}
                  />
                  <Text
                    style={[styles.actionBtnText, { color: brand.textMuted }]}
                  >
                    Fulfilled
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {admin && item.status === "shipped" && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: brand.border }]}
                  onPress={() => handleStatusChange(item, "fulfilled")}
                >
                  <Ionicons
                    name="archive-outline"
                    size={16}
                    color={brand.textMuted}
                  />
                  <Text
                    style={[styles.actionBtnText, { color: brand.textMuted }]}
                  >
                    Mark Fulfilled
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: brand.textSecondary,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    textAlign: "center",
  },
  emptySubtext: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: brand.navy + "10",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: brand.navy + "25",
  },
  filterBannerText: {
    flex: 1,
    color: brand.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  filterClearBtn: {
    padding: 2,
  },
  emptyFiltered: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 32,
  },
  emptyFilteredText: {
    color: brand.textSecondary,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
  },
  clearFilterLink: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brand.navy + "40",
  },
  clearFilterLinkText: {
    color: brand.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  desc: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  empName: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  metaItem: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  adminNotes: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
  },
  adminActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
