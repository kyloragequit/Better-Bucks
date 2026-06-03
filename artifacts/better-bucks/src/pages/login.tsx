import { useState, useEffect, useRef } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, LogIn, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { InstagramFloat } from "@/components/instagram-float";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";
import { startAuthentication, browserSupportsWebAuthnAutofill } from "@simplewebauthn/browser";
import { PasskeySetupPrompt } from "@/components/passkey-manager";
import { Link } from "wouter";
import { TurnstileWidget, TurnstileStep } from "@/components/turnstile-captcha";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const urlOrgCode = params.get("orgCode") || localStorage.getItem("bb_last_site_id") || "";

  return (
    <main className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-primary">
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

          <div className="px-6 pb-6 pt-2 space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              New employee?{" "}
              <Link
                href="/get-started"
                className="text-primary font-medium hover:underline underline-offset-2"
                data-testid="link-get-started"
              >
                Get started here
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Setting up an organization?{" "}
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
    </main>
  );
}

type CaptchaState = { error?: string };

function redirectAfterLogin(role: string, setLocation: (path: string) => void) {
  if (role === "developer") setLocation("/developer/dashboard");
  else if (role === "admin" || role === "prime_admin") setLocation("/admin/dashboard");
  else setLocation("/dashboard");
}

function useLoginFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPending, setIsPending] = useState(false);
  const [captchaState, setCaptchaState] = useState<CaptchaState | null>(null);

  async function submitLogin(payload: {
    username: string;
    password: string;
    turnstileToken?: string;
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
        setCaptchaState({ error: data.error });
        return { captchaRequired: true };
      }

      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome back!", description: `Logged in as ${data.fullName}` });
      setCaptchaState(null);
      redirectAfterLogin(data.role, setLocation);
      return { captchaRequired: false };
    } finally {
      setIsPending(false);
    }
  }

  return { submitLogin, isPending, captchaState, setCaptchaState };
}

// Shared controller so the manual "Sign in with Passkey" button can cancel
// any in-flight Conditional UI request. Without this, two concurrent calls
// to /api/passkeys/authenticate/start would race for the single per-session
// challenge, and whichever request resolved last would invalidate the other.
let conditionalPasskeyAbort: AbortController | null = null;
function cancelConditionalPasskey() {
  conditionalPasskeyAbort?.abort();
  conditionalPasskeyAbort = null;
}

function usePasskeySignIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPending, setIsPending] = useState(false);

  async function signInWithPasskey(): Promise<boolean> {
    setIsPending(true);
    cancelConditionalPasskey();
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
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState(defaultOrgCode);
  const [showCredential, setShowCredential] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [step, setStep] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [allowPasswordCreation, setAllowPasswordCreation] = useState(true);
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [resolvedSiteId, setResolvedSiteId] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();
  const [, setLocation] = useLocation();
  const { submitLogin, isPending: adminPending, captchaState, setCaptchaState } = useLoginFlow();
  const conditionalStartedRef = useRef(false);

  // iOS / Android Conditional UI: when supported, request a passkey assertion in
  // the background so the platform shows Face ID / Touch ID / Windows Hello as
  // an autofill suggestion on the username field.
  useEffect(() => {
    const ac = new AbortController();
    conditionalPasskeyAbort = ac;
    (async () => {
      try {
        if (conditionalStartedRef.current) return;
        if (!(await browserSupportsWebAuthnAutofill())) return;
        conditionalStartedRef.current = true;
        const startRes = await fetch("/api/passkeys/authenticate/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
        });
        if (!startRes.ok || ac.signal.aborted) return;
        const options = await startRes.json();
        const credential = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
        });
        if (ac.signal.aborted) return;
        const finishRes = await fetch("/api/passkeys/authenticate/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential),
          credentials: "include",
          signal: ac.signal,
        });
        if (!finishRes.ok) return;
        const user = await finishRes.json();
        queryClient.setQueryData(["/api/user"], user);
        toast({ title: "Signed in!", description: `Welcome back, ${user.fullName}` });
        redirectAfterLogin(user.role, setLocation);
      } catch {
        // Silent — user may have ignored the autofill suggestion or the
        // request was aborted because the manual passkey button took over.
      }
    })();
    return () => {
      ac.abort();
      if (conditionalPasskeyAbort === ac) conditionalPasskeyAbort = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !credential.trim()) return;

    const cred = credential.trim();
    // A site ID only contains lowercase letters, numbers, and dashes
    const looksLikeSiteId = /^[a-z0-9-]+$/.test(cred);

    if (looksLikeSiteId) {
      setIsPending(true);
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: cred.toLowerCase(), username: username.trim() }),
          credentials: "include",
        });
        const data = await res.json();

        if (res.status === 404) {
          // Not a valid site ID — treat the credential as a password instead
          setIsPending(false);
          await submitLogin({ username: username.trim(), password: cred });
          return;
        }

        if (!res.ok) {
          toast({ title: "Sign In Failed", description: data.message || "Something went wrong", variant: "destructive" });
          return;
        }

        if (data.needsRegistration) {
          setResolvedSiteId(cred.toLowerCase());
          setAllowPasswordCreation(data.allowPasswordCreation ?? true);
          setStep("register");
          return;
        }

        localStorage.setItem("bb_last_site_id", cred.toLowerCase());
        queryClient.setQueryData(["/api/user"], data);
        toast({ title: "Welcome back!", description: `Signed in as ${data.fullName}` });
        redirectAfterLogin(data.role, setLocation);
      } finally {
        setIsPending(false);
      }
    } else {
      // Contains uppercase or special chars — must be a password
      await submitLogin({ username: username.trim(), password: cred });
    }
  };

  const handleCaptchaSubmit = async (turnstileToken: string) => {
    await submitLogin({ username: username.trim(), password: credential.trim(), turnstileToken });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    if (allowPasswordCreation && regPassword && regPassword !== regConfirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both password fields match.", variant: "destructive" });
      return;
    }
    if (allowPasswordCreation && regPassword && regPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const body: Record<string, string> = { siteId: resolvedSiteId, username: username.trim(), fullName: fullName.trim() };
      if (allowPasswordCreation && regPassword.trim()) body.password = regPassword.trim();
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
      localStorage.setItem("bb_last_site_id", resolvedSiteId);
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome!", description: `Signed in as ${data.fullName}` });
      redirectAfterLogin(data.role, setLocation);
    } finally {
      setIsPending(false);
    }
  };

  if (captchaState !== null) {
    return (
      <TurnstileStep
        error={captchaState.error}
        onSubmit={handleCaptchaSubmit}
        onBack={() => setCaptchaState(null)}
        isPending={adminPending}
      />
    );
  }

  if (step === "register") {
    return (
      <form onFocusCapture={scrollOnFocus} onSubmit={handleRegisterSubmit} className="space-y-4">
        <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
          <p className="text-muted-foreground text-xs">Employee code</p>
          <p className="font-mono font-semibold">{username}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullname">Your Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  type={showRegPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pr-9"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-emp-reg-password"
                />
                <button type="button" aria-label={showRegPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowRegPassword(v => !v)} tabIndex={-1}>
                  {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {regPassword && (
              <div className="space-y-2">
                <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="reg-confirm-password"
                    type={showRegConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    className="pr-9"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="input-emp-reg-confirm-password"
                  />
                  <button type="button" aria-label={showRegConfirmPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowRegConfirmPassword(v => !v)} tabIndex={-1}>
                    {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setStep("login"); setFullName(""); setRegPassword(""); setRegConfirmPassword(""); }} data-testid="button-emp-back">
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </form>
    );
  }

  const isLoading = isPending || adminPending;

  return (
    <form onFocusCapture={scrollOnFocus} onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="username">Username or email</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            placeholder="Username, email, or employee code"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username webauthn"
            data-testid="input-employee-code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="credential">Password or Site ID</Label>
          <button
            type="button"
            className="inline-flex items-center min-h-11 sm:min-h-0 px-2 -mx-2 sm:px-0 sm:mx-0 text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
            onClick={() => setLocation("/forgot-password")}
            data-testid="link-forgot-password"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="credential"
            type={showCredential ? "text" : "password"}
            placeholder="Your password or workplace Site ID"
            className="pl-9 pr-9"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            autoComplete="off"
            data-testid="input-admin-password"
          />
          <button
            type="button"
            aria-label={showCredential ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowCredential(v => !v)}
            tabIndex={-1}
            data-testid="button-toggle-password"
          >
            {showCredential ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isLoading || !username.trim() || !credential.trim()}
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
