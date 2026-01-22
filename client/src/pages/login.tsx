import { useState, useEffect } from "react";
import { useLogin, useUser, useRegisterAdmin } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Lock, User, Loader2, LogIn, UserPlus, Building2 } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border-primary/10 animate-in">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold font-display">Employee Portal</CardTitle>
          <CardDescription>
            Sign in to access your incentives and rewards
          </CardDescription>
        </CardHeader>

        <Tabs defaultValue="employee" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mx-4 mb-4">
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
          <TabsContent value="employee" className="space-y-4 px-4 pb-4">
            <EmployeeLoginForm />
          </TabsContent>

          {/* Admin Tab */}
          <TabsContent value="admin" className="space-y-4 px-4 pb-4">
            <AdminTabs />
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
    register({ fullName, username, password });
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
