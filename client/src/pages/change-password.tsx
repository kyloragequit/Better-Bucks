import { useEffect, useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock } from "lucide-react";

export default function ChangePasswordPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Side-effecty navigation belongs in an effect, not the render path.
  useEffect(() => {
    if (!isLoading && (!user || !user.mustChangePassword)) {
      setLocation("/");
    }
  }, [isLoading, user, setLocation]);

  const updateMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}/profile`, {
        password: newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Password updated", description: "Your new password is now active." });
      const dest = (user?.role === "admin" || user?.role === "prime_admin") ? "/admin/dashboard" : "/dashboard";
      setLocation(dest);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;
  if (!user || !user.mustChangePassword) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    updateMutation.mutate(password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4 relative">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Change Password</CardTitle>
          <CardDescription className="text-center">
            Set a new password to finish signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending || !password || !confirmPassword}
              data-testid="button-update-password"
            >
              {updateMutation.isPending ? <SpinningLogo className="mr-2 h-4 w-4" /> : null}
              Confirm & Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
      <SiteFooter absolute />
    </div>
  );
}
