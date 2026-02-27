import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, LogOut, LogIn, Code2, Shield, Trash2, AlertTriangle, Play, Pause, FileEdit, Save, BarChart3, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Organization } from "@shared/schema";

const CMS_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "hero_headline", label: "Hero Headline" },
  { key: "hero_subheadline", label: "Hero Sub-headline", multiline: true },
  { key: "benefit1_title", label: "Benefit 1 — Title" },
  { key: "benefit1_subtitle", label: "Benefit 1 — Subtitle" },
  { key: "benefit1_bullet1", label: "Benefit 1 — Bullet 1" },
  { key: "benefit1_bullet2", label: "Benefit 1 — Bullet 2" },
  { key: "benefit1_bullet3", label: "Benefit 1 — Bullet 3" },
  { key: "benefit2_title", label: "Benefit 2 — Title" },
  { key: "benefit2_subtitle", label: "Benefit 2 — Subtitle" },
  { key: "benefit2_bullet1", label: "Benefit 2 — Bullet 1" },
  { key: "benefit2_bullet2", label: "Benefit 2 — Bullet 2" },
  { key: "benefit2_bullet3", label: "Benefit 2 — Bullet 3" },
  { key: "benefit3_title", label: "Benefit 3 — Title" },
  { key: "benefit3_subtitle", label: "Benefit 3 — Subtitle" },
  { key: "benefit3_bullet1", label: "Benefit 3 — Bullet 1" },
  { key: "benefit3_bullet2", label: "Benefit 3 — Bullet 2" },
  { key: "benefit3_bullet3", label: "Benefit 3 — Bullet 3" },
  { key: "cta_headline", label: "CTA Headline" },
  { key: "cta_subtext", label: "CTA Sub-text", multiline: true },
  { key: "instagram_handle", label: "Instagram Handle (without @)" },
];

const CMS_DEFAULTS: Record<string, string> = {
  hero_headline: "Reward What's Important",
  hero_subheadline: `A "Bucks"-based incentive system that helps businesses recognize employees instantly, automate rewards, and drive measurable results — without extra admin work.`,
  benefit1_title: "Simple Rewards, Zero Hassle",
  benefit1_subtitle: "Streamline how you recognize employees.",
  benefit1_bullet1: "Replace spreadsheets and manual tracking",
  benefit1_bullet2: "Reward employees in seconds",
  benefit1_bullet3: "Centralized platform for all incentives",
  benefit2_title: "Motivate Performance That Matters",
  benefit2_subtitle: "Turn everyday actions into measurable results.",
  benefit2_bullet1: "Tie rewards to KPIs, attendance, or goals",
  benefit2_bullet2: "Reinforce productivity and accountability",
  benefit2_bullet3: "Encourage behaviors aligned with company success",
  benefit3_title: "Control Costs While Boosting Engagement",
  benefit3_subtitle: "Incentives employees love — with budgets you control.",
  benefit3_bullet1: "Predictable incentive spending",
  benefit3_bullet2: "Flexible reward options employees choose",
  benefit3_bullet3: "Scales easily as your workforce grows",
  cta_headline: "Ready to transform your employee rewards?",
  cta_subtext: "Fill out the form below and we'll get back to you about how Better Bucks can work for your team.",
  instagram_handle: "better_bucks",
};

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
  const [cmsValues, setCmsValues] = useState<Record<string, string>>({});
  const [cmsTab, setCmsTab] = useState(false);

  const { data: organizations, isLoading } = useQuery<OrgWithStats[]>({
    queryKey: ["/api/developer/organizations"],
    enabled: user?.role === "developer",
  });

  const { data: cmsContent } = useQuery<Record<string, string>>({
    queryKey: ["/api/page-content"],
    enabled: user?.role === "developer",
  });

  useEffect(() => {
    if (cmsContent) {
      const merged: Record<string, string> = {};
      for (const f of CMS_FIELDS) {
        merged[f.key] = cmsContent[f.key] ?? CMS_DEFAULTS[f.key] ?? "";
      }
      setCmsValues(merged);
    } else {
      setCmsValues({ ...CMS_DEFAULTS });
    }
  }, [cmsContent]);

  const saveCmsMutation = useMutation({
    mutationFn: async (entries: Record<string, string>) => {
      const res = await apiRequest("PATCH", "/api/page-content", entries);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-content"] });
      toast({ title: "Saved", description: "Landing page content updated successfully." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
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
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-ga-dashboard"
            >
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
              >
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Analytics
              </Button>
            </a>
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
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-dev-dashboard-title">
              Developer Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              {cmsTab ? "Edit landing page text and links." : "View all organizations and manage customer accounts."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={cmsTab ? "outline" : "default"}
              size="sm"
              onClick={() => setCmsTab(false)}
              data-testid="button-tab-orgs"
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Organizations
            </Button>
            <Button
              variant={cmsTab ? "default" : "outline"}
              size="sm"
              onClick={() => setCmsTab(true)}
              data-testid="button-tab-cms"
            >
              <FileEdit className="mr-1.5 h-4 w-4" />
              Edit Home Page
            </Button>
          </div>
        </div>

        <a
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6"
          data-testid="card-ga-analytics-link"
        >
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-600 text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">Google Analytics 4</p>
                    <p className="text-sm text-blue-700">View traffic, user sessions, and page analytics for the Better Bucks website</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-blue-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </a>

        {cmsTab ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Home Page Content Editor
              </CardTitle>
              <CardDescription>
                Changes are saved permanently and appear live on the public landing page immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {CMS_FIELDS.map((field) => (
                  <div key={field.key} className={field.multiline ? "md:col-span-2" : ""}>
                    <Label htmlFor={`cms-${field.key}`} className="mb-1.5 block text-sm font-medium">
                      {field.label}
                    </Label>
                    {field.multiline ? (
                      <Textarea
                        id={`cms-${field.key}`}
                        rows={3}
                        value={cmsValues[field.key] ?? ""}
                        onChange={(e) => setCmsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        data-testid={`input-cms-${field.key}`}
                        className="resize-y"
                      />
                    ) : (
                      <Input
                        id={`cms-${field.key}`}
                        value={cmsValues[field.key] ?? ""}
                        onChange={(e) => setCmsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        data-testid={`input-cms-${field.key}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => saveCmsMutation.mutate(cmsValues)}
                  disabled={saveCmsMutation.isPending}
                  data-testid="button-save-cms"
                >
                  {saveCmsMutation.isPending ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isLoading ? (
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
