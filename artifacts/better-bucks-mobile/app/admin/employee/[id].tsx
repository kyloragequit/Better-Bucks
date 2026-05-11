import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Transaction = {
  id: number;
  amount: number;
  reason: string | null;
  createdAt: string;
  performedByName: string | null;
};

type EmployeeDetail = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: string;
  balance: number;
  status: string;
  createdAt: string;
  transactions: Transaction[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user: me } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const { data: emp, isLoading, refetch } = useQuery<EmployeeDetail>({
    queryKey: ["mobile-admin-employee", id, token],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/mobile/admin/employees/${id}`), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load employee");
      return res.json();
    },
    enabled: !!token && !!id,
  });

  const handleChangeRole = () => {
    if (!emp) return;
    const isEmp = emp.role === "employee";
    Alert.alert(
      `Make ${isEmp ? "admin" : "employee"}?`,
      `Change ${emp.fullName}'s role to ${isEmp ? "admin" : "employee"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/employees/${id}`), {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token ?? ""}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ role: isEmp ? "admin" : "employee" }),
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-employee", id] });
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
              refetch();
            } else {
              const d = await res.json().catch(() => ({}));
              Alert.alert("Failed", d?.message ?? "Try again.");
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!emp) return;
    Alert.alert(
      "Delete employee?",
      `This will permanently remove ${emp.fullName}'s account and all their data. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/employees/${id}`), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token ?? ""}` },
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
              router.back();
            } else {
              const d = await res.json().catch(() => ({}));
              Alert.alert("Failed", d?.message ?? "Try again.");
            }
          },
        },
      ],
    );
  };

  const handleAdjustBalance = async () => {
    const amt = parseInt(adjustAmount);
    if (!amt || amt === 0) {
      Alert.alert("Invalid", "Enter a non-zero amount.");
      return;
    }
    if (amt > 0) {
      Alert.alert(
        "Use Transfer Tab",
        "Adding Bucks requires a payment. Use the Transfer tab to credit an employee via Apple Pay or Google Pay.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert("Required", "Enter a reason for the adjustment.");
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch(apiUrl(`/api/mobile/admin/employees/${id}/balance`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amt, reason: adjustReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Failed", data?.message ?? "Try again.");
        return;
      }
      setAdjustModal(false);
      setAdjustAmount("");
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-employee", id] });
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
      refetch();
      Alert.alert("Done", `Balance updated. New balance: ${data.newBalance?.toLocaleString()} Bucks.`);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setAdjusting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (!emp) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Employee not found.</Text>
      </View>
    );
  }

  const isSelf = me?.id === emp.id;
  const isOwner = emp.role === "prime_admin";

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{emp.fullName?.charAt(0)?.toUpperCase() ?? "?"}</Text>
          </View>
          <Text style={styles.name}>{emp.fullName}</Text>
          <Text style={styles.username}>@{emp.username}</Text>
          {emp.email ? <Text style={styles.email}>{emp.email}</Text> : null}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {emp.role === "prime_admin" ? "Owner" : emp.role === "admin" ? "Admin" : "Employee"}
            </Text>
          </View>
          <View style={styles.balanceRow}>
            <Ionicons name="wallet-outline" size={18} color={brand.green} />
            <Text style={styles.balanceText}>{(emp.balance ?? 0).toLocaleString()} Bucks</Text>
          </View>
          <Text style={styles.joined}>Joined {formatDate(emp.createdAt)}</Text>
        </View>

        {/* Actions */}
        {!isSelf && !isOwner && (
          <>
            <Text style={styles.sectionHeader}>Actions</Text>
            <View style={styles.actionGroup}>
              <TouchableOpacity style={styles.actionRow} onPress={() => setAdjustModal(true)}>
                <View style={[styles.actionIcon, { backgroundColor: "rgba(46,125,50,0.1)" }]}>
                  <Ionicons name="add-circle-outline" size={20} color={brand.green} />
                </View>
                <Text style={styles.actionLabel}>Adjust Balance</Text>
                <Ionicons name="chevron-forward" size={16} color={brand.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={handleChangeRole}>
                <View style={[styles.actionIcon, { backgroundColor: "rgba(21,101,192,0.1)" }]}>
                  <Ionicons name="swap-horizontal-outline" size={20} color="#1565C0" />
                </View>
                <Text style={styles.actionLabel}>
                  {emp.role === "employee" ? "Make Admin" : "Make Employee"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={brand.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
                <View style={[styles.actionIcon, { backgroundColor: "rgba(198,40,40,0.08)" }]}>
                  <Ionicons name="trash-outline" size={20} color={brand.danger} />
                </View>
                <Text style={[styles.actionLabel, { color: brand.danger }]}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={16} color={brand.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Recent transactions */}
        <Text style={styles.sectionHeader}>Recent Transactions</Text>
        {emp.transactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={28} color={brand.textMuted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {emp.transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txReason}>{tx.reason ?? (tx.amount >= 0 ? "Bucks awarded" : "Bucks spent")}</Text>
                  <Text style={styles.txDate}>
                    {formatDate(tx.createdAt)}
                    {tx.performedByName ? ` · by ${tx.performedByName}` : ""}
                  </Text>
                </View>
                <Text style={[styles.txAmount, tx.amount >= 0 ? styles.positive : styles.negative]}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Adjust Balance Modal */}
      <Modal visible={adjustModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setAdjustModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAdjustModal(false)} hitSlop={12}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Adjust Balance</Text>
            <TouchableOpacity onPress={handleAdjustBalance} disabled={adjusting} hitSlop={12}>
              <Text style={[styles.modalSave, adjusting && { opacity: 0.5 }]}>
                {adjusting ? "Saving…" : "Apply"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalHint}>
              Enter a negative number to deduct Bucks. To add Bucks, use the Transfer tab (payment required).
            </Text>
            <Text style={styles.fieldLabel}>Amount (e.g. -50)</Text>
            <TextInput
              style={styles.textInput}
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              placeholder="e.g. -50"
              placeholderTextColor={brand.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 80, textAlignVertical: "top" }]}
              value={adjustReason}
              onChangeText={setAdjustReason}
              placeholder="Great performance this week!"
              placeholderTextColor={brand.textMuted}
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.offWhite },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  headerCard: {
    backgroundColor: brand.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: brand.border,
    marginBottom: 20,
    gap: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(46,125,50,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { color: brand.green, fontFamily: "Inter_700Bold", fontSize: 26 },
  name: { color: brand.text, fontFamily: "Inter_700Bold", fontSize: 20 },
  username: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
  email: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  roleBadge: {
    marginTop: 6,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  balanceText: { color: brand.green, fontFamily: "Inter_700Bold", fontSize: 18 },
  joined: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  sectionHeader: {
    color: brand.textMuted,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  actionGroup: {
    backgroundColor: brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, color: brand.text, fontFamily: "Inter_500Medium", fontSize: 15 },
  emptyBox: {
    backgroundColor: brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 32,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  emptyText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
  txList: {
    backgroundColor: brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    gap: 12,
  },
  txReason: { color: brand.text, fontFamily: "Inter_500Medium", fontSize: 14 },
  txDate: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 14 },
  positive: { color: brand.green },
  negative: { color: brand.danger },
  // Modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.white,
  },
  modalTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  modalCancel: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 16 },
  modalSave: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  modalBody: { padding: 20, gap: 16 },
  modalHint: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  fieldLabel: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: brand.text,
    backgroundColor: brand.white,
  },
});
