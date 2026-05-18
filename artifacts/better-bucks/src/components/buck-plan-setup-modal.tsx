import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Users, Zap, Crown, Check, DollarSign, Building2, RotateCcw } from "lucide-react";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    bucks: 50,
    price: 50,
    icon: Users,
    description: "Small teams",
    features: ["50 Bucks/month", "1 Buck = $1", "Admin dashboard", "Basic reporting"],
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    bucks: 400,
    price: 400,
    icon: Zap,
    description: "Growing teams",
    features: ["400 Bucks/month", "1 Buck = $1", "Admin dashboard", "Advanced reporting"],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    bucks: 750,
    price: 750,
    icon: Crown,
    description: "Large teams",
    features: ["750 Bucks/month", "1 Buck = $1", "Admin dashboard", "Priority support"],
    popular: false,
  },
  {
    id: "custom",
    name: "Custom",
    bucks: null,
    price: null,
    icon: Building2,
    description: "You choose",
    features: ["Any amount of Bucks", "1 Buck = $1", "Admin dashboard", "Dedicated support"],
    popular: false,
  },
];

export function BuckPlanSetupModal() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customBucks, setCustomBucks] = useState<number | "">("");

  const setupMutation = useMutation({
    mutationFn: async () => {
      const body: { tier: string; customBucks?: number } = { tier: selectedTier! };
      if (selectedTier === "custom") body.customBucks = customBucks as number;
      const res = await apiRequest("POST", "/api/organizations/setup-billing", body);
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const isValid =
    selectedTier !== null &&
    (selectedTier !== "custom" || (typeof customBucks === "number" && customBucks >= 1));

  const selectedTierData = TIERS.find((t) => t.id === selectedTier);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(22,42,74,0.97)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-7">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: "rgba(22,42,74,0.1)" }}
            >
              <DollarSign className="h-7 w-7" style={{ color: "#162A4A" }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Monthly Bucks</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
              Select how many Bucks your organization gets each month. 1 Buck = $1 — you're only
              ever billed for what you actually need thanks to Keep Your Bucks™.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative text-left rounded-xl border-2 p-4 transition-all focus:outline-none ${
                    isSelected
                      ? "border-[#162A4A] bg-[#162A4A]/5 shadow-md"
                      : "border-gray-200 hover:border-[#162A4A]/40 bg-white"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge className="text-[10px] px-2 py-0">Most Popular</Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(22,42,74,0.1)" }}
                    >
                      <Icon className="h-4 w-4" style={{ color: "#162A4A" }} />
                    </div>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "#162A4A" }}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{tier.name}</p>
                  <p className="text-xs text-gray-400 mb-2">{tier.description}</p>
                  {tier.bucks !== null ? (
                    <p className="text-xl font-bold" style={{ color: "#162A4A" }}>
                      ${tier.price}
                      <span className="text-xs font-normal text-gray-400">/mo</span>
                    </p>
                  ) : (
                    <p className="text-base font-bold" style={{ color: "#162A4A" }}>
                      You Choose
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {tier.bucks !== null ? `${tier.bucks} Bucks` : "1 Buck = $1"}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedTier === "custom" && (
            <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <Label htmlFor="setup-custom-bucks" className="text-sm font-medium text-gray-700 mb-2 block">
                How many Bucks per month?
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="setup-custom-bucks"
                  type="number"
                  min={1}
                  value={customBucks}
                  onChange={(e) => setCustomBucks(parseInt(e.target.value) || "")}
                  placeholder="e.g. 200"
                  className="max-w-[180px]"
                  autoFocus
                />
                <span className="text-sm text-gray-500">
                  ={" "}
                  <strong>
                    ${typeof customBucks === "number" ? customBucks.toLocaleString() : 0}/month
                  </strong>
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                1 Buck = $1. You're only charged for Bucks that aren't recalled at month-end.
              </p>
            </div>
          )}

          {selectedTierData && (
            <div className="mb-5 flex flex-wrap gap-2">
              {selectedTierData.features.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-full px-3 py-1 font-medium"
                >
                  <Check className="h-3 w-3" />
                  {f}
                </span>
              ))}
            </div>
          )}

          <div className="mb-5 p-3 rounded-lg border flex items-start gap-3" style={{ background: "rgba(22,42,74,0.04)", borderColor: "rgba(22,42,74,0.15)" }}>
            <RotateCcw className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#162A4A" }} />
            <p className="text-xs text-gray-600">
              <strong style={{ color: "#162A4A" }}>Keep Your Bucks™</strong> — Unspent admin Bucks
              at month-end return to your pool and reduce your next bill. You'll never be charged
              for Bucks you didn't use.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={!isValid || setupMutation.isPending}
            onClick={() => setupMutation.mutate()}
          >
            {setupMutation.isPending ? "Redirecting to payment…" : "Continue to Payment →"}
          </Button>

          {setupMutation.isError && (
            <p className="text-xs text-red-600 text-center mt-2">
              Something went wrong — please try again.
            </p>
          )}

          <p className="text-center text-xs text-gray-400 mt-3">
            You'll be redirected to Stripe to securely add your payment method. To change your plan
            later, you'll go through this same Stripe flow.
          </p>
        </div>
      </div>
    </div>
  );
}
