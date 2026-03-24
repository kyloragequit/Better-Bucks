import { useState, useEffect } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useRegisterAdmin } from "@/hooks/use-auth";
import { PageSEO } from "@/components/page-seo";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, User, LogIn, UserPlus, Building2, ArrowLeft, HelpCircle, Mail, Phone, Eye, EyeOff, ShieldCheck, RefreshCw, KeyRound } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { InstagramFloat } from "@/components/instagram-float";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { startAuthentication } from "@simplewebauthn/browser";
import { PasskeySetupPrompt } from "@/components/passkey-manager";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const urlOrgCode = params.get("orgCode") || "";
  const urlTab = params.get("tab") || "employee";
  const urlMode = params.get("mode") || "";

  // Clear any stale "remember me" opt-in from previous app versions
  useEffect(() => {
    localStorage.removeItem("bb_remember_opted_in");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-primary">
      <PageSEO
        title="Log In – Better Bucks Employee Incentive Platform"
        description="Access your Better Bucks portal. Purpose-built reward program management for logistics, warehousing, and manufacturing operations — eliminating manual incentive tracking and spreadsheet reward systems."
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
              Sign in or create an account to access your rewards portal
            </CardDescription>
          </CardHeader>

          <Tabs defaultValue={urlTab} className="w-full px-4">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="employee" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Employee</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Administrator</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employee" className="space-y-4 pb-4">
              <EmployeeTabs defaultMode={urlMode === "create" ? "register" : "login"} defaultOrgCode={urlOrgCode} />
            </TabsContent>

            <TabsContent value="admin" className="space-y-4 pb-4">
              <AdminTabs />
            </TabsContent>
          </Tabs>

          <div className="px-4 pb-4">
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/80 px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setLocation("/setup")}
              data-testid="button-first-time"
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              First time login? (Organization Setup)
            </Button>
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

function EmployeeTabs({ defaultMode = "login", defaultOrgCode = "" }: { defaultMode?: "login" | "register"; defaultOrgCode?: string }) {
  return <EmployeeAccessForm defaultSiteId="" />;
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

function EmployeeAccessForm({ defaultSiteId = "" }: { defaultSiteId?: string }) {
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [step, setStep] = useState<"credentials" | "register">("credentials");
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId.trim() || !username.trim()) return;
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
        setStep("register");
        return;
      }
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Welcome back!", description: `Signed in as ${data.fullName}` });
      redirectAfterLogin(data.role, setLocation);
    } finally {
      setIsPending(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setIsPending(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: siteId.trim().toLowerCase(), username: username.trim(), fullName: fullName.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Registration Failed", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: "Account created!", description: `Welcome, ${data.fullName}!` });
      redirectAfterLogin(data.role, setLocation);
    } finally {
      setIsPending(false);
    }
  };

  if (step === "register") {
    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
          <p className="text-muted-foreground text-xs">Employee code</p>
          <p className="font-mono font-semibold">{username}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-fullname">Your Full Name</Label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="emp-fullname"
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
          <p className="text-xs text-muted-foreground">No password or email required.</p>
        </div>
        <Button
          type="submit"
          className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
          disabled={isPending || !fullName.trim()}
          data-testid="button-emp-register"
        >
          {isPending ? <><SpinningLogo className="mr-2 h-4 w-4" />Creating...</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account & Sign In</>}
        </Button>
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setStep("credentials"); setFullName(""); }} data-testid="button-emp-back">
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentialsSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="emp-site-id">Site ID</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-site-id"
            placeholder="e.g. warehouse-1"
            className="pl-9"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            required
            autoComplete="organization"
            data-testid="input-emp-site-id"
          />
        </div>
        <p className="text-xs text-muted-foreground">Ask your manager for your workplace Site ID.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-username">Employee Code / Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-username"
            placeholder="e.g. john.smith or EMP-001"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            data-testid="input-employee-code"
          />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isPending}
        data-testid="button-employee-login"
      >
        {isPending ? <><SpinningLogo className="mr-2 h-4 w-4" />Signing In...</> : <><LogIn className="mr-2 h-4 w-4" />Sign In</>}
      </Button>
      <PasskeySignInButton />
    </form>
  );
}

