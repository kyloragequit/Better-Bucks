import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpinningLogo } from "@/components/spinning-logo";
import { useLocation } from "wouter";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, DollarSign, ArrowRight, LogIn, Building2, Info, Send, Menu, Lightbulb } from "lucide-react";
import { LogoBackground } from "@/components/logo-background";
import { InstagramFloat } from "@/components/instagram-float";

const DEFAULTS: Record<string, string> = {
  hero_headline: "Reward What's Important",
  hero_subheadline: `A "Bucks"-based incentive system that helps businesses recognize employees instantly, automate rewards, and drive measurable results — without extra admin work.`,
  benefit1_title: "Simple Rewards, Zero Hassle",
  benefit1_subtitle: "Streamline how you recognize employees.",
  benefit1_bullet1: "Replace spreadsheets and manual tracking",
  benefit1_bullet2: "Reward employees in seconds",
  benefit1_bullet3: "Centralized platform for all incentives",
  benefit2_title: "Motivate Performance That Matters",
  benefit2_subtitle: "Turn everyday actions into measurable results.",
  benefit2_bullet1: "Tie rewards to KPIs, attendance, or goals",
  benefit2_bullet2: "Reinforce productivity and accountability",
  benefit2_bullet3: "Encourage behaviors aligned with company success",
  benefit3_title: "Control Costs While Boosting Engagement",
  benefit3_subtitle: "Incentives employees love — with budgets you control.",
  benefit3_bullet1: "Predictable incentive spending",
  benefit3_bullet2: "Flexible reward options employees choose",
  benefit3_bullet3: "Scales easily as your workforce grows",
  cta_headline: "Ready to transform your employee rewards?",
  cta_subtext: "Fill out the form below and we'll get back to you about how Better Bucks can work for your team.",
  instagram_handle: "better_bucks",
};

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const contactRef = useRef<HTMLDivElement>(null);
  const { data: rawContent } = useQuery<Record<string, string>>({ queryKey: ["/api/page-content"] });
  const c = (key: string) => rawContent?.[key] ?? DEFAULTS[key] ?? "";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNeeds, setContactNeeds] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    try {
      const res = await fetch("/api/info-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, email: contactEmail, phone: contactPhone, needs: contactNeeds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      toast({ title: "Request Sent!", description: data.message });
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactNeeds("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setContactSubmitting(false);
    }
  };

  const jsonLd = [
    {
      "@type": "Organization",
      "name": "Better Bucks",
      "url": "https://better-bucks.replit.app",
      "logo": "https://better-bucks.replit.app/favicon.png",
      "description": "Better Bucks eliminates manual employee incentive tracking and replaces spreadsheet reward systems with automated, consistent employee recognition. Built for logistics, warehousing, manufacturing, and distribution operations with 50–500 employees.",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "miles@betterbucks.net",
        "contactType": "sales"
      },
      "sameAs": [
        "https://www.instagram.com/betterbucks"
      ]
    },
    {
      "@type": "SoftwareApplication",
      "name": "Better Bucks",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": "https://better-bucks.replit.app",
      "description": "Better Bucks is employee incentive software and employee recognition platform that eliminates manual reward tracking, replaces spreadsheet reward systems with workplace rewards software, automates incentive tracking, provides employee engagement tools, and serves as a complete performance recognition system for logistics, warehousing, and manufacturing teams.",
      "screenshot": "https://better-bucks.replit.app/haring-background.png",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0",
        "offerCount": "4",
        "description": "Free starter plan through enterprise tiers for organizations with 50–500 employees"
      },
      "featureList": [
        "Employee incentive software for frontline workforces",
        "Employee recognition platform with real-time balances",
        "Workplace rewards software — no spreadsheets required",
        "Incentive tracking software with full audit trail",
        "Employee engagement tools tied to KPIs and attendance",
        "Performance recognition system for logistics and manufacturing",
        "Safety compliance motivation tools",
        "Custom company store for Bucks redemption"
      ],
      "audience": {
        "@type": "BusinessAudience",
        "audienceType": "Operations managers, HR managers, and shift supervisors in logistics, warehousing, and manufacturing"
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I stop tracking employee incentives manually?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks automates employee incentive tracking entirely. Administrators award Bucks for performance, attendance, safety compliance, and KPIs — no spreadsheets, no manual calculations. Employees see their balance in real time."
          }
        },
        {
          "@type": "Question",
          "name": "What replaces a spreadsheet-based employee reward system?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks is purpose-built to replace spreadsheet reward systems. It provides a centralized platform where managers award Bucks currency, employees track their earnings, and both parties can see history and balances — all without a single spreadsheet."
          }
        },
        {
          "@type": "Question",
          "name": "How do I make employee recognition consistent across my team?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Inconsistent employee recognition is a common problem in shift-based environments. Better Bucks gives every manager a shared, auditable system — so recognition follows the same rules and is visible to everyone, eliminating favoritism and gaps."
          }
        },
        {
          "@type": "Question",
          "name": "How can I motivate employees to follow safety compliance guidelines?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks lets you directly reward safety compliance with Bucks. When employees know that following safety procedures earns them tangible rewards redeemable in a real company store, compliance rates improve significantly across logistics, manufacturing, and warehousing teams."
          }
        },
        {
          "@type": "Question",
          "name": "How do I fix employee engagement issues in logistics or manufacturing?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Employee engagement issues in frontline and hourly roles often stem from a lack of recognition. Better Bucks gives employees a real stake in their performance — they earn Bucks for hitting targets and spend them on items they actually want."
          }
        },
        {
          "@type": "Question",
          "name": "What reduces time-consuming admin tasks in reward program management?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks automates the most time-consuming reward admin tasks: calculating totals, distributing awards, tracking redemptions, and managing employee balances. What used to take hours of spreadsheet work takes minutes."
          }
        },
        {
          "@type": "Question",
          "name": "How do I manage a reward program for 50 to 500 employees?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks is designed specifically for organizations with 50–500 employees. It scales from small operations to multi-department warehouses and manufacturing floors, with tiered pricing and admin tools built for real-world operations management."
          }
        },
        {
          "@type": "Question",
          "name": "How do I get performance visibility for hourly and frontline employees?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Better Bucks gives operations and HR managers a real-time view of employee Bucks activity, redemptions, and department-level engagement. No more guessing who is performing — the data is always current and accessible."
          }
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageSEO
        title="Better Bucks – Employee Incentive Software for Logistics & Manufacturing"
        description="Better Bucks is employee incentive software and employee recognition platform built for logistics, warehousing, and manufacturing teams. Replace spreadsheets with workplace rewards software that automates incentive tracking, boosts employee engagement, and powers your performance recognition system."
        canonicalPath="/"
        keywords="employee incentive software, employee recognition platform, workplace rewards software, incentive tracking software, employee engagement tools, performance recognition system, employee reward tracking, spreadsheet reward system, safety compliance motivation, employee engagement platform, reward program management, performance visibility, logistics employee incentives, warehousing employee recognition, manufacturing incentive program, frontline worker rewards"
        jsonLd={jsonLd}
      />

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900" data-testid="text-brand-name">Better Bucks</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/about")}
              data-testid="button-header-about"
            >
              <Info className="mr-1.5 h-4 w-4" />
              About
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-header-login"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              Log In
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/signup")}
              data-testid="button-header-signup"
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Sign Up
            </Button>
          </div>
          <div className="sm:hidden relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-lg border py-1 z-50">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => { setLocation("/about"); setMobileMenuOpen(false); }}
                    data-testid="button-mobile-about"
                  >
                    <Info className="h-4 w-4" />
                    About
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => { setLocation("/login"); setMobileMenuOpen(false); }}
                    data-testid="button-mobile-login"
                  >
                    <LogIn className="h-4 w-4" />
                    Log In
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => { setLocation("/signup"); setMobileMenuOpen(false); }}
                    data-testid="button-mobile-signup"
                  >
                    <Building2 className="h-4 w-4" />
                    Sign Up
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <LogoBackground />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight" data-testid="text-hero-headline">
            {c("hero_headline")}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subheadline">
            {c("hero_subheadline")}
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-10 py-6 border-2 border-primary text-primary font-bold shadow-md hover:bg-primary hover:text-white transition-all"
              onClick={() => setLocation("/how-it-works")}
              data-testid="button-how-it-works"
            >
              <Lightbulb className="mr-2 h-6 w-6" />
              How It Works
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="text-base px-8 shadow-lg shadow-primary/25"
              onClick={() => setLocation("/signup")}
              data-testid="button-hero-signup"
            >
              <Building2 className="mr-2 h-5 w-5" />
              Sign Up for Your Organization
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm" data-testid="card-benefit-rewards">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 mb-5">
                <Star className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{c("benefit1_title")}</h3>
              <p className="text-gray-600 mb-4">{c("benefit1_subtitle")}</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit1_bullet1")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit1_bullet2")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit1_bullet3")}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm" data-testid="card-benefit-performance">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 mb-5">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{c("benefit2_title")}</h3>
              <p className="text-gray-600 mb-4">{c("benefit2_subtitle")}</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit2_bullet1")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit2_bullet2")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit2_bullet3")}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm" data-testid="card-benefit-costs">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 mb-5">
                <DollarSign className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{c("benefit3_title")}</h3>
              <p className="text-gray-600 mb-4">{c("benefit3_subtitle")}</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit3_bullet1")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit3_bullet2")}
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  {c("benefit3_bullet3")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-white border-t" data-testid="section-what-is">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" data-testid="text-what-is-heading">
            The Complete Employee Recognition Platform
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl mx-auto mb-10" data-testid="text-what-is-body">
            Better Bucks is <strong>employee incentive software</strong> built for operations teams that need more than a spreadsheet. As a purpose-built <strong>employee recognition platform</strong>, it replaces manual processes with <strong>workplace rewards software</strong> that runs automatically. Our <strong>incentive tracking software</strong> gives managers real-time visibility into every award and redemption — while giving employees <strong>employee engagement tools</strong> they actually feel motivated by. The result is a <strong>performance recognition system</strong> that drives measurable results across logistics, warehousing, and manufacturing teams.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-gray-500 max-w-2xl mx-auto">
            {[
              "Employee Incentive Software",
              "Employee Recognition Platform",
              "Workplace Rewards Software",
              "Incentive Tracking Software",
              "Employee Engagement Tools",
              "Performance Recognition System",
            ].map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 font-medium text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer ref={contactRef} className="border-t bg-gray-50" data-testid="section-contact">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3" data-testid="text-cta-headline">
              {c("cta_headline")}
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              {c("cta_subtext")}
            </p>
          </div>
          <form onSubmit={handleContactSubmit} className="bg-white rounded-lg border shadow-sm p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  required
                  placeholder="Your full name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  data-testid="input-contact-email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                required
                placeholder="(555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                data-testid="input-contact-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-needs">Tell us about your employee incentive needs</Label>
              <Textarea
                id="contact-needs"
                required
                rows={4}
                placeholder="How many employees do you have? What kind of rewards are you looking for?"
                value={contactNeeds}
                onChange={(e) => setContactNeeds(e.target.value)}
                data-testid="input-contact-needs"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-base shadow-lg shadow-primary/25"
              disabled={contactSubmitting}
              data-testid="button-request-demo"
            >
              {contactSubmitting ? (
                <SpinningLogo className="mr-2 h-5 w-5" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {contactSubmitting ? "Sending..." : "Request a Demo"}
            </Button>
          </form>
          <div className="mt-10 pt-6 border-t text-sm text-gray-400 flex items-center justify-center gap-2">
            <AppLogo size="sm" />
            <span>Better Bucks LLC</span>
          </div>
        </div>
      </footer>
      <InstagramFloat />
    </div>
  );
}
