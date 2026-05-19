import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Users,
  Zap,
  Crown,
  Building2,
  Check,
  DollarSign,
  RotateCcw,
  ExternalLink,
  TrendingDown,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const NAVY = "#162A4A";

const TIERS = [
  { id: "starter", name: "Starter", bucks: 50, price: 50, icon: Users, popular: false },
  { id: "growth", name: "Growth", bucks: 400, price: 400, icon: Zap, popular: true },
  { id: "pro", name: "Pro", bucks: 750, price: 750, icon: Crown, popular: false },
  { id: "custom", name: "Custom", bucks: null, price: null, icon: Building2, popular: false },
];

interface CreditStatus {
  planBucks: number;
  orgBucksBalance: number;
  lastRecallMonth: string | null;
  tier: string | null;
  recallHistory: Array<{ month: string; recalled: number; creditApplied: number; createdAt: string }>;
}

interface ManagerEmployeeCounts {
  admins: Array<{ adminId: number; adminName: string; employeeCount: number }>;
  totalEmployees: number;
}

function TierBadge({ tier }: { tier: string | null }) {
  const map: Record<string, string> = {
    starter: "bg-blue-100 text-blue-700",
    growth: "bg-green-100 text-green-700",
    pro: "bg-purple-100 text-purple-700",
    custom: "bg-orange-100 text-orange-700",
  };
  const label = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "No Plan";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[tier ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

export default function AdminSubscriptionPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customBucks, setCustomBucks] = useState<number | "">("");

  const { data: creditStatus, isLoading } = useQuery<CreditStatus>({
    queryKey: ["/api/org/credit-status"],
    enabled: user?.role === "prime_admin",
    staleTime: 30000,
  });

  const { data: empData } = useQuery<ManagerEmployeeCounts>({
    queryKey: ["/api/org/manager-employee-counts"],
    enabled: user?.role === "prime_admin" || user?.role === "admin",
    staleTime: 60000,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/billing-portal");
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast({ title: "Error", description: "Could not open billing portal.", variant: "destructive" }),
  });

  const changePlanMutation = useMutation({
    mutationFn: async () => {
      const body: { tier: string; customBucks?: number } = { tier: selectedTier! };
      if (selectedTier === "custom") body.customBucks = customBucks as number;
      const res = await apiRequest("POST", "/api/organizations/setup-billing", body);
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast({ title: "Error", description: "Could not start plan change.", variant: "destructive" }),
  });

  const isValid =
    selectedTier !== null &&
    (selectedTier !== "custom" || (typeof customBucks === "number" && customBucks >= 1));

  const totalEmployees = empData?.totalEmployees ?? empData?.admins?.reduce((s, a) => s + a.employeeCount, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }} data-testid="text-subscription-title">
            Subscription Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your monthly Buck budget, view billing history, and update your payment method.
          </p>
        </div>

        {isLoading ? (
          <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
        ) : (
          <>
            {/* Current Plan Card */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ background: `${NAVY}08` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: NAVY }}>
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Current Plan</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg" style={{ color: NAVY }}>
                        {creditStatus?.planBucks ?? 0} Bucks/month
                      </span>
                      <TierBadge tier={creditStatus?.tier ?? null} />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Monthly price</p>
                  <p className="text-lg font-bold" style={{ color: NAVY }}>
                    ${creditStatus?.planBucks ?? 0}
                    <span className="text-xs font-normal text-gray-400">/mo</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x">
                <div className="px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Available Pool</p>
                  <p className="text-xl font-bold text-green-600">{creditStatus?.orgBucksBalance ?? 0}</p>
                  <p className="text-[11px] text-gray-400">Bucks</p>
                </div>
                <div className="px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Max This Month</p>
                  <p className="text-xl font-bold" style={{ color: NAVY }}>{creditStatus?.planBucks ?? 0}</p>
                  <p className="text-[11px] text-gray-400">Bucks</p>
                </div>
                <div className="px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Employees</p>
                  <p className="text-xl font-bold" style={{ color: NAVY }}>{totalEmployees}</p>
                  <p className="text-[11px] text-gray-400">active</p>
                </div>
              </div>
            </div>

            {/* Change Plan */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setShowChangePlan(!showChangePlan)}
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5" style={{ color: NAVY }} />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Change Monthly Bucks</p>
                    <p className="text-xs text-gray-500">Select a new plan — you'll go through Stripe to update billing</p>
                  </div>
                </div>
                {showChangePlan ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {showChangePlan && (
                <div className="px-6 pb-6 border-t pt-5 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TIERS.map((tier) => {
                      const Icon = tier.icon;
                      const isSelected = selectedTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setSelectedTier(tier.id)}
                          className={`relative text-left rounded-xl border-2 p-3 transition-all focus:outline-none ${
                            isSelected
                              ? "border-[#162A4A] bg-[#162A4A]/5 shadow-md"
                              : "border-gray-200 hover:border-[#162A4A]/40 bg-white"
                          }`}
                        >
                          {tier.popular && (
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                              <Badge className="text-[10px] px-2 py-0">Popular</Badge>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(22,42,74,0.1)" }}>
                              <Icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: NAVY }}>
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="font-semibold text-gray-900 text-xs">{tier.name}</p>
                          {tier.bucks !== null ? (
                            <p className="text-base font-bold mt-0.5" style={{ color: NAVY }}>
                              ${tier.price}<span className="text-[10px] font-normal text-gray-400">/mo</span>
                            </p>
                          ) : (
                            <p className="text-sm font-bold mt-0.5" style={{ color: NAVY }}>You Choose</p>
                          )}
                          <p className="text-[10px] text-gray-400">
                            {tier.bucks !== null ? `${tier.bucks} Bucks` : "1 Buck = $1"}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedTier === "custom" && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <Label htmlFor="sub-custom-bucks" className="text-sm font-medium text-gray-700 mb-2 block">
                        How many Bucks per month?
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="sub-custom-bucks"
                          type="number"
                          min={1}
                          value={customBucks}
                          onChange={(e) => setCustomBucks(parseInt(e.target.value) || "")}
                          placeholder="e.g. 200"
                          className="max-w-[160px]"
                          autoFocus
                        />
                        <span className="text-sm text-gray-500">
                          = <strong>${typeof customBucks === "number" ? customBucks.toLocaleString() : 0}/mo</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      disabled={!isValid || changePlanMutation.isPending}
                      onClick={() => changePlanMutation.mutate()}
                      className="flex-1 sm:flex-none"
                    >
                      {changePlanMutation.isPending ? "Redirecting…" : "Continue to Stripe →"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowChangePlan(false); setSelectedTier(null); setCustomBucks(""); }}>
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Changing your plan requires updating your Stripe subscription. You'll be redirected to complete the change securely.
                  </p>
                </div>
              )}
            </div>

            {/* Billing Portal */}
            <div className="rounded-xl border bg-white shadow-sm px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">Payment Method &amp; Invoices</p>
                  <p className="text-xs text-gray-500">Manage your card, view past invoices, and download receipts via Stripe</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                {portalMutation.isPending ? "Opening…" : "Open Portal"}
              </Button>
            </div>

            {/* Keep Your Bucks explainer */}
            <div className="rounded-xl border px-6 py-5 flex items-start gap-4" style={{ background: `${NAVY}06`, borderColor: `${NAVY}20` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}15` }}>
                <RotateCcw className="h-5 w-5" style={{ color: NAVY }} />
              </div>
              <div>
                <p className="font-bold text-sm mb-1" style={{ color: NAVY }}>Keep Your Bucks™ — How Billing Works</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Each month you receive a fresh pool of Bucks equal to your plan amount. Any Bucks still sitting in{" "}
                  <strong>admin accounts</strong> at month-end are automatically returned to your organization pool and
                  applied as a <strong>credit against your next invoice</strong>. Bucks already earned by employees are
                  always theirs to keep — only unspent admin Bucks are recalled.
                </p>
                <p className="text-xs text-gray-400 italic mt-2">
                  Example: 400 Bucks/month plan, admins spent 310 → 90 Bucks recalled → next month's charge is $310 instead of $400.
                </p>
              </div>
            </div>

            {/* Recall History */}
            {(creditStatus?.recallHistory?.length ?? 0) > 0 && (
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">Recall History</h2>
                  <span className="text-xs text-gray-400 ml-auto">Last 12 months</span>
                </div>
                <div className="divide-y">
                  {creditStatus!.recallHistory.map((row) => (
                    <div key={row.month} className="px-6 py-3 flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">{row.month}</span>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-gray-400">Recalled</p>
                          <p className="font-semibold text-gray-800">{row.recalled} Bucks</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Bill Credit</p>
                          <p className="font-semibold text-green-600">${row.creditApplied}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
