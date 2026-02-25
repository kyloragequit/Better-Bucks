import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUsers, useCreateUser } from "@/hooks/use-users";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, ChevronRight, Mail, Phone, Zap, TrendingUp } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useRoleLabels } from "@/hooks/use-role-labels";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import type { InsertUser, Department, User, Organization } from "@shared/schema";

export default function AdminEmployeesPage() {
  const { data: users, isLoading } = useUsers();
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();
  const isPrimeAdmin = currentUser?.role === "prime_admin";
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

  const assignDeptMutation = useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: number; departmentId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/department`, { departmentId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Department Updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.username.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || 
      (deptFilter === "none" && !user.departmentId) ||
      (user.departmentId?.toString() === deptFilter);
    return matchesSearch && matchesDept;
  });

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{isPrimeAdmin ? "Team Members" : "Employees"}</h1>
          <p className="text-muted-foreground mt-1">{isPrimeAdmin ? "Manage all team member accounts and balances" : "Manage employee accounts and balances"}</p>
        </div>
        <div className="flex gap-2">
          <BulkCreditDialog users={users ?? []} departments={departments ?? []} />
          <CreateEmployeeDialog />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or code..." 
              className="pl-9 bg-muted/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-employees"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-dept-filter">
              <SelectValue placeholder="All Departments" />
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
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              )}
              {filteredUsers?.map((user) => (
                <TableRow key={user.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {user.username}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{getRoleLabel(user.role)}</TableCell>
                  <TableCell>
                    {isPrimeAdmin ? (
                      <Select
                        value={user.departmentId?.toString() || "none"}
                        onValueChange={(val) => assignDeptMutation.mutate({ userId: user.id, departmentId: val === "none" ? null : parseInt(val) })}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`select-dept-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {departments?.map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {user.departmentId ? deptMap.get(user.departmentId) || "—" : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {user.balance.toLocaleString()} pts
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/employees/${user.id}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Details <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}

function BulkCreditDialog({ users, departments }: { users: User[]; departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [deptQuickSelect, setDeptQuickSelect] = useState<string>("none");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();

  const { data: currentUser } = useUser();
  const creditableUsers = users.filter(u => u.role !== "prime_admin" && u.id !== currentUser?.id);

  const bulkCreditMutation = useMutation({
    mutationFn: async ({ userIds, amount, reason }: { userIds: number[]; amount: number; reason: string }) => {
      const res = await apiRequest("POST", "/api/users/bulk-credit", { userIds, amount, reason });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to credit employees");
      }
      return await res.json();
    },
    onSuccess: (data: { credited: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/points"] });
      toast({ title: "Points Credited", description: `Successfully credited ${data.credited} employee${data.credited !== 1 ? "s" : ""}.` });
      setOpen(false);
      setSelectedIds(new Set());
      setAmount("");
      setReason("");
      setDeptQuickSelect("none");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleUser = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === creditableUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(creditableUsers.map(u => u.id)));
    }
  };

  const selectDepartment = (deptId: string) => {
    setDeptQuickSelect(deptId);
    if (deptId === "none") {
      setSelectedIds(new Set());
      return;
    }
    const deptUsers = creditableUsers.filter(u => u.departmentId?.toString() === deptId);
    setSelectedIds(new Set(deptUsers.map(u => u.id)));
  };

  const parsedAmount = parseInt(amount) || 0;
  const totalCost = parsedAmount * selectedIds.size;

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No employees selected", description: "Select at least one employee to credit.", variant: "destructive" });
      return;
    }
    if (parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive point amount.", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for the credit.", variant: "destructive" });
      return;
    }
    bulkCreditMutation.mutate({ userIds: Array.from(selectedIds), amount: parsedAmount, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) { setSelectedIds(new Set()); setAmount(""); setReason(""); setDeptQuickSelect("none"); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-bulk-credit">
          <Zap className="mr-2 h-4 w-4" /> Bulk Credit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bulk Credit Points</DialogTitle>
          <DialogDescription>Credit the same amount of points to multiple employees at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Points Per Employee</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-bulk-amount"
              />
            </div>
            {departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>Quick-Select Department</Label>
                <Select value={deptQuickSelect} onValueChange={selectDepartment}>
                  <SelectTrigger data-testid="select-bulk-dept">
                    <SelectValue placeholder="Choose department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              placeholder="e.g. Monthly performance bonus"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-bulk-reason"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Employees</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAll}
                data-testid="button-bulk-select-all"
              >
                {selectedIds.size === creditableUsers.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <ScrollArea className="h-[220px] rounded-md border">
              <div className="p-2 space-y-1">
                {creditableUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No employees available</p>
                )}
                {creditableUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    data-testid={`bulk-row-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                      data-testid={`bulk-check-${u.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.username} · {getRoleLabel(u.role)}</p>
                    </div>
                    <span className="text-xs font-bold text-primary tabular-nums">{u.balance.toLocaleString()} pts</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {selectedIds.size > 0 && parsedAmount > 0 && (
            <div className="rounded-lg bg-muted/50 border px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedIds.size}</span> employee{selectedIds.size !== 1 ? "s" : ""} × <span className="font-semibold text-foreground">{parsedAmount.toLocaleString()} pts</span>
              </span>
              <span className="font-bold text-primary">{totalCost.toLocaleString()} pts total</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkCreditMutation.isPending || selectedIds.size === 0 || parsedAmount <= 0 || !reason.trim()}
            data-testid="button-bulk-submit"
          >
            {bulkCreditMutation.isPending ? "Crediting..." : `Credit ${selectedIds.size > 0 ? selectedIds.size : ""} Employee${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { mutate: createUser, isPending } = useCreateUser();
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("none");
  const [formData, setFormData] = useState<InsertUser>({
    fullName: "",
    username: "",
    password: "",
    email: "",
    role: "employee",
    barcode: "",
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  type OrgData = Organization & { isFree: boolean; employeeCount: number };
  const { data: org } = useQuery<OrgData>({
    queryKey: ["/api/organizations/my-org"],
  });
  const isAtCapacity = !!org && org.maxEmployees > 0 && org.employeeCount >= org.maxEmployees;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      barcode: formData.barcode || formData.username,
      email: contactMethod === "email" ? formData.email : "",
      phone: contactMethod === "phone" ? phone : "",
      departmentId: selectedDept !== "none" ? parseInt(selectedDept) : null,
    };
    createUser(payload, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ fullName: "", username: "", password: "", email: "", role: "employee", barcode: "" });
        setPhone("");
        setContactMethod("email");
        setSelectedDept("none");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20">
          <UserPlus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </DialogTrigger>

      {isAtCapacity ? (
        <DialogContent className="sm:max-w-[400px]" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Employee Limit Reached</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center gap-5 py-4">
            <AppLogo size="lg" />
            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-foreground">
                Would you like to add another employee?
              </h2>
              <p className="text-muted-foreground text-sm">
                You've reached the limit of <span className="font-semibold text-foreground">{org?.maxEmployees} employees</span> on your current plan. Upgrade to add more team members.
              </p>
            </div>
            <Button
              className="w-full shadow-lg shadow-primary/20"
              onClick={() => { setOpen(false); navigate("/admin/settings"); }}
              data-testid="button-upgrade-plan"
            >
              <TrendingUp className="mr-2 h-4 w-4" /> Upgrade Your Plan
            </Button>
          </div>
        </DialogContent>
      ) : (
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a new employee account. They will use the code to login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              required
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label>Verification Method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contactMethod === "email" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setContactMethod("email")}
                data-testid="button-emp-method-email"
              >
                <Mail className="mr-1 h-3 w-3" /> Email
              </Button>
              <Button
                type="button"
                variant={contactMethod === "phone" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setContactMethod("phone")}
                data-testid="button-emp-method-phone"
              >
                <Phone className="mr-1 h-3 w-3" /> Phone
              </Button>
            </div>
            {contactMethod === "email" ? (
              <Input 
                id="emp-email" 
                type="email"
                required
                placeholder="employee@example.com"
                value={formData.email || ""}
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                data-testid="input-employee-email"
              />
            ) : (
              <Input 
                id="emp-phone" 
                type="tel"
                required
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)} 
                data-testid="input-employee-phone"
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Employee Code (Username)</Label>
            <Input 
              id="code" 
              required
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="barcode">Barcode (Optional)</Label>
            <Input 
              id="barcode" 
              placeholder="Defaults to Employee Code"
              value={formData.barcode}
              onChange={(e) => setFormData({...formData, barcode: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(val: "admin" | "employee") => setFormData({...formData, role: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="prime_admin">Prime Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="department">Department</Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger data-testid="select-create-department">
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
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      )}
    </Dialog>
  );
}
