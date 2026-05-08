import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTutorial, TUTORIAL_RESET_EVENT } from "@/hooks/use-tutorial";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import { ChevronLeft, ChevronRight, X, MapPin, ArrowRight, Sparkles } from "lucide-react";

const NAVY = "#162A4A";
const GREEN = "#4E9F3D";

type Step = {
  id: string;
  path: string;
  selector?: string;
  title: string;
  description: string;
  optional?: boolean;
  miniPreview?: React.ReactNode;
};

function MiniBar({ label, pct, color, delay }: { label: string; pct: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-white/70">{label}</span>
        <span className="font-bold text-white/90">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/15 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniTeamPreview() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStep(1), 600), setTimeout(() => setStep(2), 1200), setTimeout(() => setStep(3), 1800)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const names = ["Sarah C.", "Marcus H.", "Priya P."];
  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ background: `${NAVY}CC` }}>
      <div className="px-2.5 py-1.5 text-[10px] font-bold text-white/80 border-b border-white/10">My Team</div>
      {names.map((n, i) => (
        <div key={n} className="flex items-center gap-2 px-2.5 py-1 border-b border-white/5 transition-all duration-500" style={{ opacity: step > i ? 1 : 0, transform: step > i ? "translateX(0)" : "translateX(-8px)" }}>
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: GREEN }}>{n[0]}</div>
          <span className="text-[10px] text-white/80">{n}</span>
          {step > i && <span className="ml-auto text-[9px] font-bold" style={{ color: GREEN }}>✓</span>}
        </div>
      ))}
    </div>
  );
}

function MiniSurveyPreview() {
  const [answered, setAnswered] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setAnswered(1), 700), setTimeout(() => setAnswered(2), 1400)];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ background: `${NAVY}CC` }}>
      <div className="px-2.5 py-1.5 text-[10px] font-bold text-white/80 border-b border-white/10">Survey</div>
      <div className="px-2.5 py-1.5 space-y-1.5">
        {["How was this week?", "Rate your manager"].map((q, i) => (
          <div key={q} className="flex items-center gap-1.5 transition-all duration-500" style={{ opacity: answered > i ? 1 : 0.5 }}>
            <div className="w-3 h-3 rounded-full border transition-all duration-300" style={{ borderColor: answered > i ? GREEN : "rgba(255,255,255,0.3)", background: answered > i ? GREEN : "transparent" }}>
              {answered > i && <span className="text-[7px] text-white flex items-center justify-center h-full">✓</span>}
            </div>
            <span className="text-[10px] text-white/70">{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniDocPreview() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 500); return () => clearTimeout(t); }, []);
  return (
    <div className="rounded-lg overflow-hidden border border-white/10 transition-all duration-700" style={{ background: `${NAVY}CC`, opacity: show ? 1 : 0, transform: show ? "scale(1)" : "scale(0.9)" }}>
      <div className="px-2.5 py-1.5 text-[10px] font-bold text-white/80 border-b border-white/10">Monthly Report</div>
      <div className="px-2.5 py-2 space-y-1">
        <MiniBar label="Awarded" pct={72} color={GREEN} delay={600} />
        <MiniBar label="Spent" pct={45} color="#3B82F6" delay={900} />
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-white/50">PDF ready</span>
          <span className="text-[9px] font-bold" style={{ color: GREEN }}>↓ Download</span>
        </div>
      </div>
    </div>
  );
}

const employeeSteps: Step[] = [
  {
    id: "welcome",
    path: "/dashboard",
    title: "Welcome to Better Bucks!",
    description: "Earn Bucks for great work and spend them on real rewards. Let's take a quick look around.",
  },
  {
    id: "balance",
    path: "/dashboard",
    selector: '[data-testid="card-balance"]',
    title: "Your Bucks Balance",
    description: "Your current balance lives here. Admins award Bucks for performance, attendance, and more.",
  },
  {
    id: "goals",
    path: "/dashboard",
    selector: '[data-testid="section-goals"]',
    title: "Team Goals",
    description: "Shared team goals — hit the target together and everyone earns a reward automatically.",
    optional: true,
  },
  {
    id: "qr",
    path: "/dashboard",
    selector: '[data-testid="qr-code-container"]',
    title: "Your QR Code",
    description: "Your admin scans this to pull up your account instantly. No usernames needed.",
  },
  {
    id: "store",
    path: "/store",
    title: "The Store",
    description: "Browse and spend your Bucks on gift cards, products, and other rewards your company offers.",
  },
  {
    id: "store-balance",
    path: "/store",
    selector: '[data-testid="text-store-balance"]',
    title: "Balance in the Store",
    description: "Your balance is always shown here so you know what you can afford.",
  },
  {
    id: "orders",
    path: "/orders",
    selector: '[data-testid="text-orders-title"]',
    title: "Your Orders",
    description: "Track every reward you've requested. Pending = under review, Completed = fulfilled.",
  },
  {
    id: "surveys",
    path: "/surveys",
    title: "Surveys",
    description: "Your organization may post surveys for feedback. Check here to share your thoughts and help improve the workplace.",
    miniPreview: <MiniSurveyPreview />,
  },
  {
    id: "done",
    path: "/dashboard",
    title: "You're All Set!",
    description: "That's everything! Check your balance, browse the store, answer surveys, and start earning.",
  },
];

