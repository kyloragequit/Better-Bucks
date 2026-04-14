import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CalendarDays, CalendarRange, ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown, BookOpen, Users, Settings, Wallet, BadgeDollarSign, Award, Tag, PieChart, AlertTriangle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Loader } from "@/components/ui/loader";
import { useUser } from "@/hooks/use-auth";
import { PasskeyFirstTimePrompt } from "@/components/passkey-manager";
import { useTutorial } from "@/hooks/use-tutorial";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Department } from "@shared/schema";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

type OrderPeriodStats = { totalOrders: number; pendingDollars: string; approvedDollars: string; totalDollars: string };

type AdminLeaderboardEntry = { id: number; name: string; bucks: number; balance: number };
type EmployeeEntry = { id: number; name: string; balance: number; spent: number };
type BudgetSettings = { bucksPerDollar: number; monthlyBudgetBucks: number; budgetSetByName: string | null };

type CategoryStat = { categoryId: number | null; categoryName: string | null; categoryColor: string | null; totalBucks: number };
type CategoryAnalytics = { stats: CategoryStat[]; budgetUsed: number; monthlyBudgetBucks: number; year: number; month: number };

const SHORT_NAME_MAX = 14;
function shortName(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return name.length > SHORT_NAME_MAX ? name.substring(0, SHORT_NAME_MAX) + "…" : name;
  return parts[0] + " " + parts[parts.length - 1][0] + ".";
}

const ADMIN_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#f97316", "#ec4899", "#6366f1", "#14b8a6"];
const EMP_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444", "#f97316", "#ec4899", "#6366f1", "#14b8a6"];

const BAR_MIN_WIDTH = 48;
const SCROLL_THRESHOLD = 8;

