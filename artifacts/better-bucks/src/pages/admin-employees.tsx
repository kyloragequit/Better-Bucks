import { useState, useRef, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePersistedState } from "@/hooks/use-persisted-state";
import ExcelJS from "exceljs/dist/exceljs.min.js";
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
import { Search, UserPlus, ChevronRight, Mail, Phone, Zap, TrendingUp, TrendingDown, Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, Send, Trash2, Clock, AlertTriangle, MoreVertical, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useRoleLabels } from "@/hooks/use-role-labels";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import type { InsertUser, Department, User, Organization, Invitation } from "@shared/schema";

function isCurrentlyLocked(user: User): boolean {
  return !!user.lockedUntil && new Date() < new Date(user.lockedUntil);
}

export default function AdminEmployeesPage() {
  const isPublicDemo = usePublicDemo();
  const { data: users, isLoading } = useUsers();
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();
  const isPrimeAdmin = currentUser?.role === "prime_admin";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [deptFilter, setDeptFilter] = usePersistedState<string>("bb_filter_emp_deptId", "all");
  const [mgrFilter, setMgrFilter] = usePersistedState<string>("bb_filter_emp_mgrId", "all");
  const [roleFilter, setRoleFilter] = usePersistedState<string>("bb_filter_emp_role", "all");

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: admins } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });

  const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);
  const adminMap = new Map(admins?.map(a => [a.id, a.fullName]) || []);

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

  const assignMgrMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: number; managerId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/manager`, { managerId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
      toast({ title: "Manager Updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const filteredUsers = useMemo(() => users?.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      user.username.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesDept = deptFilter === "all" || 
      (deptFilter === "none" && !user.departmentId) ||
      (user.departmentId?.toString() === deptFilter);
    const matchesMgr = mgrFilter === "all" ||
      (mgrFilter === "none" && !user.managerId) ||
      (user.managerId?.toString() === mgrFilter);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesDept && matchesMgr && matchesRole;
  }), [users, debouncedSearch, deptFilter, mgrFilter, roleFilter]);

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">{isPrimeAdmin ? "Team Members" : "Employees"}</h1>
          <p className="text-muted-foreground mt-1">{isPrimeAdmin ? "Manage all team member accounts and balances" : "Manage employee accounts and balances"}</p>
        </div>
        <div className="hidden sm:flex gap-2 flex-wrap">
          <BulkImportDialog departments={departments ?? []} demoMode={isPublicDemo} />
          {!isPublicDemo && (
            <>
              <BulkCreditDialog users={users ?? []} departments={departments ?? []} />
              <BulkDebitDialog users={users ?? []} departments={departments ?? []} />
              {isPrimeAdmin && <InviteUserDialog departments={departments ?? []} />}
              <CreateEmployeeDialog />
            </>
          )}
        </div>
        <MobileActionsMenu
          isPublicDemo={isPublicDemo}
          isPrimeAdmin={!!isPrimeAdmin}
          departments={departments ?? []}
          users={users ?? []}
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search"
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
          <Select value={mgrFilter} onValueChange={setMgrFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-mgr-filter">
              <SelectValue placeholder="All Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              <SelectItem value="none">No Manager</SelectItem>
              {admins?.filter(a => a.role === "admin").map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-role-filter">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="employee">{getRoleLabel("employee")}</SelectItem>
              <SelectItem value="admin">{getRoleLabel("admin")}</SelectItem>
              <SelectItem value="prime_admin">{getRoleLabel("prime_admin")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : filteredUsers?.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-muted-foreground">
          No employees found
        </div>
      ) : (
        <EmployeeVirtualList
          filteredUsers={filteredUsers ?? []}
          isPrimeAdmin={!!isPrimeAdmin}
          departments={departments}
          admins={admins}
          deptMap={deptMap}
          adminMap={adminMap}
          getRoleLabel={getRoleLabel}
          assignDeptMutation={assignDeptMutation}
          assignMgrMutation={assignMgrMutation}
        />
      )}

      {isPrimeAdmin && <PendingAccountsList />}
      {isPrimeAdmin && <PendingInvitesList />}
    </AdminLayout>
  );
}

type EmployeeVirtualListProps = {
  filteredUsers: User[];
  isPrimeAdmin: boolean;
  departments: Department[] | undefined;
  admins: { id: number; fullName: string; role: string }[] | undefined;
  deptMap: Map<number, string>;
  adminMap: Map<number, string>;
  getRoleLabel: (role: string) => string;
  assignDeptMutation: ReturnType<typeof useMutation<any, Error, { userId: number; departmentId: number | null }>>;
  assignMgrMutation: ReturnType<typeof useMutation<any, Error, { userId: number; managerId: number | null }>>;
};

function EmployeeVirtualList({
  filteredUsers,
  isPrimeAdmin,
  departments,
  admins,
  deptMap,
  adminMap,
  getRoleLabel,
  assignDeptMutation,
  assignMgrMutation,
}: EmployeeVirtualListProps) {
  const mobileParentRef = useRef<HTMLDivElement>(null);
  const desktopParentRef = useRef<HTMLDivElement>(null);

  const mobileVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  const desktopVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => desktopParentRef.current,
    estimateSize: () => 53,
    overscan: 10,
  });

  const mobileVirtualItems = mobileVirtualizer.getVirtualItems();
  const desktopVirtualItems = desktopVirtualizer.getVirtualItems();

  const desktopPaddingTop = desktopVirtualItems.length > 0 ? desktopVirtualItems[0].start : 0;
  const desktopPaddingBottom =
    desktopVirtualItems.length > 0
      ? desktopVirtualizer.getTotalSize() - desktopVirtualItems[desktopVirtualItems.length - 1].end
      : 0;

  return (
    <>
      {/* Mobile card layout — virtualized */}
      <div
        ref={mobileParentRef}
        className="md:hidden overflow-y-auto"
        style={{ height: "min(600px, 70vh)" }}
      >
        <div
          style={{ height: mobileVirtualizer.getTotalSize(), position: "relative" }}
        >
          {mobileVirtualItems.map((virtualRow) => {
            const user = filteredUsers[virtualRow.index];
            return (
              <div
                key={user.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "8px",
                }}
              >
                <Link href={`/admin/employees/${user.id}`}>
                  <div className={`bg-card rounded-xl border shadow-sm p-4 flex items-center gap-3 active:bg-muted/30 transition-colors ${isCurrentlyLocked(user) ? "border-red-300 bg-red-50/30" : ""}`} data-testid={`card-employee-${user.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{user.fullName}</p>
                        <Badge variant="outline" className="text-xs shrink-0">{getRoleLabel(user.role)}</Badge>
                        {isCurrentlyLocked(user) && (
                          <Badge variant="outline" className="text-xs shrink-0 bg-red-50 text-red-700 border-red-300 gap-1" data-testid={`badge-locked-${user.id}`}>
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{user.username}</span>
                        {user.departmentId && deptMap.get(user.departmentId) && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate">{deptMap.get(user.departmentId)}</span>
                          </>
                        )}
                        {user.managerId && adminMap.get(user.managerId) && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate">Mgr: {adminMap.get(user.managerId)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary tabular-nums text-sm">{user.balance.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">bcks</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop table layout — virtualized */}
      <div
        ref={desktopParentRef}
        className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto overflow-y-auto"
        style={{ height: "min(600px, 70vh)" }}
      >
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            <TableRow>
              <TableHead>Employee Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {desktopPaddingTop > 0 && (
              <tr><td style={{ height: desktopPaddingTop }} /></tr>
            )}
            {desktopVirtualItems.map((virtualRow) => {
              const user = filteredUsers[virtualRow.index];
              return (
                <TableRow key={user.id} className={`group hover:bg-muted/20 transition-colors ${isCurrentlyLocked(user) ? "bg-red-50/30" : ""}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.fullName}
                      {isCurrentlyLocked(user) && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 gap-1" data-testid={`badge-locked-${user.id}`}>
                          <Lock className="h-3 w-3" /> Locked
                        </Badge>
                      )}
                    </div>
                  </TableCell>
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
                        <SelectTrigger className="min-h-8 w-auto min-w-[120px] max-w-[180px] text-xs" data-testid={`select-dept-${user.id}`}>
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
                  <TableCell>
                    {isPrimeAdmin && user.role === "employee" ? (
                      <Select
                        value={user.managerId?.toString() || "none"}
                        onValueChange={(val) => assignMgrMutation.mutate({ userId: user.id, managerId: val === "none" ? null : parseInt(val) })}
                      >
                        <SelectTrigger className="min-h-8 w-auto min-w-[120px] max-w-[180px] text-xs" data-testid={`select-mgr-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {admins?.filter(a => a.role === "admin").map(a => (
                            <SelectItem key={a.id} value={a.id.toString()}>{a.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {user.managerId ? adminMap.get(user.managerId) || "—" : "—"}
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
              );
            })}
            {desktopPaddingBottom > 0 && (
              <tr><td style={{ height: desktopPaddingBottom }} /></tr>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

type PendingUser = { id: number; fullName: string; username: string; email: string | null; phone: string | null; role: string };

function PendingAccountsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();
  const [roleSelections, setRoleSelections] = useState<Record<number, string>>({});

  const { data: pending = [], isLoading } = useQuery<PendingUser[]>({
    queryKey: ["/api/users/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("POST", `/api/users/${id}/approve`, { role });
      if (!res.ok) throw new Error("Failed to approve");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Account Approved", description: "The user can now sign in." });
    },
    onError: () => toast({ title: "Error", description: "Could not approve account.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}/reject`, undefined);
      if (!res.ok) throw new Error("Failed to reject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
      toast({ title: "Account Rejected", description: "The account request has been removed." });
    },
    onError: () => toast({ title: "Error", description: "Could not reject account.", variant: "destructive" }),
  });

  if (isLoading || pending.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-foreground">
        <Clock className="h-4 w-4 text-amber-500" />
        Pending Accounts
        <Badge className="ml-1 bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold">{pending.length}</Badge>
      </h2>
      {/* Mobile card layout for pending */}
      <div className="md:hidden space-y-2">
        {pending.map(u => {
          const selectedRole = roleSelections[u.id] ?? u.role ?? "employee";
          return (
            <div key={u.id} className="bg-card rounded-xl border border-amber-200/60 shadow-sm p-4 space-y-3" data-testid={`row-pending-${u.id}`}>
              <div>
                <p className="font-medium text-sm" data-testid={`text-pending-name-${u.id}`}>{u.fullName}</p>
                <p className="font-mono text-xs text-muted-foreground">{u.username}</p>
                {(u.email || u.phone) && <p className="text-xs text-muted-foreground mt-0.5">{u.email || u.phone}</p>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Select value={selectedRole} onValueChange={(v) => setRoleSelections(prev => ({ ...prev, [u.id]: v }))}>
                  <SelectTrigger className="w-auto min-w-28 min-h-8 text-xs" data-testid={`select-role-${u.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{getRoleLabel("employee")}</SelectItem>
                    <SelectItem value="admin">{getRoleLabel("admin")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => approveMutation.mutate({ id: u.id, role: selectedRole })} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-approve-${u.id}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={() => rejectMutation.mutate(u.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-reject-${u.id}`}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop table layout for pending */}
      <div className="hidden md:block bg-card rounded-xl border border-amber-200/60 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-amber-50/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Assign Role</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map(u => {
              const selectedRole = roleSelections[u.id] ?? u.role ?? "employee";
              return (
                <TableRow key={u.id} data-testid={`row-pending-desktop-${u.id}`}>
                  <TableCell className="font-medium" data-testid={`text-pending-name-desktop-${u.id}`}>{u.fullName}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{u.username}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.email || u.phone || <span className="italic">No contact</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={selectedRole} onValueChange={(v) => setRoleSelections(prev => ({ ...prev, [u.id]: v }))}>
                      <SelectTrigger className="w-auto min-w-32 min-h-8 text-xs" data-testid={`select-role-desktop-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">{getRoleLabel("employee")}</SelectItem>
                        <SelectItem value="admin">{getRoleLabel("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => approveMutation.mutate({ id: u.id, role: selectedRole })} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-approve-desktop-${u.id}`}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={() => rejectMutation.mutate(u.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-reject-desktop-${u.id}`}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PendingInvitesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/invitations"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/invitations/${id}`, undefined);
      if (!res.ok) throw new Error("Failed to revoke invitation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation Revoked" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not revoke invitation.", variant: "destructive" });
    },
  });

  if (isLoading || invites.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" /> Pending Invitations
      </h2>
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">
                    {inv.role === "prime_admin" ? "Organization User" : inv.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => revokeMutation.mutate(inv.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-invite-${inv.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InviteUserDialog({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "admin" | "prime_admin">("employee");
  const [selectedDept, setSelectedDept] = useState<string>("none");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await apiRequest("POST", "/api/invitations", payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation Sent", description: `An invitation email has been sent to ${email}.` });
      setOpen(false);
      setFullName("");
      setEmail("");
      setRole("employee");
      setSelectedDept("none");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      departmentId: selectedDept !== "none" ? parseInt(selectedDept) : null,
    });
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setFullName("");
      setEmail("");
      setRole("employee");
      setSelectedDept("none");
    }
    setOpen(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-invite-user">
          <Send className="mr-2 h-4 w-4" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite a New User</DialogTitle>
          <DialogDescription>
            Set their permissions and send them an invite link to create their own account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-fullname">Full Name</Label>
            <Input
              id="invite-fullname"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              data-testid="input-invite-fullname"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              data-testid="input-invite-email"
            />
            <p className="text-xs text-muted-foreground">The invite link will be sent to this address.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as any)}>
              <SelectTrigger id="invite-role" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="prime_admin">Organization User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {departments.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="invite-dept">Department (optional)</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger id="invite-dept" data-testid="select-invite-department">
                  <SelectValue placeholder="No Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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
                type="number" inputMode="numeric"
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

function BulkDebitDialog({ users, departments }: { users: User[]; departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [deptQuickSelect, setDeptQuickSelect] = useState<string>("none");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useUser();
  const debitableUsers = users.filter(u => u.role !== "prime_admin" && u.id !== currentUser?.id && u.balance > 0);

  const bulkDebitMutation = useMutation({
    mutationFn: async ({ userIds, amount, reason }: { userIds: number[]; amount: number; reason: string }) => {
      const res = await apiRequest("POST", "/api/users/bulk-debit", { userIds, amount, reason });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to debit employees");
      }
      return await res.json();
    },
    onSuccess: (data: { debited: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/points"] });
      toast({ title: "Bucks Debited", description: `Successfully debited ${data.debited} employee${data.debited !== 1 ? "s" : ""}.` });
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
    if (selectedIds.size === debitableUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(debitableUsers.map(u => u.id)));
    }
  };

  const selectDepartment = (deptId: string) => {
    setDeptQuickSelect(deptId);
    if (deptId === "none") {
      setSelectedIds(new Set());
      return;
    }
    const deptUsers = debitableUsers.filter(u => u.departmentId?.toString() === deptId);
    setSelectedIds(new Set(deptUsers.map(u => u.id)));
  };

  const parsedAmount = parseInt(amount) || 0;

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No employees selected", description: "Select at least one employee to debit.", variant: "destructive" });
      return;
    }
    if (parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive Bucks amount.", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for the debit.", variant: "destructive" });
      return;
    }
    bulkDebitMutation.mutate({ userIds: Array.from(selectedIds), amount: parsedAmount, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) { setSelectedIds(new Set()); setAmount(""); setReason(""); setDeptQuickSelect("none"); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-bulk-debit">
          <TrendingDown className="mr-2 h-4 w-4" /> Bulk Debit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bulk Debit Bucks</DialogTitle>
          <DialogDescription>Remove the same amount of Bucks from multiple employees at once. Employees without sufficient balance are skipped.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bucks Per Employee</Label>
              <Input
                type="number" inputMode="numeric"
                min={1}
                placeholder="e.g. 50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-bulk-debit-amount"
              />
            </div>
            {departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>Quick-Select Department</Label>
                <Select value={deptQuickSelect} onValueChange={selectDepartment}>
                  <SelectTrigger data-testid="select-bulk-debit-dept">
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
              placeholder="e.g. Policy violation correction"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-bulk-debit-reason"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Employees</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAll}
                data-testid="button-bulk-debit-select-all"
              >
                {selectedIds.size === debitableUsers.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <ScrollArea className="h-[220px] rounded-md border">
              <div className="p-2 space-y-1">
                {debitableUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No employees with a balance available</p>
                )}
                {debitableUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    data-testid={`bulk-debit-row-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                      data-testid={`bulk-debit-check-${u.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.username}</p>
                    </div>
                    <span className="text-xs font-bold text-primary tabular-nums">{u.balance.toLocaleString()} bcks</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {selectedIds.size > 0 && parsedAmount > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedIds.size}</span> employee{selectedIds.size !== 1 ? "s" : ""} × <span className="font-semibold text-foreground">{parsedAmount.toLocaleString()} bcks</span>
              </span>
              <span className="font-bold tabular-nums text-destructive">{(parsedAmount * selectedIds.size).toLocaleString()} bcks total removed</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={bulkDebitMutation.isPending || selectedIds.size === 0 || parsedAmount <= 0 || !reason.trim()}
            data-testid="button-bulk-debit-submit"
          >
            {bulkDebitMutation.isPending ? "Debiting..." : `Debit ${selectedIds.size > 0 ? selectedIds.size : ""} Employee${selectedIds.size !== 1 ? "s" : ""}`}
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
  const isNearCapacity = !!org && org.maxEmployees > 0 && !isAtCapacity && org.employeeCount >= org.maxEmployees - 3;
  const spotsRemaining = org && org.maxEmployees > 0 ? Math.max(0, org.maxEmployees - org.employeeCount) : null;

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
        {isNearCapacity && spotsRemaining !== null && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm" data-testid="near-capacity-warning">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-medium">Only {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Your plan allows {org?.maxEmployees} employees.{" "}
                <button
                  type="button"
                  className="underline font-medium hover:text-amber-900"
                  onClick={() => { setOpen(false); navigate("/admin/settings"); }}
                  data-testid="link-upgrade-near-capacity"
                >
                  Upgrade your plan
                </button>{" "}
                for more capacity.
              </p>
            </div>
          </div>
        )}
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
  managerName: string;
};

type ImportResult = {
  row: number;
  username: string;
  fullName: string;
  success: boolean;
  error?: string;
};

async function downloadTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Employees");
  worksheet.columns = [
    { width: 20 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 28 }, { width: 16 }, { width: 20 },
  ];
  worksheet.addRows([
    ["Full Name", "Employee Code", "Role", "Department", "Email", "Password", "Manager"],
    ["Jane Smith", "EMP-001", "employee", "Warehouse", "jane@example.com", "", "Alice Manager"],
    ["Bob Johnson", "EMP-002", "employee", "Logistics", "", "", "Alice Manager"],
    ["Alice Manager", "MGR-001", "admin", "Shipping", "alice@example.com", "TempPass1!", ""],
    ["Sam Director", "DIR-001", "prime_admin", "Operations", "sam@example.com", "", ""],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "better-bucks-employee-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  let rows: (string | number | boolean | Date | null)[][];
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    rows = text.split(/\r?\n/).filter(Boolean).map(line =>
      line.split(",").map(cell => cell.replace(/^"|"$/g, "").trim())
    );
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    rows = [];
    worksheet.eachRow((row) => {
      rows.push((row.values as (string | number | boolean | Date | null)[]).slice(1));
    });
  }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h ?? "").toLowerCase().trim());
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
  const mgrCol = colIdx(["manager", "manager name", "mgr"]);
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
      managerName: mgrCol >= 0 ? String(r[mgrCol] ?? "").trim() : "",
    });
  }
  return result;
}

function BulkImportDialog({ departments, demoMode = false }: { departments: Department[]; demoMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [jobStatus, setJobStatus] = useState<"idle" | "running" | "done" | "cancelled">("idle");
  const [jobProgress, setJobProgress] = useState({ processed: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: admins } = useQuery<{ id: number; fullName: string; role: string }[]>({
    queryKey: ["/api/org/admins"],
  });
  const adminNames = new Set(admins?.map(a => a.fullName) || []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (jobId: string, total: number) => {
    jobIdRef.current = jobId;
    setJobStatus("running");
    setJobProgress({ processed: 0, total });
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiRequest("GET", `/api/users/bulk-import/${jobId}`);
        if (!res.ok) { stopPolling(); return; }
        const data = await res.json() as { status: string; total: number; processed: number; imported: number; results: ImportResult[] };
        setJobProgress({ processed: data.processed, total: data.total });
        if (data.status === "done" || data.status === "cancelled") {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
          setResults(data.results);
          setImportedCount(data.imported);
          setJobStatus(data.status as "done" | "cancelled");
          const label = data.status === "cancelled" ? "Import Cancelled" : data.imported === data.total ? "Import Complete" : "Import Partially Complete";
          const desc = data.status === "cancelled"
            ? `Import was cancelled. ${data.imported} employee${data.imported !== 1 ? "s" : ""} were imported before cancellation.`
            : data.imported === data.total
            ? `All ${data.imported} employees imported successfully. A confirmation email has been sent.`
            : `${data.imported} of ${data.total} imported. Review errors below. A summary email has been sent.`;
          toast({ title: label, description: desc, variant: data.imported < data.total ? "destructive" : "default" });
        }
      } catch {
        stopPolling();
      }
    }, 1500);
  };

  const importMutation = useMutation({
    mutationFn: async (employees: ImportRow[]) => {
      const res = await apiRequest("POST", "/api/users/bulk-import", { employees });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Import failed");
      }
      return res.json() as Promise<{ jobId: string; total: number }>;
    },
    onSuccess: ({ jobId, total }) => {
      startPolling(jobId, total);
    },
    onError: (e: Error) => {
      setJobStatus("idle");
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    },
  });

  const handleCancel = async () => {
    if (jobIdRef.current) {
      try { await apiRequest("DELETE", `/api/users/bulk-import/${jobIdRef.current}`); } catch { /* ignore */ }
    }
  };

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseSpreadsheet(file);
      setRows(parsed);
      setResults(null);
      setJobStatus("idle");
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
    stopPolling();
    setRows([]);
    setResults(null);
    setImportedCount(0);
    setJobStatus("idle");
    setJobProgress({ processed: 0, total: 0 });
    jobIdRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (jobStatus === "running") return; // block closing while running — use Cancel button
    setOpen(o);
    if (!o) reset();
  };

  // Clean up on unmount
  useEffect(() => () => stopPolling(), []);

  const deptNames = new Set(departments.map(d => d.name));
  const rowErrors = rows.map(r => {
    const errs: string[] = [];
    if (!r.fullName) errs.push("Missing name");
    if (!r.username) errs.push("Missing code");
    const rl = r.role.toLowerCase();
    if ((rl === "admin" || rl === "prime_admin") && !r.email) errs.push(`${rl === "prime_admin" ? "Organization User" : "Admin"} needs email`);
    return errs;
  });
  const hasErrors = rowErrors.some(e => e.length > 0);

  const progressPct = jobProgress.total > 0 ? Math.round((jobProgress.processed / jobProgress.total) * 100) : 0;

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
                "Fill in names, codes, departments & roles (including Organization User)",
                "Upload — processes in the background, you'll get an email when done",
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
            Upload an Excel file (.xlsx) to add multiple employees at once. The import runs in the background — you'll receive an email when it's complete.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* ── Running progress ── */}
          {jobStatus === "running" && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/30 px-5 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Importing employees…</span>
                  <span className="text-muted-foreground">{jobProgress.processed} / {jobProgress.total}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                    data-testid="progress-bar-import"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Processing in the background. You can cancel at any time — a summary email will be sent when finished.
                </p>
              </div>
            </div>
          )}

          {/* ── File selector + preview (idle only) ── */}
          {jobStatus === "idle" && !results && (
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
                  <div className="grid grid-cols-7 bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">
                    <span>Full Name*</span>
                    <span>Emp. Code*</span>
                    <span>Role</span>
                    <span>Department</span>
                    <span>Email</span>
                    <span>Password</span>
                    <span>Manager</span>
                  </div>
                  <div className="grid grid-cols-7 px-3 py-2 text-muted-foreground border-t">
                    <span>Required</span>
                    <span>Required</span>
                    <span className="truncate">employee / admin / prime_admin</span>
                    <span>Optional</span>
                    <span>Required for admin/prime_admin</span>
                    <span>Optional</span>
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
                          <TableHead>Manager</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => {
                          const errs = rowErrors[i];
                          const hasUnknownDept = r.departmentName && !deptNames.has(r.departmentName);
                          const hasUnknownMgr = r.managerName && !adminNames.has(r.managerName);
                          const rl = r.role.toLowerCase();
                          return (
                            <TableRow key={i} className={errs.length > 0 ? "bg-destructive/5" : undefined}>
                              <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="text-sm font-medium">{r.fullName || <span className="text-destructive italic text-xs">missing</span>}</TableCell>
                              <TableCell className="font-mono text-xs">{r.username || <span className="text-destructive italic text-xs">missing</span>}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={rl === "prime_admin" ? "default" : rl === "admin" ? "secondary" : "outline"}
                                  className="text-xs"
                                >
                                  {rl === "prime_admin" ? "Organization User" : rl === "admin" ? "Admin" : "Employee"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.departmentName
                                  ? <span className={hasUnknownDept ? "text-amber-600" : ""}>{r.departmentName}{hasUnknownDept ? " ⚠" : ""}</span>
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.managerName
                                  ? <span className={hasUnknownMgr ? "text-amber-600" : ""}>{r.managerName}{hasUnknownMgr ? " ⚠" : ""}</span>
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
                  {rows.some(r => r.managerName && !adminNames.has(r.managerName)) && (
                    <p className="text-xs text-amber-600">⚠ Managers marked with ⚠ don't match any existing admin and will cause those rows to fail.</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Results ── */}
          {results && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${jobStatus === "cancelled" ? "bg-amber-50 border border-amber-200" : importedCount === results.length ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                {importedCount === results.length && jobStatus !== "cancelled" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {jobStatus === "cancelled" ? "Import cancelled — " : ""}{importedCount} of {jobProgress.total || results.length} employees imported
                  </p>
                  {importedCount < (jobProgress.total || results.length) && jobStatus !== "cancelled" && (
                    <p className="text-xs text-muted-foreground">{(jobProgress.total || results.length) - importedCount} rows had errors — review below</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">A summary email has been sent to your account.</p>
                </div>
              </div>
              {results.length > 0 && (
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
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 shrink-0">
          {jobStatus === "running" ? (
            <Button variant="destructive" onClick={handleCancel} data-testid="button-cancel-import">
              Cancel Import
            </Button>
          ) : results ? (
            <Button onClick={() => handleClose(false)} data-testid="button-import-done">Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => importMutation.mutate(rows)}
                disabled={rows.length === 0 || hasErrors || importMutation.isPending}
                data-testid="button-import-submit"
              >
                {importMutation.isPending
                  ? "Starting…"
                  : hasErrors
                  ? "Fix errors to import"
                  : `Import ${rows.length} Employee${rows.length !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  );
}

function MobileActionsMenu({ isPublicDemo, isPrimeAdmin, departments, users }: { isPublicDemo: boolean; isPrimeAdmin: boolean; departments: Department[]; users: User[] }) {
  const addRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const debitRef = useRef<HTMLDivElement>(null);
  const inviteRef = useRef<HTMLDivElement>(null);
  const click = (ref: React.RefObject<HTMLDivElement>) => ref.current?.querySelector("button")?.click();
  return (
    <div className="sm:hidden flex items-center gap-2 w-full">
      <div className="hidden" aria-hidden="true">
        <div ref={importRef}><BulkImportDialog departments={departments} demoMode={isPublicDemo} /></div>
        {!isPublicDemo && (
          <>
            <div ref={creditRef}><BulkCreditDialog users={users} departments={departments} /></div>
            <div ref={debitRef}><BulkDebitDialog users={users} departments={departments} /></div>
            {isPrimeAdmin && <div ref={inviteRef}><InviteUserDialog departments={departments} /></div>}
            <div ref={addRef}><CreateEmployeeDialog /></div>
          </>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex-1 justify-start gap-2" data-testid="button-mobile-actions" aria-label="Employee actions menu">
            <MoreVertical className="h-4 w-4" /> Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Employee actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isPublicDemo && (
            <DropdownMenuItem onSelect={() => click(addRef)} data-testid="menu-add-employee">
              <UserPlus className="h-4 w-4 mr-2" /> Add Employee
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => click(importRef)} data-testid="menu-bulk-import">
            <Upload className="h-4 w-4 mr-2" /> Bulk Import
          </DropdownMenuItem>
          {!isPublicDemo && (
            <>
              <DropdownMenuItem onSelect={() => click(creditRef)} data-testid="menu-bulk-credit">
                <TrendingUp className="h-4 w-4 mr-2" /> Bulk Credit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => click(debitRef)} data-testid="menu-bulk-debit">
                <TrendingDown className="h-4 w-4 mr-2" /> Bulk Debit
              </DropdownMenuItem>
              {isPrimeAdmin && (
                <DropdownMenuItem onSelect={() => click(inviteRef)} data-testid="menu-invite-user">
                  <Send className="h-4 w-4 mr-2" /> Invite User
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
