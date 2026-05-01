import { useState, useRef, useEffect } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { PageSEO } from "@/components/page-seo";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/app-logo";
import { LogoBackground } from "@/components/logo-background";
import { InstagramFloat } from "@/components/instagram-float";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Users, Award, ShoppingCart, Shield, Check, Building2, Zap, Crown, Send, Mail, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const tiers = [
  {
    id: "small" as const,
    name: "A Little Better",
    price: 8.79,
    maxEmployees: 25,
    description: "25 Employee Logins",
    perEmployee: "~$0.35",
    icon: Users,
    features: ["25 employee logins", "60-day free pilot program", "Admin dashboard", "Bucks tracking", "Basic reporting", "Email support"],
  },
  {
    id: "mid" as const,
    name: "Much Better",
    price: 15.19,
    maxEmployees: 75,
    description: "75 Employee Logins",
    perEmployee: "~$0.20",
    icon: Building2,
    popular: true,
    features: ["75 employee logins", "60-day free pilot program", "Admin dashboard", "Bucks tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "large" as const,
    name: "A LOT Better",
    price: 23.99,
    maxEmployees: 150,
    description: "150 Employee Logins",
    perEmployee: "~$0.16",
    icon: Zap,
    features: ["150 employee logins", "60-day free pilot program", "Admin dashboard", "Bucks tracking", "Advanced reporting", "Priority support"],
  },
  {
    id: "enterprise" as const,
    name: "How much Better?",
    price: 239.99,
    maxEmployees: -1,
    description: "Unlimited Logins",
    perEmployee: "More dedicated support",
    icon: Crown,
    features: ["Unlimited employee logins", "60-day free pilot program", "Admin dashboard", "Bucks tracking", "Custom reporting", "Dedicated support"],
  },
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralExtraMonths, setReferralExtraMonths] = useState(1);
  const [contactPending, setContactPending] = useState(false);
  const [licenseAccepted, setLicenseAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

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

  const rfiRef = useRef<HTMLDivElement>(null);
  const signupFormRef = useRef<HTMLDivElement>(null);

  const scrollToRfi = () => {
    rfiRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (selectedTier) {
      setTimeout(() => {
        signupFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [selectedTier]);

  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get("cancelled");

  const { mutate: startCheckout, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/signup", {
        organizationName: orgName,
        email,
        tier: selectedTier,
        referralCode: referralCode.trim() || undefined,
        licenseAccepted: true,
        marketingOptIn,
      });
      return await res.json();
    },
    onSuccess: (data: { url?: string; promoApplied?: boolean; orgCode?: string; contactPending?: boolean; referralValid?: boolean; referralExtraMonths?: number }) => {
      if (data.contactPending) {
        setContactPending(true);
        if (data.referralValid) {
          setReferralValid(true);
          setReferralExtraMonths(data.referralExtraMonths ?? 1);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data.promoApplied && data.orgCode) {
        setLocation(`/signup/success?org_code=${data.orgCode}`);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("referral code")) {
        setReferralCodeError(error.message);
      } else {
        toast({
          title: "Signup Failed",
          description: error.message,
          variant: "destructive",
        });
      }
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
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-primary">
      <PageSEO
        title="Get Started – Drive Employee Performance & Operational Efficiency | Better Bucks"
        description="Start improving employee performance and operational efficiency in your logistics, warehousing, or manufacturing operation. Better Bucks gives managers the tools to track, motivate, and reward top performers — boosting productivity across every team and shift."
        canonicalPath="/signup"
        keywords="employee performance platform signup, operational efficiency software, workforce productivity tools, frontline employee performance, logistics performance management, warehousing productivity software, manufacturing employee incentives, employee recognition platform, performance-based rewards, improve employee output"
      />

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 30%, #4E9F3D15 0%, transparent 60%)" }} />

      {contactPending && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="relative z-10 w-full max-w-lg text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-400/20 border-2 border-green-400/40">
              <Mail className="h-10 w-10 text-green-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-3">We Got Your Request!</h1>
              <p className="text-white/80 text-lg leading-relaxed">
                Thanks for your interest in Better Bucks. We received your plan selection and will reach out to <span className="font-semibold text-white">{email}</span> shortly to get you set up.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/20 p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Company</span>
                <span className="text-white font-medium">{orgName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Plan</span>
                <span className="text-white font-medium">{tiers.find(t => t.id === selectedTier)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Contact Email</span>
                <span className="text-white font-medium">{email}</span>
              </div>
              {referralValid && (
                <div className="flex justify-between text-sm pt-1 border-t border-white/20">
                  <span className="text-green-300 font-medium">🎁 Referral Bonus</span>
                  <span className="text-green-300 font-semibold">+{referralExtraMonths} free month{referralExtraMonths > 1 ? "s" : ""} applied!</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      )}

      {!contactPending && <div className="flex-1 flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-5xl space-y-6">
        <Button
          variant="ghost"
          className="mb-2 text-white/70 hover:text-white hover:bg-white/10"
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
          <h1 className="text-2xl font-bold text-white" data-testid="text-signup-title">
            Choose Your Plan
          </h1>
          <p className="text-white/65">
            Select the right plan for your organization's size
          </p>
        </div>

        {cancelled && (
          <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
            Your request was not completed. You can try again below.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => {
            const isEnterprise = tier.id === "enterprise";
            const isSelected = selectedTier === tier.id;
            const TierIcon = tier.icon;
            return (
              <Card
                key={tier.id}
                className={`relative transition-all duration-200 ${
                  isEnterprise
                    ? "cursor-default border-muted hover-elevate"
                    : isSelected
                    ? "cursor-pointer ring-2 ring-primary border-primary shadow-lg"
                    : "cursor-pointer border-muted hover-elevate"
                } ${tier.popular ? "border-primary/50" : ""}`}
                onClick={() => {
                  if (isEnterprise) { setSelectedTier(null); setTimeout(scrollToRfi, 80); }
                  else setSelectedTier(tier.id);
                }}
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
                    {isEnterprise ? (
                      <span className="text-2xl font-bold text-primary">Contact Us</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-3xl font-bold text-gray-900">${tier.price}</span>
                          <span className="text-sm text-muted-foreground">/mo</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="inline-block rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1" data-testid={`badge-trial-${tier.id}`}>
                    60-Day Free Pilot
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isEnterprise ? tier.perEmployee : `${tier.perEmployee} per employee`}
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
                    {isEnterprise ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTier(null);
                          setTimeout(scrollToRfi, 80);
                        }}
                        data-testid="button-select-tier-enterprise"
                      >
                        <Mail className="mr-1.5 h-3 w-3" />
                        Contact Us
                      </Button>
                    ) : (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div ref={signupFormRef}>
        {selectedTier && (
          <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm max-w-lg mx-auto">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-lg">
                Claim Your Spot
              </CardTitle>
              <CardDescription>
                {selectedTierData?.name} — locked in at ${selectedTierData?.price}/month
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
                  <Label htmlFor="org-email">Work Email</Label>
                  <Input
                    id="org-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-org-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="referral-code">Referral Code (optional)</Label>
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full border border-green-200">+1 month free</span>
                  </div>
                  <Input
                    id="referral-code"
                    placeholder="Enter referral or promo code"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferralCodeError(null);
                    }}
                    data-testid="input-referral-code"
                    className={`uppercase placeholder:normal-case ${referralCodeError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {referralCodeError ? (
                    <p className="text-xs text-red-600 font-medium">{referralCodeError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Have a referral or promo code? Enter it here — referral codes add an extra month free!</p>
                  )}
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">Terms of Service & Software License Agreement</span>
                  </div>
                  <div
                    className="h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed space-y-2"
                    data-testid="container-license-text"
                  >
                    <p className="font-semibold text-foreground">BETTER BUCKS LLC – TERMS OF SERVICE & SOFTWARE LICENSE AGREEMENT</p>
                    <p><strong>Effective Date:</strong> {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    <p>By creating an account, accessing, or using the Better Bucks platform ("Software"), you ("User" or "Company") agree to be bound by these Terms of Service and Software License Agreement ("Agreement"). If you do not agree, do not use the Software.</p>
                    <p className="font-semibold text-foreground">1. LICENSE GRANT</p>
                    <p>Better Bucks LLC ("Company," "we," "us") grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Software for internal business purposes. This is a license—not a sale.</p>
                    <p className="font-semibold text-foreground">2. OWNERSHIP</p>
                    <p>All rights, title, and interest in and to the Software—including all intellectual property—are and will remain the exclusive property of Better Bucks LLC. You do not acquire any ownership rights through use of the Software.</p>
                    <p className="font-semibold text-foreground">3. PERMITTED USE</p>
                    <p>You agree to use the Software solely for: managing employee incentives, tracking performance, conducting internal surveys, and internal business operations.</p>
                    <p className="font-semibold text-foreground">4. RESTRICTIONS</p>
                    <p>You may NOT: copy, reproduce, or distribute the Software; modify, adapt, or create derivative works; reverse engineer or attempt to extract source code; resell, sublicense, or commercially exploit the Software; or allow unauthorized third-party access.</p>
                    <p className="font-semibold text-foreground">5. ACCOUNT RESPONSIBILITY</p>
                    <p>You are responsible for maintaining account security, all activity under your account, and ensuring your users comply with this Agreement.</p>
                    <p className="font-semibold text-foreground">6. HOSTING & ACCESS</p>
                    <p>The Software is hosted and maintained exclusively by Better Bucks LLC. We reserve the right to modify features, update functionality, and suspend or restrict access if necessary.</p>
                    <p className="font-semibold text-foreground">7. FEES & BILLING</p>
                    <p>Subscription fees will be billed on a recurring basis. Pricing is subject to change with notice. Failure to pay may result in suspension or termination.</p>
                    <p className="font-semibold text-foreground">8. TERMINATION</p>
                    <p>We may suspend or terminate your access at any time if you violate these terms, payment is not received, or misuse of the platform occurs. Upon termination, your license is revoked immediately and access to the Software will be discontinued.</p>
                    <p className="font-semibold text-foreground">9. DATA & PRIVACY</p>
                    <p>You retain ownership of your business data. However, you grant Better Bucks LLC the right to store and process data necessary to provide the service, and use aggregated, anonymized data for platform improvements.</p>
                    <p className="font-semibold text-foreground">10. DISCLAIMER OF WARRANTIES</p>
                    <p>The Software is provided "as is" and "as available." We make no guarantees regarding performance, uptime, or results from use.</p>
                    <p className="font-semibold text-foreground">11. LIMITATION OF LIABILITY</p>
                    <p>To the fullest extent permitted by law, Better Bucks LLC shall not be liable for indirect, incidental, or consequential damages, or loss of profits, data, or business opportunities.</p>
                    <p className="font-semibold text-foreground">12. GOVERNING LAW</p>
                    <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
                    <p className="font-semibold text-foreground">13. CHANGES TO TERMS</p>
                    <p>We may update these terms at any time. Continued use of the Software constitutes acceptance of any changes.</p>
                    <p className="font-semibold text-foreground">14. ACCEPTANCE OF TERMS</p>
                    <p>By checking the box and clicking "Get Started," you acknowledge that you have read, understood, and agree to be bound by this Agreement.</p>
                  </div>
                  <div className="flex items-start gap-3 pt-1">
                    <Checkbox
                      id="license-accept"
                      checked={licenseAccepted}
                      onCheckedChange={(checked) => setLicenseAccepted(checked === true)}
                      data-testid="checkbox-license-accept"
                    />
                    <label
                      htmlFor="license-accept"
                      className="text-xs leading-relaxed cursor-pointer text-muted-foreground"
                    >
                      I have read and agree to the <strong className="text-foreground">Terms of Service and Software License Agreement</strong>. I understand this is a binding legal agreement between my organization and Better Bucks LLC, effective {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="marketing-opt-in"
                      checked={marketingOptIn}
                      onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
                      data-testid="checkbox-marketing-opt-in"
                    />
                    <label
                      htmlFor="marketing-opt-in"
                      className="text-xs leading-relaxed cursor-pointer text-muted-foreground"
                    >
                      I'd like to receive product updates, tips, and occasional promotions from Better Bucks. <span className="italic">(Optional)</span>
                    </label>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  disabled={isPending || !licenseAccepted}
                  data-testid="button-subscribe"
                >
                  {isPending ? (
                    <>
                      <SpinningLogo className="mr-2 h-4 w-4" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Get Started
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground" data-testid="text-cancellation-policy">
                  60-day free pilot · Cancel anytime · No commitments
                </p>
              </form>
            </CardContent>
          </Card>
        )}
        </div>

        {!selectedTier && (
        <div ref={rfiRef} className="border-t border-border/50 pt-8 mt-8">
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
                        <SpinningLogo className="mr-2 h-4 w-4" />
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
        )}
      </div>
      </div>}
      <SiteFooter dark />
      <InstagramFloat />
    </div>
  );
}
