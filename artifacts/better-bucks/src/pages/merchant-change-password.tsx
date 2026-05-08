import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { FullPageLoader } from "@/components/ui/loader";

type MerchantMe = { id: number; email: string; name: string; orgId: number; mustChangePassword: boolean };

export default function MerchantChangePasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const { data: me, isLoading } = useQuery<MerchantMe>({
    queryKey: ["/api/merchant/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !me) setLocation("/merchant/login");
    if (!isLoading && me && !me.mustChangePassword) setLocation("/merchant/scanner");
  }, [isLoading, me, setLocation]);

  const changeMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/merchant/change-password", { password }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: "Failed to change password" }));
          throw new Error(err.message || "Failed to change password");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/me"] });
      toast({ title: "Password changed", description: "Your new password is set. Welcome!" });
      setLocation("/merchant/scanner");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please make sure both fields match.", variant: "destructive" });
      return;
    }
    changeMut.mutate();
  }

  if (isLoading) return <FullPageLoader />;
  if (!me) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            You're using a temporary password. Please choose a permanent one before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                data-testid="input-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                data-testid="input-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                placeholder="Re-enter your new password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={changeMut.isPending}
              data-testid="button-change-password"
            >
              {changeMut.isPending ? "Saving…" : "Set password & continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
