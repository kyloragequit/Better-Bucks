import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { usePublicDemo } from "@/hooks/use-demo";
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
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, ChevronRight, Mail, Phone, Zap, TrendingUp, Upload, Download, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useRoleLabels } from "@/hooks/use-role-labels";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import type { InsertUser, Department, User, Organization } from "@shared/schema";

export default function AdminEmployeesPage() {
  const isPublicDemo = usePublicDemo();
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
        <div className="flex gap-2 flex-wrap">
          <BulkImportDialog departments={departments ?? []} demoMode={isPublicDemo} />
          {!isPublicDemo && (
            <>
              <BulkCreditDialog users={users ?? []} departments={departments ?? []} />
              <CreateEmployeeDialog />
            </>
          )}
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
                    {user.balance.toLocaleString()} bcks
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
      toast({ title: "Bucks Credited", description: `Successfully credited ${data.credited} employee${data.credited !== 1 ? "s" : ""}.` });
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
  const isPrime = currentUser?.role === "prime_admin";
  const adminBalance = currentUser?.balance ?? 0;
  const wouldOverspend = !isPrime && totalCost > adminBalance;

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No employees selected", description: "Select at least one employee to credit.", variant: "destructive" });
      return;
    }
    if (parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive Bucks amount.", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for the credit.", variant: "destructive" });
      return;
    }
    if (wouldOverspend) {
      toast({ title: "Insufficient balance", description: `You only have ${adminBalance.toLocaleString()} bcks. This credit would cost ${totalCost.toLocaleString()} bcks.`, variant: "destructive" });
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
          <DialogTitle>Bulk Credit Bucks</DialogTitle>
          <DialogDescription>Credit the same amount of Bucks to multiple employees at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bucks Per Employee</Label>
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
                    <span className="text-xs font-bold text-primary tabular-nums">{u.balance.toLocaleString()} bcks</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {!isPrime && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Your Bucks balance</span>
              <span className="font-bold text-primary tabular-nums">{adminBalance.toLocaleString()} bcks</span>
            </div>
          )}

          {selectedIds.size > 0 && parsedAmount > 0 && (
            <div className={`rounded-lg border px-4 py-3 flex items-center justify-between text-sm ${wouldOverspend ? "border-destructive/40 bg-destructive/5" : "bg-muted/50"}`}>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedIds.size}</span> employee{selectedIds.size !== 1 ? "s" : ""} × <span className="font-semibold text-foreground">{parsedAmount.toLocaleString()} bcks</span>
              </span>
              <span className={`font-bold tabular-nums ${wouldOverspend ? "text-destructive" : "text-primary"}`}>{totalCost.toLocaleString()} bcks total</span>
            </div>
          )}
          {wouldOverspend && (
            <p className="text-xs text-destructive -mt-2">
              Insufficient balance — you need {totalCost.toLocaleString()} bcks but only have {adminBalance.toLocaleString()} bcks.
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkCreditMutation.isPending || selectedIds.size === 0 || parsedAmount <= 0 || !reason.trim() || wouldOverspend}
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
  const [contactMethod, setContactMethod] = useState<"none" | "email" | "phone">("none");
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

  const isAdminRole = formData.role === "admin" || formData.role === "prime_admin";

  const handleRoleChange = (val: "admin" | "employee" | "prime_admin") => {
    setFormData(prev => ({ ...prev, role: val }));
    if (val === "admin" || val === "prime_admin") {
      setContactMethod("email");
    }
  };

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
        setContactMethod("none");
        setSelectedDept("none");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20" data-testid="button-add-employee">
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
            <Label>
              {isAdminRole ? (
                <>Email <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(required for admin accounts)</span></>
              ) : (
                <>Notifications <span className="text-xs font-normal text-muted-foreground">(optional)</span></>
              )}
            </Label>
            {!isAdminRole && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={contactMethod === "none" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setContactMethod("none")}
                  data-testid="button-emp-method-none"
                >
                  None
                </Button>
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
            )}
            {(contactMethod === "email" || isAdminRole) && (
              <Input 
                id="emp-email" 
                type="email"
                required
                placeholder="admin@company.com"
                value={formData.email || ""}
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                data-testid="input-employee-email"
              />
            )}
            {contactMethod === "phone" && !isAdminRole && (
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
            {contactMethod === "none" && !isAdminRole && (
              <p className="text-xs text-muted-foreground">Employee will use the Site ID QR code to sign in — no email or phone needed.</p>
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
            <Label htmlFor="password">Password (Optional)</Label>
            <Input 
              id="password" 
              type="password"
              placeholder="Leave blank to use QR code or universal PIN"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(val: "admin" | "employee" | "prime_admin") => handleRoleChange(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="prime_admin">Organization</SelectItem>
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

type ImportRow = {
  fullName: string;
  username: string;
  role: string;
  departmentName: string;
  email: string;
  password: string;
};

type ImportResult = {
  row: number;
  username: string;
  fullName: string;
  success: boolean;
  error?: string;
};

function downloadTemplate() {
  const headers = [["Full Name", "Employee Code", "Role", "Department", "Email", "Password"]];
  const examples = [
    ["Jane Smith", "EMP-001", "employee", "Warehouse", "jane@example.com", ""],
    ["Bob Johnson", "EMP-002", "employee", "Logistics", "", ""],
    ["Alice Manager", "MGR-001", "admin", "Shipping", "alice@example.com", "TempPass1!"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...examples]);
  ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  XLSX.writeFile(wb, "better-bucks-employee-template.xlsx");
}

function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
        if (rows.length < 2) { resolve([]); return; }
        const header = rows[0].map((h: string) => String(h).toLowerCase().trim());
        const colIdx = (names: string[]) => {
          for (const n of names) {
            const i = header.indexOf(n);
            if (i >= 0) return i;
          }
          return -1;
        };
        const fnCol = colIdx(["full name", "fullname", "name"]);
        const unCol = colIdx(["employee code", "code", "username", "user code"]);
        const roleCol = colIdx(["role"]);
        const deptCol = colIdx(["department", "dept", "department name"]);
        const emailCol = colIdx(["email"]);
        const pwCol = colIdx(["password", "pass"]);
        const result: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const fullName = fnCol >= 0 ? String(r[fnCol] ?? "").trim() : "";
          const username = unCol >= 0 ? String(r[unCol] ?? "").trim() : "";
          if (!fullName && !username) continue;
          result.push({
            fullName,
            username,
            role: roleCol >= 0 ? String(r[roleCol] ?? "").trim() : "employee",
            departmentName: deptCol >= 0 ? String(r[deptCol] ?? "").trim() : "",
            email: emailCol >= 0 ? String(r[emailCol] ?? "").trim() : "",
            password: pwCol >= 0 ? String(r[pwCol] ?? "").trim() : "",
          });
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function BulkImportDialog({ departments, demoMode = false }: { departments: Department[]; demoMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (employees: ImportRow[]) => {
      const res = await apiRequest("POST", "/api/users/bulk-import", { employees });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Import failed");
      }
      return res.json() as Promise<{ imported: number; total: number; results: ImportResult[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      setResults(data.results);
      setImportedCount(data.imported);
      if (data.imported === data.total) {
        toast({ title: "Import Complete", description: `All ${data.imported} employees imported successfully.` });
      } else {
        toast({ title: "Import Partially Complete", description: `${data.imported} of ${data.total} employees imported. Review errors below.`, variant: "destructive" });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    },
  });

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseSpreadsheet(file);
      setRows(parsed);
      setResults(null);
    } catch {
      toast({ title: "Parse Error", description: "Could not read the file. Ensure it's a valid .xlsx or .xls file.", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setRows([]);
    setResults(null);
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const deptNames = new Set(departments.map(d => d.name));
  const rowErrors = rows.map(r => {
    const errs: string[] = [];
    if (!r.fullName) errs.push("Missing name");
    if (!r.username) errs.push("Missing code");
    if (r.role.toLowerCase() === "admin" && !r.email) errs.push("Admin needs email");
    return errs;
  });
  const hasErrors = rowErrors.some(e => e.length > 0);

  return (
    <Dialog open={open} onOpenChange={demoMode ? () => {} : handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-bulk-import" onClick={demoMode ? () => setOpen(true) : undefined}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Spreadsheet
        </Button>
      </DialogTrigger>
      {demoMode ? (
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Import Spreadsheet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              In your own organization, this button opens a dialog where you can upload an Excel (.xlsx) file to add dozens of employees in one shot.
            </p>
            <ul className="text-sm space-y-1.5 list-none">
              {[
                "Download a pre-formatted template",
                "Fill in names, codes, departments & roles",
                "Upload — every row becomes an employee",
                "Errors shown row-by-row for easy fixing",
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#4E9F3D" }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground italic">This feature is disabled in the demo organization.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      ) : (
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Employees from Spreadsheet</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) to add multiple employees at once. Download the template to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!results && (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Start with our template</span>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Template Columns</Label>
                <div className="rounded-lg border overflow-hidden text-xs">
                  <div className="grid grid-cols-6 bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">
                    <span>Full Name*</span>
                    <span>Emp. Code*</span>
                    <span>Role</span>
                    <span>Department</span>
                    <span>Email</span>
                    <span>Password</span>
                  </div>
                  <div className="grid grid-cols-6 px-3 py-2 text-muted-foreground border-t">
                    <span>Required</span>
                    <span>Required</span>
                    <span>employee/admin</span>
                    <span>Optional</span>
                    <span>Required for admins</span>
                    <span>Optional</span>
                  </div>
                </div>
              </div>

              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 px-4 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="zone-file-upload"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Drop your spreadsheet here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">or click to browse — .xlsx, .xls, or .csv</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  data-testid="input-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{rows.length} row{rows.length !== 1 ? "s" : ""} detected</Label>
                    <button className="text-xs text-muted-foreground hover:underline" onClick={reset}>Clear</button>
                  </div>
                  <ScrollArea className="h-[220px] rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[28px] text-center">#</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Dept</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => {
                          const errs = rowErrors[i];
                          const hasUnknownDept = r.departmentName && !deptNames.has(r.departmentName);
                          return (
                            <TableRow key={i} className={errs.length > 0 ? "bg-destructive/5" : undefined}>
                              <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="text-sm font-medium">{r.fullName || <span className="text-destructive italic text-xs">missing</span>}</TableCell>
                              <TableCell className="font-mono text-xs">{r.username || <span className="text-destructive italic text-xs">missing</span>}</TableCell>
                              <TableCell>
                                <Badge variant={r.role.toLowerCase() === "admin" ? "secondary" : "outline"} className="text-xs">
                                  {r.role || "employee"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.departmentName
                                  ? <span className={hasUnknownDept ? "text-amber-600" : ""}>{r.departmentName}{hasUnknownDept ? " ⚠" : ""}</span>
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.email || "—"}</TableCell>
                              <TableCell>
                                {errs.length > 0 && (
                                  <span className="text-xs text-destructive">{errs.join(", ")}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {rows.some(r => r.departmentName && !deptNames.has(r.departmentName)) && (
                    <p className="text-xs text-amber-600">⚠ Departments marked with ⚠ don't match any existing department and will be ignored.</p>
                  )}
                </div>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${importedCount === results.length ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                {importedCount === results.length ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {importedCount} of {results.length} employees imported
                  </p>
                  {importedCount < results.length && (
                    <p className="text-xs text-muted-foreground">{results.length - importedCount} rows had errors — review below</p>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[280px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[28px]">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.row} className={r.success ? undefined : "bg-destructive/5"}>
                        <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="text-sm font-medium">{r.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{r.username}</TableCell>
                        <TableCell>
                          {r.success ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Imported
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                              <XCircle className="h-3.5 w-3.5" /> {r.error}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 shrink-0">
          {!results ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => importMutation.mutate(rows)}
                disabled={rows.length === 0 || hasErrors || importMutation.isPending}
                data-testid="button-import-submit"
              >
                {importMutation.isPending
                  ? "Importing…"
                  : hasErrors
                  ? "Fix errors to import"
                  : `Import ${rows.length} Employee${rows.length !== 1 ? "s" : ""}`}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  );
}