function LeaderboardBar({ data, valueKey, color, unit, bucksPerDollar, showDollars }: {
  data: { name: string; value: number }[];
  valueKey: string;
  color: string;
  unit: string;
  bucksPerDollar: number;
  showDollars: boolean;
}) {
  const display = data.map(d => ({
    ...d,
    display: showDollars ? +(d.value / bucksPerDollar).toFixed(2) : d.value,
  }));
  const hasData = display.some(d => d.display > 0);
  const needsScroll = display.length > SCROLL_THRESHOLD;
  const chartWidth = needsScroll ? Math.max(display.length * BAR_MIN_WIDTH + 70, 400) : undefined;

  const chart = (
    <BarChart data={display} margin={{ top: 8, right: 16, left: 0, bottom: 32 }} width={chartWidth} height={288}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: "#6b7280" }}
        tickLine={false}
        axisLine={false}
        interval={0}
        angle={-30}
        textAnchor="end"
        height={48}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#6b7280" }}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={v => showDollars ? `$${v}` : v.toLocaleString()}
        allowDecimals={showDollars}
      />
      <Tooltip
        contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
        formatter={(value: number) => [
          showDollars ? `$${value.toFixed(2)}` : `${value.toLocaleString()} ${unit}`,
          showDollars ? "Dollar Value" : unit,
        ]}
      />
      {hasData ? (
        <Bar dataKey="display" radius={[4, 4, 0, 0]}>
          {display.map((_, i) => (
            <Cell key={i} fill={ADMIN_COLORS[i % ADMIN_COLORS.length]} />
          ))}
        </Bar>
      ) : (
        <Bar dataKey="display" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
      )}
    </BarChart>
  );

  if (needsScroll) {
    return (
      <div className="mt-2">
        <div className="overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }} data-testid="chart-scroll-container">
          <div style={{ width: chartWidth, height: 288 }}>
            {chart}
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">Scroll to see all {display.length} entries</p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

type AdminCredit = { id: number; name: string; credited: number };
type AdminCreditsData = { totalCredited: number; admins: AdminCredit[] };

function BudgetPanel({ bucksPerDollar, monthlyBudgetBucks, budgetSetByName, admins, onSaved }: {
  bucksPerDollar: number;
  monthlyBudgetBucks: number;
  budgetSetByName: string | null;
  admins: { id: number; fullName: string; role: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bpd, setBpd] = useState(String(bucksPerDollar));
  const [budget, setBudget] = useState(String(monthlyBudgetBucks));
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([]);
  const [bucksEach, setBucksEach] = useState("");
  const [showOverBudgetDialog, setShowOverBudgetDialog] = useState(false);
  const [autoAllocAmounts, setAutoAllocAmounts] = useState<Record<number, number> | null>(null);

  const regularAdmins = admins.filter(a => a.role === "admin");

  const { data: adminCredits } = useQuery<AdminCreditsData>({
    queryKey: ["/api/org/admin-credits"],
  });

  type ManagerCounts = { counts: { adminId: number; adminName: string; employeeCount: number; percentage: number }[]; totalEmployees: number; unassigned: number; unassignedPercentage: number };
  const { data: mgrCounts } = useQuery<ManagerCounts>({
    queryKey: ["/api/org/manager-employee-counts"],
  });

  const { mutate: saveSettings, isPending: savingSettings } = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/org/budget-settings", {
      bucksPerDollar: Math.max(1, parseInt(bpd) || 100),
      monthlyBudgetBucks: Math.max(0, parseInt(budget) || 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/budget-settings"] });
      onSaved();
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const doAllocate = () => {
    allocate();
  };

  const { mutate: autoAllocMutate, isPending: allocatingAuto } = useMutation({
    mutationFn: (amounts: Record<number, number>) => apiRequest("POST", "/api/org/allocate-budget-auto", { allocations: Object.entries(amounts).map(([id, amount]) => ({ adminId: Number(id), bucks: amount })) }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/admin-credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
      toast({ title: "Auto allocation complete!", description: `${data.total.toLocaleString()} bucks distributed to ${data.allocated} admin${data.allocated !== 1 ? "s" : ""}.` });
      setAutoAllocAmounts(null);
      setSelectedAdmins([]);
    },
    onError: (e: Error) => toast({ title: "Auto allocation failed", description: e.message, variant: "destructive" }),
  });

  const handleAutoAllocateConfirm = () => {
    if (autoAllocAmounts) autoAllocMutate(autoAllocAmounts);
  };

  const { mutate: allocate, isPending: allocating } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/org/allocate-budget", {
      adminIds: selectedAdmins,
      bucksEach: Math.max(1, parseInt(bucksEach) || 0),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/admin-credits"] });
      toast({ title: "Budget allocated!", description: `${data.total.toLocaleString()} bucks sent to ${data.allocated} admin${data.allocated !== 1 ? "s" : ""}.` });
      setSelectedAdmins([]);
      setBucksEach("");
      setShowOverBudgetDialog(false);
    },
    onError: (e: Error) => { setShowOverBudgetDialog(false); toast({ title: "Allocation failed", description: e.message, variant: "destructive" }); },
  });

  const budgetNum = parseInt(budget) || 0;
  const bpdNum = Math.max(1, parseInt(bpd) || 100);
  const dollarEquiv = budgetNum > 0 ? (budgetNum / bpdNum).toFixed(2) : null;

  const allocationAmount = (parseInt(bucksEach) || 0) * selectedAdmins.length;
  const currentCredited = adminCredits?.totalCredited ?? 0;
  const serverBudget = monthlyBudgetBucks;
  const serverBpd = Math.max(1, bucksPerDollar);
  const newTotal = currentCredited + allocationAmount;
  const wouldExceedBudget = serverBudget > 0 && newTotal > serverBudget;
  const overBy = newTotal - serverBudget;
  const creditPercent = serverBudget > 0 ? Math.min((currentCredited / serverBudget) * 100, 100) : 0;

  const handleAllocateClick = () => {
    if (wouldExceedBudget) {
      setShowOverBudgetDialog(true);
    } else {
      doAllocate();
    }
  };

  return (
    <>
      <Card className="border shadow-sm border-blue-200 mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Wallet className="h-4 w-4" />
            </div>
            Monthly Incentive Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-blue-600 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-600 mb-1.5">Monthly Budget</p>
                  <div className="flex items-baseline gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className="w-full text-2xl font-bold text-blue-700 bg-transparent border-0 border-b-2 border-blue-200 focus:border-blue-500 focus:outline-none p-0 pb-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      data-testid="input-monthly-budget"
                      placeholder="10000"
                    />
                    <span className="text-sm font-medium text-blue-600 whitespace-nowrap">bucks</span>
                  </div>
                  {dollarEquiv && (
                    <p className="text-xs text-blue-500 mt-1">≈ ${dollarEquiv} / month</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BadgeDollarSign className="h-5 w-5 text-green-600 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-600 mb-1.5">Bucks per $1</p>
                  <div className="flex items-baseline gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={bpd}
                      onChange={e => setBpd(e.target.value)}
                      className="w-full text-2xl font-bold text-green-700 bg-transparent border-0 border-b-2 border-green-200 focus:border-green-500 focus:outline-none p-0 pb-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      data-testid="input-bucks-per-dollar"
                      placeholder="100"
                    />
                    <span className="text-sm font-medium text-green-600 whitespace-nowrap">= $1</span>
                  </div>
                  <p className="text-xs text-green-500 mt-1">conversion rate</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Button size="sm" onClick={() => saveSettings()} disabled={savingSettings} data-testid="button-save-budget-settings">
                {savingSettings ? "Saving…" : "Save Changes"}
              </Button>
              {budgetSetByName && (
                <p className="text-xs text-muted-foreground" data-testid="text-budget-set-by">
                  Last set by <span className="font-medium text-foreground">{budgetSetByName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Bucks Credited to Admins This Month */}
          {adminCredits && (
            <div className="pt-3 border-t space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Bucks Credited to Admins This Month
              </p>
              {serverBudget > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{currentCredited.toLocaleString()} of {serverBudget.toLocaleString()} bucks allocated</span>
                    <span className={`font-semibold ${creditPercent >= 100 ? "text-red-600" : creditPercent >= 80 ? "text-amber-600" : "text-emerald-600"}`}>
                      {creditPercent.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={creditPercent}
                    className={`h-2 ${creditPercent >= 100 ? "[&>div]:bg-red-500" : creditPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                  />
                  {currentCredited > serverBudget && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1" data-testid="text-over-budget-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Over budget by {(currentCredited - serverBudget).toLocaleString()} bucks (${((currentCredited - serverBudget) / serverBpd).toFixed(2)})
                    </p>
                  )}
                </div>
              )}
              {adminCredits.admins.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {adminCredits.admins.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100" data-testid={`admin-credit-${a.id}`}>
                      <span className="text-sm font-medium text-emerald-800 truncate">{a.name}</span>
                      <span className="text-sm font-bold text-emerald-700 ml-2 whitespace-nowrap">
                        {a.credited.toLocaleString()} <span className="text-xs font-normal">bucks</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-no-admin-credits">No bucks have been allocated to admins this month yet.</p>
              )}
            </div>
          )}

          {/* Employee Distribution by Manager */}
          {mgrCounts && mgrCounts.totalEmployees > 0 && regularAdmins.length > 0 && (
            <div className="pt-3 border-t space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Employee Distribution by Manager
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mgrCounts.counts.map(c => (
                  <div key={c.adminId} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100" data-testid={`mgr-pct-${c.adminId}`}>
                    <span className="text-sm font-medium text-blue-800 truncate">{c.adminName}</span>
                    <span className="text-sm font-bold text-blue-700 ml-2 whitespace-nowrap">
                      {c.employeeCount} <span className="text-xs font-normal">({c.percentage}%)</span>
                    </span>
                  </div>
                ))}
                {mgrCounts.unassigned > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200" data-testid="mgr-pct-unassigned">
                    <span className="text-sm font-medium text-gray-600 truncate">Unassigned</span>
                    <span className="text-sm font-bold text-gray-500 ml-2 whitespace-nowrap">
                      {mgrCounts.unassigned} <span className="text-xs font-normal">({mgrCounts.unassignedPercentage}%)</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Allocation */}
          {regularAdmins.length > 0 && (
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Allocate Bucks to Administrators</p>
                <div className="flex items-center gap-2">
                  {mgrCounts && mgrCounts.totalEmployees > 0 && serverBudget > 0 && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline font-medium"
                      onClick={() => {
                        const remaining = Math.max(0, serverBudget - currentCredited);
                        if (remaining <= 0) {
                          toast({ title: "Budget fully allocated", description: "The entire monthly budget has already been credited.", variant: "destructive" });
                          return;
                        }
                        const assignedAdmins = mgrCounts.counts.filter(c => c.employeeCount > 0);
                        if (assignedAdmins.length === 0) {
                          toast({ title: "No employees assigned", description: "Assign employees to managers first on the Team page.", variant: "destructive" });
                          return;
                        }
                        const assignedEmpCount = assignedAdmins.reduce((sum, c) => sum + c.employeeCount, 0);
                        const autoAmounts: Record<number, number> = {};
                        let totalUsed = 0;
                        for (const c of assignedAdmins) {
                          const share = Math.floor((c.employeeCount / assignedEmpCount) * remaining);
                          autoAmounts[c.adminId] = share;
                          totalUsed += share;
                        }
                        let remainder = remaining - totalUsed;
                        const sorted = [...assignedAdmins].sort((a, b) => b.employeeCount - a.employeeCount);
                        for (const c of sorted) {
                          if (remainder <= 0) break;
                          autoAmounts[c.adminId]++;
                          remainder--;
                        }
                        setAutoAllocAmounts(autoAmounts);
                        setSelectedAdmins(assignedAdmins.map(c => c.adminId));
                        setBucksEach("");
                      }}
                      data-testid="button-auto-allocate"
                    >
                      Auto Allocate
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => { setSelectedAdmins(selectedAdmins.length === regularAdmins.length ? [] : regularAdmins.map(a => a.id)); setAutoAllocAmounts(null); }}
                    data-testid="button-admins-select-all"
                  >
                    {selectedAdmins.length === regularAdmins.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {regularAdmins.map(a => {
                  const autoAmt = autoAllocAmounts?.[a.id];
                  return (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-colors" data-testid={`checkbox-admin-${a.id}`}>
                      <Checkbox
                        checked={selectedAdmins.includes(a.id)}
                        onCheckedChange={checked => { setSelectedAdmins(prev => checked ? [...prev, a.id] : prev.filter(id => id !== a.id)); if (!checked && autoAllocAmounts) { const next = { ...autoAllocAmounts }; delete next[a.id]; setAutoAllocAmounts(Object.keys(next).length > 0 ? next : null); } }}
                      />
                      <span className="text-sm">{a.fullName}</span>
                      {autoAmt != null && <span className="text-xs font-semibold text-blue-600 ml-auto">{autoAmt.toLocaleString()}</span>}
                    </label>
                  );
                })}
              </div>
              {!autoAllocAmounts && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bucks-each" className="text-sm">Bucks to give each</Label>
                    <Input
                      id="bucks-each"
                      type="number"
                      min="1"
                      value={bucksEach}
                      onChange={e => setBucksEach(e.target.value)}
                      placeholder="500"
                      className="w-36"
                      data-testid="input-bucks-each"
                    />
                  </div>
                  <Button
                    onClick={handleAllocateClick}
                    disabled={allocating || selectedAdmins.length === 0 || !bucksEach || parseInt(bucksEach) < 1}
                    data-testid="button-allocate-budget"
                    size="sm"
                  >
                    {allocating ? "Allocating…" : `Allocate to ${selectedAdmins.length} Admin${selectedAdmins.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              )}
              {autoAllocAmounts && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground" data-testid="text-auto-alloc-summary">
                    Auto-allocated <span className="font-semibold text-foreground">{Object.values(autoAllocAmounts).reduce((s, v) => s + v, 0).toLocaleString()} bucks</span> based on employee distribution
                    {serverBpd > 0 && <span className="text-muted-foreground"> — ${(Object.values(autoAllocAmounts).reduce((s, v) => s + v, 0) / serverBpd).toFixed(2)}</span>}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAutoAllocateConfirm}
                      disabled={allocatingAuto}
                      data-testid="button-confirm-auto-allocate"
                      size="sm"
                    >
                      {allocatingAuto ? "Allocating…" : "Confirm Auto Allocation"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAutoAllocAmounts(null); setSelectedAdmins([]); }}
                      data-testid="button-cancel-auto-allocate"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {!autoAllocAmounts && allocationAmount > 0 && selectedAdmins.length > 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-allocation-total">
                  Total: <span className="font-semibold text-foreground">{allocationAmount.toLocaleString()} bucks</span>
                  {" "}({(parseInt(bucksEach) || 0).toLocaleString()} × {selectedAdmins.length} admin{selectedAdmins.length !== 1 ? "s" : ""})
                  {serverBpd > 0 && <span className="text-muted-foreground"> — ${(allocationAmount / serverBpd).toFixed(2)}</span>}
                </p>
              )}
              {!autoAllocAmounts && allocationAmount > 0 && wouldExceedBudget && (
                <p className="text-xs text-amber-600 flex items-center gap-1" data-testid="text-allocation-warning">
                  <AlertTriangle className="h-3 w-3" />
                  This allocation will put you {overBy.toLocaleString()} bucks over budget
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showOverBudgetDialog} onOpenChange={setShowOverBudgetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Over Budget Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This allocation of <span className="font-semibold">{allocationAmount.toLocaleString()} bucks</span> will
                put your total admin credits at <span className="font-semibold">{newTotal.toLocaleString()} bucks</span>,
                which exceeds your monthly budget of <span className="font-semibold">{serverBudget.toLocaleString()} bucks</span>.
              </p>
              <p className="text-red-600 font-semibold">
                You will be over budget by {overBy.toLocaleString()} bucks (${(overBy / serverBpd).toFixed(2)}).
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-over-budget">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doAllocate}
              disabled={allocating}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-over-budget"
            >
              {allocating ? "Allocating…" : "Allocate Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function AdminDashboardPage() {
  const [selectedAdminId, setSelectedAdminId] = usePersistedState<string>("bb_filter_adminId", "all");
  const [selectedDeptId, setSelectedDeptId] = usePersistedState<string>("bb_filter_deptId", "all");
  const [selectedMgrId, setSelectedMgrId] = usePersistedState<string>("bb_filter_mgrId", "all");
  const [creditPeriod, setCreditPeriod] = useState<"week" | "month" | "year">("week");
  const [debitPeriod, setDebitPeriod] = useState<"week" | "month" | "year">("week");
  const [orderPeriod, setOrderPeriod] = useState<"week" | "month" | "year">("week");
  const [leaderboardMode, setLeaderboardMode] = useState<"admins" | "employees">("admins");
  const [empMetric, setEmpMetric] = useState<"balance" | "spent">("balance");
  const [adminMetric, setAdminMetric] = useState<"given" | "balance">("given");
  const [showDollars, setShowDollars] = useState(false);
  const [leaderboardDeptId, setLeaderboardDeptId] = usePersistedState<string>("bb_lb_deptId", "all");
  const { data: currentUser } = useUser();
  const { restartTutorial } = useTutorial();
  const queryClient = useQueryClient();

  const isPrime = currentUser?.role === "prime_admin";

  const buildStatsUrl = (base: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (selectedAdminId !== "all") params.set("adminId", selectedAdminId);
    if (selectedDeptId !== "all") params.set("departmentId", selectedDeptId);
    if (selectedMgrId !== "all") params.set("managerId", selectedMgrId);
    if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const { data: admins, isLoading: adminsLoading } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: pointsStats, isLoading: statsLoading } = useQuery<{ week: number; month: number; year: number; weekDebited: number; monthDebited: number; yearDebited: number }>({
    queryKey: ["/api/stats/points", { adminId: selectedAdminId, departmentId: selectedDeptId, managerId: selectedMgrId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/points"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery<{ week: OrderPeriodStats; month: OrderPeriodStats; year: OrderPeriodStats }>({
    queryKey: ["/api/stats/orders", { departmentId: selectedDeptId, managerId: selectedMgrId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/orders"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order stats");
      return res.json();
    },
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "prime_admin";
  const { data: budgetSettings, refetch: refetchBudget } = useQuery<BudgetSettings>({
    queryKey: ["/api/org/budget-settings"],
    enabled: isAdmin,
  });

  const now = new Date();
  const { data: categoryAnalytics } = useQuery<CategoryAnalytics>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}/analytics/categories`, now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${currentUser?.organizationId}/analytics/categories?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentUser?.organizationId && (currentUser?.role === "admin" || currentUser?.role === "prime_admin"),
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<AdminLeaderboardEntry[] | EmployeeEntry[]>({
    queryKey: ["/api/stats/leaderboard", leaderboardMode, leaderboardDeptId],
    queryFn: async () => {
      const params = new URLSearchParams({ mode: leaderboardMode });
      if (leaderboardDeptId !== "all") params.set("departmentId", leaderboardDeptId);
      const res = await fetch(`/api/stats/leaderboard?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const currentOrderStats = orderStats?.[orderPeriod];
  const periodLabel = orderPeriod === "week" ? "This Week" : orderPeriod === "month" ? "This Month" : "This Year";
  const creditTotal = creditPeriod === "week" ? pointsStats?.week : creditPeriod === "month" ? pointsStats?.month : pointsStats?.year;
  const debitTotal = debitPeriod === "week" ? pointsStats?.weekDebited : debitPeriod === "month" ? pointsStats?.monthDebited : pointsStats?.yearDebited;
  const periodTabLabel = (p: "week" | "month" | "year") => p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year";

  const bpd = budgetSettings?.bucksPerDollar ?? 100;

  // Build bar chart data
  const adminBarData: { name: string; value: number }[] = leaderboardMode === "admins" && leaderboard
    ? (leaderboard as AdminLeaderboardEntry[]).map(a => ({ name: shortName(a.name), value: adminMetric === "given" ? a.bucks : a.balance }))
    : [];
  const empBarData: { name: string; value: number }[] = leaderboardMode === "employees" && leaderboard
    ? (leaderboard as EmployeeEntry[]).map(e => ({
        name: shortName(e.name),
        value: empMetric === "balance" ? e.balance : e.spent,
      }))
    : [];

  return (
    <AdminLayout>
      {currentUser && <div className="mb-4"><PasskeyFirstTimePrompt userId={currentUser.id} /></div>}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bucks distributed from administrators to employees</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={restartTutorial}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5"
            data-testid="button-replay-tutorial"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Take the tour again
          </button>
          <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-dept-filter-dashboard">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
            <SelectTrigger className="w-full sm:w-56" data-testid="select-admin-filter">
              <SelectValue placeholder="Filter by administrator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-admin-all">All Administrators</SelectItem>
              {admins?.map((admin) => (
                <SelectItem key={admin.id} value={String(admin.id)} data-testid={`option-admin-${admin.id}`}>
                  {admin.fullName} {admin.role === "prime_admin" ? "(Org User)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMgrId} onValueChange={setSelectedMgrId}>
            <SelectTrigger className="w-full sm:w-56" data-testid="select-mgr-filter-dashboard">
              <SelectValue placeholder="Filter by manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {admins?.filter(a => a.role === "admin").map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(statsLoading || adminsLoading || orderStatsLoading) ? (
        <Loader />
      ) : (
        <>
          {/* Budget panel - prime admin gets edit controls, regular admin gets read-only view */}
          {isPrime && budgetSettings && (
            <BudgetPanel
              bucksPerDollar={budgetSettings.bucksPerDollar}
              monthlyBudgetBucks={budgetSettings.monthlyBudgetBucks}
              budgetSetByName={budgetSettings.budgetSetByName}
              admins={admins ?? []}
              onSaved={() => refetchBudget()}
            />
          )}

          {/* Admin balance card — shows the admin's own bucks balance */}
          {!isPrime && currentUser && (
            <Card className="border shadow-sm border-green-200 mb-8" data-testid="card-admin-balance">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    <BadgeDollarSign className="h-4 w-4" />
                  </div>
                  Your Bucks Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-bold text-green-700" data-testid="text-admin-balance">{(currentUser.balance ?? 0).toLocaleString()}</span>
                    <span className="text-sm font-medium text-green-600">bucks available to distribute</span>
                    {bpd > 0 && (
                      <span className="text-sm text-green-500">≈ ${((currentUser.balance ?? 0) / bpd).toFixed(2)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">This is the amount you can award to employees. Your organization admin allocates bucks to you from the monthly budget.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Analytics Card — always visible for admin/prime_admin */}
          {(currentUser?.role === "admin" || currentUser?.role === "prime_admin") && (
            <Card className="border shadow-sm border-purple-200 mb-8" data-testid="card-analytics">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <PieChart className="h-4 w-4" />
                  </div>
                  {isPrime ? `${new Date().toLocaleString("default", { month: "long" })} Analytics` : "Your Category Breakdown"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {isPrime && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Budget Progression</p>
                  {categoryAnalytics ? (
                    categoryAnalytics.monthlyBudgetBucks > 0 ? (() => {
                      const pct = Math.min(Math.round((categoryAnalytics.budgetUsed / categoryAnalytics.monthlyBudgetBucks) * 100), 100);
                      const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";
                      const textColor = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-green-600";
                      return (
                        <div>
                          <div className="flex justify-between items-baseline mb-2">
                            <span className="text-sm text-muted-foreground">
                              <span className="font-bold text-foreground">{categoryAnalytics.budgetUsed.toLocaleString()}</span> of {categoryAnalytics.monthlyBudgetBucks.toLocaleString()} bucks used
                            </span>
                            <span className={`text-sm font-bold ${textColor}`} data-testid="text-budget-used">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden" data-testid="bar-budget-progress">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                            <span>0</span>
                            <span>{Math.round(categoryAnalytics.monthlyBudgetBucks / 2).toLocaleString()}</span>
                            <span>{categoryAnalytics.monthlyBudgetBucks.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="flex flex-col gap-2">
                        <div className="h-3 bg-muted rounded-full overflow-hidden" data-testid="bar-budget-progress">
                          <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: "0%" }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          No monthly budget configured. Set one above to track usage here.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="h-3 bg-muted rounded-full animate-pulse" />
                  )}
                </div>
                )}

                {/* Category breakdown — always shown */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Rewards by Category
                  </p>
                  {!categoryAnalytics ? (
                    <div className="space-y-2.5">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-muted rounded mb-1" />
                          <div className="h-1.5 bg-muted rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : categoryAnalytics.stats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-5 text-center rounded-lg border border-dashed border-muted-foreground/20">
                      <Tag className="h-6 w-6 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No category data yet this month.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Tag transactions with categories to see the breakdown here.</p>
                    </div>
                  ) : (() => {
                    const total = categoryAnalytics.stats.reduce((s, c) => s + c.totalBucks, 0);
                    return (
                      <div className="space-y-3">
                        {categoryAnalytics.stats.map((cat, i) => {
                          const pct = total > 0 ? Math.round((cat.totalBucks / total) * 100) : 0;
                          return (
                            <div key={cat.categoryId ?? `uncategorized-${i}`} data-testid={`category-stat-${cat.categoryId ?? "none"}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="flex items-center gap-1.5 text-sm">
                                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.categoryColor ?? "#9CA3AF" }} />
                                  {cat.categoryName ?? "Uncategorized"}
                                </span>
                                <span className="text-sm font-semibold">
                                  {cat.totalBucks.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: cat.categoryColor ?? "#9CA3AF" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bucks Credited / Debited summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            {/* Bucks Credited */}
            <Card className="border shadow-sm border-green-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    Bucks Credited
                  </CardTitle>
                  <Tabs value={creditPeriod} onValueChange={(v) => setCreditPeriod(v as "week" | "month" | "year")}>
                    <TabsList className="min-h-8 h-auto flex-wrap">
                      <TabsTrigger value="week" className="text-xs px-2 py-1" data-testid="tab-credit-week" aria-label="Week"><Calendar className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Week</span></TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-2 py-1" data-testid="tab-credit-month" aria-label="Month"><CalendarDays className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Month</span></TabsTrigger>
                      <TabsTrigger value="year" className="text-xs px-2 py-1" data-testid="tab-credit-year" aria-label="Year"><CalendarRange className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Year</span></TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-700 mt-1" data-testid="text-points-credit">
                  {(creditTotal ?? 0).toLocaleString()} <span className="text-base font-medium text-green-600">bucks</span>
                </p>
                {bpd > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">≈ ${((creditTotal ?? 0) / bpd).toFixed(2)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{periodTabLabel(creditPeriod)}</p>
              </CardContent>
            </Card>

            {/* Bucks Debited */}
            <Card className="border shadow-sm border-red-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                    Bucks Spent
                  </CardTitle>
                  <Tabs value={debitPeriod} onValueChange={(v) => setDebitPeriod(v as "week" | "month" | "year")}>
                    <TabsList className="min-h-8 h-auto flex-wrap">
                      <TabsTrigger value="week" className="text-xs px-2 py-1" data-testid="tab-debit-week" aria-label="Week"><Calendar className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Week</span></TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-2 py-1" data-testid="tab-debit-month" aria-label="Month"><CalendarDays className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Month</span></TabsTrigger>
                      <TabsTrigger value="year" className="text-xs px-2 py-1" data-testid="tab-debit-year" aria-label="Year"><CalendarRange className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Year</span></TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-700 mt-1" data-testid="text-points-debit">
                  {(debitTotal ?? 0).toLocaleString()} <span className="text-base font-medium text-red-600">bucks</span>
                </p>
                {bpd > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">≈ ${((debitTotal ?? 0) / bpd).toFixed(2)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{periodTabLabel(debitPeriod)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard bar chart */}
          <div className="mb-4">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  {leaderboardMode === "admins"
                    ? (adminMetric === "given" ? "Bucks Given by Administrator" : "Administrator Balances")
                    : "Employee Bucks"}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {leaderboardMode === "admins" && (
                    <Tabs value={adminMetric} onValueChange={v => setAdminMetric(v as "given" | "balance")}>
                      <TabsList className="min-h-8 h-auto">
                        <TabsTrigger value="given" className="text-xs px-3" data-testid="tab-admin-given">Given</TabsTrigger>
                        <TabsTrigger value="balance" className="text-xs px-3" data-testid="tab-admin-balance">Balance</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  {leaderboardMode === "employees" && (
                    <>
                      <Tabs value={empMetric} onValueChange={v => setEmpMetric(v as "balance" | "spent")}>
                        <TabsList className="min-h-8 h-auto">
                          <TabsTrigger value="balance" className="text-xs px-3" data-testid="tab-emp-balance">Balance</TabsTrigger>
                          <TabsTrigger value="spent" className="text-xs px-3" data-testid="tab-emp-spent">Spent</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Tabs value={showDollars ? "dollars" : "bucks"} onValueChange={v => setShowDollars(v === "dollars")}>
                        <TabsList className="min-h-8 h-auto">
                          <TabsTrigger value="bucks" className="text-xs px-3" data-testid="tab-unit-bucks">Bucks</TabsTrigger>
                          <TabsTrigger value="dollars" className="text-xs px-3" data-testid="tab-unit-dollars">Dollars</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </>
                  )}
                  <Tabs value={leaderboardMode} onValueChange={v => { setLeaderboardMode(v as "admins" | "employees"); setShowDollars(false); }}>
                    <TabsList className="min-h-8 h-auto">
                      <TabsTrigger value="admins" className="text-xs px-3" data-testid="tab-leaderboard-admins">
                        <Settings className="h-3 w-3 mr-1" /> Admins
                      </TabsTrigger>
                      <TabsTrigger value="employees" className="text-xs px-3" data-testid="tab-leaderboard-employees">
                        <Users className="h-3 w-3 mr-1" /> Employees
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              {(departments ?? []).length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={leaderboardDeptId} onValueChange={setLeaderboardDeptId}>
                    <SelectTrigger className="w-auto min-w-40 min-h-8 text-xs" data-testid="select-leaderboard-dept">
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {(departments ?? []).map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Card className="border shadow-sm">
              <CardContent className="pt-4 pb-2">
                {leaderboardLoading ? (
                  <div className="h-72 flex items-center justify-center"><Loader /></div>
                ) : (
                  <LeaderboardBar
                    data={leaderboardMode === "admins" ? adminBarData : empBarData}
                    valueKey="value"
                    color={leaderboardMode === "admins" ? "#3b82f6" : "#10b981"}
                    unit="bucks"
                    bucksPerDollar={bpd}
                    showDollars={leaderboardMode === "employees" && showDollars}
                  />
                )}
                {!leaderboardLoading && (leaderboardMode === "admins" ? adminBarData : empBarData).every(d => d.value === 0) && (
                  <p className="text-center text-sm text-muted-foreground mt-2 pb-4">No data yet for this view.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Tracking */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 mt-8">
            <h2 className="text-xl font-display font-bold text-foreground">Order Tracking</h2>
            <Tabs value={orderPeriod} onValueChange={(v) => setOrderPeriod(v as "week" | "month" | "year")}>
              <TabsList className="min-h-8 h-auto flex-wrap">
                <TabsTrigger value="week" className="text-xs px-2 py-1" data-testid="tab-orders-week" aria-label="Week"><Calendar className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Week</span></TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2 py-1" data-testid="tab-orders-month" aria-label="Month"><CalendarDays className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Month</span></TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-2 py-1" data-testid="tab-orders-year" aria-label="Year"><CalendarRange className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Year</span></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border shadow-sm">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 flex-shrink-0">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Orders {periodLabel}</p>
                  <p className="text-3xl font-bold" data-testid="text-total-orders">{currentOrderStats?.totalOrders ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600 flex-shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending ($) {periodLabel}</p>
                  <p className="text-3xl font-bold" data-testid="text-pending-dollars">{currentOrderStats?.pendingDollars ?? "$0.00"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 flex-shrink-0">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Approved ($) {periodLabel}</p>
                  <p className="text-3xl font-bold" data-testid="text-approved-dollars">{currentOrderStats?.approvedDollars ?? "$0.00"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 text-pink-600 flex-shrink-0">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total ($) {periodLabel}</p>
                  <p className="text-3xl font-bold" data-testid="text-total-dollars">{currentOrderStats?.totalDollars ?? "$0.00"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
