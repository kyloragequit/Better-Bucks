import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "@/components/ui/loader";
import { useUser } from "@/hooks/use-auth";
import { PasskeyFirstTimePrompt } from "@/components/passkey-manager";
import { TopRewardedLeaderboard } from "@/components/top-rewarded-leaderboard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Wallet, Users, Car, Crown, RefreshCw } from "lucide-react";
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
  admins: { id: number; name: string; balance: number; avgMonthlySpend: number }[];
  employees: { id: number; name: string; balance: number; ordersCount: number; spent30Days: number }[];
};

type BudgetSettings = {
  monthlyBudgetBucks: number;
  budgetSetByName: string | null;
  bucksPerDollar: number;
};

type ManagerCounts = {
  counts: { adminId: number; adminName: string; employeeCount: number; percentage: number }[];
  totalEmployees: number;
  unassigned: number;
  unassignedPercentage: number;
};

export default function AdminDashboardPage() {
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPrime = currentUser?.role === "prime_admin";

  const [showAutoAlloc, setShowAutoAlloc] = useState(false);
  const [showManualAlloc, setShowManualAlloc] = useState(false);
  const [budget, setBudget] = useState("");
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([]);
  const [bucksEach, setBucksEach] = useState("");
  const [autoAllocAmounts, setAutoAllocAmounts] = useState<Record<number, number> | null>(null);
  const [showOverBudgetDialog, setShowOverBudgetDialog] = useState(false);
  const budgetInitialized = useRef(false);

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/org/dashboard-summary"],
  });

  const { data: budgetSettings } = useQuery<BudgetSettings>({
    queryKey: ["/api/org/budget-settings"],
    enabled: isPrime,
  });

  const { data: mgrCounts } = useQuery<ManagerCounts>({
    queryKey: ["/api/org/manager-employee-counts"],
    enabled: isPrime,
  });

  useEffect(() => {
    if (budgetSettings && !budgetInitialized.current) {
      budgetInitialized.current = true;
      setBudget(String(budgetSettings.monthlyBudgetBucks));
    }
  }, [budgetSettings]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/org/dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/org/budget-settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
  };

  const { mutate: saveBudget, isPending: savingBudget } = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/org/budget-settings", {
      monthlyBudgetBucks: Math.max(0, parseInt(budget) || 0),
      bucksPerDollar: budgetSettings?.bucksPerDollar ?? 1,
    }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Budget saved" });
    },
    onError: (e: Error) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const { mutate: autoAllocMutate, isPending: allocatingAuto } = useMutation({
    mutationFn: (amounts: Record<number, number>) =>
      apiRequest("POST", "/api/org/allocate-budget-auto", {
        allocations: Object.entries(amounts).map(([id, amount]) => ({ adminId: Number(id), bucks: amount })),
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      invalidateAll();
      toast({
        title: "Auto allocation complete!",
        description: `${data.total.toLocaleString()} Bucks distributed to ${data.allocated} admin${data.allocated !== 1 ? "s" : ""}.`,
      });
      setAutoAllocAmounts(null);
      setShowAutoAlloc(false);
    },
    onError: (e: Error) => toast({ title: "Auto allocation failed", description: e.message, variant: "destructive" }),
  });

  const { mutate: allocate, isPending: allocating } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/org/allocate-budget", {
      adminIds: selectedAdmins,
      bucksEach: Math.max(1, parseInt(bucksEach) || 0),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      invalidateAll();
      toast({
        title: "Budget allocated!",
        description: `${data.total.toLocaleString()} Bucks sent to ${data.allocated} admin${data.allocated !== 1 ? "s" : ""}.`,
      });
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
  const admins = summary?.admins ?? [];
  const employees = summary?.employees ?? [];

  const totalAdminBalance = admins.reduce((s, a) => s + a.balance, 0);
  const totalEmployeeBalance = employees.reduce((s, e) => s + e.balance, 0);

  const crownAdminId = admins.length > 0 && admins.some(a => a.avgMonthlySpend > 0)
    ? admins.reduce((best, a) => a.avgMonthlySpend > best.avgMonthlySpend ? a : best).id
    : null;

  const allocationAmount = (parseInt(bucksEach) || 0) * selectedAdmins.length;
  const wouldExceedAvailable = allocationAmount > bucksInTheBank;

  const computeAutoAlloc = () => {
    if (!mgrCounts?.counts?.length) {
      toast({ title: "No manager data", description: "Cannot auto-allocate without manager-employee data.", variant: "destructive" });
      return;
    }
    if (bucksInTheBank <= 0) {
      toast({ title: "No Bucks available", description: "Bucks in the Bank is empty.", variant: "destructive" });
      return;
    }
    const allAdminsList = mgrCounts.counts;
    const totalWeight = allAdminsList.reduce((sum, c) => sum + c.employeeCount + 1, 0);
    const autoAmounts: Record<number, number> = {};
    let totalUsed = 0;
    for (const c of allAdminsList) {
      const weight = c.employeeCount + 1;
      const share = Math.floor((weight / totalWeight) * bucksInTheBank);
      autoAmounts[c.adminId] = share;
      totalUsed += share;
    }
    let leftover = bucksInTheBank - totalUsed;
    const sorted = [...allAdminsList].sort((a, b) => b.employeeCount - a.employeeCount);
    for (const c of sorted) {
      if (leftover <= 0) break;
      autoAmounts[c.adminId]++;
      leftover--;
    }
    setAutoAllocAmounts(autoAmounts);
  };

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
                  onClick={() => { setShowAutoAlloc(!showAutoAlloc); setShowManualAlloc(false); setAutoAllocAmounts(null); }}
                  data-testid="button-auto-allocate-toggle"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  {showAutoAlloc ? "Close" : "Set up monthly auto-allocation"}
                </Button>
                <Button
                  size="sm"
                  variant={showManualAlloc ? "default" : "outline"}
                  onClick={() => { setShowManualAlloc(!showManualAlloc); setShowAutoAlloc(false); setAutoAllocAmounts(null); }}
                  data-testid="button-manual-allocate-toggle"
                >
                  {showManualAlloc ? "Close" : "Manual allocation"}
                </Button>
              </div>
            )}

            {/* Auto-allocation panel */}
            {showAutoAlloc && isPrime && (
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-semibold">Monthly Auto-Allocation</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Monthly budget cap (Bucks)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-32 h-8 text-sm"
                    placeholder="e.g. 500"
                    data-testid="input-monthly-budget"
                  />
                  <Button size="sm" variant="outline" onClick={() => saveBudget()} disabled={savingBudget}>
                    {savingBudget ? "Saving…" : "Save"}
                  </Button>
                </div>
                {budgetSettings?.budgetSetByName && (
                  <p className="text-xs text-muted-foreground">Last set by <span className="font-medium">{budgetSettings.budgetSetByName}</span></p>
                )}
                {mgrCounts && mgrCounts.counts.length > 0 && (
                  <div className="space-y-2">
                    <Button size="sm" variant="outline" onClick={computeAutoAlloc} data-testid="button-compute-auto">
                      Calculate proportional distribution
                    </Button>
                    {autoAllocAmounts && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Proposed distribution from Bucks in the Bank</p>
                        {mgrCounts.counts.map(c => (
                          <div key={c.adminId} className="flex items-center justify-between text-sm">
                            <span>{c.adminName}</span>
                            <span className="font-semibold tabular-nums">{(autoAllocAmounts[c.adminId] ?? 0).toLocaleString()} Bucks</span>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => autoAllocAmounts && autoAllocMutate(autoAllocAmounts)}
                          disabled={allocatingAuto}
                          data-testid="button-confirm-auto-allocate"
                        >
                          {allocatingAuto ? "Allocating…" : "Confirm & Distribute"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual allocation panel */}
            {showManualAlloc && isPrime && (
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-semibold">Manual Allocation</p>
                {admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admins found.</p>
                ) : (
                  <div className="space-y-2">
                    {admins.map(a => (
                      <label key={a.id} className="flex items-center gap-2 cursor-pointer py-1">
                        <Checkbox
                          checked={selectedAdmins.includes(a.id)}
                          onCheckedChange={checked => {
                            setSelectedAdmins(prev =>
                              checked ? [...prev, a.id] : prev.filter(id => id !== a.id)
                            );
                          }}
                          data-testid={`checkbox-admin-${a.id}`}
                        />
                        <span className="text-sm flex-1">{a.name}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{a.balance.toLocaleString()} Bucks</span>
                      </label>
                    ))}
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
                    disabled={selectedAdmins.length === 0 || !bucksEach || allocating}
                    onClick={() => wouldExceedAvailable ? setShowOverBudgetDialog(true) : allocate()}
                    data-testid="button-allocate"
                  >
                    {allocating
                      ? "Allocating…"
                      : `Allocate to ${selectedAdmins.length} admin${selectedAdmins.length !== 1 ? "s" : ""}`}
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
              Admin balances — unspent Bucks are recalled to Bucks in the Bank at end of billing cycle
            </p>
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admins found.</p>
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
                      <span className="text-sm font-semibold tabular-nums ml-2 whitespace-nowrap">
                        {a.balance.toLocaleString()} Bucks
                      </span>
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
                <div className="sm:hidden divide-y rounded-lg border overflow-hidden">
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
                <div className="hidden sm:block overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
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
