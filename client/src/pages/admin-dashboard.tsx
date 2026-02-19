import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { Loader } from "@/components/ui/loader";

export default function AdminDashboardPage() {
  const [selectedAdminId, setSelectedAdminId] = useState<string>("all");

  const { data: admins, isLoading: adminsLoading } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });

  const statsQueryKey = selectedAdminId === "all"
    ? ["/api/stats/points"]
    : ["/api/stats/points", { adminId: selectedAdminId }];

  const statsUrl = selectedAdminId === "all"
    ? "/api/stats/points"
    : `/api/stats/points?adminId=${selectedAdminId}`;

  const { data: pointsStats, isLoading: statsLoading } = useQuery<{ week: number; month: number; year: number }>({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const res = await fetch(statsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bucks distributed from administrators to employees</p>
        </div>
        <div className="w-full md:w-64">
          <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
            <SelectTrigger data-testid="select-admin-filter">
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

      {(statsLoading || adminsLoading) ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border shadow-sm">
            <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Bucks This Week</p>
                <p className="text-3xl font-bold" data-testid="text-points-week">{pointsStats?.week?.toLocaleString() ?? "0"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Bucks This Month</p>
                <p className="text-3xl font-bold" data-testid="text-points-month">{pointsStats?.month?.toLocaleString() ?? "0"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-6 pb-5 px-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 flex-shrink-0">
                <CalendarRange className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Bucks This Year</p>
                <p className="text-3xl font-bold" data-testid="text-points-year">{pointsStats?.year?.toLocaleString() ?? "0"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
