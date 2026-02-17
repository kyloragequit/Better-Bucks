import { AdminLayout } from "@/components/layout-admin";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Building2, CreditCard, Shield, Loader2, AlertTriangle, Copy, Check, Users } from "lucide-react";
import type { Organization } from "@shared/schema";

type OrgWithFree = Organization & { isFree: boolean; employeeCount: number };
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

const tierLabels: Record<string, string> = {
  small: "Small Site",
  mid: "Mid-Size Site",
  large: "Large Site",
  enterprise: "Enterprise Site",
};

const tierPrices: Record<string, number> = {
  small: 149,
  mid: 349,
  large: 599,
  enterprise: 999,
};

export default function AdminSettingsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: org, isLoading } = useQuery<OrgWithFree>({
    queryKey: ["/api/organizations/my-org"],
    enabled: user?.role === "prime_admin",
  });

  const { mutate: cancelSubscription, isPending: isCancelling } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/cancel-subscription");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your organization's subscription has been cancelled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = () => {
    if (org?.code) {
      navigator.clipboard.writeText(org.code);
      setCopied(true);
      toast({ title: "Copied!", description: "Organization code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (user?.role !== "prime_admin") {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-muted-foreground">
          Only the primary administrator can access settings.
        </div>
      </AdminLayout>
    );
  }

  const tierLabel = org ? (tierLabels[org.tier] || org.tier) : "";
  const tierPrice = org ? (tierPrices[org.tier] || 0) : 0;
  const employeeLimit = org?.maxEmployees === -1 ? "Unlimited" : String(org?.maxEmployees || 0);
  const employeeCount = org?.employeeCount || 0;

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Organization Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your organization's membership and details</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : org ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {org.name}
                  </CardTitle>
                  <CardDescription>Organization Details</CardDescription>
                </div>
                <Badge variant={org.status === "active" ? "default" : "destructive"} data-testid="badge-org-status">
                  {org.status === "active" ? "Active" : org.status === "inactive" ? "Cancelled" : "Pending"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Organization Code</div>
                    <div className="font-mono text-lg font-bold tracking-widest" data-testid="text-settings-org-code">{org.code}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyCode} data-testid="button-copy-org-code">
                    {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Share this code with team members who need to register for your organization.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Plan & Usage
                </CardTitle>
                <CardDescription>
                  Your current plan and employee usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Current Plan</div>
                    <div className="font-medium" data-testid="text-current-tier">{tierLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Employee Limit</div>
                    <div className="font-medium" data-testid="text-employee-limit">{employeeLimit}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Employees</div>
                    <div className="font-medium" data-testid="text-employee-count">{employeeCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Monthly Cost</div>
                    <div className="font-medium" data-testid="text-monthly-cost">
                      {org.isFree ? "Free" : `$${tierPrice}/month`}
                    </div>
                  </div>
                </div>
                {!org.isFree && org.maxEmployees > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{employeeCount} of {org.maxEmployees} employees used</span>
                      <span>{Math.round((employeeCount / org.maxEmployees) * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          employeeCount / org.maxEmployees > 0.9 ? "bg-destructive" :
                          employeeCount / org.maxEmployees > 0.7 ? "bg-yellow-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, (employeeCount / org.maxEmployees) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Membership
                </CardTitle>
                <CardDescription>
                  {org.isFree ? "You have a free membership" : "Your subscription details"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {org.isFree ? (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                    <Shield className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Free Membership</div>
                      <div>Your organization has a complimentary membership with full access to all features.</div>
                    </div>
                  </div>
                ) : org.status === "active" ? (
                  <>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-sm text-muted-foreground">Plan</div>
                        <div className="font-medium">{tierLabel} - ${tierPrice}/month</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="font-medium text-green-600">Active</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" data-testid="button-cancel-subscription">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Cancel Subscription
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately cancel your organization's subscription. 
                              All team members will lose access to the portal. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-dialog-cancel">Keep Subscription</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelSubscription()}
                              className="bg-destructive text-destructive-foreground"
                              disabled={isCancelling}
                              data-testid="button-confirm-cancel"
                            >
                              {isCancelling ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Cancelling...
                                </>
                              ) : (
                                "Yes, Cancel Subscription"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Subscription Cancelled</div>
                      <div>Your organization's subscription has been cancelled.</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Unable to load organization information.
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
