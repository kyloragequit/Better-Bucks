import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, DollarSign, Users, TrendingUp, CheckCircle2, Send, Percent, Link } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const BUCKS_COLOR = "#4E9F3D";
const NAVY = "#162A4A";
const COMMISSION_RATE = 0.25;

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

export default function AffiliatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [salesAmount, setSalesAmount] = useState(10000);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    webpage: "",
    additionalInfo: "",
  });

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parallaxOffset = scrollY * 0.45;
  const commission = Math.round(salesAmount * COMMISSION_RATE);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.webpage) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/affiliate-signup", form);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Submission failed");
      }
      setSubmitted(true);
      toast({ title: "Application submitted!", description: "We'll be in touch soon about your affiliate account." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setLocation("/")}
            data-testid="link-home-logo"
          >
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/affiliate")} className="font-semibold" style={{ color: BUCKS_COLOR }} data-testid="button-header-affiliate">
              Affiliate Program
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/blog")} data-testid="button-header-blog">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Blog
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="button-header-login">
              Log In
            </Button>
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup" style={{ background: BUCKS_COLOR, color: "white" }}>
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* ── PARALLAX HERO ─────────────────────────────────────────── */}
      <div ref={heroRef} className="relative overflow-hidden" style={{ height: "100vh", minHeight: 600 }}>
        {/* Parallax background */}
        <div
          className="absolute inset-0 w-full"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a5f 40%, #0d2137 100%)`,
            transform: `translateY(${parallaxOffset}px)`,
            height: "130%",
            top: "-15%",
          }}
        />
        {/* Floating orbs for depth */}
        <div
          className="absolute rounded-full opacity-10"
          style={{
            width: 600,
            height: 600,
            background: BUCKS_COLOR,
            top: -100,
            right: -150,
            transform: `translateY(${parallaxOffset * 0.3}px)`,
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute rounded-full opacity-10"
          style={{
            width: 400,
            height: 400,
            background: "#3b82f6",
            bottom: -80,
            left: -100,
            transform: `translateY(${parallaxOffset * -0.2}px)`,
            filter: "blur(60px)",
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
            style={{ background: `${BUCKS_COLOR}30`, color: BUCKS_COLOR, border: `1px solid ${BUCKS_COLOR}50` }}
          >
            <Percent className="h-4 w-4" />
            25% Commission on Every Sale
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight max-w-3xl mb-6">
            Earn with the{" "}
            <span style={{ color: BUCKS_COLOR }}>Better Bucks</span>{" "}
            Affiliate Program
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mb-8">
            Share Better Bucks with your audience and earn a{" "}
            <strong className="text-white">25% commission</strong> on every subscription
            that comes through your unique referral link — for the entire lifetime of the customer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}
              className="text-base px-8 py-6 font-bold shadow-xl"
              style={{ background: BUCKS_COLOR, color: "white" }}
              data-testid="button-hero-apply"
            >
              Apply Now — It's Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("commission-slider")?.scrollIntoView({ behavior: "smooth" })}
              className="text-base px-8 py-6 border-white/30 text-white hover:bg-white/10"
              data-testid="button-hero-see-earnings"
            >
              See Your Earnings
            </Button>
          </div>
          {/* Scroll cue */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60 animate-bounce">
            <span className="text-xs text-white uppercase tracking-widest">Scroll</span>
            <div className="w-px h-8 bg-white/40" />
          </div>
        </div>
      </div>

      {/* ── BENEFIT BADGES ────────────────────────────────────────── */}
      <div className="bg-white py-14 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-8">
          {[
            { icon: DollarSign, title: "25% Commission", desc: "Earn a quarter of every sale you refer — one of the highest rates in the industry." },
            { icon: Users, title: "Lifetime Earnings", desc: "You earn commission for as long as customers you refer stay subscribed." },
            { icon: TrendingUp, title: "Real-Time Dashboard", desc: "Track your clicks, conversions, and payouts in your affiliate dashboard." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}18` }}>
                <Icon className="h-6 w-6" style={{ color: BUCKS_COLOR }} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── COMMISSION SLIDER ─────────────────────────────────────── */}
      <div id="commission-slider" className="py-20 px-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: BUCKS_COLOR }}>The Math Is Simple</p>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">How Much Could You Earn?</h2>
            <p className="text-gray-500 text-lg">Drag the slider to see your potential monthly commission at 25%.</p>
          </div>

          {/* Slider card */}
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Referred Monthly Sales</p>
                <p className="text-4xl font-extrabold text-gray-900" data-testid="text-sales-amount">{formatCurrency(salesAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Your 25% Commission</p>
                <p className="text-4xl font-extrabold" style={{ color: BUCKS_COLOR }} data-testid="text-commission-amount">{formatCurrency(commission)}</p>
              </div>
            </div>

            {/* Track */}
            <div className="relative my-8">
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${((salesAmount - 1000) / (200000 - 1000)) * 100}%`,
                    background: `linear-gradient(90deg, ${BUCKS_COLOR}, #3b82f6)`,
                  }}
                />
              </div>
              <input
                type="range"
                min={1000}
                max={200000}
                step={1000}
                value={salesAmount}
                onChange={e => setSalesAmount(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
                style={{ zIndex: 2 }}
                data-testid="slider-sales"
              />
              {/* Custom thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full shadow-lg border-2 border-white transition-all duration-150"
                style={{
                  left: `calc(${((salesAmount - 1000) / (200000 - 1000)) * 100}% - 12px)`,
                  background: BUCKS_COLOR,
                  zIndex: 1,
                }}
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-400">
              <span>$1K/mo</span>
              <span>$50K/mo</span>
              <span>$100K/mo</span>
              <span>$200K/mo</span>
            </div>

            {/* Example tiers */}
            <div className="grid grid-cols-3 gap-4 mt-10">
              {[
                { label: "Side Hustle", sales: 5000 },
                { label: "Part-Time", sales: 25000 },
                { label: "Full-Time", sales: 80000 },
              ].map(({ label, sales }) => (
                <button
                  key={label}
                  onClick={() => setSalesAmount(sales)}
                  className="rounded-xl py-3 px-2 text-center border transition-all text-sm font-medium cursor-pointer"
                  style={salesAmount === sales
                    ? { background: `${BUCKS_COLOR}15`, borderColor: BUCKS_COLOR, color: BUCKS_COLOR }
                    : { background: "#f8fafc", borderColor: "#e5e7eb", color: "#6b7280" }}
                  data-testid={`button-tier-${label.toLowerCase().replace(" ", "-")}`}
                >
                  <div className="font-bold">{label}</div>
                  <div className="text-xs mt-0.5">{formatCurrency(sales)}/mo sales</div>
                  <div className="font-bold mt-1" style={{ color: BUCKS_COLOR }}>{formatCurrency(Math.round(sales * 0.25))}/mo</div>
                </button>
              ))}
            </div>
          </div>

          {/* Info callout */}
          <div className="mt-6 flex items-start gap-3 p-4 rounded-xl" style={{ background: `${BUCKS_COLOR}0f`, border: `1px solid ${BUCKS_COLOR}30` }}>
            <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />
            <p className="text-sm" style={{ color: NAVY }}>
              <strong>25% commission</strong> is paid on every successful subscription payment made by customers you refer using your unique affiliate code. Payouts are processed monthly.
            </p>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <div className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: BUCKS_COLOR }}>Simple Process</p>
            <h2 className="text-4xl font-extrabold text-gray-900">How the Affiliate Program Works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-10 relative">
            {[
              { step: "01", title: "Apply Below", desc: "Fill out the affiliate sign-up form with your contact details and your platform link." },
              { step: "02", title: "Get Your Code", desc: "Once approved, you'll receive a unique referral code and custom link to share." },
              { step: "03", title: "Earn 25%", desc: "Every customer who signs up using your code earns you 25% commission, month after month." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-md" style={{ background: NAVY }}>
                  {step}
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SIGN-UP FORM ──────────────────────────────────────────── */}
      <div
        id="signup-form"
        className="relative py-24 px-6 overflow-hidden"
        style={{ background: NAVY }}
      >
        {/* Parallax background accent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 80% 20%, ${BUCKS_COLOR}20 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, #3b82f620 0%, transparent 60%)`,
            transform: `translateY(${(scrollY - 2000) * -0.1}px)`,
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
              style={{ background: `${BUCKS_COLOR}30`, color: BUCKS_COLOR, border: `1px solid ${BUCKS_COLOR}50` }}
            >
              <Send className="h-4 w-4" />
              Affiliate Application
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4">Join the Program</h2>
            <p className="text-blue-200 text-lg">
              Apply today and start earning 25% on every sale. We review applications within 1–2 business days.
            </p>
          </div>

          {submitted ? (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${BUCKS_COLOR}30` }}>
                <CheckCircle2 className="h-9 w-9" style={{ color: BUCKS_COLOR }} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Application Received!</h3>
              <p className="text-blue-200 leading-relaxed">
                Thanks for applying to the Better Bucks Affiliate Program. We'll review your application and reach out to you within 1–2 business days with next steps.
              </p>
              <Button
                className="mt-8"
                style={{ background: BUCKS_COLOR, color: "white" }}
                onClick={() => setLocation("/")}
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 sm:p-10 space-y-5"
              data-testid="form-affiliate"
            >
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="aff-name" className="text-white font-medium">Full Name <span className="text-red-400">*</span></Label>
                <Input
                  id="aff-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  required
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/50"
                  data-testid="input-affiliate-name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="aff-email" className="text-white font-medium">Email Address <span className="text-red-400">*</span></Label>
                <Input
                  id="aff-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="jane@example.com"
                  required
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/50"
                  data-testid="input-affiliate-email"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="aff-phone" className="text-white font-medium">Phone Number <span className="text-red-400">*</span></Label>
                <Input
                  id="aff-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                  required
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/50"
                  data-testid="input-affiliate-phone"
                />
              </div>

              {/* Webpage / Social Media */}
              <div className="space-y-1.5">
                <Label htmlFor="aff-webpage" className="text-white font-medium flex items-center gap-2">
                  <Link className="h-4 w-4 opacity-70" />
                  Your Webpage / Social Media Page <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="aff-webpage"
                  name="webpage"
                  type="url"
                  value={form.webpage}
                  onChange={handleChange}
                  placeholder="https://yourwebsite.com or https://instagram.com/yourhandle"
                  required
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/50"
                  data-testid="input-affiliate-webpage"
                />
                <p className="text-xs text-blue-300">Link to your website, YouTube channel, Instagram, TikTok, LinkedIn, or any other platform.</p>
              </div>

              {/* Additional Info */}
              <div className="space-y-1.5">
                <Label htmlFor="aff-info" className="text-white font-medium">Additional Information</Label>
                <Textarea
                  id="aff-info"
                  name="additionalInfo"
                  value={form.additionalInfo}
                  onChange={handleChange}
                  placeholder="Tell us about your audience, how you plan to promote Better Bucks, your niche, approximate follower count, etc."
                  rows={4}
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/50 resize-none"
                  data-testid="input-affiliate-info"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full text-base font-bold py-6 mt-2"
                style={{ background: BUCKS_COLOR, color: "white" }}
                data-testid="button-submit-affiliate"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </Button>

              <p className="text-center text-xs text-blue-300">
                By submitting, you agree to our{" "}
                <button type="button" className="underline hover:text-white" onClick={() => setLocation("/terms")}>
                  Terms of Service
                </button>
                . We review every application personally.
              </p>
            </form>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
