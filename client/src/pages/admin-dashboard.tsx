import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarDays, CalendarRange, ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useUser } from "@/hooks/use-auth";
import type { Department } from "@shared/schema";

type OrderPeriodStats = { totalOrders: number; pendingDollars: string; approvedDollars: string; totalDollars: string };

export default function AdminDashboardPage() {
  const [selectedAdminId, setSelectedAdminId] = useState<string>("all");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [orderPeriod, setOrderPeriod] = useState<"week" | "month" | "year">("week");
  const { data: currentUser } = useUser();
  const isPrimeAdmin = currentUser?.role === "prime_admin";

  const { data: admins, isLoading: adminsLoading } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const buildStatsUrl = (base: string) => {
    const params = new URLSearchParams();
    if (selectedAdminId !== "all") params.set("adminId", selectedAdminId);
    if (selectedDeptId !== "all") params.set("departmentId", selectedDeptId);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

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

  const currentOrderStats = orderStats?.[orderPeriod];
  const periodLabel = orderPeriod === "week" ? "This Week" : orderPeriod === "month" ? "This Month" : "This Year";

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bucks distributed from administrators to employees</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {departments && departments.length > 0 && (
            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-dept-filter-dashboard">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
          <h2 className="text-lg font-display font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" /> Bucks Credited
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Card className="border shadow-sm border-green-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Week</p>
                  <p className="text-3xl font-bold text-green-700" data-testid="text-points-week">{pointsStats?.week?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm border-green-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Month</p>
                  <p className="text-3xl font-bold text-green-700" data-testid="text-points-month">{pointsStats?.month?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm border-green-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                  <CalendarRange className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Year</p>
                  <p className="text-3xl font-bold text-green-700" data-testid="text-points-year">{pointsStats?.year?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <h2 className="text-lg font-display font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" /> Bucks Debited
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Card className="border shadow-sm border-red-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600 flex-shrink-0">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Week</p>
                  <p className="text-3xl font-bold text-red-700" data-testid="text-debited-week">{pointsStats?.weekDebited?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm border-red-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600 flex-shrink-0">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Month</p>
                  <p className="text-3xl font-bold text-red-700" data-testid="text-debited-month">{pointsStats?.monthDebited?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm border-red-200">
              <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600 flex-shrink-0">
                  <CalendarRange className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Year</p>
                  <p className="text-3xl font-bold text-red-700" data-testid="text-debited-year">{pointsStats?.yearDebited?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