const adminSteps: Step[] = [
  {
    id: "welcome",
    path: "/admin/dashboard",
    title: "Your Admin Dashboard",
    description: "Award Bucks, manage your team, approve orders, and track everything from here.",
  },
  {
    id: "stats",
    path: "/admin/dashboard",
    selector: '[data-testid="text-points-credit"]',
    title: "Bucks Stats",
    description: "See Bucks credited and spent. Toggle Week / Month / Year to spot trends.",
  },
  {
    id: "leaderboard",
    path: "/admin/dashboard",
    selector: '[data-testid="tab-leaderboard-admins"]',
    title: "Leaderboard",
    description: "See which admins have awarded the most. Switch to Employees to view balances.",
  },
  {
    id: "analytics",
    path: "/admin/dashboard",
    selector: '[data-testid="card-analytics"]',
    title: "Budget & Categories",
    description: "Track monthly budget usage and see how Bucks are distributed across categories like Safety, Performance, and Attendance.",
  },
  {
    id: "team",
    path: "/admin/team",
    selector: '[data-testid="text-team-title"]',
    title: "My Team",
    description: "Your assigned employees live here. Select multiple members and award Bucks in bulk with a category tag.",
    miniPreview: <MiniTeamPreview />,
  },
  {
    id: "employees",
    path: "/admin/employees",
    selector: '[data-testid="input-search-employees"]',
    title: "Employee Management",
    description: "Your full team roster. Search, filter, and click any name for their history.",
  },
  {
    id: "bulk-credit",
    path: "/admin/employees",
    selector: '[data-testid="button-bulk-credit"]',
    title: "Bulk Award",
    description: "Award Bucks to multiple employees at once — great for shift bonuses or milestones.",
  },
  {
    id: "bulk-import",
    path: "/admin/employees",
    selector: '[data-testid="button-bulk-import"]',
    title: "Import Employees",
    description: "Upload an Excel file to add many employees at once. Download the template to get started.",
  },
  {
    id: "instant-tx",
    path: "/admin/instant-transaction",
    title: "Instant Transaction",
    description: "Scan a QR code or search for an employee, pick a category, and award Bucks in seconds. Perfect for on-the-spot recognition.",
  },
  {
    id: "orders",
    path: "/admin/orders",
    title: "Orders",
    description: "Review and fulfill employee reward requests. Approve, reject, or mark items as delivered.",
  },
  {
    id: "goals",
    path: "/admin/goals",
    selector: '[data-testid="input-goal-title"]',
    title: "Team Goals",
    description: "Create shared goals with deadlines and automatic Bucks rewards on completion.",
    optional: true,
  },
  {
    id: "surveys",
    path: "/admin/surveys",
    selector: '[data-testid="input-survey-title"]',
    title: "Surveys",
    description: "Create surveys for your team — multiple-choice or open-ended. View responses and track participation.",
    miniPreview: <MiniSurveyPreview />,
    optional: true,
  },
  {
    id: "custom-items",
    path: "/admin/items",
    title: "Custom Items",
    description: "Run a second incentive track — Safety Stars, Raffle Tickets, or any token you define.",
    optional: true,
  },
  {
    id: "documents",
    path: "/admin/documents",
    selector: '[data-testid="text-documents-title"]',
    title: "Monthly Reports",
    description: "Generate detailed monthly reports with charts, category breakdowns, and PDF downloads.",
    miniPreview: <MiniDocPreview />,
  },
  {
    id: "settings",
    path: "/admin/settings",
    selector: '[data-testid="text-settings-org-code"]',
    title: "Settings",
    description: "Your org code, passkey, role labels, and subscription details are all here.",
  },
  {
    id: "done",
    path: "/admin/dashboard",
    title: "You're Ready!",
    description: "That covers everything. Award generously, keep goals active, and check in often!",
  },
];

