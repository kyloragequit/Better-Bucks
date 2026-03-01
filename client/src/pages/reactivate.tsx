import { useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/app-logo";
import { LogoBackground } from "@/components/logo-background";
import { useToast } from "@/hooks/use-toast";
import { FullPageLoader } from "@/components/ui/loader";
import { CreditCard, Users, Check, Building2, Zap, Crown, ArrowLeft } from "lucide-react";

const tiers = [
  {
    id: "small" as const,
    name: "Small Site",
    price: 49.99,
    maxEmployees: 100,
    description: "Up to 100 employees",
    perEmployee: "~$0.50",
    icon: Users,
    features: ["Up to 100 active logins", "Admin dashboard", "Bucks tracking", "Basic reporting", "Email support"],
  },
  {
    id: "mid" as const,
    name: "Mid-Size Site",
    price: 99.99,
    maxEmployees: 300,
    description: "101-300 employees",
    perEmployee: "~$0.33",
    icon: Building2,
    popular: true,
    features: ["Up to 300 active logins", "Admin dashboard", "Bucks tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "large" as const,
    name: "Large Site",
    price: 149.99,
    maxEmployees: 500,
    description: "301-500 employees",
    perEmployee: "~$0.30",
    icon: Zap,
    features: ["Up to 500 active logins", "Admin dashboard", "Bucks tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise Site",
    price: 299.99,
    maxEmployees: -1,
    description: "500+ employees",
    perEmployee: "Best value",
    icon: Crown,
    features: ["Unlimited logins", "Admin dashboard", "Bucks tracking", "Custom reporting", "Dedicated support"],
  },
];

export default function ReactivatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useUser();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const { mutate: startReactivation, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/reactivate", {
        tier: selectedTier,
      });
      return await res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Reactivation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) {
      toast({ title: "Select a Plan", description: "Please choose a pricing tier to continue.", variant: "destructive" });
      return;
    }
    startReactivation();
  };

  if (userLoading) return <FullPageLoader />;

  if (!user || user.role !== "prime_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Only the organization owner can reactivate a subscription.</p>
            <Button className="mt-4" onClick={() => setLocation("/login")} data-testid="button-go-login">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedTierData = tiers.find(t => t.id === selectedTier);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <LogoBackground />

      <div className="relative z-10 w-full max-w-5xl space-y-6">
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => {
            if (user.role === "prime_admin") setLocation("/admin/dashboard");
            else setLocation("/");
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto mb-2">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-reactivate-title">
            Reactivate Your Subscription
          </h1>
          <p className="text-muted-foreground">
            Select a plan to reactivate your organization's account. Your existing data, employees, and settings will be preserved.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => {
            const isSelected = selectedTier === tier.id;
            const TierIcon = tier.icon;
            return (
              <Card
                key={tier.id}
                className={`relative cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-primary border-primary shadow-lg"
                    : "border-muted hover:shadow-md"
                } ${tier.popular ? "border-primary/50" : ""}`}
                onClick={() => setSelectedTier(tier.id)}
                data-testid={`card-tier-${tier.id}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs" data-testid="badge-popular">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3 pt-5 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <TierIcon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{tier.name}</CardTitle>
                  <CardDescription className="text-xs">{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-center">
                  <div>
                    <span className="text-3xl font-bold text-gray-900">${tier.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tier.perEmployee} per employee
                  </div>
                  <div className="space-y-1.5 text-left">
                    {tier.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTier(tier.id);
                      }}
                      data-testid={`button-select-tier-${tier.id}`}
                    >
                      {isSelected ? "Selected" : "Select Plan"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedTier && (
          <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm max-w-lg mx-auto">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-lg">
                Confirm Reactivation
              </CardTitle>
              <CardDescription>
                {selectedTierData?.name} - ${selectedTierData?.price}/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  Your organization code, employees, and all existing data will remain unchanged. You'll be taken to a secure payment page to complete reactivation.
                </div>
                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  disabled={isPending}
                  data-testid="button-reactivate"
                >
                  {isPending ? (
                    <>
                      <SpinningLogo className="mr-2 h-4 w-4" />
                      Setting up payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Continue to Payment - ${selectedTierData?.price}/month
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <SiteFooter absolute />
    </div>
  );
}
