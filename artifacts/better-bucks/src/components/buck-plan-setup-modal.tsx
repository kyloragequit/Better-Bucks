import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Users, Zap, Crown, Check, DollarSign, Building2, RotateCcw, ArrowRight, RefreshCw } from "lucide-react";

const NAVY = "#162A4A";
const GREEN = "#4E9F3D";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    bucks: 50,
    price: 50,
    icon: Users,
    description: "Small teams",
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    bucks: 400,
    price: 400,
    icon: Zap,
    description: "Growing teams",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    bucks: 750,
    price: 750,
    icon: Crown,
    description: "Large teams",
    popular: false,
  },
  {
    id: "custom",
    name: "Custom",
    bucks: null,
    price: null,
    icon: Building2,
    description: "You choose",
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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(22,42,74,0.97)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8 space-y-6">

          {/* Header */}
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: "rgba(22,42,74,0.1)" }}
            >
              <DollarSign className="h-7 w-7" style={{ color: NAVY }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Monthly Bucks</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
              Your login plan is all set. Now pick how many Bucks your organization
              gets each month — this is your rewards budget.
            </p>
          </div>

          {/* Keep Your Bucks™ explainer — prominent, above tier selection */}
          <div
            className="rounded-xl border p-5 space-y-4"
            style={{ background: `${NAVY}06`, borderColor: `${NAVY}20` }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${NAVY}15` }}
              >
                <RotateCcw className="h-4 w-4" style={{ color: NAVY }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: NAVY }}>Keep Your Bucks™</p>
                <p className="text-xs text-gray-500">You only pay for Bucks your team actually uses</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-white border border-gray-100 px-3 py-3 shadow-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-2"
                  style={{ background: NAVY }}
                >1</div>
                <p className="text-xs font-semibold text-gray-800 mb-1">Bucks arrive monthly</p>
                <p className="text-[11px] text-gray-500">Your plan Bucks are deposited to your org pool at the start of each month</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 px-3 py-3 shadow-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-2"
                  style={{ background: NAVY }}
                >2</div>
                <p className="text-xs font-semibold text-gray-800 mb-1">Admins distribute them</p>
                <p className="text-[11px] text-gray-500">You allocate Bucks to your team — employees earn and spend them in the app</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 px-3 py-3 shadow-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-2"
                  style={{ background: GREEN }}
                >3</div>
                <p className="text-xs font-semibold text-gray-800 mb-1">Unspent admin Bucks return</p>
                <p className="text-[11px] text-gray-500">Any Bucks still in admin accounts at month-end come back and reduce your next bill</p>
              </div>
            </div>

            <div
              className="rounded-lg px-4 py-3 flex items-start gap-3 text-xs"
              style={{ background: `${GREEN}12`, borderLeft: `3px solid ${GREEN}` }}
            >
              <RefreshCw className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: GREEN }} />
              <div>
                <span className="font-semibold" style={{ color: GREEN }}>Example: </span>
                <span className="text-gray-600">
                  You're on the 400 Bucks/month plan ($400/mo). Your admins only distributed 310 Bucks.
                  At month-end, 90 Bucks return to your pool and your next invoice is <strong>$310</strong> instead of $400.
                  Bucks already earned by employees are always theirs to keep.
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              1 Buck = $1 &mdash; simple, transparent pricing for every organization
            </p>
          </div>

          {/* Tier selection */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                      <Icon className="h-4 w-4" style={{ color: NAVY }} />
                    </div>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: NAVY }}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{tier.name}</p>
                  <p className="text-xs text-gray-400 mb-2">{tier.description}</p>
                  {tier.bucks !== null ? (
                    <p className="text-xl font-bold" style={{ color: NAVY }}>
                      ${tier.price}
                      <span className="text-xs font-normal text-gray-400">/mo</span>
                    </p>
                  ) : (
                    <p className="text-base font-bold" style={{ color: NAVY }}>You Choose</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {tier.bucks !== null ? `${tier.bucks} Bucks` : "any amount"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom bucks input */}
          {selectedTier === "custom" && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
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
                1 Buck = $1. Unspent admin Bucks are recalled and credited — you never overpay.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              disabled={!isValid || setupMutation.isPending}
              onClick={() => setupMutation.mutate()}
            >
              {setupMutation.isPending
                ? "Redirecting to payment…"
                : (
                  <span className="flex items-center gap-2">
                    Continue to Payment
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )
              }
            </Button>

            {setupMutation.isError && (
              <p className="text-xs text-red-600 text-center">
                Something went wrong — please try again.
              </p>
            )}

            <p className="text-center text-xs text-gray-400">
              You'll be redirected to Stripe to securely add your payment method.
              You can change your Buck plan any time from the Subscription page.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
