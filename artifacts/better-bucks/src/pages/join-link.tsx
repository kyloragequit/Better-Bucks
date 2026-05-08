import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

type InviteLinkInfo = {
  token: string;
  organizationId: number;
  organizationName: string;
  roleToAssign: "employee" | "admin";
  expiresAt: string;
};

function roleLabel(role: string) {
  if (role === "admin") return "Manager";
  return "Employee";
}

export function JoinLinkPage({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: link, isLoading, error } = useQuery<InviteLinkInfo>({
    queryKey: ["/api/invite-links", token],
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async (payload: { fullName: string; email: string; username: string; password: string }) => {
      const res = await apiRequest("POST", `/api/invite-links/${token}/accept`, payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create account.");
      }
      return res.json();
    },
    onSuccess: (user: any) => {
      setAccepted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setTimeout(() => {
        if (user?.role === "admin" || user?.role === "prime_admin") navigate("/admin/dashboard");
        else navigate("/dashboard");
      }, 1500);
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
    acceptMutation.mutate({ fullName, email, username, password });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  const errorMsg = (error as any)?.message || (!link ? "This invite link is invalid, expired, or has been deactivated." : null);

  if (errorMsg || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><AppLogo size="lg" /></div>
            <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5" /> Invite Link Unavailable
            </CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
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
            <div className="flex justify-center mb-4"><AppLogo size="lg" /></div>
            <div className="flex justify-center mb-2"><CheckCircle2 className="h-12 w-12 text-green-500" /></div>
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
          <div className="flex justify-center mb-4"><AppLogo size="lg" /></div>
          <CardTitle>Join {link.organizationName}</CardTitle>
          <CardDescription>
            You've been invited to join as a <strong>{roleLabel(link.roleToAssign)}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="il-name">Full Name</Label>
              <Input id="il-name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} data-testid="input-fullname" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="il-email">Email</Label>
              <Input id="il-email" type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="il-username">Choose a Username</Label>
              <Input id="il-username" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} data-testid="input-username" />
              <p className="text-xs text-muted-foreground">This is what you'll use to log in.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="il-password">Create a Password</Label>
              <div className="relative">
                <Input id="il-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} data-testid="input-password" />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="il-confirm">Confirm Password</Label>
              <Input id="il-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required data-testid="input-confirm-password" />
            </div>
            <Button type="submit" className="w-full shadow-lg shadow-primary/20" disabled={acceptMutation.isPending} data-testid="button-create-account">
              {acceptMutation.isPending ? "Creating Account..." : "Create My Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default JoinLinkPage;
