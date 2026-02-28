import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Gamepad2,
  Tv,
  PersonStanding,
  ShoppingBag,
  Coins,
  Star,
  CheckCircle2,
  Package,
  Truck,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const BUCKS_COLOR = "#4E9F3D";
const NAVY = "#162A4A";

const products = [
  { icon: Gamepad2, name: "Gaming Controller", description: "Latest wireless controller, compatible with all major consoles.", price: 150, stars: 5, tag: "Popular" },
  { icon: Tv, name: 'Smart TV 55"', description: "4K Ultra HD smart TV with built-in streaming apps.", price: 450, stars: 4, tag: "Top Pick" },
  { icon: PersonStanding, name: "Collector Action Figure", description: "Limited-edition poseable action figure, 12\" tall.", price: 75, stars: 5, tag: "New" },
];

export default function HowItWorksPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const s1 = useInView(0.2);
  const s2 = useInView(0.2);
  const s3 = useInView(0.15);
  const s4 = useInView(0.15);

  const [selectedProduct, setSelectedProduct] = useState(0);
  const [orderMode, setOrderMode] = useState(false);
  const [orderStep, setOrderStep] = useState(0);

  const handleSelect = (i: number) => {
    setSelectedProduct(i);
    setOrderStep(0);
    setOrderMode(true);
  };

  useEffect(() => {
    if (!orderMode) return;
    setOrderStep(0);
    const t1 = setTimeout(() => setOrderStep(1), 1400);
    const t2 = setTimeout(() => setOrderStep(2), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [orderMode, selectedProduct]);

  const handleBackToShop = () => {
    setOrderMode(false);
    setOrderStep(0);
  };

  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", email: "", phone: "", needs: "" });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSent, setDemoSent] = useState(false);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitting(true);
    try {
      await apiRequest("POST", "/api/info-request", demoForm);
      setDemoSent(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setDemoSubmitting(false);
    }
  };

  const selectedP = products[selectedProduct];
  const SelectedIcon = selectedP.icon;

  return (
    <div className="relative">
      <PageSEO
        title="How It Works – Automated Incentive Tracking for Shift-Based Teams | Better Bucks"
        description="Replace your spreadsheet reward system in minutes. Operations and HR managers get full performance visibility — hourly employees earn Bucks for safety compliance, attendance, and KPIs, then redeem them in your company store."
        canonicalPath="/how-it-works"
      />

      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            data-testid="link-home-logo"
          >
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="button-header-login">
              Log In
            </Button>
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup" style={{ background: BUCKS_COLOR, color: "white" }}>
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* ─── SECTION 1: The Question ──────────────────────────────── */}
      <div className="relative" style={{ height: "100vh" }}>
        <section className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: NAVY, zIndex: 10 }}>
          <div
            ref={s1.ref}
            className="flex flex-col items-center text-center px-6 max-w-3xl"
            style={{ opacity: s1.inView ? 1 : 0, transform: s1.inView ? "translateY(0)" : "translateY(32px)", transition: "opacity 0.9s ease, transform 0.9s ease" }}
          >
            <AppLogo size="lg" />
            <h1 className="mt-10 text-white font-display font-bold leading-tight" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }} data-testid="text-parallax-question">
              Have you ever felt like you don't know what will make your employees happy?
            </h1>
            <p className="mt-4 text-white/50 text-sm tracking-widest uppercase">Scroll to find out</p>
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${BUCKS_COLOR}18 0%, transparent 70%)` }} />
        </section>
      </div>

      {/* ─── SECTION 2: The Answer ────────────────────────────────── */}
      <div className="relative" style={{ height: "100vh" }}>
        <section className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden bg-white" style={{ zIndex: 20 }}>
          <div
            ref={s2.ref}
            className="flex flex-col items-center text-center px-6 max-w-2xl"
            style={{ opacity: s2.inView ? 1 : 0, transform: s2.inView ? "scale(1)" : "scale(0.92)", transition: "opacity 0.8s ease, transform 0.8s ease" }}
          >
            <h2 className="font-display font-black leading-none tracking-tight" style={{ fontSize: "clamp(4rem, 12vw, 9rem)", color: NAVY }} data-testid="text-parallax-answer">
              Now you can.
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-md">
              Better Bucks gives employees the power to choose what matters to them — redeemable from a curated store you control.
            </p>
            <div className="mt-8 h-1.5 w-24 rounded-full" style={{ background: BUCKS_COLOR }} />
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-300">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
        </section>
      </div>

      {/* ─── SECTION 3: Shop + Order Flow (merged) ────────────────── */}
      <div className="relative sm:h-[140vh]">
        <section className="sm:sticky sm:top-0 sm:h-screen flex flex-col items-center justify-center overflow-y-auto sm:overflow-hidden py-8 sm:py-10" style={{ background: "#F0F4F8", zIndex: 30 }}>
          <div
            ref={s3.ref}
            className="w-full max-w-4xl mx-auto px-4"
            style={{ opacity: s3.inView ? 1 : 0, transform: s3.inView ? "translateY(0)" : "translateY(40px)", transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s" }}
          >
            {/* Headline — always visible */}
            <div className="text-center mb-6">
              <h2
                className="font-display font-black leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)", color: NAVY }}
                data-testid="text-shop-headline"
              >
                Admins curate the shop and easily{" "}
                <span style={{ color: BUCKS_COLOR }}>reward employees with what they want.</span>
              </h2>
              <p className="mt-2 text-gray-500 text-sm max-w-lg mx-auto">
                Build your company store in minutes — employees spend what they've earned, no guesswork.
              </p>
            </div>

            {/* Sliding panel container — fixed height so both views keep the same box size */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/60" style={{ background: "#fff", height: 340 }}>

              {/* ── Shop view ─────────────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: orderMode ? 0 : 1,
                  transform: orderMode ? "translateX(-48px)" : "translateX(0)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  pointerEvents: orderMode ? "none" : "auto",
                }}
              >
                {/* Mock app header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <div>
                      <p className="text-white font-bold text-sm leading-tight">Better Bucks Store</p>
                      <p className="text-white/50 text-xs">Acme Corp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: BUCKS_COLOR, color: "white" }}>
                    <Coins className="h-3.5 w-3.5" />
                    <span>850 Bucks</span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="h-4 w-4" style={{ color: NAVY }} />
                    <h3 className="font-semibold text-sm" style={{ color: NAVY }}>Redeem Your Bucks</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {products.map((p, i) => {
                      const Icon = p.icon;
                      return (
                        <div
                          key={p.name}
                          className="rounded-xl border overflow-hidden flex flex-col cursor-pointer"
                          style={{
                            background: selectedProduct === i ? `${NAVY}08` : "#F8FAFC",
                            border: selectedProduct === i ? `2px solid ${BUCKS_COLOR}` : "1px solid #f0f0f0",
                            opacity: s3.inView ? 1 : 0,
                            transform: s3.inView ? "translateY(0)" : "translateY(20px)",
                            transition: `opacity 0.6s ease ${0.2 + i * 0.12}s, transform 0.6s ease ${0.2 + i * 0.12}s, border 0.15s, background 0.15s`,
                          }}
                          onClick={() => handleSelect(i)}
                          data-testid={`card-product-${i}`}
                        >
                          <div className="flex justify-end px-2 pt-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BUCKS_COLOR}22`, color: BUCKS_COLOR }}>{p.tag}</span>
                          </div>
                          <div className="flex justify-center py-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${NAVY}12` }}>
                              <Icon className="h-6 w-6" style={{ color: NAVY }} />
                            </div>
                          </div>
                          <div className="px-3 pb-3 flex flex-col gap-1.5 flex-1">
                            <p className="font-bold text-xs leading-tight" style={{ color: NAVY }}>{p.name}</p>
                            <p className="text-xs text-gray-400 leading-snug flex-1">{p.description}</p>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <Star key={si} className="h-2.5 w-2.5" style={{ fill: si < p.stars ? "#f59e0b" : "none", color: si < p.stars ? "#f59e0b" : "#d1d5db" }} />
                              ))}
                            </div>
                            <span className="font-black text-sm" style={{ color: BUCKS_COLOR }} data-testid={`text-price-${i}`}>{p.price} Bucks</span>
                            <button
                              className="w-full py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: BUCKS_COLOR, color: "white" }}
                              onClick={(e) => { e.stopPropagation(); handleSelect(i); }}
                              data-testid={`button-redeem-${i}`}
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">Select any item to see how ordering works</p>
                </div>
              </div>

              {/* ── Order flow view ────────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: orderMode ? 1 : 0,
                  transform: orderMode ? "translateX(0)" : "translateX(48px)",
                  transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
                  pointerEvents: orderMode ? "auto" : "none",
                }}
              >
                {/* Order view header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBackToShop}
                      className="text-white/60 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
                      data-testid="button-back-to-shop"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <AppLogo size="sm" />
                      <div>
                        <p className="text-white font-bold text-sm leading-tight">My Order</p>
                        <p className="text-white/50 text-xs">Acme Corp</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: `${BUCKS_COLOR}40`, color: "white" }}>
                    <Coins className="h-3.5 w-3.5" />
                    <span>{850 - selectedP.price} Bucks left</span>
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-4 min-h-[200px] sm:min-h-[260px]">
                  {/* Step indicators */}
                  <div className="flex items-center gap-2 justify-center">
                    {["Select", "Confirm", "Ordered!"].map((label, i) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                          style={{ background: orderStep >= i ? BUCKS_COLOR : "#e5e7eb", color: orderStep >= i ? "white" : "#9ca3af" }}
                        >
                          {orderStep > i ? "✓" : i + 1}
                        </div>
                        <span className="text-xs" style={{ color: orderStep >= i ? NAVY : "#9ca3af" }}>{label}</span>
                        {i < 2 && <div className="w-6 h-px" style={{ background: orderStep > i ? BUCKS_COLOR : "#e5e7eb" }} />}
                      </div>
                    ))}
                  </div>

                  {/* Step 0: Confirm screen */}
                  <div
                    style={{
                      opacity: orderStep === 0 ? 1 : 0,
                      transform: orderStep === 0 ? "translateX(0)" : "translateX(-24px)",
                      transition: "opacity 0.35s ease, transform 0.35s ease",
                      position: orderStep === 0 ? "relative" : "absolute",
                      pointerEvents: orderStep === 0 ? "auto" : "none",
                      width: "100%",
                    }}
                    className="flex flex-col gap-3"
                  >
                    <div className="rounded-xl border border-gray-100 p-4 flex items-center gap-4" style={{ background: "#F8FAFC" }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${NAVY}12` }}>
                        <SelectedIcon className="h-6 w-6" style={{ color: NAVY }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: NAVY }}>{selectedP.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{selectedP.description}</p>
                        <p className="font-black text-sm mt-0.5" style={{ color: BUCKS_COLOR }}>{selectedP.price} Bucks</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-gray-100 p-3 flex flex-col" style={{ background: "#F8FAFC" }}>
                        <span className="text-xs text-gray-400">Your Balance</span>
                        <span className="font-bold text-sm" style={{ color: BUCKS_COLOR }}>850 Bucks</span>
                      </div>
                      <div className="rounded-xl border border-gray-100 p-3 flex flex-col" style={{ background: "#F8FAFC" }}>
                        <span className="text-xs text-gray-400">Remaining After</span>
                        <span className="font-bold text-sm" style={{ color: NAVY }}>{850 - selectedP.price} Bucks</span>
                      </div>
                    </div>
                    <button className="w-full py-2.5 rounded-xl font-bold text-white text-sm" style={{ background: BUCKS_COLOR, animation: "pulse 2s infinite" }}>
                      Confirm Order
                    </button>
                  </div>

                  {/* Step 1: Processing */}
                  {orderStep === 1 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-6">
                      <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${BUCKS_COLOR}33`, borderTopColor: BUCKS_COLOR }} />
                      <p className="font-semibold text-sm" style={{ color: NAVY }}>Processing your order…</p>
                    </div>
                  )}

                  {/* Step 2: Confirmed */}
                  {orderStep === 2 && (
                    <div className="flex flex-col items-center justify-center gap-3 text-center py-4" style={{ animation: "fadeUp 0.5s ease forwards" }}>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}18` }}>
                        <CheckCircle2 className="h-8 w-8" style={{ color: BUCKS_COLOR }} />
                      </div>
                      <p className="font-black text-xl" style={{ color: NAVY }}>Order Placed!</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Package className="h-3.5 w-3.5" />
                        <span>{selectedP.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `${BUCKS_COLOR}18`, color: BUCKS_COLOR }}>
                        <Truck className="h-3 w-3" />
                        <span>Your manager will fulfill your request</span>
                      </div>
                      <button
                        onClick={handleBackToShop}
                        className="mt-1 text-xs underline underline-offset-2 text-gray-400 hover:text-gray-600 transition-colors"
                        data-testid="button-back-after-order"
                      >
                        ← Browse more items
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-400">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
        </section>
      </div>

      {/* ─── SECTION 4: CTA ───────────────────────────────────────── */}
      <div className="relative" style={{ minHeight: "100vh" }}>
        <section className="sticky top-0 min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-24" style={{ background: NAVY, zIndex: 40 }}>
          <div
            ref={s4.ref}
            className="w-full max-w-4xl mx-auto"
            style={{ opacity: s4.inView ? 1 : 0, transform: s4.inView ? "translateY(0)" : "translateY(30px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}
          >
            {!demoOpen ? (
              <div className="flex flex-col items-center text-center gap-6">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 text-white/60 text-xs font-semibold tracking-widest uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ready to get started?
                </div>
                <h2
                  className="font-display font-black text-white leading-tight"
                  style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
                  data-testid="text-cta-headline"
                >
                  Your team deserves better.
                </h2>
                <p className="text-white/60 text-lg max-w-xl">
                  Launch a rewards program your employees will actually love — in minutes, not months.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full max-w-md">
                  <button
                    onClick={() => setLocation("/signup")}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{ background: BUCKS_COLOR }}
                    data-testid="button-cta-signup"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDemoOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white text-base border-2 border-white/30 transition-all duration-200 hover:border-white/60 hover:bg-white/10 active:scale-95"
                    data-testid="button-cta-demo"
                  >
                    Request a Demo
                  </button>
                </div>
                <p className="text-white/30 text-xs mt-2">No credit card required to get started.</p>
              </div>
            ) : (
              <div className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden shadow-2xl" style={{ background: "white" }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <p className="text-white font-bold text-sm">Request a Demo</p>
                  </div>
                  <button onClick={() => { setDemoOpen(false); setDemoSent(false); }} className="text-white/50 hover:text-white transition-colors" data-testid="button-close-demo">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {demoSent ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}18` }}>
                      <CheckCircle2 className="h-8 w-8" style={{ color: BUCKS_COLOR }} />
                    </div>
                    <h3 className="font-bold text-xl" style={{ color: NAVY }}>Request Received!</h3>
                    <p className="text-gray-500 text-sm max-w-xs">We'll reach out within one business day to schedule your personalized demo.</p>
                    <button
                      className="mt-2 px-6 py-2 rounded-xl font-semibold text-white text-sm"
                      style={{ background: BUCKS_COLOR }}
                      onClick={() => { setDemoOpen(false); setDemoSent(false); setDemoForm({ name: "", email: "", phone: "", needs: "" }); }}
                      data-testid="button-demo-close-success"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit} className="p-6 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-name" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name</Label>
                        <Input id="demo-name" placeholder="Jane Smith" value={demoForm.name} onChange={e => setDemoForm(f => ({ ...f, name: e.target.value }))} required autoComplete="name" data-testid="input-demo-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-email" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Work Email</Label>
                        <Input id="demo-email" type="email" placeholder="jane@company.com" value={demoForm.email} onChange={e => setDemoForm(f => ({ ...f, email: e.target.value }))} required autoComplete="email" data-testid="input-demo-email" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="demo-phone" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone Number</Label>
                      <Input id="demo-phone" type="tel" placeholder="+1 (555) 000-0000" value={demoForm.phone} onChange={e => setDemoForm(f => ({ ...f, phone: e.target.value }))} required autoComplete="tel" data-testid="input-demo-phone" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="demo-needs" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">What are your incentive goals?</Label>
                      <Textarea id="demo-needs" placeholder="e.g. We want to improve attendance and safety compliance for our 120 warehouse employees..." rows={3} value={demoForm.needs} onChange={e => setDemoForm(f => ({ ...f, needs: e.target.value }))} required data-testid="input-demo-needs" />
                    </div>
                    <button type="submit" disabled={demoSubmitting} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60" style={{ background: BUCKS_COLOR }} data-testid="button-demo-submit">
                      {demoSubmitting ? "Sending…" : (<><Send className="h-4 w-4" /> Send Request</>)}
                    </button>
                    <p className="text-center text-xs text-gray-400">
                      Or{" "}
                      <button type="button" className="underline underline-offset-2 hover:text-gray-700" onClick={() => setLocation("/signup")}>
                        sign up and start free today
                      </button>
                    </p>
                  </form>
                )}
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 60% 40%, ${BUCKS_COLOR}15 0%, transparent 65%)` }} />
        </section>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer className="relative border-t py-6 text-sm text-gray-400 flex items-center justify-center gap-2" style={{ background: "#fff", zIndex: 50 }}>
        <AppLogo size="sm" />
        <span>Better Bucks LLC</span>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
