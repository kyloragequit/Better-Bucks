import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, CreditCard, Users, Award, ShoppingCart, Shield, Check, Building2, Zap, Crown, Send, Mail } from "lucide-react";

const tiers = [
  {
    id: "small" as const,
    name: "Small Site",
    price: 49.99,
    maxEmployees: 100,
    description: "Up to 100 employees",
    perEmployee: "~$0.50",
    icon: Users,
    features: ["Up to 100 active logins", "Admin dashboard", "Points tracking", "Basic reporting", "Email support"],
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
    features: ["Up to 300 active logins", "Admin dashboard", "Points tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "large" as const,
    name: "Large Site",
    price: 149.99,
    maxEmployees: 500,
    description: "301-500 employees",
    perEmployee: "~$0.30",
    icon: Zap,
    features: ["Up to 500 active logins", "Admin dashboard", "Points tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise Site",
    price: 299.99,
    maxEmployees: -1,
    description: "500+ employees",
    perEmployee: "Best value",
    icon: Crown,
    features: ["Unlimited logins", "Admin dashboard", "Points tracking", "Custom reporting", "Dedicated support"],
  },
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");

  const [rfiName, setRfiName] = useState("");
  const [rfiEmail, setRfiEmail] = useState("");
  const [rfiPhone, setRfiPhone] = useState("");
  const [rfiNeeds, setRfiNeeds] = useState("");
  const [rfiSubmitted, setRfiSubmitted] = useState(false);

  const { mutate: submitRfi, isPending: isSubmittingRfi } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/info-request", {
        name: rfiName,
        email: rfiEmail,
        phone: rfiPhone,
        needs: rfiNeeds,
      });
      return await res.json();
    },
    onSuccess: () => {
      setRfiSubmitted(true);
      toast({ title: "Request Sent!", description: "We'll be in touch with more information soon." });
    },
    onError: (error: Error) => {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    },
  });

  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get("cancelled");

  const { mutate: startCheckout, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/signup", {
        organizationName: orgName,
        email,
        tier: selectedTier,
        promoCode: promoCode || undefined,
      });
      return await res.json();
    },
    onSuccess: (data: { url?: string; promoApplied?: boolean; orgCode?: string }) => {
      if (data.promoApplied && data.orgCode) {
        setLocation(`/signup/success?org_code=${data.orgCode}`);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Signup Failed",
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
    startCheckout();
  };

  const selectedTierData = tiers.find(t => t.id === selectedTier);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#F7C1E7] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#F7C1E7] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#F7C1E7] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#F7C1E7] opacity-25" />
        <div className="absolute bottom-[10%] right-[30%] w-20 h-20 rounded-full bg-[#F7C1E7] opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-5xl space-y-6">
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => setLocation("/")}
          data-testid="button-back-landing"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto mb-2">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-signup-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground">
            Select the right plan for your organization's size
          </p>
        </div>

        {cancelled && (
          <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
            Payment was cancelled. You can try again below.
          </div>
        )}

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
                    : "border-muted hover-elevate"
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
                Complete Your Signup
              </CardTitle>
              <CardDescription>
                {selectedTierData?.name} - ${selectedTierData?.price}/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    placeholder="Acme Corporation"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    data-testid="input-org-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-email">Billing Email</Label>
                  <Input
                    id="org-email"
                    type="email"
                    placeholder="billing@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-org-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-code">Promo Code (optional)</Label>
                  <Input
                    id="promo-code"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    data-testid="input-promo-code"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  disabled={isPending}
                  data-testid="button-subscribe"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Subscribe - ${selectedTierData?.price}/month
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="border-t border-border/50 pt-8 mt-8">
          <Card className="shadow-xl shadow-black/5 border-muted bg-white/80 backdrop-blur-sm max-w-lg mx-auto">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg" data-testid="text-rfi-title">
                Would you like more information?
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you with details tailored to your needs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rfiSubmitted ? (
                <div className="text-center py-6 space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg" data-testid="text-rfi-success">Thank You!</h3>
                  <p className="text-muted-foreground text-sm">Your request has been submitted. We'll be in touch soon!</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitRfi();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="rfi-name">Name</Label>
                    <Input
                      id="rfi-name"
                      placeholder="John Smith"
                      value={rfiName}
                      onChange={(e) => setRfiName(e.target.value)}
                      required
                      data-testid="input-rfi-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfi-email">Email</Label>
                    <Input
                      id="rfi-email"
                      type="email"
                      placeholder="john@company.com"
                      value={rfiEmail}
                      onChange={(e) => setRfiEmail(e.target.value)}
                      required
                      data-testid="input-rfi-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfi-phone">Phone Number</Label>
                    <Input
                      id="rfi-phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={rfiPhone}
                      onChange={(e) => setRfiPhone(e.target.value)}
                      required
                      data-testid="input-rfi-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfi-needs">Employee Incentive Needs</Label>
                    <Textarea
                      id="rfi-needs"
                      placeholder="Tell us about your organization and what you're looking for in an employee incentive program..."
                      value={rfiNeeds}
                      onChange={(e) => setRfiNeeds(e.target.value)}
                      rows={4}
                      required
                      data-testid="input-rfi-needs"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmittingRfi}
                    data-testid="button-submit-rfi"
                  >
                    {isSubmittingRfi ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Request
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
