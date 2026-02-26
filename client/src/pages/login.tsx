import { useState, useEffect } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { useLogin, useUser, useRegisterAdmin, useRegisterEmployee } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, User, LogIn, UserPlus, Building2, ArrowLeft, HelpCircle, Mail, Phone } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { LogoBackground } from "@/components/logo-background";
import { InstagramFloat } from "@/components/instagram-float";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { data: user } = useUser();

  const params = new URLSearchParams(window.location.search);
  const urlOrgCode = params.get("orgCode") || "";
  const urlTab = params.get("tab") || "employee";
  const urlMode = params.get("mode") || "";

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'prime_admin') setLocation('/admin/dashboard');
      else setLocation('/dashboard');
    }
  }, [user, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <LogoBackground />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Button
          variant="ghost"
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
                <span className="hidden sm:inline">Admin</span>
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
              First time login? (Prime Admin Setup)
            </Button>
          </div>
        </Card>
      </div>
      <InstagramFloat />
    </div>
  );
}

function EmployeeTabs({ defaultMode = "login", defaultOrgCode = "" }: { defaultMode?: "login" | "register"; defaultOrgCode?: string }) {
  const [tab, setTab] = useState<"login" | "register">(defaultMode);

  return (
    <Tabs value={tab} onValueChange={(val) => setTab(val as "login" | "register")} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="register">Create Account</TabsTrigger>
      </TabsList>

      <TabsContent value="login" className="space-y-0">
        <EmployeeLoginForm />
      </TabsContent>

      <TabsContent value="register" className="space-y-0">
        <EmployeeRegisterForm defaultOrgCode={defaultOrgCode} />
      </TabsContent>
    </Tabs>
  );
}

function EmployeeLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="emp-username">Employee Code</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-username"
            placeholder="EMP-001"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            data-testid="input-employee-code"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-password"
            type="password"
            className="pl-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="input-employee-password"
          />
        </div>
      </div>
      <Button 
        type="submit" 
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isPending}
        data-testid="button-employee-login"
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
    </form>
  );
}

function EmployeeRegisterForm({ defaultOrgCode = "" }: { defaultOrgCode?: string }) {
  const [orgCode, setOrgCode] = useState(defaultOrgCode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registered, setRegistered] = useState(false);
  const { mutate: register, isPending } = useRegisterEmployee();

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
          Your account has been submitted and is waiting for administrator approval. You'll be able to log in once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="emp-reg-org-code">Organization Code</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-reg-org-code"
            placeholder="e.g. A1B2C3D4"
            className="pl-9 uppercase font-mono tracking-widest"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
            required
            data-testid="input-emp-register-orgcode"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-full-name">Full Name</Label>
        <Input
          id="emp-full-name"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          data-testid="input-emp-fullname"
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
            data-testid="button-emp-reg-method-email"
          >
            <Mail className="mr-1 h-3 w-3" /> Email
          </Button>
          <Button
            type="button"
            variant={contactMethod === "phone" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setContactMethod("phone")}
            data-testid="button-emp-reg-method-phone"
          >
            <Phone className="mr-1 h-3 w-3" /> Phone
          </Button>
        </div>
        {contactMethod === "email" ? (
          <Input
            id="emp-reg-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-emp-register-email"
          />
        ) : (
          <Input
            id="emp-reg-phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            data-testid="input-emp-register-phone"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-reg-username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-reg-username"
            placeholder="Choose a username"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
            data-testid="input-emp-register-username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-reg-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-reg-password"
            type="password"
            className="pl-9"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            data-testid="input-emp-register-password"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="emp-reg-confirm-password">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="emp-reg-confirm-password"
            type="password"
            className="pl-9"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            data-testid="input-emp-register-confirm-password"
          />
        </div>
      </div>
      <Button 
        type="submit" 
        className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
        disabled={isPending}
        data-testid="button-emp-register"
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
  const { mutate: login, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            data-testid="input-admin-username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-password"
            type="password"
            className="pl-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="input-admin-password"
          />
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
          Your account has been submitted and is waiting for the prime administrator to approve it. You'll be able to log in once approved.
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
            data-testid="button-reg-method-email"
          >
            <Mail className="mr-1 h-3 w-3" /> Email
          </Button>
          <Button
            type="button"
            variant={contactMethod === "phone" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setContactMethod("phone")}
            data-testid="button-reg-method-phone"
          >
            <Phone className="mr-1 h-3 w-3" /> Phone
          </Button>
        </div>
        {contactMethod === "email" ? (
          <Input
            id="reg-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-register-email"
          />
        ) : (
          <Input
            id="reg-phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            data-testid="input-register-phone"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-username"
            placeholder="Choose a username"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
            data-testid="input-register-username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-password"
            type="password"
            className="pl-9"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            data-testid="input-register-password"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-confirm-password">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-confirm-password"
            type="password"
            className="pl-9"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            data-testid="input-register-confirm-password"
          />
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
