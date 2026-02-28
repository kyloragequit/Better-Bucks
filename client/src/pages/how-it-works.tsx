import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronDown,
  Gamepad2,
  Tv,
  PersonStanding,
  ShoppingBag,
  Coins,
  Star,
} from "lucide-react";

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
  {
    icon: Gamepad2,
    name: "Gaming Controller",
    description: "Latest wireless controller, compatible with all major consoles.",
    price: 150,
    stars: 5,
    tag: "Popular",
  },
  {
    icon: Tv,
    name: "Smart TV 55\"",
    description: "4K Ultra HD smart TV with built-in streaming apps.",
    price: 450,
    stars: 4,
    tag: "Top Pick",
  },
  {
    icon: PersonStanding,
    name: "Collector Action Figure",
    description: "Limited-edition poseable action figure, 12\" tall.",
    price: 75,
    stars: 5,
    tag: "New",
  },
];

export default function HowItWorksPage() {
  const [, setLocation] = useLocation();

  const s1 = useInView(0.2);
  const s2 = useInView(0.2);
  const s3 = useInView(0.15);

  return (
    <div className="relative">
      <PageSEO
        title="How It Works – Automated Incentive Tracking for Shift-Based Teams | Better Bucks"
        description="Replace your spreadsheet reward system in minutes. Operations and HR managers get full performance visibility — hourly employees earn Bucks for safety compliance, attendance, and KPIs, then redeem them in your company store."
        canonicalPath="/how-it-works"
      />

      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <AppLogo size="sm" linkTo="/" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* ─── SECTION 1: The Question ──────────────────────────────────── */}
      <div className="relative" style={{ height: "100vh" }}>
        <section
          className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{ background: NAVY, zIndex: 10 }}
        >
          <div
            ref={s1.ref}
            className="flex flex-col items-center text-center px-6 max-w-3xl"
            style={{
              opacity: s1.inView ? 1 : 0,
              transform: s1.inView ? "translateY(0)" : "translateY(32px)",
              transition: "opacity 0.9s ease, transform 0.9s ease",
            }}
          >
            <AppLogo size="lg" />
            <h1
              className="mt-10 text-white font-display font-bold leading-tight"
              style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
              data-testid="text-parallax-question"
            >
              Have you ever felt like you don't know what will make your employees happy?
            </h1>
            <p className="mt-4 text-white/50 text-sm tracking-widest uppercase">
              Scroll to find out
            </p>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>

          {/* subtle radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, ${BUCKS_COLOR}18 0%, transparent 70%)`,
            }}
          />
        </section>
      </div>

      {/* ─── SECTION 2: The Answer ───────────────────────────────────── */}
      <div className="relative" style={{ height: "100vh" }}>
        <section
          className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden bg-white"
          style={{ zIndex: 20 }}
        >
          <div
            ref={s2.ref}
            className="flex flex-col items-center text-center px-6 max-w-2xl"
            style={{
              opacity: s2.inView ? 1 : 0,
              transform: s2.inView ? "scale(1)" : "scale(0.92)",
              transition: "opacity 0.8s ease, transform 0.8s ease",
            }}
          >
            <h2
              className="font-display font-black leading-none tracking-tight"
              style={{
                fontSize: "clamp(4rem, 12vw, 9rem)",
                color: NAVY,
              }}
              data-testid="text-parallax-answer"
            >
              Now you can.
            </h2>
            <p
              className="mt-6 text-lg text-gray-500 max-w-md"
            >
              Better Bucks gives employees the power to choose what matters to them — redeemable from a curated store you control.
            </p>
            <div
              className="mt-8 h-1.5 w-24 rounded-full"
              style={{ background: BUCKS_COLOR }}
            />
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-300">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
        </section>
      </div>

      {/* ─── SECTION 3: The Shop ─────────────────────────────────────── */}
      <div className="relative" style={{ minHeight: "100vh" }}>
        <section
          className="sticky top-0 min-h-screen flex flex-col items-center justify-center overflow-hidden py-20"
          style={{ background: "#F0F4F8", zIndex: 30 }}
        >
          <div
            ref={s3.ref}
            className="w-full max-w-3xl mx-auto px-4"
            style={{
              opacity: s3.inView ? 1 : 0,
              transform: s3.inView ? "translateY(0)" : "translateY(40px)",
              transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
            }}
          >
            {/* Mock app window */}
            <div
              className="rounded-2xl overflow-hidden shadow-2xl border border-white/60"
              style={{ background: "#fff" }}
            >
              {/* Mock app header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ background: NAVY }}
              >
                <div className="flex items-center gap-2">
                  <AppLogo size="sm" />
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">Better Bucks Store</p>
                    <p className="text-white/50 text-xs">Acme Corp</p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: BUCKS_COLOR, color: "white" }}
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>850 Bucks</span>
                </div>
              </div>

              {/* Product grid */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="h-4 w-4" style={{ color: NAVY }} />
                  <h3 className="font-semibold text-sm" style={{ color: NAVY }}>
                    Redeem Your Bucks
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {products.map((p, i) => {
                    const Icon = p.icon;
                    const canAfford = 850 >= p.price;
                    return (
                      <div
                        key={p.name}
                        className="rounded-xl border border-gray-100 overflow-hidden flex flex-col"
                        style={{
                          background: "#F8FAFC",
                          opacity: s3.inView ? 1 : 0,
                          transform: s3.inView ? "translateY(0)" : "translateY(20px)",
                          transition: `opacity 0.6s ease ${0.2 + i * 0.12}s, transform 0.6s ease ${0.2 + i * 0.12}s`,
                        }}
                        data-testid={`card-product-${i}`}
                      >
                        {/* Badge */}
                        <div className="flex justify-end px-3 pt-3">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${BUCKS_COLOR}22`, color: BUCKS_COLOR }}
                          >
                            {p.tag}
                          </span>
                        </div>

                        {/* Icon */}
                        <div className="flex justify-center py-4">
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: `${NAVY}12` }}
                          >
                            <Icon className="h-8 w-8" style={{ color: NAVY }} />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="px-4 pb-4 flex flex-col gap-2 flex-1">
                          <p className="font-bold text-sm leading-tight" style={{ color: NAVY }}>
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-400 leading-snug flex-1">
                            {p.description}
                          </p>

                          {/* Stars */}
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, si) => (
                              <Star
                                key={si}
                                className="h-3 w-3"
                                style={{
                                  fill: si < p.stars ? "#f59e0b" : "none",
                                  color: si < p.stars ? "#f59e0b" : "#d1d5db",
                                }}
                              />
                            ))}
                          </div>

                          {/* Price + Button */}
                          <div className="flex items-center justify-between mt-1">
                            <span
                              className="font-black text-base"
                              style={{ color: BUCKS_COLOR }}
                              data-testid={`text-price-${i}`}
                            >
                              {p.price} Bucks
                            </span>
                          </div>
                          <button
                            className="w-full py-2 rounded-lg text-sm font-semibold transition-opacity"
                            style={{
                              background: canAfford ? BUCKS_COLOR : "#e5e7eb",
                              color: canAfford ? "white" : "#9ca3af",
                              cursor: canAfford ? "pointer" : "not-allowed",
                            }}
                            data-testid={`button-redeem-${i}`}
                            disabled={!canAfford}
                          >
                            {canAfford ? "Redeem" : "Not Enough Bucks"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-gray-400 mt-6">
              Admins curate the store. Employees choose what they love.
            </p>
          </div>
        </section>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="relative border-t py-6 text-sm text-gray-400 flex items-center justify-center gap-2"
        style={{ background: "#fff", zIndex: 40 }}
      >
        <AppLogo size="sm" />
        <span>Better Bucks LLC</span>
      </footer>
    </div>
  );
}
