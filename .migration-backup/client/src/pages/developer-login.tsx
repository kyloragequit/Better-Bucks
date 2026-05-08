import { useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AppLogo } from "@/components/app-logo";
import { Code2, ArrowLeft } from "lucide-react";
import { TurnstileStep } from "@/components/turnstile-captcha";

export default function DeveloperLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState<{ error?: string } | null>(null);

  async function doLogin(turnstileToken?: string) {
    setIsPending(true);
    try {
      const res = await fetch("/api/developer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, turnstileToken }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Login Failed", description: data.message || "Login failed", variant: "destructive" });
        return;
      }
      if (data.captchaRequired) {
        setCaptchaRequired({ error: data.error });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (data.mustChangePassword) {
        setLocation("/change-password");
      } else {
        setLocation("/developer/dashboard");
      }
    } finally {
      setIsPending(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin();
  };

  if (captchaRequired !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-950 relative">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto mb-2"><AppLogo size="lg" /></div>
            <h1 className="text-3xl font-bold text-white">Developer Portal</h1>
          </div>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6">
              <TurnstileStep
                error={captchaRequired.error}
                onSubmit={(token) => doLogin(token)}
                onBack={() => setCaptchaRequired(null)}
                isPending={isPending}
                dark
              />
            </CardContent>
          </Card>
        </div>
        <SiteFooter dark absolute />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-950 relative">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto mb-2">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-dev-login-title">
            Developer Portal
          </h1>
          <p className="text-gray-400">
            Authorized access only
          </p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Code2 className="h-5 w-5 text-secondary" />
              Developer Sign In
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter your developer credentials to access the admin portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                  data-testid="input-dev-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                  data-testid="input-dev-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
                data-testid="button-dev-login"
              >
                {isPending ? <SpinningLogo className="mr-2 h-4 w-4" /> : <Code2 className="mr-2 h-4 w-4" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
      <SiteFooter dark absolute />
    </div>
  );
}
