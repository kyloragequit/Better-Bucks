import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { Building2, LogIn, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#F7C1E7] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#F7C1E7] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#F7C1E7] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#F7C1E7] opacity-25" />
        <div className="absolute bottom-[10%] right-[30%] w-20 h-20 rounded-full bg-[#F7C1E7] opacity-10" />
        <div className="absolute top-[40%] left-[15%] w-6 h-6 rounded-full bg-[#F7C1E7] opacity-30" />
        <div className="absolute bottom-[40%] right-[25%] w-14 h-14 rounded-full bg-[#F7C1E7] opacity-15" />
        <div className="absolute top-[5%] right-[40%] w-10 h-10 rounded-full bg-[#F7C1E7] opacity-20" />
        <div className="absolute bottom-[5%] left-[45%] w-28 h-28 rounded-full bg-[#F7C1E7] opacity-5" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto mb-2">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-landing-title">
            Better Bucks
          </h1>
          <p className="text-muted-foreground">
            Manage your team's rewards, incentives, and recognition in one place.
          </p>
        </div>

        <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">Get Started</CardTitle>
            <CardDescription className="text-center">
              Choose an option below to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
              onClick={() => setLocation("/signup")}
              data-testid="button-signup-org"
            >
              <Building2 className="mr-2 h-5 w-5" />
              Sign up for your organization
              <ArrowRight className="ml-auto h-4 w-4" />
            </Button>

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
              className="w-full text-base py-6 font-semibold transition-all duration-300"
              onClick={() => setLocation("/login")}
              data-testid="button-login-org"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Log in to my organization
              <ArrowRight className="ml-auto h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
