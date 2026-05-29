import { useEffect } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { Code2, ArrowLeft, LogIn } from "lucide-react";
import { useUser } from "@/hooks/use-auth";

export default function DeveloperLoginPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useUser();

  // If already logged in as developer, go straight to dashboard
  useEffect(() => {
    if (user?.role === "developer") {
      setLocation("/developer/dashboard");
    }
  }, [user, setLocation]);

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  const errorMessages: Record<string, string> = {
    not_authorized: "Your Replit account is not linked to a developer account. Contact the system administrator.",
    auth_failed: "Authentication failed. Please try again.",
    missing_oidc_state: "Session expired. Please try again.",
    no_claims: "Could not retrieve identity from Replit. Please try again.",
    session_failed: "Failed to create session. Please try again.",
    oidc_init_failed: "Could not connect to authentication provider. Please try again.",
  };

  const errorMessage = error ? (errorMessages[error] ?? "An unexpected error occurred. Please try again.") : null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <SpinningLogo className="h-8 w-8" />
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
              Sign in with your Replit account to access the developer portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
            <a href="/api/dev-auth/login" className="block">
              <Button
                className="w-full"
                data-testid="button-dev-login"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign in with Replit
              </Button>
            </a>
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
