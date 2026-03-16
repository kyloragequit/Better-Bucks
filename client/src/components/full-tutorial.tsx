import { useEffect, useState, useCallback, useRef } from "react";
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
    description: "Better Bucks is your company's incentive program — you earn Bucks for great work and can spend them on rewards. This tour will walk you through every feature so you feel right at home.",
  },
  {
    id: "balance",
    path: "/dashboard",
    selector: '[data-testid="card-balance"]',
    title: "Your Bucks Balance",
    description: "This card shows your current Bucks balance. Administrators award Bucks to you for good performance, attendance, hitting goals, and more. The higher your balance, the more you can redeem!",
  },
  {
    id: "goals",
    path: "/dashboard",
    selector: '[data-testid="section-goals"]',
    title: "Team Goals",
    description: "Your team can set shared goals — like 30 accident-free days or hitting a production milestone. When the whole team achieves the goal, everyone earns a Bucks reward automatically. Check back here to track progress!",
    optional: true,
  },
  {
    id: "qr",
    path: "/dashboard",
    selector: '[data-testid="qr-code-container"]',
    title: "Your Personal QR Code",
    description: "This is your unique employee ID. Your administrator can scan it to instantly pull up your account and award Bucks on the spot. No need to memorize usernames — just show the code!",
  },
  {
    id: "store",
    path: "/store",
    title: "The Better Bucks Store",
    description: "This is where your Bucks turn into real rewards! Browse your company's catalog of items — products, gift cards, and more — and spend your hard-earned Bucks on something you actually want.",
  },
  {
    id: "store-balance",
    path: "/store",
    selector: '[data-testid="text-store-balance"]',
    title: "Your Balance in the Store",
    description: "Your current Bucks balance is always shown here so you know exactly what you can afford. Items you have enough Bucks for will show a purchase button right on the card.",
  },
  {
    id: "orders",
    path: "/orders",
    selector: '[data-testid="text-orders-title"]',
    title: "Your Orders",
    description: "Every reward request you submit lands here. You can track the status of each one — Pending means your administrator is reviewing it, Approved means it's on the way, and Completed means it's been fulfilled!",
  },
  {
    id: "new-order",
    path: "/orders",
    selector: '[data-testid="button-new-order"]',
    title: "Request a Custom Item",
    description: "Don't see exactly what you want in the store? Click here to submit a custom item request. Describe what you want, add a link or photos, and your administrator will review it.",
    optional: true,
  },
  {
    id: "done",
    path: "/dashboard",
    title: "You're All Set!",
    description: "That's the full tour! You know how to check your balance, track team goals, browse the store, and manage your orders. Time to start earning — go show your team what you're made of!",
  },
];

const adminSteps: Step[] = [
  {
    id: "welcome",
    path: "/admin/dashboard",
    title: "Welcome to Your Admin Dashboard",
    description: "As an administrator, you're responsible for recognizing great work by awarding Bucks. You can manage your team, approve reward orders, set team goals, and track everything from here.",
  },
  {
    id: "stats",
    path: "/admin/dashboard",
    selector: '[data-testid="text-points-credit"]',
    title: "Bucks Statistics",
    description: "These stat cards show how many Bucks have been credited (awarded) and spent by your team. Toggle between Week, Month, and Year to see how engagement is trending over time.",
  },
  {
    id: "leaderboard",
    path: "/admin/dashboard",
    selector: '[data-testid="tab-leaderboard-admins"]',
    title: "Admin & Employee Leaderboard",
    description: "This bar chart shows which administrators have awarded the most Bucks to employees. Switch to the Employees tab to see each employee's current balance or how much they've spent on completed orders.",
  },
  {
    id: "employees",
    path: "/admin/employees",
    selector: '[data-testid="input-search-employees"]',
    title: "Employee Management",
    description: "This is your team roster. Search by name, filter by department, and click any employee to view their full transaction history. You can also add new employees, assign departments, and adjust their balances.",
  },
  {
    id: "bulk-credit",
    path: "/admin/employees",
    selector: '[data-testid="button-bulk-credit"]',
    title: "Award Bucks in Bulk",
    description: "Use this to award Bucks to multiple employees at once — perfect for shift bonuses, safety milestones, or weekly performance rewards. Select employees, enter an amount and reason, then hit send.",
  },
  {
    id: "orders",
    path: "/admin/orders",
    title: "Order Management",
    description: "All employee reward requests land here. You'll see what employees are asking for, their Bucks balance, and any photos or links they've submitted. Approve and mark as completed when the item has been fulfilled.",
  },
  {
    id: "goals",
    path: "/admin/goals",
    selector: '[data-testid="input-goal-title"]',
    title: "Team Goals",
    description: "Create shared goals for your entire team. Set a target (like 30 accident-free days or a production quota), a Bucks reward, and an optional deadline. The system tracks progress automatically and distributes rewards when the goal is achieved.",
    optional: true,
  },
  {
    id: "settings",
    path: "/admin/settings",
    selector: '[data-testid="text-settings-org-code"]',
    title: "Organization Settings",
    description: "Your organization's unique code is here — new employees use it when registering. You can also manage your store, customize role labels, view subscription details, and configure other organization-wide settings.",
  },
  {
    id: "done",
    path: "/admin/dashboard",
    title: "You're Ready to Go!",
    description: "You've seen all the key features. The best managers check in regularly, award Bucks generously, and keep goals active to maintain team momentum. Your team is counting on you — let's go!",
  },
];

