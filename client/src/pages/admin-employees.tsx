import { useState } from "react";
import { Link } from "wouter";
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
import { Search, UserPlus, ChevronRight, Mail, Phone } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useRoleLabels } from "@/hooks/use-role-labels";
import { useUser } from "@/hooks/use-auth";
import type { InsertUser, Department } from "@shared/schema";

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
        <CreateEmployeeDialog />
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
          {departments && departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-dept-filter">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="none">No Department</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                    {isPrimeAdmin && departments && departments.length > 0 ? (
                      <Select
                        value={user.departmentId?.toString() || "none"}
                        onValueChange={(val) => assignDeptMutation.mutate({ userId: user.id, departmentId: val === "none" ? null : parseInt(val) })}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`select-dept-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {departments.map(d => (
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

function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const { mutate: createUser, isPending } = useCreateUser();
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [formData, setFormData] = useState<InsertUser>({
    fullName: "",
    username: "",
    password: "",
    email: "",
    role: "employee",
    barcode: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      barcode: formData.barcode || formData.username,
      email: contactMethod === "email" ? formData.email : "",
      phone: contactMethod === "phone" ? phone : "",
    };
    createUser(payload, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ fullName: "", username: "", password: "", email: "", role: "employee", barcode: "" });
        setPhone("");
        setContactMethod("email");
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
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
