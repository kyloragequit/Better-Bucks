import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={planStyles.name}>{tier.name}</Text>
        <Text style={planStyles.price}>{priceLabel}</Text>
      </View>
      <Text style={planStyles.blurb}>{tier.blurb}</Text>
      <Text style={planStyles.meta}>{tier.employees}</Text>
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 4,
  },
  cardSelected: {
    borderColor: brand.gold,
    backgroundColor: "rgba(245,200,66,0.08)",
  },
  name: {
    color: brand.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  price: {
    color: brand.gold,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  blurb: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  meta: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  heading: {
    color: brand.white,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  sub: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
});
