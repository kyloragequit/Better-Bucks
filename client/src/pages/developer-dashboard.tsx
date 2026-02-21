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
import { Building2, Users, Crown, LogOut, LogIn, Code2, Shield } from "lucide-react";
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
  small: 149,
  mid: 349,
  large: 599,
  enterprise: 999,
};

export default function DeveloperDashboardPage() {
  const { data: user } = useUser();
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
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Impersonation Active", description: "You are now viewing as the prime admin. Use the return button to switch back." });
      setLocation("/admin/dashboard");
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

  if (!user || user.role !== "developer") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Access denied. Developer credentials required.</p>
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
              <Badge variant="outline" className="ml-2 text-[#D94FAD] border-[#D94FAD] text-xs">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#F7C1E7]/20">
                      <Building2 className="h-5 w-5 text-[#D94FAD]" />
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
                    <div className="p-2 rounded-md bg-[#F7C1E7]/20">
                      <Shield className="h-5 w-5 text-[#D94FAD]" />
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
                    <div className="p-2 rounded-md bg-[#F7C1E7]/20">
                      <Users className="h-5 w-5 text-[#D94FAD]" />
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
            </div>

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
                                <Badge variant={org.status === "active" ? "default" : "destructive"} className="capitalize">
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
                                {org.primeAdmin ? (
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
                                ) : (
                                  <span className="text-xs text-muted-foreground">No prime admin</span>
                                )}
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
