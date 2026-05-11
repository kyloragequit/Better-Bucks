import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Org = {
  id: number;
  name: string;
  code: string;
  tier: string;
  maxEmployees: number;
  bucksPerDollar: number | null;
  monthlyBudgetBucks: number | null;
  adminLabel: string | null;
  employeeLabel: string | null;
  status: string;
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function OrgSettingsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: org, isLoading, refetch } = useQuery<Org>({
    queryKey: ["mobile-admin-org", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/org"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load org settings");
      return res.json();
    },
    enabled: !!token,
  });

  const [bucksPerDollar, setBucksPerDollar] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [adminLabel, setAdminLabel] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingLabels, setSavingLabels] = useState(false);

  useEffect(() => {
    if (org) {
      setBucksPerDollar(org.bucksPerDollar ? String(org.bucksPerDollar) : "");
      setMonthlyBudget(org.monthlyBudgetBucks ? String(org.monthlyBudgetBucks) : "");
      setAdminLabel(org.adminLabel ?? "Admin");
      setEmployeeLabel(org.employeeLabel ?? "Employee");
    }
  }, [org]);

  const handleSaveBudget = async () => {
    const bpd = parseInt(bucksPerDollar);
    const mb = parseInt(monthlyBudget);
    if (!bpd || bpd < 1) { Alert.alert("Invalid", "Enter a valid Bucks per Dollar (min 1)."); return; }
    if (isNaN(mb) || mb < 0) { Alert.alert("Invalid", "Enter a valid monthly budget (0 = unlimited)."); return; }
    setSavingBudget(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/admin/org/budget"), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bucksPerDollar: bpd, monthlyBudgetBucks: mb }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", data?.message ?? "Try again."); return; }
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-org"] });
      refetch();
      Alert.alert("Saved", "Budget settings updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSavingBudget(false);
    }
  };

  const handleSaveLabels = async () => {
    if (!adminLabel.trim() || !employeeLabel.trim()) {
      Alert.alert("Required", "Both role labels are required.");
      return;
    }
    setSavingLabels(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/admin/org/labels"), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ adminLabel: adminLabel.trim(), employeeLabel: employeeLabel.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", data?.message ?? "Try again."); return; }
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-org"] });
      refetch();
      Alert.alert("Saved", "Role labels updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSavingLabels(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (!org) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load organization settings.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Org Info */}
        <SectionCard title="Organization">
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color={brand.navy} />
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{org.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="key-outline" size={16} color={brand.navy} />
            <Text style={styles.infoLabel}>Org Code</Text>
            <Text style={[styles.infoValue, styles.code]}>{org.code}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="layers-outline" size={16} color={brand.navy} />
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{org.tier} · {org.maxEmployees === -1 ? "Unlimited" : `${org.maxEmployees} max`}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={brand.green} />
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: brand.green, fontFamily: "Inter_600SemiBold" }]}>{org.status}</Text>
          </View>
        </SectionCard>

        {/* Budget Settings */}
        <SectionCard title="Budget Settings">
          <Text style={styles.hintText}>
            Set how many Bucks equal $1, and your monthly Bucks budget. Set budget to 0 for unlimited.
          </Text>
          <Text style={styles.fieldLabel}>Bucks per Dollar</Text>
          <TextInput
            style={styles.textInput}
            value={bucksPerDollar}
            onChangeText={setBucksPerDollar}
            placeholder="e.g. 100"
            placeholderTextColor={brand.textMuted}
            keyboardType="numeric"
          />
          <Text style={styles.fieldLabel}>Monthly Budget (Bucks)</Text>
          <TextInput
            style={styles.textInput}
            value={monthlyBudget}
            onChangeText={setMonthlyBudget}
            placeholder="e.g. 50000 (0 = unlimited)"
            placeholderTextColor={brand.textMuted}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.saveBtn, savingBudget && { opacity: 0.6 }]}
            onPress={handleSaveBudget}
            disabled={savingBudget}
          >
            <Text style={styles.saveBtnText}>{savingBudget ? "Saving…" : "Save Budget Settings"}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Role Labels */}
        <SectionCard title="Role Labels">
          <Text style={styles.hintText}>
            Customize what admins and employees are called in your organization.
          </Text>
          <Text style={styles.fieldLabel}>Admin Label</Text>
          <TextInput
            style={styles.textInput}
            value={adminLabel}
            onChangeText={setAdminLabel}
            placeholder="e.g. Manager"
            placeholderTextColor={brand.textMuted}
          />
          <Text style={styles.fieldLabel}>Employee Label</Text>
          <TextInput
            style={styles.textInput}
            value={employeeLabel}
            onChangeText={setEmployeeLabel}
            placeholder="e.g. Team Member"
            placeholderTextColor={brand.textMuted}
          />
          <TouchableOpacity
            style={[styles.saveBtn, savingLabels && { opacity: 0.6 }]}
            onPress={handleSaveLabels}
            disabled={savingLabels}
          >
            <Text style={styles.saveBtnText}>{savingLabels ? "Saving…" : "Save Role Labels"}</Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.offWhite },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  sectionCard: {
    backgroundColor: brand.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 14,
  },
  sectionTitle: {
    color: brand.navy,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  infoLabel: { color: brand.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14, flex: 1 },
  infoValue: { color: brand.text, fontFamily: "Inter_500Medium", fontSize: 14 },
  code: { fontFamily: "Inter_700Bold", letterSpacing: 2, color: brand.navy },
  hintText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
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
  saveBtn: {
    backgroundColor: brand.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: brand.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
