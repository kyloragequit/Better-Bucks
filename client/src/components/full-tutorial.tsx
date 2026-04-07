import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTutorial } from "@/hooks/use-tutorial";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import { ChevronLeft, ChevronRight, X, MapPin, ArrowRight } from "lucide-react";

const NAVY = "#162A4A";
const GREEN = "#4E9F3D";

type Step = {
  id: string;
  path: string;
  selector?: string;
  title: string;
  description: string;
  optional?: boolean;
};

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
    id: "done",
    path: "/dashboard",
    title: "You're All Set!",
    description: "That's everything! Check your balance, browse the store, and start earning.",
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
    description: "Track monthly budget usage and see how Bucks are distributed across categories.",
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
    id: "orders",
    path: "/admin/orders",
    title: "Orders",
    description: "Review and fulfill employee reward requests from here.",
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
    id: "custom-items",
    path: "/admin/items",
    title: "Custom Items",
    description: "Run a second incentive track — Safety Stars, Raffle Tickets, or any token you define.",
    optional: true,
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

function SpotlightOverlay({ rect, padding = 10 }: { rect: Rect; padding?: number }) {
  const { top, left, width, height } = rect;
  const p = padding;
  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none">
      <div className="absolute bg-black/65" style={{ top: 0, left: 0, right: 0, height: Math.max(0, top - p) }} />
      <div className="absolute bg-black/65" style={{ top: top - p, left: 0, width: Math.max(0, left - p), height: height + p * 2 }} />
      <div className="absolute bg-black/65" style={{ top: top - p, left: left + width + p, right: 0, height: height + p * 2 }} />
      <div className="absolute bg-black/65" style={{ top: top + height + p, left: 0, right: 0, bottom: 0 }} />
      <div
        className="absolute rounded-lg"
        style={{
          top: top - p,
          left: left - p,
          width: width + p * 2,
          height: height + p * 2,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.3), 0 0 0 5px rgba(255,255,255,0.1)",
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
}) {
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 180;
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
      className="fixed flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ top, left, width: TOOLTIP_W, zIndex: 10001, pointerEvents: "auto" }}
      data-testid="tutorial-tooltip"
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <span className="text-white text-xs font-bold">Tour</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">{stepIndex + 1}/{totalSteps}</span>
          <button onClick={onSkip} className="text-white/40 hover:text-white transition-colors" title="Exit tour" data-testid="button-tutorial-close">
            <X className="h-4 w-4" />
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

      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-0 transition-colors"
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
          onClick={onNext}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-colors"
          style={{ background: GREEN }}
          data-testid="button-tutorial-next"
        >
          {isLast ? "Finish" : "Next"}
          {isLast ? <ArrowRight className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
        </button>
      </div>
    </div>
  );
}

const APP_PAGE_PREFIXES = ["/dashboard", "/store", "/orders", "/settings", "/admin/"];

export function FullTutorialOverlay() {
  const { data: user } = useUser();
  const { showFullTutorial, completeTutorial, skipTutorial } = useTutorial();
  const [location, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [forceHide, setForceHide] = useState(false);
  const locating = useRef(false);

  const role = user?.role ?? "employee";
  const steps = useMemo(() => getSteps(role), [role]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const homePath = role === "employee" ? "/dashboard" : "/admin/dashboard";

  const findElement = useCallback(() => {
    if (!step?.selector) { setRect(null); return; }
    try {
      const el = document.querySelector(step.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setRect(null);
      }
    } catch {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!showFullTutorial) return;
    locating.current = false;
    setRect(null);
    setLocation(step.path);
    const t1 = setTimeout(() => { findElement(); locating.current = true; }, 500);
    const t2 = setTimeout(() => findElement(), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stepIndex, step?.path, findElement, setLocation, showFullTutorial]);

  useEffect(() => {
    const handleResize = () => { if (locating.current) findElement(); };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [findElement]);

  const handleNext = async () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(s => s + 1);
    } else {
      await completeTutorial();
      setLocation(homePath);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(s => s - 1);
  };

  const handleSkip = () => {
    setForceHide(true);
    setLocation(homePath);
    skipTutorial();
  };

  const isOnAppPage = APP_PAGE_PREFIXES.some(p => location.startsWith(p));
  const isActive = !forceHide && showFullTutorial && !!user && isOnAppPage && !!user?.termsAcceptedAt;

  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isActive]);

  if (!isActive) return null;

  return createPortal(
    <>
      <button
        onClick={handleSkip}
        className="fixed flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-opacity hover:opacity-80"
        style={{ top: 12, right: 12, zIndex: 10002, background: NAVY, pointerEvents: "auto" }}
        title="Exit tour"
        data-testid="button-exit-tour"
      >
        <X className="h-3 w-3" /> Exit Tour
      </button>

      <div
        className="fixed inset-0"
        style={{ zIndex: 9996, pointerEvents: "auto" }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      />

      {!rect && <div className="fixed inset-0 bg-black/65 pointer-events-none" style={{ zIndex: 9997 }} />}
      {rect && <SpotlightOverlay rect={rect} />}

      {step && (
        <TooltipCard
          rect={rect}
          title={step.title}
          description={step.description}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          isFirst={stepIndex === 0}
          isLast={stepIndex === steps.length - 1}
          onPrev={handlePrev}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </>,
    document.body
  );
}
