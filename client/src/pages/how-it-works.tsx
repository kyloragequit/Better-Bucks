import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { ROICalculator } from "@/components/roi-calculator";
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
  Truck,
  Send,
  X,
  Sparkles,
  ClipboardList,
  BookOpen,
  Play,
  BarChart2,
  Users,
  Zap,
  Menu,
  LogIn,
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
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const s1 = useInView(0.2);
  const s2 = useInView(0.2);
  const s3 = useInView(0.15);
  const sSurvey = useInView(0.15);
  const s4 = useInView(0.15);

  const [selectedProduct, setSelectedProduct] = useState(0);
  const [orderMode, setOrderMode] = useState(false);
  const [orderStep, setOrderStep] = useState(0);

  const [surveyQ1, setSurveyQ1] = useState<number | null>(null);
  const [surveyQ2, setSurveyQ2] = useState<number | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);

  const surveyQ1Options = [
    "Recognition from my manager",
    "Earning Bucks rewards",
    "Clear goals and targets",
    "Team camaraderie",
  ];
  const surveyQ2Options = [
    "Very satisfied",
    "Satisfied",
    "Neutral",
    "Not satisfied",
  ];
  const surveyResults1 = [42, 33, 17, 8];
  const surveyResults2 = [41, 33, 17, 9];

  const handleSurveySubmit = () => {
    setSurveyStep(1);
    setTimeout(() => setSurveyStep(2), 1100);
  };
  const handleSurveyReset = () => {
    setSurveyQ1(null);
    setSurveyQ2(null);
    setSurveyStep(0);
  };

  const SCROLLING_WORDS = [
    "Attendance", "Safety", "Productivity", "Performance", "Teamwork",
    "Punctuality", "Efficiency", "Quality", "Innovation", "Initiative",
    "Leadership", "Reliability", "Engagement", "Collaboration", "Accountability",
    "Improvement", "Compliance", "Sales", "Retention", "Training",
    "Certification", "Mentorship", "Communication", "Consistency", "Customer Service",
  ];
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIdx(i => (i + 1) % SCROLLING_WORDS.length);
        setWordVisible(true);
      }, 320);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

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

  const [activeTab, setActiveTab] = useState(0);
  const [rewardStep, setRewardStep] = useState(0);
  const [rewardEmployee, setRewardEmployee] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount] = useState(100);
  const [rewardReason, setRewardReason] = useState<string | null>(null);

  const handleRewardSend = () => {
    setRewardStep(2);
  };

  const handleRewardReset = () => {
    setRewardStep(0);
    setRewardEmployee(null);
    setRewardReason(null);
    setRewardAmount(100);
  };

  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", email: "", phone: "", needs: "" });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSent, setDemoSent] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const startPublicDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo/public-login", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start demo");
      if (data.userId) {
        localStorage.removeItem(`bb_tutorial_type_${data.userId}`);
        localStorage.setItem(`bb_tutorial_type_${data.userId}`, "full");
      }
      try { sessionStorage.setItem("bb_demo_visitor", "1"); } catch {}
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/admin/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDemoLoading(false);
    }
  };

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
        title="Reward Employees Faster — Stop Manual Incentive Tracking | Better Bucks"
        description="Better Bucks lets managers reward employees instantly — one tap to give Bucks, a curated store for redemption, and budget tracking built in. Replace spreadsheets and recognize performance in seconds, not hours."
        canonicalPath="/how-it-works"
        keywords="how employee incentive software works, replace spreadsheet reward system, employee engagement solution, safety compliance rewards, performance visibility tool, reward program management demo, frontline worker incentives, automated incentive tracking, reward employees faster, instant employee recognition"
        jsonLd={[
          {
            "@type": "Organization",
            "@id": "https://betterbucks.net/#organization",
            "name": "Better Bucks",
            "url": "https://betterbucks.net",
            "logo": {
              "@type": "ImageObject",
              "@id": "https://betterbucks.net/#logo",
              "url": "https://betterbucks.net/favicon.png",
              "width": 512,
              "height": 512,
              "caption": "Better Bucks"
            },
            "image": { "@id": "https://betterbucks.net/#logo" },
            "description": "Better Bucks is employee incentive software for logistics, warehousing, and manufacturing. Reward employees instantly with Bucks — replace spreadsheets with a platform that lets you recognize performance in seconds.",
            "email": "miles.chase@betterbucks.net",
            "sameAs": ["https://www.instagram.com/better_bucks"]
          },
          {
            "@type": "WebSite",
            "@id": "https://betterbucks.net/#website",
            "url": "https://betterbucks.net",
            "name": "Better Bucks",
            "publisher": { "@id": "https://betterbucks.net/#organization" }
          },
          {
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How fast can I reward an employee with Better Bucks?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Managers can give Bucks to any employee in under 10 seconds — just select the employee, choose an amount, pick a reason, and tap Send. The employee's balance updates instantly. No approvals, no paperwork, no delays."
                }
              },
              {
                "@type": "Question",
                "name": "How does Better Bucks replace a manual spreadsheet reward system?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Managers award Bucks through a simple dashboard. Employees see their balance instantly. No spreadsheets, no manual calculations, no inconsistent recognition — just a clear, auditable record of every award and redemption."
                }
              },
              {
                "@type": "Question",
                "name": "How do employees redeem their Bucks?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Each organization gets a private company store where employees browse and select items. When an employee chooses an item, the order is submitted to the admin for fulfillment — keeping the entire reward program management process in one place."
                }
              },
              {
                "@type": "Question",
                "name": "How does Better Bucks help managers track their incentive budget?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The admin dashboard shows a full budget overview — total Bucks allocated, how many have been awarded, and a breakdown by category (safety, attendance, performance). Managers save hours of manual tracking every month with full audit history."
                }
              }
            ]
          }
        ]}
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
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/affiliate")} data-testid="button-header-affiliate">
              Affiliate Program
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/blog")} data-testid="button-header-blog">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Blog
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="button-header-login">
              <LogIn className="mr-1.5 h-4 w-4" />
              Log In
            </Button>
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup" style={{ background: BUCKS_COLOR, color: "white" }}>
              Sign Up
            </Button>
          </div>
          {/* Mobile nav */}
          <div className="sm:hidden flex items-center gap-2">
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup-mobile" style={{ background: BUCKS_COLOR, color: "white" }}>
              Sign Up
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
                <Menu className="h-4 w-4" />
              </Button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/blog"); setMobileMenuOpen(false); }} data-testid="button-mobile-blog">
                      <BookOpen className="h-4 w-4" /> Blog
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/affiliate"); setMobileMenuOpen(false); }} data-testid="button-mobile-affiliate">
                      Affiliate Marketing
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/login"); setMobileMenuOpen(false); }} data-testid="button-mobile-login">
                      <LogIn className="h-4 w-4" /> Log In
                    </button>
                  </div>
                </>
              )}
            </div>
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
              Build a Better Workplace — the easy way.
            </h1>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={startPublicDemo}
                disabled={demoLoading}
                className="flex items-center gap-2 py-3 px-7 rounded-xl font-bold text-white text-base border-2 border-white/40 transition-all duration-200 hover:border-white/80 hover:bg-white/10 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-hero-self-guided-demo"
              >
                <Play className="h-4 w-4" />
                {demoLoading ? "Loading…" : "Try our self guided demo"}
              </button>
              <button
                onClick={() => setLocation("/signup")}
                className="flex items-center gap-2 py-3 px-7 rounded-xl font-bold text-base transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{ background: BUCKS_COLOR, color: "#fff" }}
                data-testid="button-hero-signup"
              >
                Sign Up
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-6 text-white/40 text-xs tracking-widest uppercase">Scroll to explore</p>
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
            <h2 className="font-display font-black leading-tight tracking-tight" style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)", color: NAVY }} data-testid="text-parallax-answer">
              Reward what's Important — Faster.
            </h2>
            <p className="mt-6 text-xl text-gray-600 max-w-lg leading-relaxed">
              A simple platform that helps managers recognize performance, encourage{" "}
              <span
                style={{
                  display: "inline-block",
                  color: BUCKS_COLOR,
                  fontWeight: 700,
                  transition: "opacity 0.32s ease, transform 0.32s ease",
                  opacity: wordVisible ? 1 : 0,
                  transform: wordVisible ? "translateY(0)" : "translateY(-6px)",
                  minWidth: "11ch",
                  textAlign: "left",
                }}
                data-testid="text-scrolling-word"
              >
                {SCROLLING_WORDS[wordIdx]}
              </span>
              .
            </p>
            <div className="mt-8 h-1.5 w-24 rounded-full" style={{ background: BUCKS_COLOR }} />
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-300">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
        </section>
      </div>

      {/* ─── ROI Calculator ─────────── */}
      <ROICalculator />

      {/* ─── SECTION 3: Reward → Redeem → Budget (3-tab) ─────────── */}
      <div className="relative sm:h-[175vh]">
        <section className="sm:sticky sm:top-0 sm:h-screen flex flex-col items-center justify-center overflow-y-auto sm:overflow-hidden py-8 sm:py-4" style={{ background: "#F0F4F8", zIndex: 30 }}>
          <div
            ref={s3.ref}
            className="w-full max-w-4xl mx-auto px-4"
            style={{ opacity: s3.inView ? 1 : 0, transform: s3.inView ? "translateY(0)" : "translateY(40px)", transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s" }}
          >
            {/* Headline */}
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2 text-xs font-bold tracking-wide uppercase" style={{ background: `${BUCKS_COLOR}15`, color: BUCKS_COLOR }}>
                <Zap className="h-3 w-3" />
                Reward in seconds, not hours
              </div>
              <h2
                className="font-display font-black leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)", color: NAVY }}
                data-testid="text-shop-headline"
              >
                Streamline your incentive program —{" "}
                <span style={{ color: BUCKS_COLOR }}>from reward to redemption.</span>
              </h2>
              <p className="mt-2 text-gray-500 text-sm max-w-xl mx-auto">
                Recognize performance instantly, give employees a store they'll love, and keep your budget on track — all in one platform.
              </p>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 p-1 rounded-xl mb-3 max-w-xs mx-auto" style={{ background: "#dde4ed" }}>
              {[
                { icon: Zap, label: "Reward" },
                { icon: ShoppingBag, label: "Redeem" },
                { icon: BarChart2, label: "Budget" },
              ].map(({ icon: Icon, label }, i) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(i)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all duration-200"
                  style={{
                    background: activeTab === i ? "white" : "transparent",
                    color: activeTab === i ? NAVY : "#64748b",
                    boxShadow: activeTab === i ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  }}
                  data-testid={`tab-${label.toLowerCase()}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* 3-Tab panel */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/60" style={{ background: "#fff", height: "clamp(230px, calc(100vh - 340px), 460px)" }}>

              {/* ── TAB 0: REWARD ─────────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: activeTab === 0 ? 1 : 0,
                  transition: "opacity 0.3s ease",
                  pointerEvents: activeTab === 0 ? "auto" : "none",
                  zIndex: activeTab === 0 ? 2 : 1,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ background: NAVY }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <div>
                      <p className="text-white font-bold text-xs leading-tight">Better Bucks Admin</p>
                      <p className="text-white/50 text-xs">Acme Corp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${BUCKS_COLOR}40`, color: "white" }}>
                    <Zap className="h-3 w-3" />
                    <span>Quick Reward</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3">

                  {/* Step 0: Employee list */}
                  {rewardStep === 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" style={{ color: NAVY }} />
                        <p className="font-bold text-xs" style={{ color: NAVY }}>Select an employee to reward</p>
                      </div>
                      {[
                        { name: "James L.", dept: "Warehouse · 847 Bucks", initials: "JL" },
                        { name: "Sarah K.", dept: "Logistics · 1,240 Bucks", initials: "SK" },
                        { name: "Mike T.", dept: "Operations · 512 Bucks", initials: "MT" },
                      ].map((emp) => (
                        <div
                          key={emp.name}
                          className="flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all hover:shadow-sm"
                          style={{ background: "#F8FAFC", borderColor: "#e2e8f0" }}
                          onClick={() => { setRewardEmployee(emp.name); setRewardStep(1); }}
                          data-testid={`card-employee-${emp.initials.toLowerCase()}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: NAVY }}>
                              {emp.initials}
                            </div>
                            <div>
                              <p className="font-bold text-sm" style={{ color: NAVY }}>{emp.name}</p>
                              <p className="text-xs text-gray-400">{emp.dept}</p>
                            </div>
                          </div>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                            style={{ background: BUCKS_COLOR }}
                          >
                            <Coins className="h-3 w-3" />
                            Give Bucks
                          </button>
                        </div>
                      ))}
                      <p className="text-center text-xs text-gray-400 mt-1">Tap any employee to reward them instantly</p>
                    </>
                  )}

                  {/* Step 1: Give form */}
                  {rewardStep === 1 && (
                    <>
                      <button onClick={() => { setRewardStep(0); setRewardEmployee(null); setRewardReason(null); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="rounded-xl border px-4 py-3 flex items-center gap-3" style={{ background: "#F8FAFC", borderColor: "#e2e8f0" }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: NAVY }}>
                          {rewardEmployee?.split(" ").map(w => w[0]).join("")}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: NAVY }}>{rewardEmployee}</p>
                          <p className="text-xs text-gray-400">Rewarding now</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: NAVY }}>Amount</p>
                        <div className="grid grid-cols-4 gap-2">
                          {[50, 100, 150, 200].map(amt => (
                            <button
                              key={amt}
                              onClick={() => setRewardAmount(amt)}
                              className="py-2 rounded-lg text-xs font-bold border-2 transition-all"
                              style={{
                                borderColor: rewardAmount === amt ? BUCKS_COLOR : "#e2e8f0",
                                background: rewardAmount === amt ? `${BUCKS_COLOR}12` : "#F8FAFC",
                                color: rewardAmount === amt ? BUCKS_COLOR : "#64748b",
                              }}
                              data-testid={`button-amount-${amt}`}
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-center">{rewardAmount} Bucks selected</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: NAVY }}>Reason</p>
                        <div className="flex flex-wrap gap-2">
                          {["Attendance", "Safety", "Productivity", "Initiative", "Teamwork"].map(r => (
                            <button
                              key={r}
                              onClick={() => setRewardReason(r)}
                              className="px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all"
                              style={{
                                borderColor: rewardReason === r ? BUCKS_COLOR : "#e2e8f0",
                                background: rewardReason === r ? `${BUCKS_COLOR}12` : "#F8FAFC",
                                color: rewardReason === r ? BUCKS_COLOR : "#64748b",
                              }}
                              data-testid={`chip-reason-${r.toLowerCase()}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleRewardSend}
                        disabled={!rewardReason}
                        className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: BUCKS_COLOR }}
                        data-testid="button-send-bucks"
                      >
                        <Zap className="h-4 w-4" />
                        Send {rewardAmount} Bucks Instantly
                      </button>
                    </>
                  )}

                  {/* Step 2: Sent! */}
                  {rewardStep === 2 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center" style={{ animation: "fadeUp 0.5s ease forwards" }}>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}18` }}>
                        <CheckCircle2 className="h-8 w-8" style={{ color: BUCKS_COLOR }} />
                      </div>
                      <p className="font-black text-xl" style={{ color: NAVY }}>{rewardAmount} Bucks Sent!</p>
                      <p className="text-sm text-gray-500">{rewardEmployee} rewarded for <strong>{rewardReason}</strong></p>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{ background: `${NAVY}08`, color: NAVY }}>
                        <Zap className="h-3.5 w-3.5" style={{ color: BUCKS_COLOR }} />
                        Delivered in under 3 seconds
                      </div>
                      <p className="text-xs text-gray-400">No paperwork. No spreadsheet. No delays.</p>
                      <button
                        onClick={handleRewardReset}
                        className="mt-1 px-5 py-2 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
                        style={{ background: NAVY }}
                        data-testid="button-reward-again"
                      >
                        Reward another employee
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* ── TAB 1: REDEEM ─────────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: activeTab === 1 ? 1 : 0,
                  transition: "opacity 0.3s ease",
                  pointerEvents: activeTab === 1 ? "auto" : "none",
                  zIndex: activeTab === 1 ? 2 : 1,
                }}
              >
                {/* Mock app header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <div>
                      <p className="text-white font-bold text-xs leading-tight">Better Bucks Store</p>
                      <p className="text-white/50 text-xs">Acme Corp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: BUCKS_COLOR, color: "white" }}>
                    <Coins className="h-3 w-3" />
                    <span>850 Bucks</span>
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShoppingBag className="h-3.5 w-3.5" style={{ color: NAVY }} />
                    <h3 className="font-semibold text-xs" style={{ color: NAVY }}>Redeem Your Bucks</h3>
                  </div>

                  {!orderMode ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {products.map((p, i) => {
                          const Icon = p.icon;
                          return (
                            <div
                              key={p.name}
                              className="rounded-lg border overflow-hidden flex flex-col cursor-pointer"
                              style={{
                                background: selectedProduct === i ? `${NAVY}08` : "#F8FAFC",
                                border: selectedProduct === i ? `2px solid ${BUCKS_COLOR}` : "1px solid #f0f0f0",
                              }}
                              onClick={() => handleSelect(i)}
                              data-testid={`card-product-${i}`}
                            >
                              <div className="flex justify-end px-1.5 pt-1.5">
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${BUCKS_COLOR}22`, color: BUCKS_COLOR }}>{p.tag}</span>
                              </div>
                              <div className="flex justify-center py-1.5">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${NAVY}12` }}>
                                  <Icon className="h-4.5 w-4.5" style={{ color: NAVY, width: 18, height: 18 }} />
                                </div>
                              </div>
                              <div className="px-2 pb-2 flex flex-col gap-1 flex-1">
                                <p className="font-bold text-[10px] leading-tight" style={{ color: NAVY }}>{p.name}</p>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: 5 }).map((_, si) => (
                                    <Star key={si} className="h-2 w-2" style={{ fill: si < p.stars ? "#f59e0b" : "none", color: si < p.stars ? "#f59e0b" : "#d1d5db" }} />
                                  ))}
                                </div>
                                <span className="font-black text-[10px]" style={{ color: BUCKS_COLOR }} data-testid={`text-price-${i}`}>{p.price} Bucks</span>
                                <button
                                  className="w-full py-1 rounded-md text-[10px] font-semibold"
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
                      <p className="text-center text-xs font-semibold mt-3" style={{ color: NAVY + "80" }}>Select any item to see how ordering works</p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3 py-1">
                      <button onClick={handleBackToShop} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to store
                      </button>
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
                          <span className="text-xs text-gray-400">After Purchase</span>
                          <span className="font-bold text-sm" style={{ color: NAVY }}>{850 - selectedP.price} Bucks</span>
                        </div>
                      </div>

                      {orderStep < 2 ? (
                        <button className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ background: BUCKS_COLOR }}>
                          {orderStep === 0 ? (
                            "Confirm Order"
                          ) : (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                              Processing…
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-3 text-center" style={{ animation: "fadeUp 0.5s ease forwards" }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}18` }}>
                            <CheckCircle2 className="h-6 w-6" style={{ color: BUCKS_COLOR }} />
                          </div>
                          <p className="font-black text-lg" style={{ color: NAVY }}>Order Placed!</p>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `${BUCKS_COLOR}18`, color: BUCKS_COLOR }}>
                            <Truck className="h-3 w-3" />
                            <span>Waiting for manager approval</span>
                          </div>
                          <button onClick={handleBackToShop} className="text-xs underline underline-offset-2 text-gray-400 hover:text-gray-600 transition-colors" data-testid="button-back-after-order">
                            ← Browse more items
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── TAB 2: BUDGET ─────────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: activeTab === 2 ? 1 : 0,
                  transition: "opacity 0.3s ease",
                  pointerEvents: activeTab === 2 ? "auto" : "none",
                  zIndex: activeTab === 2 ? 2 : 1,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <div>
                      <p className="text-white font-bold text-xs leading-tight">Better Bucks Admin</p>
                      <p className="text-white/50 text-xs">Acme Corp · June 2025</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${BUCKS_COLOR}40`, color: "white" }}>
                    <BarChart2 className="h-3 w-3" />
                    <span>Budget</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-4">
                  {/* Monthly overview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-xs" style={{ color: NAVY }}>Monthly Budget Overview</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BUCKS_COLOR}18`, color: BUCKS_COLOR }}>On track</span>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2" style={{ background: "#F8FAFC" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400">Total Budget</p>
                          <p className="font-black text-lg" style={{ color: NAVY }}>5,000 Bucks</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Remaining</p>
                          <p className="font-black text-lg" style={{ color: BUCKS_COLOR }}>1,840 Bucks</p>
                        </div>
                      </div>
                      <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "#e2e8f0" }}>
                        <div className="h-full rounded-full" style={{ width: "63%", background: `linear-gradient(90deg, ${BUCKS_COLOR}, ${BUCKS_COLOR}bb)` }} />
                      </div>
                      <p className="text-xs text-gray-400 text-right">3,160 of 5,000 Bucks used (63%)</p>
                    </div>
                  </div>

                  {/* By category */}
                  <div>
                    <p className="font-bold text-xs mb-2" style={{ color: NAVY }}>Rewards by Category</p>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "Safety", pct: 40, bucks: 1264 },
                        { label: "Attendance", pct: 25, bucks: 790 },
                        { label: "Performance", pct: 35, bucks: 1106 },
                      ].map(cat => (
                        <div key={cat.label} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "#F8FAFC" }}>
                          <span className="text-xs font-semibold w-20 shrink-0" style={{ color: NAVY }}>{cat.label}</span>
                          <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "#e2e8f0" }}>
                            <div className="h-full rounded-full" style={{ width: `${cat.pct}%`, background: BUCKS_COLOR }} />
                          </div>
                          <span className="text-xs font-bold shrink-0" style={{ color: BUCKS_COLOR }}>{cat.pct}%</span>
                          <span className="text-xs text-gray-400 shrink-0 w-14 text-right">{cat.bucks.toLocaleString()} B</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impact stats */}
                  <div>
                    <p className="font-bold text-xs mb-2" style={{ color: NAVY }}>This Month's Impact</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "8+ hrs", label: "Tracking time saved" },
                        { value: "23", label: "Same-day rewards" },
                        { value: "100%", label: "Auditable history" },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-xl border border-gray-100 p-3 text-center" style={{ background: "#F8FAFC" }}>
                          <p className="font-black text-base" style={{ color: BUCKS_COLOR }}>{stat.value}</p>
                          <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Feature highlight strip */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
              {[
                { icon: Zap, title: "Reward in seconds", desc: "One tap to give Bucks — no delays, no paperwork" },
                { icon: ShoppingBag, title: "Employees choose", desc: "A curated store they'll actually want to shop" },
                { icon: BarChart2, title: "Budget on autopilot", desc: "Full visibility into what you spend and why" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.85)" }}>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ background: `${BUCKS_COLOR}18` }}>
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: BUCKS_COLOR }} />
                  </div>
                  <p className="font-bold text-[10px] sm:text-xs" style={{ color: NAVY }}>{title}</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 leading-tight hidden sm:block">{desc}</p>
                </div>
              ))}
            </div>

          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-400">
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </div>
        </section>
      </div>

      {/* ─── SECTION 3B: Survey Tutorial ──────────────────────────── */}
      <div className="relative sm:h-[140vh]">
        <section className="sm:sticky sm:top-0 sm:h-screen flex flex-col items-center justify-center overflow-y-auto sm:overflow-hidden py-6 sm:py-4" style={{ background: "#fff", zIndex: 35 }}>
          <div
            ref={sSurvey.ref}
            className="w-full max-w-4xl mx-auto px-4"
            style={{ opacity: sSurvey.inView ? 1 : 0, transform: sSurvey.inView ? "translateY(0)" : "translateY(40px)", transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s" }}
          >
            {/* Headline */}
            <div className="text-center mb-4">
              <h2
                className="font-display font-black leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)", color: NAVY }}
                data-testid="text-survey-headline"
              >
                Built-in employee surveys reveal what drives performance, engagement, and retention—
                <span style={{ color: BUCKS_COLOR }}> so you can reward what actually works.</span>
              </h2>
              <p className="mt-2 text-gray-500 text-sm max-w-lg mx-auto">
                Create surveys in seconds, collect anonymous responses, and see results the moment they come in.
              </p>
            </div>

            {/* Sliding panel container */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-gray-100" style={{ background: "#fff", height: "clamp(260px, calc(100vh - 260px), 520px)" }}>

              {/* ── Employee form view ───────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: surveyStep >= 2 ? 0 : 1,
                  transform: surveyStep >= 2 ? "translateX(-48px)" : "translateX(0)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  pointerEvents: surveyStep >= 2 ? "none" : "auto",
                  zIndex: surveyStep < 2 ? 2 : 1,
                }}
              >
                {/* Mock app header */}
                <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ background: NAVY }}>
                  <div className="flex items-center gap-2">
                    <AppLogo size="sm" />
                    <div>
                      <p className="text-white font-bold text-xs leading-tight">Better Bucks Surveys</p>
                      <p className="text-white/50 text-xs">Acme Corp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${BUCKS_COLOR}30`, color: "white" }}>
                    <ClipboardList className="h-3 w-3" />
                    <span>1 active</span>
                  </div>
                </div>

                {surveyStep === 0 && (
                  <div className="p-4 flex flex-col gap-4">
                    {/* Survey card */}
                    <div className="rounded-xl border border-gray-100 overflow-hidden" style={{ background: "#F8FAFC" }}>
                      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BUCKS_COLOR}18`, color: BUCKS_COLOR }}>Active · 2 min</span>
                        </div>
                        <p className="font-black text-base" style={{ color: NAVY }}>Q3 Team Pulse Check</p>
                        <p className="text-xs text-gray-400 mt-0.5">Anonymous · Closes in 5 days</p>
                      </div>

                      <div className="p-4 flex flex-col gap-5">
                        {/* Question 1 */}
                        <div>
                          <p className="text-xs font-bold mb-2.5" style={{ color: NAVY }}>
                            1. What motivates you most at work?
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {surveyQ1Options.map((opt, i) => (
                              <button
                                key={opt}
                                onClick={() => setSurveyQ1(i)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs transition-all duration-150"
                                style={{
                                  borderColor: surveyQ1 === i ? BUCKS_COLOR : "#e5e7eb",
                                  background: surveyQ1 === i ? `${BUCKS_COLOR}0F` : "#fff",
                                  color: NAVY,
                                  fontWeight: surveyQ1 === i ? 600 : 400,
                                }}
                                data-testid={`button-survey-q1-${i}`}
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center"
                                  style={{ borderColor: surveyQ1 === i ? BUCKS_COLOR : "#d1d5db" }}
                                >
                                  {surveyQ1 === i && <div className="w-1.5 h-1.5 rounded-full" style={{ background: BUCKS_COLOR }} />}
                                </div>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Question 2 */}
                        <div>
                          <p className="text-xs font-bold mb-2.5" style={{ color: NAVY }}>
                            2. How satisfied are you with how your performance is recognized?
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {surveyQ2Options.map((opt, i) => (
                              <button
                                key={opt}
                                onClick={() => setSurveyQ2(i)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs transition-all duration-150"
                                style={{
                                  borderColor: surveyQ2 === i ? BUCKS_COLOR : "#e5e7eb",
                                  background: surveyQ2 === i ? `${BUCKS_COLOR}0F` : "#fff",
                                  color: NAVY,
                                  fontWeight: surveyQ2 === i ? 600 : 400,
                                }}
                                data-testid={`button-survey-q2-${i}`}
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center"
                                  style={{ borderColor: surveyQ2 === i ? BUCKS_COLOR : "#d1d5db" }}
                                >
                                  {surveyQ2 === i && <div className="w-1.5 h-1.5 rounded-full" style={{ background: BUCKS_COLOR }} />}
                                </div>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleSurveySubmit}
                          disabled={surveyQ1 === null || surveyQ2 === null}
                          className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition-all"
                          style={{ background: (surveyQ1 !== null && surveyQ2 !== null) ? BUCKS_COLOR : "#d1d5db" }}
                          data-testid="button-survey-submit"
                        >
                          Submit Responses
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitting state */}
                {surveyStep === 1 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${BUCKS_COLOR}33`, borderTopColor: BUCKS_COLOR }} />
                    <p className="font-semibold text-sm" style={{ color: NAVY }}>Submitting your responses…</p>
                  </div>
                )}
              </div>

              {/* ── Admin results view ───────────────────────────────── */}
              <div
                className="absolute inset-0 w-full overflow-y-auto"
                style={{
                  opacity: surveyStep === 2 ? 1 : 0,
                  transform: surveyStep === 2 ? "translateX(0)" : "translateX(48px)",
                  transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
                  pointerEvents: surveyStep === 2 ? "auto" : "none",
                  zIndex: surveyStep === 2 ? 2 : 1,
                }}
              >
                {/* Admin header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSurveyReset}
                      className="text-white/60 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
                      data-testid="button-survey-back"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <AppLogo size="sm" />
                      <div>
                        <p className="text-white font-bold text-xs leading-tight">Survey Results</p>
                        <p className="text-white/50 text-xs">Admin View · Acme Corp</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${BUCKS_COLOR}30`, color: "white" }}>
                    <Users className="h-3 w-3" />
                    <span>12 responses</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-4" style={{ animation: "fadeUp 0.5s ease forwards" }}>
                  {/* Thank-you banner */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: `${BUCKS_COLOR}0D`, borderColor: `${BUCKS_COLOR}40` }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: BUCKS_COLOR }} />
                    <p className="text-xs font-semibold" style={{ color: NAVY }}>Your response was submitted — here's how the team responded:</p>
                  </div>

                  {/* Q1 results */}
                  <div className="rounded-xl border border-gray-100 p-4" style={{ background: "#F8FAFC" }}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <BarChart2 className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                      <p className="text-xs font-bold" style={{ color: NAVY }}>What motivates you most at work?</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {surveyQ1Options.map((opt, i) => (
                        <div key={opt} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: NAVY, fontWeight: i === 0 ? 700 : 400 }}>{opt}</span>
                            <span className="text-xs font-bold" style={{ color: BUCKS_COLOR }}>{surveyResults1[i]}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${surveyResults1[i]}%`,
                                background: i === 0 ? BUCKS_COLOR : `${BUCKS_COLOR}60`,
                                transition: "width 1s ease 0.3s",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Q2 results */}
                  <div className="rounded-xl border border-gray-100 p-4" style={{ background: "#F8FAFC" }}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <BarChart2 className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                      <p className="text-xs font-bold" style={{ color: NAVY }}>How satisfied are you with how your performance is recognized?</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {surveyQ2Options.map((opt, i) => (
                        <div key={opt} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: NAVY, fontWeight: i === 0 ? 700 : 400 }}>{opt}</span>
                            <span className="text-xs font-bold" style={{ color: BUCKS_COLOR }}>{surveyResults2[i]}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${surveyResults2[i]}%`,
                                background: i === 0 ? BUCKS_COLOR : `${BUCKS_COLOR}60`,
                                transition: "width 1s ease 0.3s",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSurveyReset}
                    className="w-full py-2 rounded-xl font-semibold text-sm border-2 transition-all hover:opacity-80"
                    style={{ borderColor: `${NAVY}30`, color: NAVY, background: "transparent" }}
                    data-testid="button-survey-reset"
                  >
                    ← Try the survey demo again
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-300">
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
                <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-md">
                  <button
                    onClick={() => setLocation("/signup")}
                    className="w-full flex items-center justify-center gap-3 py-5 px-8 rounded-xl font-black text-lg transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{ background: BUCKS_COLOR, color: "#fff" }}
                    data-testid="button-cta-signup"
                  >
                    Build a Better Workplace Today
                    <ArrowRight className="h-5 w-5" />
                  </button>
                  <p className="text-white/40 text-xs -mt-1">View our plans — no credit card required.</p>
                  <button
                    onClick={startPublicDemo}
                    disabled={demoLoading}
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white text-base border-2 border-white/30 transition-all duration-200 hover:border-white/60 hover:bg-white/10 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="button-try-self-guided-demo"
                  >
                    <Play className="h-4 w-4" />
                    {demoLoading ? "Loading…" : "Try our self guided demo"}
                  </button>
                  <button
                    onClick={() => setDemoOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white/60 text-sm transition-all duration-200 hover:text-white/90 active:scale-95"
                    data-testid="button-cta-demo"
                  >
                    Request a personalized demo
                  </button>
                </div>
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

      <SiteFooter />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
