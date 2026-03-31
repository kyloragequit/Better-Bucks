import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

type InviteInfo = {
  id: number;
  token: string;
  fullName: string;
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
};

function roleLabel(role: string) {
  if (role === "prime_admin") return "Prime Admin";
  if (role === "admin") return "Admin";
  return "Employee";
}

export default function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading, error } = useQuery<InviteInfo>({
    queryKey: [`/api/invite/${token}`],
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const res = await apiRequest("POST", `/api/invite/${token}/accept`, payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create account.");
      }
      return res.json();
    },
    onSuccess: () => {
      setAccepted(true);
      setTimeout(() => {
        const role = invite?.role;
        if (role === "admin" || role === "prime_admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/dashboard");
        }
      }, 2000);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    acceptMutation.mutate({ username, password });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  const errorMsg = (error as any)?.message || (invite === undefined && !isLoading ? "Invitation not found." : null);

  if (errorMsg || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AppLogo size="lg" />
            </div>
            <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5" /> Invalid Invitation
            </CardTitle>
            <CardDescription>
              {errorMsg || "This invitation link is invalid, has expired, or has already been used."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AppLogo size="lg" />
            </div>
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Welcome to Better Bucks!</CardTitle>
            <CardDescription>Your account has been created. Redirecting you now...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AppLogo size="lg" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            Join <strong>{invite.organizationName}</strong> on Better Bucks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 rounded-lg p-4 mb-6 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{invite.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{invite.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{roleLabel(invite.role)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-username">Choose a Username</Label>
              <Input
                id="invite-username"
                autoComplete="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. jsmith"
                required
                minLength={3}
                data-testid="input-invite-username"
              />
              <p className="text-xs text-muted-foreground">This is what you'll use to log in.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-password">Create a Password</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  data-testid="input-invite-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-confirm-password">Confirm Password</Label>
              <Input
                id="invite-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                data-testid="input-invite-confirm-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full shadow-lg shadow-primary/20"
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? "Creating Account..." : "Create My Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
