import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarDays, CalendarRange, ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useUser } from "@/hooks/use-auth";
import type { Department } from "@shared/schema";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type OrderPeriodStats = { totalOrders: number; pendingDollars: string; approvedDollars: string; totalDollars: string };
type TimeSeriesPoint = { label: string; value: number };

function StatLineChart({ data, color, yLabel }: { data: TimeSeriesPoint[]; color: string; yLabel?: string }) {
  const hasData = data.some(d => d.value > 0);
  return (
    <div className="mt-4 h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            interval={data.length > 14 ? Math.floor(data.length / 7) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={36}
            label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#9ca3af" } : undefined}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
            formatter={(value: number) => [value.toLocaleString(), yLabel || "Value"]}
          />
          {hasData ? (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ) : (
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [selectedAdminId, setSelectedAdminId] = useState<string>("all");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [creditPeriod, setCreditPeriod] = useState<"week" | "month" | "year">("week");
  const [debitPeriod, setDebitPeriod] = useState<"week" | "month" | "year">("week");
  const [orderPeriod, setOrderPeriod] = useState<"week" | "month" | "year">("week");
  const { data: currentUser } = useUser();

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

  const { data: creditSeries } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["/api/stats/timeseries", { type: "credited", period: creditPeriod, adminId: selectedAdminId, departmentId: selectedDeptId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/timeseries", { type: "credited", period: creditPeriod }), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: debitSeries } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["/api/stats/timeseries", { type: "debited", period: debitPeriod, adminId: selectedAdminId, departmentId: selectedDeptId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/timeseries", { type: "debited", period: debitPeriod }), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: orderSeries } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["/api/stats/timeseries", { type: "orders", period: orderPeriod, departmentId: selectedDeptId }],
    queryFn: async () => {
      const res = await fetch(buildStatsUrl("/api/stats/timeseries", { type: "orders", period: orderPeriod }), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const currentOrderStats = orderStats?.[orderPeriod];
  const periodLabel = orderPeriod === "week" ? "This Week" : orderPeriod === "month" ? "This Month" : "This Year";

  const creditTotal = creditPeriod === "week" ? pointsStats?.week : creditPeriod === "month" ? pointsStats?.month : pointsStats?.year;
  const debitTotal = debitPeriod === "week" ? pointsStats?.weekDebited : debitPeriod === "month" ? pointsStats?.monthDebited : pointsStats?.yearDebited;

  const periodTabLabel = (p: "week" | "month" | "year") =>
    p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year";

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bucks distributed from administrators to employees</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
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
                  {admin.fullName} {admin.role === "prime_admin" ? "(Prime)" : ""}
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
          {/* Bucks Credited */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" /> Bucks Credited
            </h2>
            <Tabs value={creditPeriod} onValueChange={(v) => setCreditPeriod(v as "week" | "month" | "year")}>
              <TabsList>
                <TabsTrigger value="week" data-testid="tab-credit-week">
                  <Calendar className="h-4 w-4 mr-1.5" /> Week
                </TabsTrigger>
                <TabsTrigger value="month" data-testid="tab-credit-month">
                  <CalendarDays className="h-4 w-4 mr-1.5" /> Month
                </TabsTrigger>
                <TabsTrigger value="year" data-testid="tab-credit-year">
                  <CalendarRange className="h-4 w-4 mr-1.5" /> Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Card className="border shadow-sm border-green-200 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-normal">{periodTabLabel(creditPeriod)}</p>
                    <p className="text-3xl font-bold text-green-700" data-testid="text-points-credit">
                      {(creditTotal ?? 0).toLocaleString()} <span className="text-base font-medium text-green-600">bucks</span>
                    </p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatLineChart
                data={creditSeries ?? []}
                color="#16a34a"
                yLabel="Bucks"
              />
            </CardContent>
          </Card>

          {/* Bucks Debited */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" /> Bucks Debited
            </h2>
            <Tabs value={debitPeriod} onValueChange={(v) => setDebitPeriod(v as "week" | "month" | "year")}>
              <TabsList>
                <TabsTrigger value="week" data-testid="tab-debit-week">
                  <Calendar className="h-4 w-4 mr-1.5" /> Week
                </TabsTrigger>
                <TabsTrigger value="month" data-testid="tab-debit-month">
                  <CalendarDays className="h-4 w-4 mr-1.5" /> Month
                </TabsTrigger>
                <TabsTrigger value="year" data-testid="tab-debit-year">
                  <CalendarRange className="h-4 w-4 mr-1.5" /> Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Card className="border shadow-sm border-red-200 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-normal">{periodTabLabel(debitPeriod)}</p>
                    <p className="text-3xl font-bold text-red-700" data-testid="text-points-debit">
                      {(debitTotal ?? 0).toLocaleString()} <span className="text-base font-medium text-red-600">bucks</span>
                    </p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatLineChart
                data={debitSeries ?? []}
                color="#dc2626"
                yLabel="Bucks"
              />
            </CardContent>
          </Card>

          {/* Order Tracking */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-display font-bold text-foreground">Order Tracking</h2>
            <Tabs value={orderPeriod} onValueChange={(v) => setOrderPeriod(v as "week" | "month" | "year")}>
              <TabsList>
                <TabsTrigger value="week" data-testid="tab-orders-week">
                  <Calendar className="h-4 w-4 mr-1.5" /> Week
                </TabsTrigger>
                <TabsTrigger value="month" data-testid="tab-orders-month">
                  <CalendarDays className="h-4 w-4 mr-1.5" /> Month
                </TabsTrigger>
                <TabsTrigger value="year" data-testid="tab-orders-year">
                  <CalendarRange className="h-4 w-4 mr-1.5" /> Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Orders Per Day — {periodLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatLineChart
                data={orderSeries ?? []}
                color="#6366f1"
                yLabel="Orders"
              />
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
