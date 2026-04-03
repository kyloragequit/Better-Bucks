import { useState, useEffect } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, LogIn, Building2, ArrowLeft, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { InstagramFloat } from "@/components/instagram-float";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { startAuthentication } from "@simplewebauthn/browser";
import { PasskeySetupPrompt } from "@/components/passkey-manager";
import { Link } from "wouter";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const urlOrgCode = params.get("orgCode") || localStorage.getItem("bb_last_site_id") || "";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-primary">
      <PageSEO
        title="Log In – Better Bucks Employee Incentive Platform"
        description="Access your Better Bucks portal. Purpose-built reward program management for logistics, warehousing, and manufacturing operations."
        canonicalPath="/login"
        keywords="Better Bucks login, employee incentive platform login, reward program management login"
        noindex
      />

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, #4E9F3D18 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #ffffff08 0%, transparent 50%)" }} />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setLocation("/")}
          data-testid="button-back-landing"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="w-full shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4">
              <AppLogo size="lg" />
            </div>
            <CardTitle className="text-2xl font-bold font-display">Better Bucks</CardTitle>
            <CardDescription>
              Sign in to access your rewards portal
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-2">
            <UnifiedLoginForm defaultOrgCode={urlOrgCode} />
          </CardContent>

          <div className="px-6 pb-6 pt-2 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="text-primary font-medium hover:underline underline-offset-2"
                data-testid="link-signup"
              >
                Sign up today
              </Link>
            </p>
          </div>
        </Card>
      </div>
      <SiteFooter dark absolute />
      <InstagramFloat />
    </div>
  );
}

type CaptchaChallenge = {
  question: string;
  token: string;
  error?: string;
};

function CaptchaStep({
  challenge,
  answer,
  onAnswerChange,
  onSubmit,
  onBack,
  isPending,
}: {
  challenge: CaptchaChallenge;
  answer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-sm">Security Check</p>
          <p className="text-xs text-muted-foreground">
            Please answer this question to continue
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
        <p className="text-lg font-semibold" data-testid="text-captcha-question">
          {challenge.question}
        </p>
      </div>

      {challenge.error && (
        <p className="text-sm text-destructive text-center" data-testid="text-captcha-error">
          {challenge.error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="captcha-answer">Your Answer</Label>
        <Input
          id="captcha-answer"
          type="number"
          placeholder="Enter the answer"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          required
          autoFocus
          data-testid="input-captcha-answer"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isPending}
          data-testid="button-captcha-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
          disabled={isPending || !answer}
          data-testid="button-captcha-submit"
        >
          {isPending ? (
            <>
              <SpinningLogo className="mr-2 h-4 w-4" />
              Verifying...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Continue
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function redirectAfterLogin(role: string, setLocation: (path: string) => void) {
  if (role === "admin" || role === "prime_admin") setLocation("/admin/dashboard");
  else setLocation("/dashboard");
}

function useLoginFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPending, setIsPending] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge | null>(null);

  async function submitLogin(payload: {
    username: string;
    password: string;
    captchaToken?: string;
    captchaAnswer?: string;
  }): Promise<{ captchaRequired: boolean }> {
    setIsPending(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.message || (res.status === 401 ? "Invalid username or password" : "Login failed");
        toast({ title: "Login Failed", description: msg, variant: "destructive" });
        return { captchaRequired: false };
      }

      if (data.captchaRequired) {
        setCaptchaChallenge({ question: data.question, token: data.token, error: data.error });
        return { captchaRequired: true };
      }

      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome back!", description: `Logged in as ${data.fullName}` });
      setCaptchaChallenge(null);
      redirectAfterLogin(data.role, setLocation);
      return { captchaRequired: false };
    } finally {
      setIsPending(false);
    }
  }

  return { submitLogin, isPending, captchaChallenge, setCaptchaChallenge };
}

function usePasskeySignIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPending, setIsPending] = useState(false);

  async function signInWithPasskey(): Promise<boolean> {
    setIsPending(true);
    try {
      const startRes = await fetch("/api/passkeys/authenticate/start", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
      if (!startRes.ok) throw new Error("Could not start passkey authentication");
      const options = await startRes.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const finishRes = await fetch("/api/passkeys/authenticate/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
        credentials: "include",
      });
      if (!finishRes.ok) {
        const err = await finishRes.json();
        throw new Error(err.message || "Passkey authentication failed");
      }
      const user = await finishRes.json();
      queryClient.setQueryData(["/api/user"], user);
      toast({ title: "Signed in!", description: `Welcome back, ${user.fullName}` });
      redirectAfterLogin(user.role, setLocation);
      return true;
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        toast({ title: "Passkey sign-in failed", description: err.message || "Try signing in with your password instead.", variant: "destructive" });
      }
      return false;
    } finally {
      setIsPending(false);
    }
  }

  return { signInWithPasskey, isPending };
}

