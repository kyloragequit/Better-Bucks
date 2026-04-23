import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Loader,
  Mail,
  Trash2,
  Search,
  Clock,
  UserCheck,
  Filter,
  ChevronRight,
  Wallet,
  History,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type PendingAccount = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: "employee" | "admin" | "prime_admin" | "developer";
  status: "pending" | "approved";
  balance: number;
  departmentId: number | null;
  departmentName: string | null;
  successfulLoginCount: number;
  transactionCount: number;
  pendingType: "awaiting_approval" | "never_logged_in";
};

type OrgData = {
  adminRoleLabel: string;
  employeeRoleLabel: string;
};

export default function AdminPendingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: accounts = [], isLoading } = useQuery<PendingAccount[]>({
    queryKey: ["/api/users/pending-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/users/pending-accounts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: org } = useQuery<OrgData>({
    queryKey: ["/api/organizations/my-org"],
  });

  const adminLabel = org?.adminRoleLabel || "Admin";
  const employeeLabel = org?.employeeRoleLabel || "Employee";

  const getRoleLabel = (role: string) => {
    if (role === "employee") return employeeLabel;
    if (role === "admin" || role === "prime_admin") return adminLabel;
    return role;
  };

  const { mutate: resendEmail, isPending: isResending } = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/users/${id}/resend-join-email`);
      return res.json();
    },
    onSuccess: (_data, id) => {
      const acct = accounts.find(a => a.id === id);
      toast({ title: "Email Sent", description: `Join instructions sent to ${acct?.email || "the account"}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Send", description: error.message, variant: "destructive" });
    },
  });

  const { mutate: cancelAccount, isPending: isCancelling } = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}/reject`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove account");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending-admins"] });
      toast({ title: "Account Removed", description: "The account has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const departments = Array.from(
    new Map(
      accounts
        .filter(a => a.departmentId && a.departmentName)
        .map(a => [a.departmentId, a.departmentName!])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = accounts.filter(a => {
    const matchesSearch =
      !search ||
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.username.toLowerCase().includes(search.toLowerCase()) ||
      (a.email ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "employee" && a.role === "employee") ||
      (roleFilter === "admin" && (a.role === "admin" || a.role === "prime_admin"));

    const matchesDept =
      deptFilter === "all" ||
      (deptFilter === "none" && !a.departmentId) ||
      String(a.departmentId) === deptFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "awaiting" && a.pendingType === "awaiting_approval") ||
      (statusFilter === "never_logged_in" && a.pendingType === "never_logged_in");

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Pending Accounts</h1>
        <p className="text-muted-foreground mt-1">
          Accounts awaiting approval or that have never logged in. Click a name to view their full balance history.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search name, username or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-pending-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-pending-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="awaiting">Awaiting Approval</SelectItem>
                <SelectItem value="never_logged_in">Never Logged In</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-pending-role">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Account Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="employee">{employeeLabel}</SelectItem>
                <SelectItem value="admin">{adminLabel}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="select-pending-dept">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="none">No Department</SelectItem>
                {departments.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">No pending accounts</p>
                <p className="text-muted-foreground">Everyone has logged in and is active.</p>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No accounts match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  Pending Accounts
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filtered.length}{filtered.length !== accounts.length ? ` of ${accounts.length}` : ""})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto [transform:rotateX(180deg)]">
                  <Table className="[transform:rotateX(180deg)]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Type / Dept</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(acct => (
                        <TableRow key={acct.id} data-testid={`row-pending-account-${acct.id}`}>
                          {/* Name — links to full account detail view */}
                          <TableCell>
                            <Link
                              href={`/admin/employees/${acct.id}`}
                              className="font-medium text-foreground hover:text-primary hover:underline flex items-center gap-1 group"
                              data-testid={`link-account-name-${acct.id}`}
                            >
                              {acct.fullName}
                              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            {acct.email ? (
                              <p className="text-xs text-muted-foreground mt-0.5">{acct.email}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic mt-0.5">No email</p>
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {acct.username}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={acct.role === "employee" ? "secondary" : "default"} className="w-fit">
                                {getRoleLabel(acct.role)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {acct.departmentName || <span className="italic">No dept</span>}
                              </span>
                            </div>
                          </TableCell>

                          {/* Balance + transaction history indicator */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`font-semibold tabular-nums text-sm ${acct.balance > 0 ? "text-primary" : "text-muted-foreground"}`}
                                data-testid={`text-balance-${acct.id}`}
                              >
                                {acct.balance.toLocaleString()} bcks
                              </span>
                              {acct.transactionCount > 0 && (
                                <Link
                                  href={`/admin/employees/${acct.id}`}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                  data-testid={`link-tx-count-${acct.id}`}
                                >
                                  <History className="h-3 w-3" />
                                  {acct.transactionCount} change{acct.transactionCount !== 1 ? "s" : ""}
                                </Link>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {acct.pendingType === "awaiting_approval" ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1 whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                Awaiting Approval
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 gap-1 whitespace-nowrap">
                                <UserCheck className="h-3 w-3" />
                                Never Logged In
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resendEmail(acct.id)}
                                disabled={isResending || !acct.email}
                                title={acct.email ? "Resend join instructions by email" : "No email address on file"}
                                data-testid={`button-resend-email-${acct.id}`}
                              >
                                <Mail className="h-4 w-4 mr-1.5" />
                                Resend
                              </Button>

                              <RemoveAccountDialog
                                acct={acct}
                                isCancelling={isCancelling}
                                onConfirm={() => cancelAccount(acct.id)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function RemoveAccountDialog({
  acct,
  isCancelling,
  onConfirm,
}: {
  acct: PendingAccount;
  isCancelling: boolean;
  onConfirm: () => void;
}) {
  const hasHistory = acct.transactionCount > 0 || acct.balance > 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
          disabled={isCancelling}
          data-testid={`button-cancel-account-${acct.id}`}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">Remove Account?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-center">
              <p>
                This will permanently delete <strong>{acct.fullName}</strong>'s account.
              </p>

              {hasHistory && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left space-y-2">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                    <Wallet className="h-4 w-4" /> This account has balance history
                  </p>
                  <div className="text-sm text-amber-700 space-y-1">
                    {acct.balance > 0 && (
                      <p>• Current balance: <strong>{acct.balance.toLocaleString()} bucks</strong></p>
                    )}
                    {acct.transactionCount > 0 && (
                      <p>
                        • <strong>{acct.transactionCount} balance change{acct.transactionCount !== 1 ? "s" : ""}</strong> on record
                        {" "}— including reasons and dates
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-amber-600">
                    Review the full history before removing by clicking the account name.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:justify-center">
          <AlertDialogCancel>Keep Account</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid={`button-confirm-cancel-${acct.id}`}
          >
            Yes, Remove Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
