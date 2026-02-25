import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, DollarSign, ArrowRight, LogIn, Building2, ChevronDown, Info, Send, Loader2 } from "lucide-react";
import { LogoBackground } from "@/components/logo-background";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"home" | "about">("home");
  const aboutRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNeeds, setContactNeeds] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const scrollToAbout = () => {
    setActiveTab("about");
    setTimeout(() => aboutRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900" data-testid="text-brand-name">Better Bucks</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToAbout}
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
        </div>
      </header>

      <section className="relative overflow-hidden">
        <LogoBackground />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight" data-testid="text-hero-headline">
            Reward What's Important
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subheadline">
            A "Bucks"-based incentive system that helps businesses recognize employees instantly, automate rewards, and drive measurable results — without extra admin work.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
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
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8"
              onClick={() => setLocation("/login")}
              data-testid="button-hero-login"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Log In
            </Button>
          </div>
          <div className="mt-12 animate-bounce">
            <ChevronDown className="mx-auto h-6 w-6 text-gray-400" />
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Simple Rewards, Zero Hassle</h3>
              <p className="text-gray-600 mb-4">Streamline how you recognize employees.</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Replace spreadsheets and manual tracking
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Reward employees in seconds
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Centralized platform for all incentives
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm" data-testid="card-benefit-performance">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 mb-5">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Motivate Performance That Matters</h3>
              <p className="text-gray-600 mb-4">Turn everyday actions into measurable results.</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Tie rewards to KPIs, attendance, or goals
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Reinforce productivity and accountability
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Encourage behaviors aligned with company success
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-md p-8 border border-gray-100 shadow-sm" data-testid="card-benefit-costs">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 mb-5">
                <DollarSign className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Control Costs While Boosting Engagement</h3>
              <p className="text-gray-600 mb-4">Incentives employees love — with budgets you control.</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Predictable incentive spending
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Flexible reward options employees choose
                </li>
                <li className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                  Scales easily as your workforce grows
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section ref={aboutRef} className="py-16 sm:py-24 bg-white" data-testid="section-about">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">About Better Bucks</h2>
            <div className="h-1 w-16 bg-secondary mx-auto rounded-full" />
          </div>
          <div className="space-y-6 text-gray-700 text-base sm:text-lg leading-relaxed">
            <p>
              Better Bucks LLC was founded in 2026 by Southeastern Louisiana University Business Administration student, Miles Gideon Chase.
            </p>
            <p>
              Throughout his college career, Miles saw the emphasis focused on behaviors in the workplace in 21st century business. Through his various jobs (7 to be precise) and internships throughout his college career, he saw how psychology and incentives play a major role in how to have happier and more effective employees. He also saw that poor incentives &mdash; things that the employees did not want &mdash; actually discouraged employees more than they made them want to be more effective. He also saw that managers had difficulty allocating their time to actually reward their employees.
            </p>
            <p className="text-xl font-semibold text-gray-900">
              That's why he made Better Bucks.
            </p>
            <p>
              Better Bucks streamlines the process for employee incentives. It allows them to tell you what they want and helps you to easily and instantly reward them with things they want.
            </p>
            <p className="text-2xl font-bold text-center text-primary mt-8">
              Better Bucks for a Better Business!
            </p>
          </div>
        </div>
      </section>

      <footer ref={contactRef} className="border-t bg-gray-50" data-testid="section-contact">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3" data-testid="text-cta-headline">
              Ready to transform your employee rewards?
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              Fill out the form below and we'll get back to you about how Better Bucks can work for your team.
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
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {contactSubmitting ? "Sending..." : "Request a Demo"}
            </Button>
          </form>
          <div className="mt-10 pt-6 border-t text-sm text-gray-400 flex items-center justify-center gap-2">
            <AppLogo size="sm" />
            <span>Better Bucks</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