function AdminTabs() {
  const [adminTab, setAdminTab] = useState<"login" | "register">("login");

  return (
    <Tabs value={adminTab} onValueChange={(val) => setAdminTab(val as "login" | "register")} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="register">Create Account</TabsTrigger>
      </TabsList>

      <TabsContent value="login" className="space-y-0">
        <AdminLoginForm />
      </TabsContent>

      <TabsContent value="register" className="space-y-0">
        <AdminRegisterForm />
      </TabsContent>
    </Tabs>
  );
}

function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [, setLocation] = useLocation();
  const { submitLogin, isPending, captchaChallenge, setCaptchaChallenge } = useLoginFlow();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitLogin({ username, password });
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

  if (captchaChallenge) {
    return (
      <CaptchaStep
        challenge={captchaChallenge}
        answer={captchaAnswer}
        onAnswerChange={setCaptchaAnswer}
        onSubmit={handleCaptchaSubmit}
        onBack={() => { setCaptchaChallenge(null); setCaptchaAnswer(""); }}
        isPending={isPending}
      />
    );
  }

  return (
    <form onSubmit={handleCredentialsSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-username"
            placeholder="admin"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            data-testid="input-admin-username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="admin-password">Password</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
            onClick={() => setLocation("/forgot-password")}
            data-testid="link-admin-forgot-password"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            className="pl-9 pr-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            data-testid="input-admin-password"
          />
          <button
            type="button"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            data-testid="button-toggle-admin-password"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isPending}
        data-testid="button-admin-login"
      >
        {isPending ? (
          <>
            <SpinningLogo className="mr-2 h-4 w-4" />
            Authenticating...
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </>
        )}
      </Button>
      <PasskeySignInButton />
    </form>
  );
}

function AdminRegisterForm() {
  const [orgCode, setOrgCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { mutate: register, isPending } = useRegisterAdmin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    register({
      fullName, username, password,
      email: contactMethod === "email" ? email : "",
      phone: contactMethod === "phone" ? phone : "",
      orgCode: orgCode.toUpperCase()
    } as any, {
      onSuccess: () => {
        setRegistered(true);
      }
    });
  };

  if (registered) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <UserPlus className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="font-bold text-lg">Account Created!</h3>
        <p className="text-sm text-muted-foreground">
          Your account has been submitted and is waiting for the organization to approve it. You'll be able to log in once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-org-code">Organization Code</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-org-code"
            placeholder="e.g. A1B2C3D4"
            className="pl-9 uppercase font-mono tracking-widest"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
            required
            data-testid="input-register-orgcode"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="full-name">Full Name</Label>
        <Input
          id="full-name"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          data-testid="input-admin-fullname"
        />
      </div>
      <div className="space-y-2">
        <Label>Verification Method</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={contactMethod === "email" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setContactMethod("email")}
            data-testid="button-admin-reg-method-email"
          >
            <Mail className="mr-1 h-3 w-3" /> Email
          </Button>
          <Button
            type="button"
            variant={contactMethod === "phone" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setContactMethod("phone")}
            data-testid="button-admin-reg-method-phone"
          >
            <Phone className="mr-1 h-3 w-3" /> Phone
          </Button>
        </div>
        {contactMethod === "email" ? (
          <Input
            id="admin-reg-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-admin-register-email"
          />
        ) : (
          <Input
            id="admin-reg-phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            data-testid="input-admin-register-phone"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-reg-username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-reg-username"
            placeholder="Choose a username"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
            data-testid="input-admin-register-username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-reg-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-reg-password"
            type={showPassword ? "text" : "password"}
            className="pl-9 pr-9"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            data-testid="input-admin-register-password"
          />
          <button
            type="button"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            data-testid="button-toggle-admin-reg-password"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-reg-confirm-password">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-reg-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            className="pl-9 pr-9"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            data-testid="input-admin-register-confirm-password"
          />
          <button
            type="button"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            data-testid="button-toggle-admin-reg-confirm-password"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isPending}
        data-testid="button-admin-register"
      >
        {isPending ? (
          <>
            <SpinningLogo className="mr-2 h-4 w-4" />
            Creating Account...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Account
          </>
        )}
      </Button>
    </form>
  );
}
