import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ExpoImage } from "expo-image";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";

type Phase = "input" | "preview" | "success";

type ProductPreview = {
  productName: string;
  productDescription: string;
  priceUsd: number;
  imageUrl: string | null;
  sizes: string[];
  colors: string[];
  bucksPerDollar: number;
  bucksPrice: number;
};

export default function ExternalOrderScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: dashData } = useDashboardData(token, user?.id ?? null);

  const [phase, setPhase] = useState<Phase>("input");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedPrice, setEditedPrice] = useState("");

  const balance = dashData?.balance ?? 0;

  async function handleAnalyze() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/external-order/preview"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        Alert.alert("Could Not Analyze", data.message ?? "Please try a different link.");
        return;
      }
      setPreview(data as ProductPreview);
      setEditedName(data.productName ?? "");
      setEditedPrice(String(data.priceUsd?.toFixed(2) ?? "0.00"));
      setSelectedSize(null);
      setSelectedColor(null);
      setNotes("");
      setPhase("preview");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert("Network Error", "Could not reach the server. Please check your connection.");
    } finally {
      setAnalyzing(false);
    }
  }

  function getEffectiveBucksPrice(): number {
    if (!preview) return 0;
    const priceUsd = parseFloat(editedPrice) || preview.priceUsd;
    return Math.ceil(priceUsd * preview.bucksPerDollar);
  }

  async function handleSubmit() {
    if (!preview) return;
    const effectivePrice = parseFloat(editedPrice) || preview.priceUsd;
    const bucksCost = Math.ceil(effectivePrice * preview.bucksPerDollar);
    const productName = editedName.trim() || preview.productName;

    if (!productName) {
      Alert.alert("Required", "Please enter a product name.");
      return;
    }
    if (effectivePrice <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return;
    }
    if (balance < bucksCost) {
      Alert.alert(
        "Insufficient Bucks",
        `You need ${bucksCost.toLocaleString()} Bucks but only have ${balance.toLocaleString()}.`,
      );
      return;
    }

    const variantLine = [selectedSize, selectedColor].filter(Boolean).join(" · ");
    Alert.alert(
      "Confirm Order",
      `${productName}${variantLine ? `\n${variantLine}` : ""}\n\n$${effectivePrice.toFixed(2)} = ${bucksCost.toLocaleString()} Bucks`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Order — ${bucksCost.toLocaleString()} Bucks`,
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await fetch(apiUrl("/api/mobile/external-orders"), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token ?? ""}`,
                },
                body: JSON.stringify({
                  productUrl: url.trim(),
                  productName,
                  productDescription: preview.productDescription,
                  priceUsd: effectivePrice,
                  imageUrl: preview.imageUrl,
                  selectedSize,
                  selectedColor,
                  additionalNotes: notes.trim(),
                }),
              });
              const data = (await res.json().catch(() => ({}))) as any;
              if (!res.ok) {
                Alert.alert("Order Failed", data.message ?? "Please try again.");
                return;
              }
              queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setPhase("success");
            } catch {
              Alert.alert("Network Error", "Please check your connection and try again.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  const bucksCost = getEffectiveBucksPrice();
  const canAfford = balance >= bucksCost && bucksCost > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Order from Any Store",
          headerBackTitle: "Store",
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: brand.white }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Input Phase ── */}
          {phase === "input" && (
            <>
              <View style={styles.heroSection}>
                <View style={styles.heroIcon}>
                  <Ionicons name="storefront-outline" size={36} color={brand.navy} />
                </View>
                <Text style={styles.heroTitle}>Order from Any Store</Text>
                <Text style={styles.heroSub}>
                  Paste a product link from Amazon, Nike, Walmart, or any retailer — we'll
                  calculate the Bucks cost automatically.
                </Text>
              </View>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Product URL</Text>
                <View style={styles.urlRow}>
                  <Ionicons name="link-outline" size={16} color={brand.textMuted} />
                  <TextInput
                    style={styles.urlInput}
                    placeholder="https://amazon.com/dp/…"
                    placeholderTextColor={brand.textMuted}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleAnalyze}
                    selectTextOnFocus
                  />
                  {url.length > 0 && (
                    <TouchableOpacity onPress={() => setUrl("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={brand.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.inputHint}>
                  Copy the link directly from your browser or the retailer's app.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.analyzeBtn,
                  (!url.trim() || analyzing) && styles.analyzeBtnDisabled,
                ]}
                onPress={handleAnalyze}
                disabled={!url.trim() || analyzing}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator color={brand.white} size="small" />
                ) : (
                  <Ionicons name="sparkles-outline" size={18} color={brand.white} />
                )}
                <Text style={styles.analyzeBtnText}>
                  {analyzing ? "Analyzing…" : "Analyze Product"}
                </Text>
              </TouchableOpacity>

              {analyzing && (
                <View style={styles.analyzingRow}>
                  <Text style={styles.analyzingText}>
                    Reading the product page with AI — this takes a few seconds…
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ── Preview Phase ── */}
          {phase === "preview" && preview && (
            <>
              {/* Product image + name */}
              <View style={styles.productCard}>
                {preview.imageUrl ? (
                  <ExpoImage
                    source={{ uri: preview.imageUrl }}
                    style={styles.productImage}
                    contentFit="contain"
                  />
                ) : (
                  <View style={styles.productImageFallback}>
                    <Ionicons name="bag-outline" size={44} color={brand.textMuted} />
                  </View>
                )}
                <View style={styles.productCardBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.microLabel}>PRODUCT NAME</Text>
                    <Text style={styles.editHint}>tap to edit</Text>
                  </View>
                  <TextInput
                    style={styles.editableNameField}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Product name"
                    placeholderTextColor={brand.textMuted}
                    returnKeyType="done"
                  />
                  {!!preview.productDescription && (
                    <Text style={styles.productDesc} numberOfLines={2}>
                      {preview.productDescription}
                    </Text>
                  )}
                </View>
              </View>

              {/* Price conversion */}
              <View style={styles.priceCard}>
                <View style={styles.priceSide}>
                  <Text style={styles.microLabel}>PRICE (USD)</Text>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={editedPrice}
                      onChangeText={setEditedPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={brand.textMuted}
                      selectTextOnFocus
                    />
                  </View>
                  <Text style={styles.conversionNote}>
                    {preview.bucksPerDollar} Bucks per $1
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={brand.textMuted} style={styles.priceArrow} />
                <View style={[styles.priceSide, { alignItems: "flex-end" }]}>
                  <Text style={styles.microLabel}>BUCKS COST</Text>
                  <Text style={[styles.bucksAmount, !canAfford && bucksCost > 0 && styles.bucksAmountDanger]}>
                    {bucksCost > 0 ? bucksCost.toLocaleString() : "—"}
                  </Text>
                  {bucksCost > 0 && (
                    <Text style={[styles.conversionNote, !canAfford && styles.dangerText]}>
                      {canAfford
                        ? `Balance: ${balance.toLocaleString()} ✓`
                        : `Need ${(bucksCost - balance).toLocaleString()} more`}
                    </Text>
                  )}
                </View>
              </View>

              {/* Size */}
              {preview.sizes.length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.microLabel}>
                    SIZE{selectedSize ? ` — ${selectedSize}` : ""}
                  </Text>
                  <View style={styles.chipsRow}>
                    {preview.sizes.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.chip, selectedSize === s && styles.chipActive]}
                        onPress={() => setSelectedSize(selectedSize === s ? null : s)}
                      >
                        <Text style={[styles.chipText, selectedSize === s && styles.chipTextActive]}>
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Color */}
              {preview.colors.length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.microLabel}>
                    COLOR{selectedColor ? ` — ${selectedColor}` : ""}
                  </Text>
                  <View style={styles.chipsRow}>
                    {preview.colors.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.chip, selectedColor === c && styles.chipActive]}
                        onPress={() => setSelectedColor(selectedColor === c ? null : c)}
                      >
                        <Text style={[styles.chipText, selectedColor === c && styles.chipTextActive]}>
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.variantSection}>
                <Text style={styles.microLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any special instructions for your order…"
                  placeholderTextColor={brand.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!canAfford || submitting) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!canAfford || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={brand.white} size="small" />
                ) : (
                  <Ionicons name="bag-check-outline" size={18} color={brand.white} />
                )}
                <Text style={styles.submitBtnText}>
                  {submitting
                    ? "Placing Order…"
                    : `Place Order — ${bucksCost.toLocaleString()} Bucks`}
                </Text>
              </TouchableOpacity>

              {!canAfford && bucksCost > 0 && (
                <Text style={styles.insufficientText}>
                  You need {bucksCost.toLocaleString()} Bucks but only have{" "}
                  {balance.toLocaleString()}.
                </Text>
              )}

              <TouchableOpacity
                style={styles.backLinkRow}
                onPress={() => {
                  setPhase("input");
                  setPreview(null);
                }}
              >
                <Ionicons name="arrow-back" size={13} color={brand.textMuted} />
                <Text style={styles.backLinkText}>Try a different link</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Success Phase ── */}
          {phase === "success" && (
            <View style={styles.successContainer}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={44} color={brand.white} />
              </View>
              <Text style={styles.successTitle}>Order Submitted!</Text>
              <Text style={styles.successSub}>
                Your request is pending admin review. Once approved, it'll appear in your order
                history.
              </Text>

              <TouchableOpacity
                style={styles.backStoreBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={16} color={brand.white} />
                <Text style={styles.backStoreBtnText}>Back to Store</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.orderAnotherLink}
                onPress={() => {
                  setPhase("input");
                  setUrl("");
                  setPreview(null);
                  setSelectedSize(null);
                  setSelectedColor(null);
                  setNotes("");
                }}
              >
                <Text style={styles.orderAnotherText}>Order another item</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 18 },

  // Input Phase
  heroSection: { alignItems: "center", gap: 10, marginBottom: 4 },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: "rgba(22,46,75,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  heroSub: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  inputCard: {
    backgroundColor: brand.offWhite,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  inputLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  urlInput: {
    flex: 1,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 0,
  },
  inputHint: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.navy,
    borderRadius: 14,
    paddingVertical: 15,
  },
  analyzeBtnDisabled: { opacity: 0.45 },
  analyzeBtnText: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  analyzingRow: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: -4,
  },
  analyzingText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // Preview Phase
  productCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: "hidden",
    backgroundColor: brand.offWhite,
  },
  productImage: { width: "100%", height: 200, backgroundColor: "#f5f5f5" },
  productImageFallback: {
    width: "100%",
    height: 120,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  productCardBody: { padding: 14, gap: 7 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  microLabel: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  editHint: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontStyle: "italic",
  },
  editableNameField: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    paddingBottom: 4,
  },
  productDesc: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },

  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 16,
  },
  priceSide: { flex: 1, gap: 5 },
  priceInputRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  dollarSign: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  priceInput: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    padding: 0,
    minWidth: 80,
    borderBottomWidth: 1.5,
    borderBottomColor: brand.border,
    paddingBottom: 2,
  },
  priceArrow: { marginHorizontal: 8 },
  conversionNote: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  bucksAmount: {
    color: brand.green,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
  },
  bucksAmountDanger: { color: brand.danger },
  dangerText: { color: brand.danger },

  variantSection: { gap: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: brand.white,
  },
  chipActive: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  chipText: { color: brand.text, fontFamily: "Inter_500Medium", fontSize: 14 },
  chipTextActive: { color: brand.green, fontFamily: "Inter_600SemiBold" },

  notesInput: {
    backgroundColor: brand.offWhite,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 12,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 80,
    lineHeight: 20,
  },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: brand.green,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  insufficientText: {
    color: brand.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: -6,
  },
  backLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 4,
  },
  backLinkText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },

  // Success Phase
  successContainer: { alignItems: "center", gap: 16, paddingTop: 48 },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
  },
  successSub: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  backStoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: brand.navy,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  backStoreBtnText: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  orderAnotherLink: { paddingTop: 4 },
  orderAnotherText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
