import { useState, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useUserDetails, useUpdateBalance, useUpdateRole, useUpdateProfile, useDeleteUser, useUsers } from "@/hooks/use-users";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Wallet, TrendingUp, TrendingDown, History, Shield, UserCog, Trash2, AlertTriangle, BarChart2, Users, Search } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, subMonths, subYears, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { useRoleLabels } from "@/hooks/use-role-labels";
import type { Department, TransactionCategory } from "@shared/schema";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type RangeKey = "week" | "month" | "year" | "all" | "custom";

type Transaction = {
  id: number;
  amount: number;
  reason: string;
  createdAt: string;
};

function buildChartData(
  transactions: Transaction[],
  rangeKey: RangeKey,
  customFrom: string,
  customTo: string
) {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let bucketFn: (d: Date) => string;
  let labelFn: (key: string) => string;

  if (rangeKey === "week") {
    from = subDays(startOfDay(now), 6);
    bucketFn = (d) => format(d, "yyyy-MM-dd");
    labelFn = (k) => format(new Date(k + "T12:00:00"), "EEE M/d");
  } else if (rangeKey === "month") {
    from = subDays(startOfDay(now), 29);
    bucketFn = (d) => format(d, "yyyy-MM-dd");
    labelFn = (k) => format(new Date(k + "T12:00:00"), "M/d");
  } else if (rangeKey === "year") {
    from = subMonths(startOfDay(now), 11);
    from = new Date(from.getFullYear(), from.getMonth(), 1);
    bucketFn = (d) => format(d, "yyyy-MM");
    labelFn = (k) => format(new Date(k + "-15"), "MMM yyyy");
  } else if (rangeKey === "custom") {
    from = customFrom ? startOfDay(new Date(customFrom + "T00:00:00")) : subDays(startOfDay(now), 29);
    to = customTo ? new Date(customTo + "T23:59:59") : to;
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 60) {
      bucketFn = (d) => format(d, "yyyy-MM-dd");
      labelFn = (k) => format(new Date(k + "T12:00:00"), "M/d");
    } else {
      bucketFn = (d) => format(d, "yyyy-MM");
      labelFn = (k) => format(new Date(k + "-15"), "MMM yyyy");
    }
  } else {
    // all time
    const sorted = [...transactions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sorted.length === 0) return [];
    from = startOfDay(new Date(sorted[0].createdAt));
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 60) {
      bucketFn = (d) => format(d, "yyyy-MM-dd");
      labelFn = (k) => format(new Date(k + "T12:00:00"), "M/d");
    } else {
      bucketFn = (d) => format(d, "yyyy-MM");
      labelFn = (k) => format(new Date(k + "-15"), "MMM yyyy");
    }
  }

  // Filter transactions in range
  const inRange = transactions.filter((tx) => {
    const d = new Date(tx.createdAt);
    return d >= from && d <= to;
  });

  // Aggregate into buckets
  const map: Record<string, { credited: number; debited: number }> = {};
  for (const tx of inRange) {
    const key = bucketFn(new Date(tx.createdAt));
    if (!map[key]) map[key] = { credited: 0, debited: 0 };
    if (tx.amount > 0) map[key].credited += tx.amount;
    else map[key].debited += Math.abs(tx.amount);
  }

  // Build all bucket keys in range
  const allKeys: string[] = [];
  const cursor = new Date(from);
  const isMonthly = bucketFn(cursor) !== format(cursor, "yyyy-MM-dd");

  if (isMonthly || (rangeKey !== "week" && rangeKey !== "month" && rangeKey !== "custom")) {
    // We'll detect from map keys if monthly
  }

  // Detect mode from a sample
  const sampleKey = bucketFn(from);
  const isMonth = sampleKey.length === 7; // "yyyy-MM"

  if (isMonth) {
    let cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) {
      allKeys.push(format(cur, "yyyy-MM"));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  } else {
    let cur = startOfDay(new Date(from));
    while (cur <= to) {
      allKeys.push(format(cur, "yyyy-MM-dd"));
      cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return allKeys.map((key) => ({
    label: labelFn(key),
    credited: map[key]?.credited ?? 0,
    debited: map[key]?.debited ?? 0,
  }));
}

function BucksActivityChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const data = useMemo(
    () => buildChartData(transactions, range, customFrom, customTo),
    [transactions, range, customFrom, customTo]
  );

  const hasData = data.some((d) => d.credited > 0 || d.debited > 0);

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <Card className="shadow-md border-primary/10">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl font-bold">Bucks Activity</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ranges.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? "default" : "outline"}
                className="h-7 px-3 text-xs"
                onClick={() => setRange(r.key)}
                data-testid={`button-range-${r.key}`}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 text-xs w-36"
                data-testid="input-custom-from"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 text-xs w-36"
                data-testid="input-custom-to"
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No activity in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v === 0 ? "0" : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} bcks`,
                  name === "credited" ? "Credited" : "Debited",
                ]}
                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "hsl(var(--foreground))" }}>
                    {value === "credited" ? "Credited" : "Debited"}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="credited"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#16a34a" }}
              />
              <Line
                type="monotone"
                dataKey="debited"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#dc2626" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ManageEmployeesDialog({ adminId, adminName }: { adminId: number; adminName: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localChecked, setLocalChecked] = useState<Set<number> | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");
  const { data: allUsers } = useUsers();
  const { data: admins } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const adminMap = new Map(admins?.map(a => [a.id, a.fullName]) || []);
  const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);
  const employees = allUsers?.filter(u => u.id !== adminId) || [];
  const filtered = employees.filter(e => {
    const matchesSearch = !search || e.fullName.toLowerCase().includes(search.toLowerCase()) || e.username.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || (deptFilter === "none" && !e.departmentId) || e.departmentId?.toString() === deptFilter;
    return matchesSearch && matchesDept;
  });

  const serverChecked = new Set(employees.filter(e => e.managerId === adminId).map(e => e.id));
  const checked = localChecked ?? serverChecked;

  const added = [...checked].filter(id => !serverChecked.has(id));
  const removed = [...serverChecked].filter(id => !checked.has(id));
  const hasChanges = added.length > 0 || removed.length > 0;

  const reassigned = added
    .map(id => employees.find(e => e.id === id))
    .filter(e => e && e.managerId && e.managerId !== adminId)
    .map(e => ({ id: e!.id, name: e!.fullName, currentManager: adminMap.get(e!.managerId!) || "another manager" }));

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setLocalChecked(null);
      setShowConfirm(false);
      setSearch("");
      setDeptFilter("all");
    }
  };

  const handleToggle = (empId: number, isChecked: boolean) => {
    const next = new Set(checked);
    if (isChecked) {
      next.add(empId);
    } else {
      next.delete(empId);
    }
    setLocalChecked(next);
  };

  const handleDone = () => {
    if (!hasChanges) {
      setOpen(false);
      return;
    }
    setShowConfirm(true);
  };

  const handleGoBack = () => {
    setShowConfirm(false);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      for (const empId of added) {
        await apiRequest("PATCH", `/api/users/${empId}/manager`, { managerId: adminId });
      }
      for (const empId of removed) {
        await apiRequest("PATCH", `/api/users/${empId}/manager`, { managerId: null });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", adminId] });
      toast({ title: "Employees updated", description: `${added.length} assigned, ${removed.length} unassigned.` });
      setShowConfirm(false);
      setOpen(false);
      setLocalChecked(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = serverChecked.size;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-manage-employees">
            <Users className="h-4 w-4 mr-2" /> Employees ({assignedCount})
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Team for {adminName}</DialogTitle>
            <DialogDescription>
              Select which people report to this manager. Click Done to review and save your changes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-manage-employees"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-dept-filter-manage">
                <SelectValue placeholder="All Depts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="none">No Department</SelectItem>
                {departments?.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
              ) : (
                filtered.map(emp => {
                  const isChecked = checked.has(emp.id);
                  const mgrName = emp.managerId ? adminMap.get(emp.managerId) : null;
                  const isOriginal = serverChecked.has(emp.id);
                  const wasChanged = isChecked !== isOriginal;
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted/50"} ${wasChanged ? "ring-1 ring-blue-300" : ""}`}
                      data-testid={`manage-emp-row-${emp.id}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) => handleToggle(emp.id, !!c)}
                        data-testid={`manage-emp-check-${emp.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {emp.username}
                          {emp.departmentId && deptMap.get(emp.departmentId) && (
                            <span className="ml-1.5 text-muted-foreground/70">· {deptMap.get(emp.departmentId)}</span>
                          )}
                        </p>
                      </div>
                      {mgrName && !isChecked && (
                        <Badge variant="outline" className="text-xs shrink-0 bg-amber-50 text-amber-700 border-amber-200" data-testid={`manage-emp-mgr-${emp.id}`}>
                          Mgr: {mgrName}
                        </Badge>
                      )}
                      {isChecked && !wasChanged && (
                        <Badge variant="outline" className="text-xs shrink-0 bg-green-50 text-green-700 border-green-200">
                          Assigned
                        </Badge>
                      )}
                      {wasChanged && (
                        <Badge variant="outline" className={`text-xs shrink-0 ${isChecked ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                          {isChecked ? "Adding" : "Removing"}
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <p className="text-xs text-muted-foreground mr-auto">
              {checked.size} employee{checked.size !== 1 ? "s" : ""} selected
              {hasChanges && <span className="text-blue-600 ml-1">({added.length} to add, {removed.length} to remove)</span>}
            </p>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-manage-employees">Cancel</Button>
            <Button onClick={handleDone} data-testid="button-done-manage-employees">Done</Button>
          </DialogFooter>

          <AlertDialog open={showConfirm} onOpenChange={(o) => { if (!o) setShowConfirm(false); }}>
            <AlertDialogContent className="z-[1003]">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Confirm Changes
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    {added.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground text-sm mb-1">Assigning to {adminName}:</p>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {added.map(id => {
                            const emp = employees.find(e => e.id === id);
                            const r = reassigned.find(r => r.id === id);
                            return (
                              <li key={id} className="text-sm">
                                <span className="font-medium">{emp?.fullName}</span>
                                {r && <span className="text-amber-600"> (currently managed by {r.currentManager})</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {removed.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground text-sm mb-1">Removing from {adminName}:</p>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {removed.map(id => {
                            const emp = employees.find(e => e.id === id);
                            return <li key={id} className="text-sm"><span className="font-medium">{emp?.fullName}</span></li>;
                          })}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm">Are you sure you want to apply these changes?</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleGoBack} data-testid="button-go-back">Go Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmSave} disabled={saving} data-testid="button-confirm-changes">
                  {saving ? "Saving…" : "Confirm Changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminEmployeeDetailPage() {
  const [, params] = useRoute("/admin/employees/:id");
  const [, setLocation] = useLocation();
  const id = params ? parseInt(params.id) : 0;
  const { data: user, isLoading, error } = useUserDetails(id);
  const { data: currentUser } = useUser();
  const { getRoleLabel } = useRoleLabels();

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;
  if (error || !user) return <AdminLayout><div className="p-8 text-center text-destructive">User not found</div></AdminLayout>;

  const isPrime = currentUser?.role === "prime_admin";
  const canDelete = isPrime ? (user.role !== "prime_admin") : (user.role === "employee");
  const canEditProfile = isPrime || currentUser?.id === user.id;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link href="/admin/employees" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Employees
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-display font-bold">{user.fullName}</h1>
            <Badge variant={user.role === 'admin' ? "default" : "secondary"}>
              {getRoleLabel(user.role)}
            </Badge>
          </div>
          <div className="flex gap-2">
            {isPrime && user.role === "admin" && <ManageEmployeesDialog adminId={user.id} adminName={user.fullName} />}
            {canEditProfile && <EditProfileDialog user={user} />}
            {canDelete && <DeleteUserDialog userId={user.id} fullName={user.fullName} onSuccess={() => setLocation("/admin/employees")} />}
          </div>
        </div>
      </div>

      <div className="mb-8">
        {/* Balance Card */}
        <Card className="shadow-md bg-gradient-to-br from-white to-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Current Balance</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display text-primary mb-4">
              {user.balance.toLocaleString()} bcks
            </div>
            <div className="flex gap-2">
              <AdjustBalanceDialog userId={user.id} currentBalance={user.balance} />
              {isPrime && <ChangeRoleDialog userId={user.id} currentRole={user.role} fullName={user.fullName} />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bucks Activity Chart */}
      <div className="mb-8">
        <BucksActivityChart transactions={user.transactions ?? []} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">Transaction History</h2>
        </div>
        
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
              {user.transactions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {tx.amount > 0 ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Credit</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Debit</Badge>
                    )}
                  </TableCell>
                  <TableCell>{tx.reason}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

function AdjustBalanceDialog({ userId, currentBalance }: { userId: number; currentBalance: number }) {
  const [open, setOpen] = useState(false);
  const { mutate: updateBalance, isPending } = useUpdateBalance();
  const { data: adminUser } = useUser();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");

  const { data: categories } = useQuery<TransactionCategory[]>({
    queryKey: [`/api/organizations/${adminUser?.organizationId}/categories`],
    enabled: !!adminUser?.organizationId,
  });

  const numAmount = parseInt(amount) || 0;
  const isPrime = adminUser?.role === "prime_admin";
  const adminBalance = adminUser?.balance ?? 0;
  const wouldOverspend = type === "credit" && !isPrime && numAmount > adminBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (wouldOverspend) return;

    if (type === "credit") {
      if (!categoryId || categoryId === "none") return;
      const selectedCat = categories?.find(c => String(c.id) === categoryId);
      updateBalance({ id: userId, amount: numAmount, reason: selectedCat?.name ?? "Credit", categoryId: parseInt(categoryId) }, {
        onSuccess: () => {
          setOpen(false);
          setAmount("");
          setCategoryId("");
          setType("credit");
        }
      });
    } else {
      updateBalance({ id: userId, amount: -numAmount, reason: reason || "Debit" }, {
        onSuccess: () => {
          setOpen(false);
          setAmount("");
          setReason("");
          setType("credit");
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Adjust Balance</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Employee Balance</DialogTitle>
          <DialogDescription>
            Add or remove Bucks from this employee's account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {!isPrime && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Your Bucks balance</span>
              <span className="font-bold text-primary tabular-nums">{adminBalance.toLocaleString()} bcks</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Button 
              type="button" 
              variant={type === "credit" ? "default" : "outline"}
              className={type === "credit" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => setType("credit")}
              data-testid="button-credit-type"
            >
              <TrendingUp className="mr-2 h-4 w-4" /> Credit (Add)
            </Button>
            <Button 
              type="button"
              variant={type === "debit" ? "destructive" : "outline"}
              onClick={() => setType("debit")}
              data-testid="button-debit-type"
            >
              <TrendingDown className="mr-2 h-4 w-4" /> Debit (Remove)
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              min="1"
              required
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-adjust-amount"
            />
            {wouldOverspend && (
              <p className="text-xs text-destructive">
                Insufficient balance — you only have {adminBalance.toLocaleString()} bcks available.
              </p>
            )}
          </div>

          {type === "credit" ? (
            <div className="grid gap-2">
              <Label htmlFor="adjust-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="adjust-category" data-testid="select-adjust-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories && categories.length > 0 ? categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  )) : (
                    <SelectItem value="none" disabled>No categories set up</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {(!categories || categories.length === 0) && (
                <p className="text-xs text-muted-foreground">Ask your Organization Owner to set up categories in Settings.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input 
                id="reason" 
                placeholder="e.g. Cafeteria Purchase"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-adjust-reason"
              />
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending || wouldOverspend || (type === "credit" && (!categoryId || categoryId === "none"))} data-testid="button-confirm-adjust">
              {isPending ? "Updating..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialog({ userId, currentRole, fullName }: { userId: number; currentRole: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const { mutate: updateRole, isPending } = useUpdateRole();
  const newRole = currentRole === "admin" ? "employee" : currentRole === "employee" ? "admin" : "employee";

  const handleSubmit = () => {
    const roles: ("admin" | "employee" | "prime_admin")[] = ["employee", "admin", "prime_admin"];
    const nextRole = roles[(roles.indexOf(currentRole as any) + 1) % roles.length];
    updateRole({ id: userId, role: nextRole }, {
      onSuccess: () => {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Shield className="mr-2 h-4 w-4" />Change Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Change {fullName}'s role from {currentRole} to {newRole}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            This action will change the user's access level and permissions.
          </p>
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium">Current Role: <span className="capitalize">{currentRole}</span></p>
            <p className="text-sm font-medium">New Role: <span className="capitalize text-primary">{newRole}</span></p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Updating..." : "Confirm Role Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName || "");
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(user.email || "");
  const [selectedDept, setSelectedDept] = useState<string>(user.departmentId?.toString() || "none");
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { data: currentUser } = useUser();
  const isPrimeAdmin = currentUser?.role === "prime_admin";

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { id: user.id, username, password: password || undefined, email: email || undefined };
    if (isPrimeAdmin) {
      payload.departmentId = selectedDept !== "none" ? parseInt(selectedDept) : null;
      if (fullName.trim() && fullName.trim() !== user.fullName) {
        payload.fullName = fullName.trim();
      }
    }
    updateProfile(payload, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile Settings</DialogTitle>
          <DialogDescription>Update profile information for {user.fullName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {isPrimeAdmin && (
            <div className="grid gap-2">
              <Label htmlFor="fullName">Display Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full name"
                required
                data-testid="input-edit-fullname"
              />
              <p className="text-xs text-muted-foreground">The name displayed throughout the platform for this user.</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="username">Username / Code</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required data-testid="input-edit-username" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">New Password (leave blank to keep current)</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="input-edit-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email (for balance updates)</Label>
            <Input id="email" type="email" placeholder="employee@example.com" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-edit-email" />
            <p className="text-xs text-muted-foreground">Optional. Receive notifications when your balance changes.</p>
          </div>
          {isPrimeAdmin && (
            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger data-testid="select-edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments?.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending} data-testid="button-save-profile">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ userId, fullName, onSuccess }: { userId: number; fullName: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { mutate: deleteUser, isPending } = useDeleteUser();

  const handleDelete = () => {
    deleteUser(userId, {
      onSuccess: () => {
        setOpen(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center">Confirm Deletion</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to delete <strong>{fullName}</strong>? This action cannot be undone and all transaction history will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
