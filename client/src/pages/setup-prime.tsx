import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, UserPlus, Lock, User, Building2, Check, Globe } from "lucide-react";

export default function SetupPrimePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(window.location.search);
  const initialCode = params.get("org_code") || "";

  const [orgCode, setOrgCode] = useState(initialCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [codeValidated, setCodeValidated] = useState(false);
  const [orgName, setOrgName] = useState("");

  const { mutate: validateCode, isPending: isValidating } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/organizations/validate/${orgCode.toUpperCase()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid code");
      }
      return await res.json();
    },
    onSuccess: (data: { id: number; name: string; status: string }) => {
      if (data.status !== "active") {
        toast({
          title: "Organization Not Active",
          description: "This organization's subscription is not active yet.",
          variant: "destructive",
        });
        return;
      }
      setCodeValidated(true);
      setOrgName(data.name);
    },
    onError: (error: Error) => {
      toast({
        title: "Invalid Code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: setupPrime, isPending: isSettingUp } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/setup-prime", {
        orgCode: orgCode.toUpperCase(),
        username,
        password,
        fullName,
        storeUrl,
      });
      return await res.json();
    },
    onSuccess: (user: any) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Account Created!",
        description: `Welcome, ${user.fullName}! You are now the administrator.`,
      });
      setLocation("/admin/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (initialCode) {
      validateCode();
    }
  }, []);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    validateCode();
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setupPrime();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#F7C1E7] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#F7C1E7] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#F7C1E7] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#F7C1E7] opacity-25" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/login")}
          data-testid="button-back-login"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>

        <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-setup-title">
              First Time Setup
            </CardTitle>
            <CardDescription>
              {codeValidated
                ? `Setting up administrator for ${orgName}`
                : "Enter your organization code to create your admin account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!codeValidated ? (
              <form onSubmit={handleValidate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-code">Organization Code</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="org-code"
                      placeholder="e.g. A1B2C3D4"
                      className="pl-9 uppercase font-mono tracking-widest"
                      value={orgCode}
                      onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                      required
                      data-testid="input-org-code"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  disabled={isValidating || !orgCode}
                  data-testid="button-validate-code"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="rounded-md bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-800">
                  <Check className="h-4 w-4" />
                  Organization verified: {orgName}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-store-url">Employee Store Website</Label>
                  <p className="text-xs text-muted-foreground">Enter the website where your employees will browse and pick items</p>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-store-url"
                      type="url"
                      placeholder="https://yourstore.com"
                      className="pl-9"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      required
                      data-testid="input-setup-store-url"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-fullname"
                      placeholder="John Doe"
                      className="pl-9"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      data-testid="input-setup-fullname"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-username"
                      placeholder="Choose a username"
                      className="pl-9"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      minLength={3}
                      required
                      data-testid="input-setup-username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-password"
                      type="password"
                      placeholder="At least 6 characters"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      data-testid="input-setup-password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-confirm"
                      type="password"
                      placeholder="Confirm your password"
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      data-testid="input-setup-confirm"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  disabled={isSettingUp}
                  data-testid="button-create-prime"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Admin Account
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
