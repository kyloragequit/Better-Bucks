import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { AlertTriangle, CreditCard, Loader2, LogOut } from "lucide-react";
import { useLogout } from "@/hooks/use-auth";

interface OrgStatus {
  status: string;
  isPaused: boolean;
  orgName?: string;
  isPrimeAdmin?: boolean;
}

export function PaymentPausedDialog() {
  const { mutate: logout } = useLogout();

  const { data: orgStatus } = useQuery<OrgStatus>({
    queryKey: ["/api/organizations/my-status"],
    refetchInterval: 60000,
  });

  const billingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/organizations/billing-portal", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to open billing portal");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, "_blank");
    },
  });

  if (!orgStatus?.isPaused) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-[440px] [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Account Paused</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <AppLogo size="lg" />

          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-foreground">
              Account {orgStatus.status === "inactive" ? "Cancelled" : "Paused"}
            </h2>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              {orgStatus.status === "inactive"
                ? "Your organization's subscription has been cancelled. Please update your billing information to reactivate your account."
                : "There's an issue with your organization's payment. Please update your billing information to continue using Better Bucks."}
            </p>
          </div>

          {orgStatus.isPrimeAdmin ? (
            <div className="w-full space-y-3">
              <Button
                className="w-full shadow-lg shadow-primary/25"
                size="lg"
                onClick={() => billingMutation.mutate()}
                disabled={billingMutation.isPending}
                data-testid="button-update-billing"
              >
                {billingMutation.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-5 w-5" />
                )}
                Update Billing Information
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => logout()}
                data-testid="button-paused-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-sm text-muted-foreground">
                Please contact your organization administrator to resolve this billing issue.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => logout()}
                data-testid="button-paused-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