const primeAdminExtraStep: Step = {
  id: "budget",
  path: "/admin/dashboard",
  selector: '[data-testid="input-bucks-per-dollar"]',
  title: "Budget & Conversion Rate",
  description: "As the Organization Owner, you can set how many Bucks equal one dollar (the conversion rate), configure a monthly incentive budget in Bucks, and allocate that budget directly to your administrators so they always have Bucks to award.",
};

function getSteps(role: string): Step[] {
  if (role === "employee") return employeeSteps;
  const base = [...adminSteps];
  if (role === "prime_admin") {
    base.splice(3, 0, primeAdminExtraStep);
  }
  return base;
}

type Rect = { top: number; left: number; width: number; height: number };

function SpotlightOverlay({ rect, padding = 10 }: { rect: Rect | null; padding?: number }) {
  if (!rect) return (
    <div className="fixed inset-0 bg-black/70 z-[9997] pointer-events-none" />
  );

  const { top, left, width, height } = rect;
  const p = padding;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none">
      <div className="absolute bg-black/70" style={{ top: 0, left: 0, right: 0, height: Math.max(0, top - p) }} />
      <div className="absolute bg-black/70" style={{ top: top - p, left: 0, width: Math.max(0, left - p), height: height + p * 2 }} />
      <div className="absolute bg-black/70" style={{ top: top - p, left: left + width + p, right: 0, height: height + p * 2 }} />
      <div className="absolute bg-black/70" style={{ top: top + height + p, left: 0, right: 0, bottom: 0 }} />
      <div
        className="absolute rounded-lg pointer-events-none"
        style={{
          top: top - p,
          left: left - p,
          width: width + p * 2,
          height: height + p * 2,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.35), 0 0 0 5px rgba(255,255,255,0.12)",
        }}
      />
    </div>
  );
}

function Tooltip({
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
  const TOOLTIP_W = 340;
  const TOOLTIP_H = 220;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const PAD = 16;

  let top: number, left: number;

  if (!rect) {
    top = vh / 2 - TOOLTIP_H / 2;
    left = vw / 2 - TOOLTIP_W / 2;
  } else {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    if (spaceBelow >= TOOLTIP_H + 24) {
      top = rect.top + rect.height + 16;
    } else if (spaceAbove >= TOOLTIP_H + 24) {
      top = rect.top - TOOLTIP_H - 16;
    } else {
      top = vh / 2 - TOOLTIP_H / 2;
    }
    left = Math.min(Math.max(PAD, rect.left + rect.width / 2 - TOOLTIP_W / 2), vw - TOOLTIP_W - PAD);
    top = Math.min(Math.max(PAD, top), vh - TOOLTIP_H - PAD);
  }

  return (
    <div
      className="fixed z-[10000] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ top, left, width: TOOLTIP_W, pointerEvents: "all" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <span className="text-white text-xs font-bold">Full Tour</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">{stepIndex + 1} / {totalSteps}</span>
          <button onClick={onSkip} className="text-white/40 hover:text-white transition-colors" title="Exit tour">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white px-5 py-4 flex-1">
        <div className="flex items-start gap-2 mb-2">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: GREEN }} />
          <h3 className="text-sm font-bold leading-snug" style={{ color: NAVY }}>{title}</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-0 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === stepIndex ? 16 : 5,
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
        >
          {isLast ? "Finish" : "Next"}
          {isLast ? <ArrowRight className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
        </button>
      </div>
    </div>
  );
}

export function FullTutorialOverlay() {
  const { data: user } = useUser();
  const { showFullTutorial, completeTutorial, skipTutorial } = useTutorial();
  const [, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const locating = useRef(false);

  const role = user?.role ?? "employee";
  const steps = getSteps(role);
  const step = steps[stepIndex];

  const findElement = useCallback(() => {
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (!step.optional) {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    locating.current = false;
    setLocation(step.path);
    setRect(null);
    const t1 = setTimeout(() => { findElement(); locating.current = true; }, 500);
    const t2 = setTimeout(() => { findElement(); }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stepIndex, step.path, findElement, setLocation]);

  useEffect(() => {
    const handleResize = () => { if (locating.current) findElement(); };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => { window.removeEventListener("resize", handleResize); window.removeEventListener("scroll", handleResize, true); };
  }, [findElement]);

  const handleNext = async () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(s => s + 1);
    } else {
      await completeTutorial();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(s => s - 1);
  };

  const handleSkip = async () => {
    await skipTutorial();
  };

  if (!showFullTutorial || !user) return null;

  return createPortal(
    <>
      <SpotlightOverlay rect={rect} />
      <Tooltip
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
    </>,
    document.body
  );
}
