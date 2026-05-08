import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store } from "lucide-react";

export default function MerchantLoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: me } = useQuery<{ id: number; email: string; name: string }>({
    queryKey: ["/api/merchant/me"],
    retry: false,
  });

  useEffect(() => { if (me?.id) setLocation("/merchant/scanner"); }, [me, setLocation]);

  const loginMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/merchant/login", { email, password }).then((r) => r.json()),
    onSuccess: (data: { mustChangePassword?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/me"] });
      setLocation(data.mustChangePassword ? "/merchant/change-password" : "/merchant/scanner");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle>Merchant sign-in</CardTitle>
          <CardDescription>Sign in to scan Better Bucks passes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); loginMut.mutate(); }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="input-merchant-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd">Password</Label>
              <Input
                id="pwd"
                data-testid="input-merchant-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginMut.isError && (
              <p role="alert" className="text-sm font-medium text-destructive" data-testid="error-merchant-login">
                {(loginMut.error as Error)?.message || "Login failed"}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loginMut.isPending} data-testid="button-merchant-login">
              {loginMut.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
