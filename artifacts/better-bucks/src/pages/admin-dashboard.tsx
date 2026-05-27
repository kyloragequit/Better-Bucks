import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { useUser } from "@/hooks/use-auth";
import { PasskeyFirstTimePrompt } from "@/components/passkey-manager";
import { TopRewardedLeaderboard } from "@/components/top-rewarded-leaderboard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Wallet, Users, Car, Crown, RefreshCw, Lock, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DashboardSummary = {
  bucksInTheBank: number;
  admins: {
    id: number;
    name: string;
    balance: number;
    avgMonthlySpend: number;
    lastAllocatedMonth: string | null;
    allocatedBucksThisMonth: number;
  }[];
  employees: { id: number; name: string; balance: number; ordersCount: number; spent30Days: number }[];
};

type AutoAllocation = { id: number; orgId: number; adminUserId: number; monthlyBucks: number; active: boolean };
type AllocRule = { monthly: string; sendNow: string };

export default function AdminDashboardPage() {
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPrime = currentUser?.role === "prime_admin";

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [showAutoAlloc, setShowAutoAlloc] = useState(false);
  const [showManualAlloc, setShowManualAlloc] = useState(false);
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([]);
  const [bucksEach, setBucksEach] = useState("");
  const [showOverBudgetDialog, setShowOverBudgetDialog] = useState(false);
  const [allocRules, setAllocRules] = useState<Record<number, AllocRule>>({});
  const [rulesInitialized, setRulesInitialized] = useState(false);

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/org/dashboard-summary"],
  });

  const { data: autoAllocsData } = useQuery<{ allocations: AutoAllocation[] }>({
    queryKey: ["/api/org/auto-allocations"],
    enabled: isPrime,
  });

  const admins = summary?.admins ?? [];
  const employees = summary?.employees ?? [];
  const allocatableAdmins = admins.filter(a => a.id !== currentUser?.id);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/org/dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/org/auto-allocations"] });
  };

  useEffect(() => {
    if (showAutoAlloc && autoAllocsData && !rulesInitialized && allocatableAdmins.length > 0) {
      const rules: Record<number, AllocRule> = {};
      for (const admin of allocatableAdmins) {
        const existing = autoAllocsData.allocations.find(a => a.adminUserId === admin.id);
        rules[admin.id] = { monthly: existing ? String(existing.monthlyBucks) : "", sendNow: "" };
      }
      setAllocRules(rules);
      setRulesInitialized(true);
    }
    if (!showAutoAlloc) setRulesInitialized(false);
  }, [showAutoAlloc, autoAllocsData, allocatableAdmins.length, rulesInitialized]);

  const { mutate: saveAutoAllocRules, isPending: savingRules } = useMutation({
    mutationFn: async () => {
      for (const admin of allocatableAdmins) {
        const rule = allocRules[admin.id];
        if (!rule) continue;
        const monthly = parseInt(rule.monthly) || 0;
        const sendNow = parseInt(rule.sendNow) || 0;
        const hasExisting = autoAllocsData?.allocations.some(a => a.adminUserId === admin.id);
        if (monthly > 0 || sendNow > 0) {
          await apiRequest("PUT", "/api/org/auto-allocations", {
            adminUserId: admin.id,
            monthlyBucks: monthly,
            ...(sendNow > 0 ? { manualBucksNow: sendNow } : {}),
          });
        } else if (hasExisting) {
          await apiRequest("PUT", "/api/org/auto-allocations", { adminUserId: admin.id, monthlyBucks: 0 });
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Auto-allocation saved!" });
      setShowAutoAlloc(false);
      setAllocRules({});
      setRulesInitialized(false);
    },
    onError: (e: Error) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const { mutate: allocate, isPending: allocating } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/org/allocate-budget", {
      adminIds: selectedAdmins,
      bucksEach: Math.max(1, parseInt(bucksEach) || 0),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      invalidateAll();
      const skippedCount = data.skipped?.length ?? 0;
      const msg = skippedCount
        ? `${data.total.toLocaleString()} Bucks sent to ${data.allocated} manager${data.allocated !== 1 ? "s" : ""}. ${skippedCount} already allocated this month.`
        : `${data.total.toLocaleString()} Bucks sent to ${data.allocated} manager${data.allocated !== 1 ? "s" : ""}.`;
      toast({ title: "Budget allocated!", description: msg });
      setSelectedAdmins([]);
      setBucksEach("");
      setShowOverBudgetDialog(false);
      setShowManualAlloc(false);
    },
    onError: (e: Error) => {
      setShowOverBudgetDialog(false);
      toast({ title: "Allocation failed", description: e.message, variant: "destructive" });
    },
  });

  const bucksInTheBank = summary?.bucksInTheBank ?? 0;
  const totalAdminBalance = admins.reduce((s, a) => s + a.balance, 0);
  const totalEmployeeBalance = employees.reduce((s, e) => s + e.balance, 0);

  const crownAdminId = admins.length > 0 && admins.some(a => a.avgMonthlySpend > 0)
    ? admins.reduce((best, a) => a.avgMonthlySpend > best.avgMonthlySpend ? a : best).id
    : null;

  const unlockedSelected = selectedAdmins.filter(id => {
    const admin = admins.find(a => a.id === id);
    return !admin || admin.lastAllocatedMonth !== currentMonth;
  });
  const allocationAmount = (parseInt(bucksEach) || 0) * unlockedSelected.length;
  const wouldExceedAvailable = allocationAmount > bucksInTheBank;

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  return (
    <AdminLayout>
      {currentUser && <div className="mb-4"><PasskeyFirstTimePrompt userId={currentUser.id} /></div>}

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your organization's Bucks at a glance</p>
      </div>

      <div className="space-y-6">
        {/* ── Section 1: Bucks in the Bank ── */}
        <Card className="border shadow-sm border-blue-200" data-testid="card-bucks-in-the-bank">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Wallet className="h-4 w-4" />
              </div>
              Bucks in the Bank
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-4xl font-bold text-blue-700 tabular-nums" data-testid="text-bucks-in-the-bank">
                {bucksInTheBank.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Unallocated Bucks available to distribute to your team</p>
            </div>

            {isPrime && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant={showAutoAlloc ? "default" : "outline"}
                  onClick={() => { setShowAutoAlloc(!showAutoAlloc); setShowManualAlloc(false); }}
                  data-testid="button-auto-allocate-toggle"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  {showAutoAlloc ? "Close" : "Set up monthly auto-allocation"}
                </Button>
                <Button
                  size="sm"
                  variant={showManualAlloc ? "default" : "outline"}
                  onClick={() => { setShowManualAlloc(!showManualAlloc); setShowAutoAlloc(false); }}
                  data-testid="button-manual-allocate-toggle"
                >
                  {showManualAlloc ? "Close" : "Manual allocation"}
                </Button>
              </div>
            )}

            {/* Auto-allocation setup panel */}
            {showAutoAlloc && isPrime && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Monthly Auto-Allocation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set a recurring monthly amount per manager. Optionally send Bucks now — each manager can only receive one allocation per month, resetting at the start of each billing cycle.
                  </p>
                </div>

                {allocatableAdmins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No managers found.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-[1fr_110px_110px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <span>Manager</span>
                      <span className="text-center">Monthly auto</span>
                      <span className="text-center">Send now</span>
                    </div>
                    <div className="divide-y">
                      {allocatableAdmins.map(admin => {
                        const rule = allocRules[admin.id] ?? { monthly: "", sendNow: "" };
                        const alreadyAllocated = admin.lastAllocatedMonth === currentMonth;
                        return (
                          <div key={admin.id} className="grid grid-cols-[1fr_110px_110px] gap-2 items-center px-3 py-2.5 bg-background">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{admin.name}</p>
                              {alreadyAllocated ? (
                                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                                  {admin.allocatedBucksThisMonth.toLocaleString()} sent this month
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">{admin.balance.toLocaleString()} Bucks</p>
                              )}
                            </div>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={rule.monthly}
                              onChange={e => setAllocRules(prev => ({ ...prev, [admin.id]: { ...rule, monthly: e.target.value } }))}
                              className="h-8 text-sm text-center"
                              placeholder="0"
                            />
                            {alreadyAllocated ? (
                              <div className="flex items-center justify-center gap-1 h-8 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" />
                                <span>Locked</span>
                              </div>
                            ) : (
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={rule.sendNow}
                                onChange={e => setAllocRules(prev => ({ ...prev, [admin.id]: { ...rule, sendNow: e.target.value } }))}
                                className="h-8 text-sm text-center"
                                placeholder="0"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  disabled={savingRules || allocatableAdmins.length === 0}
                  onClick={() => saveAutoAllocRules()}
                  data-testid="button-save-auto-alloc"
                >
                  {savingRules ? "Saving…" : "Save & Apply"}
                </Button>
              </div>
            )}

            {/* Manual allocation panel */}
            {showManualAlloc && isPrime && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Manual Allocation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select managers and send Bucks now. Each manager can only receive one allocation per month — Bucks are deducted from your Bucks in the Bank.
                  </p>
                </div>
                {allocatableAdmins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No managers found.</p>
                ) : (
                  <div className="space-y-1">
                    {allocatableAdmins.map(a => {
                      const alreadyAllocated = a.lastAllocatedMonth === currentMonth;
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2 py-1.5 px-1 rounded ${alreadyAllocated ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/30"}`}
                        >
                          <Checkbox
                            checked={selectedAdmins.includes(a.id)}
                            disabled={alreadyAllocated}
                            onCheckedChange={checked => {
                              if (alreadyAllocated) return;
                              setSelectedAdmins(prev => checked ? [...prev, a.id] : prev.filter(id => id !== a.id));
                            }}
                            data-testid={`checkbox-admin-${a.id}`}
                          />
                          <span className="text-sm flex-1 truncate">{a.name}</span>
                          {alreadyAllocated ? (
                            <Badge variant="secondary" className="text-xs font-normal gap-1 flex-shrink-0">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              {a.allocatedBucksThisMonth.toLocaleString()} sent
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{a.balance.toLocaleString()} Bucks</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={bucksEach}
                    onChange={e => setBucksEach(e.target.value)}
                    placeholder="Bucks each"
                    className="w-28 h-8 text-sm"
                    data-testid="input-bucks-each"
                  />
                  <Button
                    size="sm"
                    disabled={unlockedSelected.length === 0 || !bucksEach || allocating}
                    onClick={() => wouldExceedAvailable ? setShowOverBudgetDialog(true) : allocate()}
                    data-testid="button-allocate"
                  >
                    {allocating
                      ? "Allocating…"
                      : `Allocate to ${unlockedSelected.length} manager${unlockedSelected.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
                {allocationAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: <strong>{allocationAmount.toLocaleString()} Bucks</strong>
                    {wouldExceedAvailable && (
                      <span className="text-amber-600 ml-1">(exceeds {bucksInTheBank.toLocaleString()} available)</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2: Bucks on the Way ── */}
        <Card className="border shadow-sm border-amber-200" data-testid="card-bucks-on-the-way">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Car className="h-4 w-4" />
                </div>
                Bucks on the Way
              </div>
              <span className="text-sm font-normal text-muted-foreground" data-testid="text-total-admin-balance">
                Total: <strong className="text-foreground">{totalAdminBalance.toLocaleString()} Bucks</strong>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Manager balances — unspent Bucks are recalled to Bucks in the Bank at end of billing cycle
            </p>
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No managers found.</p>
            ) : (
              <div className="divide-y rounded-lg border overflow-hidden">
                {admins.map(a => {
                  const isCrown = a.id === crownAdminId;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors"
                      data-testid={`row-admin-${a.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isCrown && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Highest average monthly spend" />
                        )}
                        <span className="text-sm font-medium truncate">{a.name}</span>
                        {isCrown && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                            (avg {a.avgMonthlySpend.toLocaleString()}/mo)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {a.lastAllocatedMonth === currentMonth && (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 gap-1 hidden sm:flex">
                            <CheckCircle2 className="h-3 w-3" />
                            Allocated
                          </Badge>
                        )}
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                          {a.balance.toLocaleString()} Bucks
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Employee Balances ── */}
        <Card className="border shadow-sm border-emerald-200" data-testid="card-employee-balances">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Users className="h-4 w-4" />
                </div>
                Employee Balances
              </div>
              <span className="text-sm font-normal text-muted-foreground" data-testid="text-total-employee-balance">
                Total: <strong className="text-foreground">{totalEmployeeBalance.toLocaleString()} Bucks</strong>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees found.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="sm:hidden divide-y rounded-lg border overflow-hidden overflow-y-auto max-h-[296px]">
                  {employees.map(e => (
                    <div key={e.id} className="px-3 py-2.5 bg-background" data-testid={`row-employee-mobile-${e.id}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{e.name}</span>
                        <span className="text-sm font-semibold tabular-nums ml-2 whitespace-nowrap">
                          {e.balance.toLocaleString()} Bucks
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {e.ordersCount} order{e.ordersCount !== 1 ? "s" : ""} (30d)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.spent30Days.toLocaleString()} spent (30d)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[234px] rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-muted/50">
                        <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Orders (30d)</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Spent (30d)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {employees.map((e, i) => (
                        <tr
                          key={e.id}
                          className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                          data-testid={`row-employee-${e.id}`}
                        >
                          <td className="px-3 py-2 font-medium">{e.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{e.balance.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.ordersCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.spent30Days.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Top Rewarded ── */}
        <TopRewardedLeaderboard />
      </div>

      {/* Over-budget confirmation dialog */}
      <AlertDialog open={showOverBudgetDialog} onOpenChange={setShowOverBudgetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exceeds available Bucks</AlertDialogTitle>
            <AlertDialogDescription>
              This allocation ({allocationAmount.toLocaleString()} Bucks) exceeds what is currently in Bucks in the Bank ({bucksInTheBank.toLocaleString()} Bucks). Proceed anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => allocate()}>Allocate anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
