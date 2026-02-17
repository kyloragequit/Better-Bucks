import { useState, useEffect } from "react";
import { useLogin, useUser, useRegisterAdmin } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, User, Loader2, LogIn, UserPlus, Building2 } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { data: user } = useUser();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'prime_admin') setLocation('/admin/employees');
      else setLocation('/dashboard');
    }
  }, [user, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      {/* Red Dots Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#D40511] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#D40511] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#D40511] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#D40511] opacity-25" />
        <div className="absolute bottom-[10%] right-[30%] w-20 h-20 rounded-full bg-[#D40511] opacity-10" />
        <div className="absolute top-[40%] left-[15%] w-6 h-6 rounded-full bg-[#D40511] opacity-30" />
        <div className="absolute bottom-[40%] right-[25%] w-14 h-14 rounded-full bg-[#D40511] opacity-15" />
        <div className="absolute top-[5%] right-[40%] w-10 h-10 rounded-full bg-[#D40511] opacity-20" />
        <div className="absolute bottom-[5%] left-[45%] w-28 h-28 rounded-full bg-[#D40511] opacity-5" />
      </div>
      <Card className="w-full max-w-md shadow-2xl shadow-black/10 border-muted animate-in relative z-10 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <AppLogo size="lg" />
          </div>
          <CardTitle className="text-2xl font-bold font-display">Employee Portal</CardTitle>
          <CardDescription>
            Sign in to access your incentives and rewards
          </CardDescription>
        </CardHeader>

        <Tabs defaultValue="employee" className="w-full px-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="employee" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Employee</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </TabsTrigger>
          </TabsList>

          {/* Employee Login Tab */}
          <TabsContent value="employee" className="space-y-4 pb-4">
            <EmployeeLoginForm />
          </TabsContent>

          {/* Admin Tab */}
          <TabsContent value="admin" className="space-y-4 pb-4">
            <AdminLoginForm />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    register({ fullName, username, password }, {
      onSuccess: (data: any) => {
        alert("Thank you for creating your account. We are waiting on the administrator to verify your account.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
