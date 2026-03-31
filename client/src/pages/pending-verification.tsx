import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { useLogout } from "@/hooks/use-auth";
import { Clock, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function PendingVerification() {
  const { mutate: logout } = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/30 p-4 relative">
      <Card className="w-full max-w-md shadow-2xl border-primary/10 text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold font-display">Account Pending Approval</CardTitle>
          <CardDescription>
            Your account is awaiting approval from your organization's administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Once your account is approved you'll be able to sign in. Check back later or ask your manager to approve your account.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </CardFooter>
      </Card>
      <SiteFooter absolute />
    </div>
  );
}
