import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { brand } from "@/constants/colors";
import { SignupTier, useSignup } from "@/contexts/SignupContext";

type Tier = {
  key: SignupTier;
  name: string;
  blurb: string;
  monthlyCents: number | null;
  employees: string;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    key: "small",
    name: "A Little Better",
    blurb: "Best for small teams getting started.",
    monthlyCents: 879,
    employees: "Up to 25 employees",
  },
  {
    key: "mid",
    name: "Much Better",
    blurb: "Most popular for growing teams.",
    monthlyCents: 1519,
    employees: "Up to 75 employees",
    popular: true,
  },
  {
    key: "large",
    name: "A LOT Better",
    blurb: "For mid-size organizations.",
    monthlyCents: 2399,
    employees: "Up to 150 employees",
  },
  {
    key: "enterprise",
    name: "How much Better?",
    blurb: "Custom pricing for unlimited teams.",
    monthlyCents: null,
    employees: "Unlimited employees",
  },
];

export default function SignupPlanScreen() {
  const { draft, update } = useSignup();

  const handleNext = () => {
    if (draft.tier === "enterprise") {
      router.push("/signup/confirmation?contact=1");
      return;
    }
    router.push("/signup/payment");
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Pick your plan</Text>
      <Text style={styles.sub}>
        Step 2 of 3 · 60-day free trial included on every paid plan
      </Text>

      <View style={{ height: 18 }} />

      {TIERS.map((tier) => (
        <PlanCard
          key={tier.key}
          tier={tier}
          selected={draft.tier === tier.key}
          onSelect={() => update({ tier: tier.key })}
        />
      ))}

      <Button
        testID="signup-plan-next"
        title={
          draft.tier === "enterprise"
            ? "Request a quote"
            : "Continue to payment"
        }
        onPress={handleNext}
        style={{ marginTop: 12 }}
      />
    </ScreenContainer>
  );
}

function PlanCard({
  tier,
  selected,
  onSelect,
}: {
  tier: Tier;
  selected: boolean;
  onSelect: () => void;
}) {
  const priceLabel = formatPrice(tier.monthlyCents);
  return (
    <Pressable
      testID={`plan-${tier.key}`}
      onPress={onSelect}
      style={[planStyles.card, selected ? planStyles.cardSelected : null]}
    >
      <View style={planStyles.cardHeader}>
        <Text style={[planStyles.name, selected ? { color: brand.navy } : null]}>
          {tier.name}
        </Text>
        <View style={planStyles.priceRow}>
          {tier.popular && (
            <View style={planStyles.popularBadge}>
              <Text style={planStyles.popularText}>Popular</Text>
            </View>
          )}
          <Text style={[planStyles.price, selected ? { color: brand.green } : null]}>
            {priceLabel}
          </Text>
        </View>
      </View>
      <Text style={planStyles.blurb}>{tier.blurb}</Text>
      <View style={planStyles.metaRow}>
        <Ionicons
          name="people-outline"
          size={13}
          color={selected ? brand.green : brand.textMuted}
        />
        <Text style={[planStyles.meta, selected ? { color: brand.green } : null]}>
          {tier.employees}
        </Text>
      </View>
      {selected && (
        <View style={planStyles.checkRow}>
          <Ionicons name="checkmark-circle" size={16} color={brand.green} />
          <Text style={planStyles.checkText}>Selected</Text>
        </View>
      )}
    </Pressable>
  );
}

function formatPrice(cents: number | null): string {
  if (cents == null) return "Contact us";
  const monthly = cents / 100;
  return `$${monthly.toFixed(2)}/mo`;
}

const planStyles = StyleSheet.create({
  card: {
    backgroundColor: brand.white,
    borderColor: brand.border,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  cardSelected: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.04)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  popularBadge: {
    backgroundColor: "rgba(46,125,50,0.10)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.20)",
  },
  popularText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  price: {
    color: brand.textSecondary,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  blurb: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  meta: {
    color: brand.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(46,125,50,0.15)",
  },
  checkText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});

const styles = StyleSheet.create({
  heading: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  sub: {
    color: brand.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
});
