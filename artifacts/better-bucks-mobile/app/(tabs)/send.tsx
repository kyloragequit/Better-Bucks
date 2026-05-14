import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Method = "nfc" | "qr" | "direct";

const METHOD_CONFIG: {
  key: Method;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  description: string;
}[] = [
  {
    key: "nfc",
    label: "Tap",
    icon: "radio-outline",
    description: "Hold devices together",
  },
  {
    key: "qr",
    label: "QR Code",
    icon: "qr-code-outline",
    description: "Recipient scans your code",
  },
  {
    key: "direct",
    label: "Username",
    icon: "person-outline",
    description: "Send by username",
  },
];

export default function SendTab() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [rawAmount, setRawAmount] = useState("0");
  const [method, setMethod] = useState<Method>("nfc");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const recipientRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  const amount = parseInt(rawAmount.replace(/\D/g, "") || "0", 10);
  const isValid = amount > 0 && (method !== "direct" || recipient.trim().length > 0);

  function handleAmountChange(text: string) {
    const digits = text.replace(/\D/g, "");
    setRawAmount(digits || "0");
  }

  async function handleSend() {
    if (!token || !isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);

    try {
      if (method === "nfc") {
        const res = await fetch(apiUrl("/api/transfers/nfc/initiate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount, note: note.trim() || undefined }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          Alert.alert("Error", (body as any)?.message ?? "Could not initiate transfer");
          return;
        }
        const data = await res.json();
        router.push({
          pathname: "/transfer/receive",
          params: {
            method: "nfc",
            token: data.token,
            transferId: String(data.transferId),
            amount: String(amount),
            expiresIn: String(data.expiresInSeconds ?? 60),
          },
        });
      } else if (method === "qr") {
        const res = await fetch(apiUrl("/api/transfers/qr/generate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount, note: note.trim() || undefined }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          Alert.alert("Error", (body as any)?.message ?? "Could not generate QR code");
          return;
        }
        const data = await res.json();
        router.push({
          pathname: "/transfer/receive",
          params: {
            method: "qr",
            token: data.token,
            transferId: String(data.transferId),
            amount: String(amount),
            expiresIn: String(data.expiresInSeconds ?? 300),
          },
        });
      } else {
        // direct
        const res = await fetch(apiUrl("/api/transfers/direct/send"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientUsername: recipient.trim(),
            amount,
            note: note.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          Alert.alert("Error", (body as any)?.message ?? "Could not send transfer");
          return;
        }
        const data = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace({
          pathname: "/transfer/success",
          params: {
            amount: String(amount),
            recipientName: data.recipientName ?? recipient.trim(),
            direction: "sent",
          },
        });
      }
    } catch {
      Alert.alert("Error", "Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Amount display */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Amount (Bucks)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountPrefix}>BB</Text>
          <TextInput
            style={styles.amountInput}
            value={amount === 0 ? "" : String(amount)}
            onChangeText={handleAmountChange}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.35)"
            maxLength={7}
            returnKeyType="next"
            onSubmitEditing={() =>
              method === "direct" ? recipientRef.current?.focus() : noteRef.current?.focus()
            }
            accessibilityLabel="Enter amount in Bucks"
          />
        </View>
        <Text style={styles.balanceHint}>
          Balance: BB {(user as any)?.balance?.toLocaleString() ?? "—"}
        </Text>
      </View>

      {/* Method selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Transfer method</Text>
        <View style={styles.methodGrid}>
          {METHOD_CONFIG.map((m) => {
            const active = method === m.key;
            return (
              <Pressable
                key={m.key}
                style={({ pressed }) => [
                  styles.methodCard,
                  active && styles.methodCardActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setMethod(m.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m.label}
              >
                <Ionicons
                  name={m.icon}
                  size={22}
                  color={active ? brand.white : brand.navy}
                />
                <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.methodDesc, active && styles.methodDescActive]}>
                  {m.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Recipient — only for direct */}
      {method === "direct" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipient username</Text>
          <TextInput
            ref={recipientRef}
            style={styles.textInput}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Enter their username"
            placeholderTextColor={brand.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => noteRef.current?.focus()}
            accessibilityLabel="Recipient username"
          />
        </View>
      )}

      {/* Note */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Note (optional)</Text>
        <TextInput
          ref={noteRef}
          style={styles.textInput}
          value={note}
          onChangeText={setNote}
          placeholder="What's this for?"
          placeholderTextColor={brand.textMuted}
          maxLength={200}
          returnKeyType="done"
          accessibilityLabel="Optional note"
        />
      </View>

      {/* Info banner for NFC / QR */}
      {method !== "direct" && (
        <View style={styles.infoBanner}>
          <Ionicons
            name={method === "nfc" ? "radio-outline" : "qr-code-outline"}
            size={16}
            color={brand.navy}
          />
          <Text style={styles.infoText}>
            {method === "nfc"
              ? "Tapping will show an animation — ask the recipient to bring their device close."
              : "A QR code will appear — let the recipient scan it to receive the Bucks."}
          </Text>
        </View>
      )}

      {/* Send button */}
      <Pressable
        style={({ pressed }) => [
          styles.sendButton,
          (!isValid || loading) && styles.sendButtonDisabled,
          pressed && isValid && { opacity: 0.85 },
        ]}
        onPress={handleSend}
        disabled={!isValid || loading}
        accessibilityRole="button"
        accessibilityLabel={`Send ${amount} Bucks`}
      >
        {loading ? (
          <ActivityIndicator color={brand.white} size="small" />
        ) : (
          <>
            <Ionicons
              name={method === "nfc" ? "radio" : method === "qr" ? "qr-code" : "paper-plane"}
              size={20}
              color={brand.white}
            />
            <Text style={styles.sendButtonText}>
              {method === "nfc" ? "Generate Tap Token" : method === "qr" ? "Show QR Code" : "Send Bucks"}
            </Text>
          </>
        )}
      </Pressable>

      {/* History link */}
      <Pressable
        style={({ pressed }) => [styles.historyLink, pressed && { opacity: 0.7 }]}
        onPress={() => router.push("/transfer/history")}
        accessibilityRole="button"
        accessibilityLabel="View transfer history"
      >
        <Ionicons name="time-outline" size={15} color={brand.green} />
        <Text style={styles.historyLinkText}>View transfer history</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  amountCard: {
    backgroundColor: brand.navyCard,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  amountPrefix: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    marginBottom: 6,
  },
  amountInput: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 56,
    lineHeight: 64,
    minWidth: 100,
    textAlign: "center",
  },
  balanceHint: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 8,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  methodGrid: {
    flexDirection: "row",
    gap: 10,
  },
  methodCard: {
    flex: 1,
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  methodCardActive: {
    backgroundColor: brand.navy,
    borderColor: brand.navy,
  },
  methodLabel: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  methodLabelActive: {
    color: brand.white,
  },
  methodDesc: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "center",
  },
  methodDescActive: {
    color: "rgba(255,255,255,0.55)",
  },
  textInput: {
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    borderWidth: 1,
    borderColor: brand.border,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(26,35,126,0.06)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(26,35,126,0.12)",
  },
  infoText: {
    color: brand.navy,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  sendButton: {
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sendButtonDisabled: {
    backgroundColor: brand.border,
  },
  sendButtonText: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  historyLinkText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
