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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

const STATUS_CONFIG: Record<
  Order["status"],
  { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  pending: { label: "Pending", color: brand.gold, icon: "time-outline" },
  approved: { label: "Approved", color: brand.green, icon: "checkmark-circle-outline" },
  denied: { label: "Denied", color: brand.danger, icon: "close-circle-outline" },
  shipped: { label: "Shipped", color: "#60A5FA", icon: "airplane-outline" },
  fulfilled: { label: "Fulfilled", color: "rgba(255,255,255,0.5)", icon: "archive-outline" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OrdersTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const admin = user?.role === "admin" || user?.role === "prime_admin";

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
        <ActivityIndicator color={brand.gold} size="large" />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.emptyText}>
          {admin ? "No orders yet" : "No orders placed yet"}
        </Text>
        {!admin && (
          <Text style={styles.emptySubtext}>
            Visit the Store tab to redeem your Bucks.
          </Text>
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => String(o.id)}
      style={{ backgroundColor: brand.navy }}
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingTop: 16 },
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={brand.gold}
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
                  { borderColor: statusCfg.color + "55" },
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
                  style={[styles.actionBtn, { borderColor: brand.green }]}
                  onPress={() => handleStatusChange(item, "approved")}
                >
                  <Ionicons name="checkmark" size={16} color={brand.green} />
                  <Text style={[styles.actionBtnText, { color: brand.green }]}>
                    Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: brand.danger }]}
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
                  style={[styles.actionBtn, { borderColor: "#60A5FA" }]}
                  onPress={() => handleStatusChange(item, "shipped")}
                >
                  <Ionicons name="airplane-outline" size={16} color="#60A5FA" />
                  <Text style={[styles.actionBtnText, { color: "#60A5FA" }]}>
                    Ship
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {admin && item.status === "approved" && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#60A5FA" }]}
                  onPress={() => handleStatusChange(item, "shipped")}
                >
                  <Ionicons name="airplane-outline" size={16} color="#60A5FA" />
                  <Text style={[styles.actionBtnText, { color: "#60A5FA" }]}>
                    Mark Shipped
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { borderColor: "rgba(255,255,255,0.3)" },
                  ]}
                  onPress={() => handleStatusChange(item, "fulfilled")}
                >
                  <Ionicons
                    name="archive-outline"
                    size={16}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: "rgba(255,255,255,0.6)" },
                    ]}
                  >
                    Fulfilled
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {admin && item.status === "shipped" && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { borderColor: "rgba(255,255,255,0.3)" },
                  ]}
                  onPress={() => handleStatusChange(item, "fulfilled")}
                >
                  <Ionicons
                    name="archive-outline"
                    size={16}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: "rgba(255,255,255,0.6)" },
                    ]}
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
    backgroundColor: brand.navy,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    textAlign: "center",
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  desc: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  empName: {
    color: "rgba(255,255,255,0.55)",
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
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  adminNotes: {
    color: "rgba(255,255,255,0.45)",
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
