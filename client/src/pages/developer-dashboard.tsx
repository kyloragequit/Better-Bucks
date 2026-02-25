import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Crown, LogOut, LogIn, Code2, Shield, Trash2, AlertTriangle, Play, Pause } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Organization } from "@shared/schema";

type OrgWithStats = Organization & {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  primeAdmin: { id: number; username: string; fullName: string } | null;
};

const tierLabels: Record<string, string> = {
  small: "Small Site",
  mid: "Mid-Size",
  large: "Large Site",
  enterprise: "Enterprise",
};

const tierPrices: Record<string, number> = {
  small: 49.99,
  mid: 99.99,
  large: 149.99,
  enterprise: 299.99,
};

export default function DeveloperDashboardPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery<OrgWithStats[]>({
    queryKey: ["/api/developer/organizations"],
    enabled: user?.role === "developer",
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/developer/impersonate/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Impersonation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/admin/dashboard";
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: async ({ orgId, newStatus }: { orgId: number; newStatus: "active" | "paused" }) => {
      const res = await apiRequest("PATCH", `/api/developer/organizations/${orgId}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({ title: "Updated", description: `Organization ${variables.newStatus === "paused" ? "paused" : "reactivated"}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("DELETE", `/api/developer/organizations/${orgId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({ title: "Deleted", description: "Organization has been removed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
  });

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user || user.role !== "developer") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Please sign in with developer credentials to continue.</p>
            <Button className="mt-4" onClick={() => setLocation("/developer")}>Go to Developer Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-gray-900 text-white border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <div>
              <span className="text-lg font-bold">Better Bucks</span>
              <Badge variant="outline" className="ml-2 text-secondary border-secondary text-xs">
                DEVELOPER
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              <Code2 className="inline h-4 w-4 mr-1" />
              {user.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-dev-logout"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-dev-dashboard-title">
            Developer Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            View all organizations and manage customer accounts.
          </p>
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Building2 className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Organizations</p>
                      <p className="text-2xl font-bold" data-testid="text-total-orgs">{organizations?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Shield className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Admins</p>
                      <p className="text-2xl font-bold" data-testid="text-total-admins">
                        {organizations?.reduce((sum, o) => sum + o.adminCount, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Users className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold" data-testid="text-total-employees">
                        {organizations?.reduce((sum, o) => sum + o.employeeCount, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={organizations?.some(o => o.status === "paused") ? "border-amber-300 bg-amber-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-amber-100">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paused Accounts</p>
                      <p className="text-2xl font-bold text-amber-600" data-testid="text-paused-orgs">
                        {organizations?.filter(o => o.status === "paused").length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {organizations?.some(o => o.status === "paused") && (
              <Card className="mb-8 border-amber-300 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                    Paused Organizations
                  </CardTitle>
                  <CardDescription>
                    These organizations have payment issues and their users are currently blocked from using the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Prime Admin</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizations.filter(o => o.status === "paused").map((org) => (
                          <TableRow key={org.id} data-testid={`row-paused-org-${org.id}`}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded">{org.code}</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tierLabels[org.tier] || org.tier}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {org.primeAdmin ? (
                                <div>
                                  <div className="font-medium">{org.primeAdmin.fullName}</div>
                                  <div className="text-xs text-muted-foreground">{org.primeAdmin.username}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Not set up</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">{org.totalUsers}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "active" })}
                                  disabled={togglePauseMutation.isPending}
                                  data-testid={`button-reactivate-org-${org.id}`}
                                >
                                  <Play className="mr-1.5 h-3 w-3" />
                                  Reactivate
                                </Button>
                                {org.primeAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => impersonateMutation.mutate(org.primeAdmin!.id)}
                                    disabled={impersonateMutation.isPending}
                                    data-testid={`button-enter-paused-org-${org.id}`}
                                  >
                                    <LogIn className="mr-1.5 h-3 w-3" />
                                    Enter
                                  </Button>
                                )}
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Organizations
                </CardTitle>
                <CardDescription>
                  Click "Enter" to impersonate a prime admin and view their account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Monthly Cost</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Admins</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Prime Admin</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!organizations || organizations.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                            No organizations found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        organizations.map((org) => {
                          const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_");
                          return (
                            <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                              <TableCell className="font-medium">{org.name}</TableCell>
                              <TableCell>
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{org.code}</code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{tierLabels[org.tier] || org.tier}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {isFree ? "Free" : `$${tierPrices[org.tier] || 0}/mo`}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={org.status === "active" ? "default" : "destructive"}
                                  className={`capitalize ${org.status === "paused" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                                  data-testid={`badge-status-org-${org.id}`}
                                >
                                  {org.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">{org.adminCount}</TableCell>
                              <TableCell className="text-center font-medium">{org.employeeCount}</TableCell>
                              <TableCell className="text-sm">
                                {org.primeAdmin ? (
                                  <div>
                                    <div className="font-medium">{org.primeAdmin.fullName}</div>
                                    <div className="text-xs text-muted-foreground">{org.primeAdmin.username}</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Not set up</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {org.primeAdmin && (org.status === "active" || org.status === "paused") ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => impersonateMutation.mutate(org.primeAdmin!.id)}
                                      disabled={impersonateMutation.isPending}
                                      data-testid={`button-enter-org-${org.id}`}
                                    >
                                      <LogIn className="mr-1.5 h-3 w-3" />
                                      Enter
                                    </Button>
                                  ) : !org.primeAdmin && (org.status === "active" || org.status === "paused") ? (
                                    <span className="text-xs text-muted-foreground">No prime admin</span>
                                  ) : null}
                                  {org.status === "active" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                      onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "paused" })}
                                      disabled={togglePauseMutation.isPending}
                                      data-testid={`button-pause-org-${org.id}`}
                                    >
                                      <Pause className="mr-1.5 h-3 w-3" />
                                      Pause
                                    </Button>
                                  )}
                                  {org.status === "paused" && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "active" })}
                                      disabled={togglePauseMutation.isPending}
                                      data-testid={`button-reactivate-org-${org.id}`}
                                    >
                                      <Play className="mr-1.5 h-3 w-3" />
                                      Reactivate
                                    </Button>
                                  )}
                                  {(org.status === "pending" || org.stripeSubscriptionId === "pending_checkout") && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        if (confirm(`Delete "${org.name}"? This cannot be undone.`)) {
                                          deleteMutation.mutate(org.id);
                                        }
                                      }}
                                      disabled={deleteMutation.isPending}
                                      data-testid={`button-delete-org-${org.id}`}
                                    >
                                      <Trash2 className="mr-1.5 h-3 w-3" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