function PasskeySignInButton() {
  const { signInWithPasskey, isPending } = usePasskeySignIn();
  return (
    <>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/80 px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={signInWithPasskey}
        disabled={isPending}
        data-testid="button-passkey-signin"
      >
        {isPending ? <SpinningLogo className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        Sign in with Passkey
      </Button>
    </>
  );
}

function UnifiedLoginForm({ defaultOrgCode = "" }: { defaultOrgCode?: string }) {
  const [siteId, setSiteId] = useState(defaultOrgCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showSiteId, setShowSiteId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [step, setStep] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [allowPasswordCreation, setAllowPasswordCreation] = useState(true);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { submitLogin, isPending: adminPending, captchaChallenge, setCaptchaChallenge } = useLoginFlow();
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const hasSiteId = siteId.trim().length > 0;

    if (hasSiteId) {
      setIsPending(true);
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: siteId.trim().toLowerCase(), username: username.trim() }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Sign In Failed", description: data.message || "Something went wrong", variant: "destructive" });
          return;
        }
        if (data.needsRegistration) {
          setAllowPasswordCreation(data.allowPasswordCreation ?? true);
          setStep("register");
          return;
        }
        // Persist the site ID so employees don't have to re-enter it next time
        localStorage.setItem("bb_last_site_id", siteId.trim().toLowerCase());
        queryClient.setQueryData(["/api/user"], data);
        toast({ title: "Welcome back!", description: `Signed in as ${data.fullName}` });
        redirectAfterLogin(data.role, setLocation);
      } finally {
        setIsPending(false);
      }
    } else {
      await submitLogin({ username, password });
    }
  };

  const handleCaptchaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaChallenge) return;
    const result = await submitLogin({
      username,
      password,
      captchaToken: captchaChallenge.token,
      captchaAnswer,
    });
    if (result.captchaRequired) {
      setCaptchaAnswer("");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    if (allowPasswordCreation && password && password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both password fields match.", variant: "destructive" });
      return;
    }
    if (allowPasswordCreation && password && password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const body: Record<string, string> = { siteId: siteId.trim().toLowerCase(), username: username.trim(), fullName: fullName.trim() };
      if (allowPasswordCreation && password.trim()) body.password = password.trim();
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Sign In Failed", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }
      // Persist site ID for returning visits
      localStorage.setItem("bb_last_site_id", siteId.trim().toLowerCase());
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome!", description: `Signed in as ${data.fullName}` });
      redirectAfterLogin(data.role, setLocation);
    } finally {
      setIsPending(false);
    }
  };

  if (captchaChallenge) {
    return (
      <CaptchaStep
        challenge={captchaChallenge}
        answer={captchaAnswer}
        onAnswerChange={setCaptchaAnswer}
        onSubmit={handleCaptchaSubmit}
        onBack={() => { setCaptchaChallenge(null); setCaptchaAnswer(""); }}
        isPending={adminPending}
      />
    );
  }

  if (step === "register") {
    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
          <p className="text-muted-foreground text-xs">Employee code</p>
          <p className="font-mono font-semibold">{username}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullname">Your Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="fullname"
              placeholder="First Last"
              className="pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              data-testid="input-emp-fullname"
            />
          </div>
        </div>
        {allowPasswordCreation && (
          <>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-emp-reg-password"
                />
                <button type="button" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {password && (
              <div className="space-y-2">
                <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    className="pr-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="input-emp-reg-confirm-password"
                  />
                  <button type="button" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">{allowPasswordCreation ? "Password is optional — you can always add one later." : "No password required — your Site ID and employee code are your access."}</p>
        <Button
          type="submit"
          className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
          disabled={isPending || !fullName.trim()}
          data-testid="button-emp-register"
        >
          {isPending ? <><SpinningLogo className="mr-2 h-4 w-4" />Setting up...</> : <><LogIn className="mr-2 h-4 w-4" />Complete Sign In</>}
        </Button>
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setStep("login"); setFullName(""); setPassword(""); setConfirmPassword(""); }} data-testid="button-emp-back">
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </form>
    );
  }

  const isLoading = isPending || adminPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="site-id">
            Site ID
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(employees only)</span>
          </Label>
          {siteId.trim() && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
              onClick={() => { setSiteId(""); localStorage.removeItem("bb_last_site_id"); }}
              data-testid="button-clear-site-id"
            >
              Not your workplace?
            </button>
          )}
        </div>
        <div className="relative">
          <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="site-id"
            type={showSiteId ? "text" : "password"}
            placeholder="Your workplace Site ID"
            className="pl-9 pr-9"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            autoComplete="off"
            data-testid="input-emp-site-id"
          />
          <button type="button" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setShowSiteId(v => !v)} tabIndex={-1} data-testid="button-toggle-site-id">
            {showSiteId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {siteId.trim() && (
          <p className="text-xs text-muted-foreground">Enter your employee username below — no password needed.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            placeholder="Username or employee code"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
            data-testid="input-employee-code"
          />
        </div>
      </div>

      {!siteId.trim() && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(administrators)</span>
            </Label>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
              onClick={() => setLocation("/forgot-password")}
              data-testid="link-forgot-password"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              className="pl-9 pr-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              data-testid="input-admin-password"
            />
            <button
              type="button"
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <Button
        type="submit"
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isLoading || !username.trim()}
        data-testid="button-employee-login"
      >
        {isLoading ? (
          <><SpinningLogo className="mr-2 h-4 w-4" />Signing In...</>
        ) : (
          <><LogIn className="mr-2 h-4 w-4" />Sign In</>
        )}
      </Button>

      <PasskeySignInButton />
    </form>
  );
}
