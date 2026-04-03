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
import { Calendar, CalendarDays, CalendarRange, ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown, BookOpen, Users, Settings, Wallet, BadgeDollarSign, Award, Tag, PieChart } from "lucide-react";
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
type BudgetSettings = { bucksPerDollar: number; monthlyBudgetBucks: number };

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
  return (
    <div className="h-72 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={display} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
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
      </ResponsiveContainer>
    </div>
  );
}

function BudgetPanel({ bucksPerDollar, monthlyBudgetBucks, admins, onSaved }: {
  bucksPerDollar: number;
  monthlyBudgetBucks: number;
  admins: { id: number; fullName: string; role: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bpd, setBpd] = useState(String(bucksPerDollar));
  const [budget, setBudget] = useState(String(monthlyBudgetBucks));
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([]);
  const [bucksEach, setBucksEach] = useState("");

  const regularAdmins = admins.filter(a => a.role === "admin");

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

  const { mutate: allocate, isPending: allocating } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/org/allocate-budget", {
      adminIds: selectedAdmins,
      bucksEach: Math.max(1, parseInt(bucksEach) || 0),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats/leaderboard"] });
      toast({ title: "Budget allocated!", description: `${data.total.toLocaleString()} bucks sent to ${data.allocated} admin${data.allocated !== 1 ? "s" : ""}.` });
      setSelectedAdmins([]);
      setBucksEach("");
    },
    onError: (e: Error) => toast({ title: "Allocation failed", description: e.message, variant: "destructive" }),
  });

  const budgetDollars = monthlyBudgetBucks > 0 ? (monthlyBudgetBucks / (parseInt(bpd) || 100)).toFixed(2) : null;

  return (
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
        {/* Budget display */}
        {monthlyBudgetBucks > 0 && (
          <div className="flex flex-wrap gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Monthly Budget</p>
                <p className="text-2xl font-bold text-blue-700">{monthlyBudgetBucks.toLocaleString()} <span className="text-sm font-medium">bucks</span></p>
              </div>
            </div>
            {budgetDollars && (
              <div className="flex items-center gap-3">
                <BadgeDollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Dollar Equivalent</p>
                  <p className="text-2xl font-bold text-green-700">${budgetDollars}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bucks-per-dollar" className="text-sm">Bucks per $1 (conversion rate)</Label>
            <Input
              id="bucks-per-dollar"
              type="number"
              min="1"
              value={bpd}
              onChange={e => setBpd(e.target.value)}
              placeholder="100"
              data-testid="input-bucks-per-dollar"
            />
            <p className="text-xs text-muted-foreground">e.g. 100 means 100 bucks = $1</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly-budget" className="text-sm">Monthly budget (bucks)</Label>
            <Input
              id="monthly-budget"
              type="number"
              min="0"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="10000"
              data-testid="input-monthly-budget"
            />
            {parseInt(budget) > 0 && parseInt(bpd) > 0 && (
              <p className="text-xs text-muted-foreground">≈ ${(parseInt(budget) / parseInt(bpd)).toFixed(2)} / month</p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => saveSettings()} disabled={savingSettings} data-testid="button-save-budget-settings">
          {savingSettings ? "Saving…" : "Save Settings"}
        </Button>

        {/* Allocation */}
        {regularAdmins.length > 0 && (
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Allocate Bucks to Administrators</p>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setSelectedAdmins(selectedAdmins.length === regularAdmins.length ? [] : regularAdmins.map(a => a.id))}
                data-testid="button-admins-select-all"
              >
                {selectedAdmins.length === regularAdmins.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {regularAdmins.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-colors" data-testid={`checkbox-admin-${a.id}`}>
                  <Checkbox
                    checked={selectedAdmins.includes(a.id)}
                    onCheckedChange={checked => setSelectedAdmins(prev => checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                  />
                  <span className="text-sm">{a.fullName}</span>
                </label>
              ))}
            </div>
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
                onClick={() => allocate()}
                disabled={allocating || selectedAdmins.length === 0 || !bucksEach || parseInt(bucksEach) < 1}
                data-testid="button-allocate-budget"
                size="sm"
              >
                {allocating ? "Allocating…" : `Allocate to ${selectedAdmins.length} Admin${selectedAdmins.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [selectedAdminId, setSelectedAdminId] = usePersistedState<string>("bb_filter_adminId", "all");
  const [selectedDeptId, setSelectedDeptId] = usePersistedState<string>("bb_filter_deptId", "all");
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
    queryKey: ["/api/stats/points", { adminId: selectedAdminId, departmentId: selectedDeptId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/points"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery<{ week: OrderPeriodStats; month: OrderPeriodStats; year: OrderPeriodStats }>({
    queryKey: ["/api/stats/orders", { departmentId: selectedDeptId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/orders"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order stats");
      return res.json();
    },
  });

  const { data: budgetSettings, refetch: refetchBudget } = useQuery<BudgetSettings>({
    queryKey: ["/api/org/budget-settings"],
    enabled: isPrime,
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
        </div>
      </div>

      {(statsLoading || adminsLoading || orderStatsLoading) ? (
        <Loader />
      ) : (
        <>
          {/* Budget panel - prime admin only */}
          {isPrime && budgetSettings && (
            <BudgetPanel
              bucksPerDollar={budgetSettings.bucksPerDollar}
              monthlyBudgetBucks={budgetSettings.monthlyBudgetBucks}
              admins={admins ?? []}
              onSaved={() => refetchBudget()}
            />
          )}

          {/* Category Analytics Card — always visible for admin/prime_admin */}
          {(currentUser?.role === "admin" || currentUser?.role === "prime_admin") && (
            <Card className="border shadow-sm border-purple-200 mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <PieChart className="h-4 w-4" />
                  </div>
                  {new Date().toLocaleString("default", { month: "long" })} Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Budget progress — always shown */}
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
                          No monthly budget configured.{isPrime ? " Set one above to track usage here." : " Contact your Organization Owner to configure a budget."}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="h-3 bg-muted rounded-full animate-pulse" />
                  )}
                </div>

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
