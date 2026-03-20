import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SpinningLogo } from "@/components/spinning-logo";
import { LogoBackground } from "@/components/logo-background";
import { Building2, User, UserPlus, LogIn, ArrowLeft, QrCode } from "lucide-react";

type OrgInfo = { orgName: string; siteId: string; employeeRoleLabel: string };

export default function JoinPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [step, setStep] = useState<"username" | "register">("username");
  const [isPending, setIsPending] = useState(false);

  const { data: org, isLoading, isError } = useQuery<OrgInfo>({
    queryKey: [`/api/join/${siteId}`],
    queryFn: async () => {
      const res = await fetch(`/api/join/${siteId}`);
      if (!res.ok) throw new Error("Invalid site");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsPending(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, username: username.trim() }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }

      if (data.needsRegistration) {
        setStep("register");
        return;
      }

      // Logged in
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome back!", description: `Signed in as ${data.fullName}` });
    } finally {
      setIsPending(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) return;
    setIsPending(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, username: username.trim(), fullName: fullName.trim() }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Registration Failed", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }

      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Account created!", description: `Welcome, ${data.fullName}!` });
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <SpinningLogo className="h-10 w-10 text-white" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary p-6 text-white">
        <QrCode className="h-16 w-16 opacity-40" />
        <h1 className="text-2xl font-bold">Invalid Site ID</h1>
        <p className="text-white/70 text-center max-w-sm">
          This QR code link doesn't match any active organization. Please ask your manager for an updated QR code.
        </p>
        <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setLocation("/login")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>
    );
  }

  const roleLabel = org.employeeRoleLabel || "Employee";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-primary">
      <PageSEO
        title={`Join ${org.orgName} – Better Bucks`}
        description={`Sign in or register as an employee of ${org.orgName} on Better Bucks.`}
        noindex
      />

      <LogoBackground />

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, #4E9F3D18 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #ffffff08 0%, transparent 50%)" }} />

      <div className="relative z-10 w-full max-w-sm space-y-4">
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setLocation("/login")}
          data-testid="button-back-login"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="w-full shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span data-testid="text-org-name">{org.orgName}</span>
            </div>
            {step === "username" ? (
              <>
                <CardTitle className="text-xl font-bold font-display">
                  {roleLabel} Sign In
                </CardTitle>
                <CardDescription>
                  Enter your employee code to sign in or register
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-xl font-bold font-display">
                  Create Your Account
                </CardTitle>
                <CardDescription>
                  Enter your full name to complete registration
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="pb-6">
            {step === "username" ? (
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-username">Employee Code / Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="join-username"
                      placeholder="e.g. john.smith or EMP-001"
                      className="pl-9"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      data-testid="input-join-username"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ask your manager for your employee code if you're not sure.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                  disabled={isPending || !username.trim()}
                  data-testid="button-join-continue"
                >
                  {isPending ? (
                    <><SpinningLogo className="mr-2 h-4 w-4" />Checking...</>
                  ) : (
                    <><LogIn className="mr-2 h-4 w-4" />Continue</>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
                  <p className="text-muted-foreground text-xs">Employee code</p>
                  <p className="font-mono font-semibold">{username}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="join-fullname">Your Full Name</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="join-fullname"
                      placeholder="First Last"
                      className="pl-9"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoFocus
                      autoComplete="name"
                      data-testid="input-join-fullname"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No password or email required — your QR code is your access.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                  disabled={isPending || !fullName.trim()}
                  data-testid="button-join-register"
                >
                  {isPending ? (
                    <><SpinningLogo className="mr-2 h-4 w-4" />Creating account...</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" />Create Account & Sign In</>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => { setStep("username"); setFullName(""); }}
                  data-testid="button-join-back"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <SiteFooter dark absolute />
    </div>
  );
}
