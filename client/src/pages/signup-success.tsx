import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { Check, Copy, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SignupSuccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const orgCode = params.get("org_code") || "";

  const { data: subStatus } = useQuery({
    queryKey: ["/api/organizations/check-subscription", orgCode],
    queryFn: async () => {
      if (!orgCode) return { active: false };
      const res = await fetch(`/api/organizations/check-subscription/${orgCode}`);
      if (!res.ok) return { active: false };
      return await res.json();
    },
    refetchInterval: (query) => {
      if (query.state.data?.active) return false;
      return 3000;
    },
    enabled: !!orgCode,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(orgCode);
    setCopied(true);
    toast({ title: "Copied!", description: "Organization code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!orgCode) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-white">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Invalid signup link. Please try signing up again.</p>
            <Button className="mt-4" onClick={() => setLocation("/signup")}>
              Go to Signup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-primary opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-primary opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-primary opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-primary opacity-25" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-success-title">
              Payment Successful!
            </CardTitle>
            <CardDescription className="text-base">
              Your organization has been created. Save your organization code below.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-md border-2 border-primary/20 bg-primary/5 p-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Organization Code</div>
              <div className="text-3xl font-mono font-bold tracking-widest text-gray-900" data-testid="text-org-code">
                {orgCode}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleCopy}
                data-testid="button-copy-code"
              >
                {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                {copied ? "Copied" : "Copy Code"}
              </Button>
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Save this code! You'll need it to set up your administrator account and for your team members to join.
            </div>

            {subStatus?.active ? (
              <Button
                className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                onClick={() => setLocation("/setup?org_code=" + orgCode)}
                data-testid="button-setup-account"
              >
                Set up your admin account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Activating your subscription...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
