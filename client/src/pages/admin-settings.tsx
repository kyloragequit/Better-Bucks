import { AdminLayout } from "@/components/layout-admin";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Building2, CreditCard, Shield, Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import type { Organization } from "@shared/schema";

type OrgWithFree = Organization & { isFree: boolean };
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
                        <div className="font-medium">$50/month</div>
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
