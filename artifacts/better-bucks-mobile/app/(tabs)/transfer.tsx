import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Employee = {
  id: number;
  fullName: string;
  username: string;
  balance: number;
  role: string;
};

type Category = {
  id: number;
  name: string;
  color: string;
};

type ApiErrorBody = { message?: string };

function extractApiError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data && typeof (data as ApiErrorBody).message === "string") {
    return (data as ApiErrorBody).message ?? fallback;
  }
  return fallback;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function TransferScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const admin = user?.role === "admin" || user?.role === "prime_admin";

  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [hasCashValue, setHasCashValue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["mobile-admin-employees", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/employees"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
    enabled: !!token && admin,
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["mobile-admin-categories", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/categories"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    enabled: !!token && admin,
    staleTime: 300_000,
  });

  const parsedAmount = parseInt(amount) || 0;

  const filteredEmployees = employees.filter((e) =>
    e.id !== user?.id &&
    e.role === "employee" &&
    (
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase())
    )
  );

  const resetForm = useCallback(() => {
    setSelectedEmployee(null);
    setAmount("");
    setReason("");
    setCategoryId(null);
    setHasCashValue(false);
    setTxType("credit");
    setSearch("");
  }, []);

  const postBalance = async (body: Record<string, unknown>) => {
    const res = await fetch(
      apiUrl(`/api/mobile/admin/employees/${selectedEmployee!.id}/balance`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => ({}));
      throw new Error(extractApiError(data, "Transfer failed."));
    }
    return res.json();
  };

  const handleCredit = async () => {
    if (!selectedEmployee || parsedAmount <= 0 || !token) return;
    if (!reason.trim()) {
      Alert.alert("Reason Required", "Please enter a reason for this credit.");
      return;
    }
    if (categories.length > 0 && !categoryId) {
      Alert.alert("Category Required", "Please select a category for this credit.");
      return;
    }
    setSubmitting(true);
    try {
      await postBalance({ amount: parsedAmount, reason: reason.trim(), categoryId: categoryId ?? undefined });
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
      Alert.alert(
        "Transfer Complete",
        `${parsedAmount.toLocaleString()} Bucks credited to ${selectedEmployee.fullName}.`,
        [{ text: "Done", onPress: resetForm }],
      );
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err, "Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDebit = async () => {
    if (!selectedEmployee || parsedAmount <= 0 || !token) return;
    if (!reason.trim()) {
      Alert.alert("Reason Required", "Please enter a reason for this deduction.");
      return;
    }
    setSubmitting(true);
    try {
      await postBalance({ amount: -parsedAmount, reason: reason.trim(), hasCashValue });
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-employees"] });
      Alert.alert(
        "Deduction Complete",
        `${parsedAmount.toLocaleString()} Bucks deducted from ${selectedEmployee.fullName}.`,
        [{ text: "Done", onPress: resetForm }],
      );
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err, "Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (txType === "credit") handleCredit();
    else handleDebit();
  };

  if (!admin) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom }]}>
        <Text style={styles.errorText}>Admin access required.</Text>
      </View>
    );
  }

  if (showEmployeePicker) {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <View style={styles.searchHeader}>
          <Pressable onPress={() => setShowEmployeePicker(false)} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={brand.navy} />
          </Pressable>
          <Text style={styles.searchTitle}>Select Employee</Text>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or username…"
            placeholderTextColor={brand.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={brand.textMuted} />
            </Pressable>
          )}
        </View>
        {employeesLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={brand.green} />
        ) : (
          <FlatList
            data={filteredEmployees}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.empRow, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setSelectedEmployee(item);
                  setShowEmployeePicker(false);
                }}
              >
                <View style={styles.empAvatar}>
                  <Text style={styles.empAvatarText}>
                    {item.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{item.fullName}</Text>
                  <Text style={styles.empUsername}>@{item.username}</Text>
                </View>
                <Text style={styles.empBalance}>{item.balance.toLocaleString()} BB</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No employees found.</Text>
              </View>
            }
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Employee</Text>
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.75 }]}
        onPress={() => setShowEmployeePicker(true)}
      >
        {selectedEmployee ? (
          <>
            <View style={styles.empAvatar}>
              <Text style={styles.empAvatarText}>
                {selectedEmployee.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{selectedEmployee.fullName}</Text>
              <Text style={styles.empBalance2}>
                Current: {selectedEmployee.balance.toLocaleString()} BB
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.pickerPlaceholder}>Select an employee…</Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
      </Pressable>

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Type</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, txType === "credit" && styles.toggleBtnActive]}
          onPress={() => setTxType("credit")}
        >
          <Ionicons
            name="arrow-down-circle"
            size={16}
            color={txType === "credit" ? brand.white : brand.textSecondary}
          />
          <Text style={[styles.toggleBtnText, txType === "credit" && styles.toggleBtnTextActive]}>
            Credit
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, txType === "debit" && styles.toggleBtnDebit]}
          onPress={() => setTxType("debit")}
        >
          <Ionicons
            name="arrow-up-circle"
            size={16}
            color={txType === "debit" ? brand.white : brand.textSecondary}
          />
          <Text style={[styles.toggleBtnText, txType === "debit" && styles.toggleBtnTextActive]}>
            Debit
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Amount (Bucks)</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="0"
        placeholderTextColor={brand.textMuted}
        keyboardType="number-pad"
        value={amount}
        onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
      />

      {txType === "credit" && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Reason</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Why are Bucks being credited?"
            placeholderTextColor={brand.textMuted}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
          />

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Category</Text>
          {categories.length === 0 ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                No categories configured. Ask your org owner to set them up in Settings.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    categoryId === cat.id && { borderColor: cat.color, backgroundColor: `${cat.color}18` },
                  ]}
                  onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                >
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text
                    style={[
                      styles.categoryChipText,
                      categoryId === cat.id && { color: brand.text, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {txType === "debit" && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Reason</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Why are Bucks being deducted?"
            placeholderTextColor={brand.textMuted}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
          />
          <View style={styles.cashValueRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cashValueLabel}>Has cash value</Text>
              <Text style={styles.cashValueHint}>
                Check if this deduction corresponds to a real monetary transaction.
              </Text>
            </View>
            <Switch
              value={hasCashValue}
              onValueChange={setHasCashValue}
              trackColor={{ false: brand.border, true: brand.green }}
              thumbColor={brand.white}
            />
          </View>
        </>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          txType === "debit" && styles.submitBtnDebit,
          (!selectedEmployee || parsedAmount <= 0 || submitting) && styles.submitBtnDisabled,
          pressed && { opacity: 0.85 },
        ]}
        onPress={handleSubmit}
        disabled={!selectedEmployee || parsedAmount <= 0 || submitting}
      >
        {submitting ? (
          <ActivityIndicator color={brand.white} size="small" />
        ) : (
          <>
            <Ionicons
              name={txType === "credit" ? "arrow-down-circle-outline" : "remove-circle-outline"}
              size={18}
              color={brand.white}
            />
            <Text style={styles.submitBtnText}>
              {txType === "credit"
                ? `Credit${parsedAmount > 0 ? ` ${parsedAmount.toLocaleString()} Bucks` : ""}`
                : `Deduct${parsedAmount > 0 ? ` ${parsedAmount.toLocaleString()} Bucks` : ""}`}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  emptyText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", marginTop: 32 },
  sectionLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: brand.offWhite,
  },
  pickerPlaceholder: { flex: 1, color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: brand.border,
    backgroundColor: brand.offWhite,
  },
  toggleBtnActive: { backgroundColor: brand.green, borderColor: brand.green },
  toggleBtnDebit: { backgroundColor: brand.danger, borderColor: brand.danger },
  toggleBtnText: { color: brand.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  toggleBtnTextActive: { color: brand.white },
  amountInput: {
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: brand.offWhite,
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  categoryList: { gap: 8, paddingBottom: 4 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: brand.white,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryChipText: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: brand.offWhite,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlignVertical: "top",
    minHeight: 80,
  },
  cashValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 12,
    backgroundColor: brand.offWhite,
  },
  cashValueLabel: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 },
  cashValueHint: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, flexShrink: 1 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnDebit: { backgroundColor: brand.danger },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: brand.white, fontFamily: "Inter_700Bold", fontSize: 16 },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  searchTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  searchInput: { flex: 1, color: brand.text, fontFamily: "Inter_400Regular", fontSize: 15 },
  empRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  empAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brand.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  empAvatarText: { color: brand.white, fontFamily: "Inter_700Bold", fontSize: 16 },
  empInfo: { flex: 1, gap: 2 },
  empName: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  empUsername: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  empBalance: { color: brand.green, fontFamily: "Inter_700Bold", fontSize: 13 },
  empBalance2: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  infoBox: { backgroundColor: brand.offWhite, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: brand.border },
  infoBoxText: { color: brand.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 },
});
