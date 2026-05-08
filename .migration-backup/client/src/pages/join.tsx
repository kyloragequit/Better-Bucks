import { lazy, Suspense, useState } from "react";
import { useParams, useLocation } from "wouter";

const JoinLinkPage = lazy(() => import("@/pages/join-link").then(m => ({ default: m.JoinLinkPage })));
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";
import { SpinningLogo } from "@/components/spinning-logo";
import { LogoBackground } from "@/components/logo-background";
import { Building2, User, UserPlus, LogIn, ArrowLeft, QrCode, Eye, EyeOff, Clock } from "lucide-react";

type OrgInfo = { orgName: string; siteId: string; employeeRoleLabel: string; allowPasswordCreation: boolean };

export default function JoinPage() {
  const { siteId } = useParams<{ siteId: string }>();
  // If the URL parameter looks like a 64-char hex token, this is a reusable
  // invite link rather than a site-based signup. Dispatch to the invite-link page.
  if (siteId && /^[a-f0-9]{64}$/i.test(siteId)) {
    return (
      <Suspense fallback={null}>
        <JoinLinkPage token={siteId} />
      </Suspense>
    );
  }
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<"username" | "register" | "pending">("username");
  const [isPending, setIsPending] = useState(false);
  const [pendingName, setPendingName] = useState("");

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
    const allowPwd = org?.allowPasswordCreation ?? true;
    if (allowPwd && password && password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both password fields match.", variant: "destructive" });
      return;
    }
    if (allowPwd && password && password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const body: Record<string, string> = { siteId, username: username.trim(), fullName: fullName.trim() };
      if (allowPwd && password.trim()) body.password = password.trim();
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Registration Failed", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }

      if (data.pendingApproval) {
        setPendingName(data.fullName || fullName);
        setStep("pending");
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
            ) : step === "pending" ? (
              <>
                <CardTitle className="text-xl font-bold font-display">
                  Request Submitted
                </CardTitle>
                <CardDescription>
                  Your account is awaiting approval
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
            {step === "pending" ? (
              <div className="space-y-5 text-center py-2">
                <div className="flex justify-center">
                  <div className="rounded-full bg-amber-50 border border-amber-200 p-5">
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-base" data-testid="text-pending-name">Hi, {pendingName || username}!</p>
                  <p className="text-sm text-muted-foreground">
                    Your account request has been submitted. An administrator at <strong>{org.orgName}</strong> will review and approve your account.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-left space-y-1">
                  <p className="font-medium text-foreground">What happens next?</p>
                  <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                    <li>Your manager or admin will be notified</li>
                    <li>Once approved, you can sign in with your employee code</li>
                    <li>Check back later or ask your manager to approve your account</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-pending-go-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Go to Sign In
                </Button>
              </div>
            ) : step === "username" ? (
              <form onFocusCapture={scrollOnFocus} onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-username">Employee Code / Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <form onFocusCapture={scrollOnFocus} onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
                  <p className="text-muted-foreground text-xs">Employee code</p>
                  <p className="font-mono font-semibold">{username}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="join-fullname">Your Full Name</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                </div>

                {(org?.allowPasswordCreation ?? true) && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="join-password">Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <div className="relative">
                        <Input
                          id="join-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          className="pr-9"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          data-testid="input-join-password"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {password && (
                      <div className="space-y-2">
                        <Label htmlFor="join-confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            id="join-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            className="pr-9"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            data-testid="input-join-confirm-password"
                          />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-muted-foreground">
                  {(org?.allowPasswordCreation ?? true) ? "Password is optional — you can always add one later." : "No password required — your QR code is your access."}
                </p>

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
                  onClick={() => { setStep("username"); setFullName(""); setPassword(""); setConfirmPassword(""); }}
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