const primeAdminExtraStep: Step = {
  id: "budget",
  path: "/admin/dashboard",
  selector: '[data-testid="input-bucks-per-dollar"]',
  title: "Budget & Conversion",
  description: "Set how many Bucks equal a dollar, configure your monthly budget, and allocate to admins.",
};

function getSteps(role: string): Step[] {
  if (role === "employee") return employeeSteps;
  const base = [...adminSteps];
  if (role === "prime_admin") base.splice(3, 0, primeAdminExtraStep);
  return base;
}

type Rect = { top: number; left: number; width: number; height: number };

function lerpRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!b) return null;
  if (!a) return b;
  return b;
}

function SpotlightOverlay({ rect, padding = 10 }: { rect: Rect; padding?: number }) {
  const { top, left, width, height } = rect;
  const p = padding;
  const rx = left - p;
  const ry = top - p;
  const rw = width + p * 2;
  const rh = height + p * 2;
  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect x={rx} y={ry} width={rw} height={rh} rx="8" ry="8" fill="black" className="transition-all duration-500 ease-out" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#spotlight-mask)" className="transition-all duration-500 ease-out" />
      </svg>
      <div
        className="absolute rounded-lg transition-all duration-500 ease-out"
        style={{
          top: ry,
          left: rx,
          width: rw,
          height: rh,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.3), 0 0 0 5px rgba(255,255,255,0.1), 0 0 30px rgba(78,159,61,0.2)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function TooltipCard({
  rect,
  title,
  description,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  onPrev,
  onNext,
  onSkip,
  miniPreview,
  animKey,
}: {
  rect: Rect | null;
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  miniPreview?: React.ReactNode;
  animKey: number;
}) {
  const TOOLTIP_W = 340;
  const TOOLTIP_H = miniPreview ? 260 : 190;
  const PAD = 16;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  if (!rect) {
    top = Math.max(PAD, vh / 2 - TOOLTIP_H / 2);
    left = Math.max(PAD, vw / 2 - TOOLTIP_W / 2);
  } else {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    if (spaceBelow >= TOOLTIP_H + 20) {
      top = rect.top + rect.height + 16;
    } else if (spaceAbove >= TOOLTIP_H + 20) {
      top = rect.top - TOOLTIP_H - 16;
    } else {
      top = Math.max(PAD, vh / 2 - TOOLTIP_H / 2);
    }
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.min(Math.max(PAD, left), vw - TOOLTIP_W - PAD);
  }

  top = Math.min(Math.max(PAD, top), vh - TOOLTIP_H - PAD);

  return (
    <div
      key={animKey}
      className="fixed flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-tooltip-enter"
      style={{ top, left, width: TOOLTIP_W, zIndex: 10001, pointerEvents: "auto", transition: "top 0.5s ease, left 0.5s ease" }}
      data-testid="tutorial-tooltip"
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <span className="text-white text-xs font-bold">Tour</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">{stepIndex + 1}/{totalSteps}</span>
          <button
            type="button"
            onClick={onSkip}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            className="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
            title="Exit tour"
            data-testid="button-tutorial-close"
            aria-label="Exit tour"
          >
            <X className="h-4 w-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      <div className="bg-white px-4 py-3">
        <div className="flex items-start gap-2 mb-1.5">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: GREEN }} />
          <h3 className="text-sm font-bold leading-snug" style={{ color: NAVY }}>{title}</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed ml-6">{description}</p>
      </div>

      {miniPreview && (
        <div className="px-4 pb-3">
          {miniPreview}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex items-center gap-1 px-3 py-2 -ml-2 min-h-[44px] rounded-md text-xs font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-0 transition-colors"
          data-testid="button-tutorial-prev"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === stepIndex ? 14 : 5,
                height: 5,
                background: i === stepIndex ? GREEN : i < stepIndex ? `${GREEN}60` : "#e5e7eb",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1 text-xs font-bold px-4 py-2 min-h-[44px] rounded-lg text-white transition-all duration-200 hover:scale-105"
          style={{ background: GREEN, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          data-testid="button-tutorial-next"
        >
          {isLast ? "Finish" : "Next"}
          {isLast ? <ArrowRight className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
        </button>
      </div>
    </div>
  );
}

const APP_PAGE_PREFIXES = ["/dashboard", "/store", "/orders", "/settings", "/admin/", "/surveys"];

export function FullTutorialOverlay() {
  const { data: user } = useUser();
  const { showFullTutorial, completeTutorial, skipTutorial } = useTutorial();
  const [location, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [prevRect, setPrevRect] = useState<Rect | null>(null);
  const [forceHide, setForceHide] = useState(false);
  const locating = useRef(false);
  const [animKey, setAnimKey] = useState(0);

  const dbCompleted = !!user && user.tutorialCompleted;
  // Only clear forceHide when the user explicitly restarts the tutorial.
  // (Watching [dbCompleted, forceHide] caused a race where a refetched user
  // with tutorialCompleted=false would re-open the tutorial after Skip.)
  useEffect(() => {
    const handler = () => {
      setForceHide(false);
      setStepIndex(0);
    };
    window.addEventListener(TUTORIAL_RESET_EVENT, handler);
    return () => window.removeEventListener(TUTORIAL_RESET_EVENT, handler);
  }, []);

  const role = user?.role ?? "employee";
  const steps = useMemo(() => getSteps(role), [role]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const homePath = role === "employee" ? "/dashboard" : "/admin/dashboard";

  const measureElement = useCallback(() => {
    if (!step?.selector) { setRect(null); return null; }
    try {
      const el = document.querySelector(step.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        return el;
      }
      setRect(null);
      return null;
    } catch {
      setRect(null);
      return null;
    }
  }, [step]);

  const findElement = useCallback(() => {
    const el = measureElement();
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [measureElement]);

  useEffect(() => {
    if (!showFullTutorial) return;
    locating.current = false;
    setPrevRect(rect);
    setRect(null);
    setAnimKey(k => k + 1);
    setLocation(step.path);
    const t1 = setTimeout(() => { findElement(); locating.current = true; }, 500);
    const t2 = setTimeout(() => findElement(), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stepIndex, step?.path, findElement, setLocation, showFullTutorial]);

  useEffect(() => {
    let rafId = 0;
    const handleReposition = () => {
      if (!locating.current) return;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        // Only re-measure on scroll/resize — never re-trigger scrollIntoView,
        // which would fight the user's own scrolling and cause jank.
        measureElement();
      });
    };
    window.addEventListener("resize", handleReposition, { passive: true });
    window.addEventListener("scroll", handleReposition, { passive: true, capture: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [measureElement]);

  const handleNext = async () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(s => s + 1);
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      await completeTutorial();
      setLocation(homePath);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(s => s - 1);
  };

  const handleSkip = useCallback(() => {
    // iOS Safari: blur any focused control so the "tap to skip" isn't
    // absorbed by the on-screen keyboard dismiss gesture.
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === "function") el.blur();
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.documentElement.style.overflow = "";
    setForceHide(true);
    setLocation(homePath);
    // Fire the completion mutation AFTER local teardown so unmount can't
    // cancel the optimistic setQueryData inside completeTutorial.
    skipTutorial();
  }, [homePath, setLocation, skipTutorial]);

  const isOnAppPage = APP_PAGE_PREFIXES.some(p => location.startsWith(p));
  const isActive = !forceHide && showFullTutorial && !!user && isOnAppPage && !!user?.termsAcceptedAt;

  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleSkip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, handleSkip]);

  if (!isActive) return null;

  const displayRect = lerpRect(prevRect, rect);

  return createPortal(
    <>
      <button
        type="button"
        onClick={handleSkip}
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          right: "calc(env(safe-area-inset-right, 0px) + 12px)",
          zIndex: 10002,
          background: NAVY,
          pointerEvents: "auto",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        className="fixed flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-full text-sm font-bold text-white shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-105 animate-tooltip-enter"
        title="Exit tour"
        data-testid="button-exit-tour"
        aria-label="Exit tour"
      >
        <X className="h-5 w-5" />
        <span>Exit Tour</span>
      </button>

      <div
        className="fixed inset-0"
        style={{ zIndex: 9996, pointerEvents: "auto", cursor: "pointer" }}
        onClick={handleSkip}
        title="Click to exit tour"
      />

      {!displayRect && <div className="fixed inset-0 bg-black/65 pointer-events-none transition-opacity duration-500" style={{ zIndex: 9997 }} />}
      {displayRect && <SpotlightOverlay rect={displayRect} />}

      {step && (
        <TooltipCard
          rect={displayRect}
          title={step.title}
          description={step.description}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          isFirst={stepIndex === 0}
          isLast={stepIndex === steps.length - 1}
          onPrev={handlePrev}
          onNext={handleNext}
          onSkip={handleSkip}
          miniPreview={step.miniPreview}
          animKey={animKey}
        />
      )}

      <style>{`
        @keyframes tooltipEnter {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-tooltip-enter {
          animation: tooltipEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </>,
    document.body
  );
}
