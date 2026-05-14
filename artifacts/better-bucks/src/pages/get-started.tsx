import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SpinningLogo } from "@/components/spinning-logo";
import { LogoBackground } from "@/components/logo-background";
import { Building2, ArrowRight, ArrowLeft, QrCode } from "lucide-react";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";

type OrgInfo = { orgName: string; siteId: string; employeeRoleLabel: string };

export default function GetStartedPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();

  const params = new URLSearchParams(window.location.search);
  const prefillOrg = (params.get("org") || "").trim().toLowerCase();

  const [orgCode, setOrgCode] = useState(prefillOrg);
  const [submitted, setSubmitted] = useState(false);
  const [lookupCode, setLookupCode] = useState(prefillOrg);

  const { data: org, isLoading, isError } = useQuery<OrgInfo>({
    queryKey: [`/api/join/${lookupCode}`],
    queryFn: async () => {
      const res = await fetch(`/api/join/${lookupCode}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: submitted && !!lookupCode,
    retry: false,
    staleTime: 60_000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = orgCode.trim().toLowerCase();
    if (!code) return;
    setLookupCode(code);
    setSubmitted(true);
  };

  if (submitted && !isLoading && org) {
    setLocation(`/join/${org.siteId}`);
    return null;
  }

  const showError = submitted && !isLoading && (isError || !org);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-primary">
      <PageSEO
        title="New Employee Sign Up – Better Bucks"
        description="Create your Better Bucks employee account using your organization code."
        noindex
      />

      <LogoBackground />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, #4E9F3D18 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #ffffff08 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-4">
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setLocation("/login")}
          data-testid="button-back-login"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign In
        </Button>

        <Card className="w-full shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold font-display">
              New Employee? Welcome!
            </CardTitle>
            <CardDescription>
              Enter the organization code your employer gave you to create your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-6">
            <form onFocusCapture={scrollOnFocus} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-code">Organization Code</Label>
                <div className="relative">
                  <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="org-code"
                    placeholder="e.g. FEF55758"
                    className="pl-9 uppercase tracking-widest font-mono"
                    value={orgCode}
                    onChange={(e) => {
                      setOrgCode(e.target.value.toLowerCase());
                      setSubmitted(false);
                    }}
                    required
                    autoFocus={!prefillOrg}
                    autoComplete="off"
                    data-testid="input-org-code"
                  />
                </div>
                {showError && (
                  <p className="text-sm text-destructive">
                    That organization code wasn't found. Double-check with your employer.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This is the code or link shared by your manager or HR team.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                disabled={isLoading || !orgCode.trim()}
                data-testid="button-get-started-continue"
              >
                {isLoading ? (
                  <>
                    <SpinningLogo className="mr-2 h-4 w-4" />
                    Looking up…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline underline-offset-2"
                  onClick={() => setLocation("/login")}
                  data-testid="link-already-have-account"
                >
                  Sign in
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SiteFooter dark absolute />
    </div>
  );
}
