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
    description: "Your team can set shared goals — like 30 accident-free days or hitting a production milestone. When the whole team achieves the goal, everyone earns a Bucks reward automatically.",
    optional: true,
  },
  {
    id: "qr",
    path: "/dashboard",
    selector: '[data-testid="qr-code-container"]',
    title: "Your Personal QR Code",
    description: "This is your unique employee ID. Your administrator can scan it to instantly pull up your account and award Bucks on the spot — no need to memorize usernames!",
  },
  {
    id: "store",
    path: "/store",
    title: "The Better Bucks Store",
    description: "This is where your Bucks turn into real rewards! Browse your company's catalog of items — products, gift cards, and more — and spend your hard-earned Bucks on something you want.",
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
    description: "Every reward request you submit lands here. Track its status — Pending means your administrator is reviewing it, and Completed means it's been fulfilled!",
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
    description: "As an administrator, you recognize great work by awarding Bucks. You can manage your team, approve reward orders, set team goals, and track everything from here.",
  },
  {
    id: "stats",
    path: "/admin/dashboard",
    selector: '[data-testid="text-points-credit"]',
    title: "Bucks Statistics",
    description: "These stat cards show how many Bucks have been credited and spent by your team. Toggle between Week, Month, and Year to see how engagement is trending over time.",
  },
  {
    id: "leaderboard",
    path: "/admin/dashboard",
    selector: '[data-testid="tab-leaderboard-admins"]',
    title: "Admin & Employee Leaderboard",
    description: "This bar chart shows which administrators have awarded the most Bucks. Switch to Employees to see each employee's current balance or how much they've spent on completed orders.",
  },
  {
    id: "employees",
    path: "/admin/employees",
    selector: '[data-testid="input-search-employees"]',
    title: "Employee Management",
    description: "This is your team roster. Search by name, filter by department, and click any employee to view their full transaction history. You can also add new employees and adjust balances.",
  },
  {
    id: "bulk-credit",
    path: "/admin/employees",
    selector: '[data-testid="button-bulk-credit"]',
    title: "Award Bucks in Bulk",
    description: "Use this to award Bucks to multiple employees at once — perfect for shift bonuses, safety milestones, or weekly performance rewards. Select employees, enter an amount and reason, then send.",
  },
  {
    id: "orders",
    path: "/admin/orders",
    title: "Order Management",
    description: "All employee reward requests land here. Review what employees are asking for, check their Bucks balance, and mark orders as completed when the item has been fulfilled.",
  },
  {
    id: "goals",
    path: "/admin/goals",
    selector: '[data-testid="input-goal-title"]',
    title: "Team Goals",
    description: "Create shared goals for your entire team. Set a target, a Bucks reward, and an optional deadline. The system tracks progress automatically and distributes rewards when achieved.",
    optional: true,
  },
  {
    id: "catalogue",
    path: "/admin/catalogue",
    selector: '[data-testid="button-add-catalogue-item"]',
    title: "Catalogue Maker",
    description: "Create shorthand codes like PERF10 or SAFETY5 and assign Bucks values to them. When you do an Instant Transaction, type a catalogue code to auto-fill the amount and reason instantly — no more remembering numbers.",
    optional: true,
  },
  {
    id: "custom-items",
    path: "/admin/items",
    title: "Custom (Non-Bucks) Items",
    description: "Beyond Bucks, your org can run a second incentive system — things like Safety Stars, Raffle Tickets, or any token you define. Give and redeem custom items separately from Bucks using this page.",
    optional: true,
  },
  {
    id: "settings",
    path: "/admin/settings",
    selector: '[data-testid="text-settings-org-code"]',
    title: "Organization Settings",
    description: "Your organization's unique code is here — new employees use it when registering. You can also set a Universal Passkey so employees always have a fallback login PIN, customize role labels, and view subscription details.",
  },
  {
    id: "done",
    path: "/admin/dashboard",
    title: "You're Ready to Go!",
    description: "You've seen all the key features — Bucks management, Instant Transaction with catalogue codes, team goals, custom item tokens, and settings. The best managers check in regularly, award Bucks generously, and keep goals active. Let's go!",
  },
];

const primeAdminExtraStep: Step = {
  id: "budget",
  path: "/admin/dashboard",
  selector: '[data-testid="input-bucks-per-dollar"]',
  title: "Budget & Conversion Rate",
  description: "As the Organization Owner, you can set how many Bucks equal one dollar, configure a monthly incentive budget, and allocate that budget directly to your administrators.",
};

function getSteps(role: string): Step[] {
  if (role === "employee") return employeeSteps;
  const base = [...adminSteps];
  if (role === "prime_admin") base.splice(3, 0, primeAdminExtraStep);
  return base;
}

type Rect = { top: number; left: number; width: number; height: number };

// 4-panel spotlight — only rendered when we have a real element to highlight
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
  const TOOLTIP_W = 340;
  const PAD = 16;

  // Get live viewport dimensions at render time
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  if (!rect) {
    // Centre in viewport for steps with no spotlight target
    top = Math.max(PAD, vh / 2 - 130);
    left = Math.max(PAD, vw / 2 - TOOLTIP_W / 2);
  } else {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    if (spaceBelow >= 200) {
      top = rect.top + rect.height + 16;
    } else if (spaceAbove >= 200) {
      top = rect.top - 200 - 16;
    } else {
      top = Math.max(PAD, vh / 2 - 130);
    }
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    // Clamp horizontally
    left = Math.min(Math.max(PAD, left), vw - TOOLTIP_W - PAD);
    // Clamp vertically
    top = Math.min(Math.max(PAD, top), vh - 260);
  }

  return (
    <div
      className="fixed flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ top, left, width: TOOLTIP_W, zIndex: 10001, pointerEvents: "auto" }}
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

      <div className="bg-white px-5 py-4">
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

const APP_PAGE_PREFIXES = ["/dashboard", "/store", "/orders", "/settings", "/admin/"];

export function FullTutorialOverlay() {
  const { data: user } = useUser();
  const { showFullTutorial, completeTutorial, skipTutorial } = useTutorial();
  const [location, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const locating = useRef(false);

  const role = user?.role ?? "employee";
  const steps = useMemo(() => getSteps(role), [role]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

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
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(s => s - 1);
  };

  const handleSkip = async () => {
    await skipTutorial();
  };

  const isOnAppPage = APP_PAGE_PREFIXES.some(p => location.startsWith(p));

  if (!showFullTutorial || !user || !isOnAppPage || !user.termsAcceptedAt) return null;

  return createPortal(
    <>
      {/* Persistent escape button — always visible no matter what */}
      <button
        onClick={handleSkip}
        className="fixed flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-opacity hover:opacity-80"
        style={{ top: 12, right: 12, zIndex: 10002, background: NAVY, pointerEvents: "auto" }}
        title="Exit tour"
      >
        <X className="h-3 w-3" /> Exit Tour
      </button>

      {/* Full dark overlay when no specific element is highlighted; spotlight when one is */}
      {!rect && <div className="fixed inset-0 bg-black/65 pointer-events-none" style={{ zIndex: 9997 }} />}
      {rect && <SpotlightOverlay rect={rect} />}

      {/* Tooltip / step card */}
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
