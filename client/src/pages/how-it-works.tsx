import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  Send,
  Play,
  Zap,
  Users,
  Menu,
  LogIn,
  BookOpen,
  FileSpreadsheet,
  ThumbsUp,
  HeartHandshake,
  MousePointer2,
  Target,
  ShoppingBag,
  Coins,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BUCKS_COLOR = "#4E9F3D";
const NAVY = "#162A4A";

const REWARD_EMPLOYEES = [
  { name: "James L.", dept: "Warehouse", balance: "847", initials: "JL" },
  { name: "Sarah K.", dept: "Logistics", balance: "1,240", initials: "SK" },
  { name: "Mike T.", dept: "Operations", balance: "512", initials: "MT" },
];

const REASONS = ["Perfect attendance", "Safety milestone", "Hit production goal", "Helped a teammate"];

const BENEFITS = [
  {
    icon: FileSpreadsheet,
    title: "Ditch the Spreadsheets",
    body:
      "Run your incentive programs from one simple platform — no more manual tracking or guesswork. Rewards stay consistent, and employees stay motivated.",
  },
  {
    icon: ThumbsUp,
    title: "Make Recognition a Habit",
    body:
      "Give managers an easy way to recognize great work. When employees feel appreciated, they stick around longer.",
  },
  {
    icon: HeartHandshake,
    title: "Built to Reduce Turnover",
    body:
      "Better Bucks gives businesses the tools to keep employees engaged before they start looking elsewhere.",
  },
];

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n);
}

function MiniCalculator() {
  const [emp, setEmp] = useState(150);
  const [wage, setWage] = useState(20);
  const [turn, setTurn] = useState(35);

  const annualWage = wage * 2080;
  const leavers = Math.round((emp * turn) / 100);
  const replaceCost = Math.round(annualWage * 0.4);
  const totalTurnover = leavers * replaceCost;
  const laborBudget = emp * annualWage;
  const otCost = Math.round(laborBudget * 0.05);
  const savTurn = Math.round(totalTurnover * 0.15);
  const savOT = Math.round(otCost * 0.1);
  const savProd = Math.round(laborBudget * 0.03);
  const totalROI = savTurn + savOT + savProd;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 sm:p-8" data-testid="card-mini-calculator">
      <div className="grid gap-5 sm:grid-cols-3 mb-6">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
            <span>Employees</span>
            <span className="text-gray-900 font-bold" data-testid="text-calc-employees">{emp}</span>
          </div>
          <input
            type="range"
            min={5}
            max={500}
            step={5}
            value={emp}
            onChange={(e) => setEmp(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: BUCKS_COLOR }}
            data-testid="slider-calc-employees"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
            <span>Avg hourly wage</span>
            <span className="text-gray-900 font-bold" data-testid="text-calc-wage">${wage}</span>
          </div>
          <input
            type="range"
            min={8}
            max={35}
            step={1}
            value={wage}
            onChange={(e) => setWage(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: BUCKS_COLOR }}
            data-testid="slider-calc-wage"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
            <span>Annual turnover %</span>
            <span className="text-gray-900 font-bold" data-testid="text-calc-turnover">{turn}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={turn}
            onChange={(e) => setTurn(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: BUCKS_COLOR }}
            data-testid="slider-calc-turnover"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Your estimated annual savings</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Based on a {leavers}-person/yr loss at {fmt(replaceCost)} per replacement.
          </p>
        </div>
        <p
          className="text-3xl sm:text-4xl font-black"
          style={{ color: BUCKS_COLOR, fontFamily: "'Outfit', sans-serif" }}
          data-testid="text-calc-total"
        >
          {fmt(totalROI)}/yr
        </p>
      </div>
    </div>
  );
}

const PRODUCTS = [
  { name: "Gaming Headset", price: 350, emoji: "🎧" },
  { name: "Smart TV 55\"", price: 1800, emoji: "📺" },
  { name: "$50 Gift Card", price: 200, emoji: "💳" },
];

const GOALS = [
  { title: "Zero safety incidents", progress: 78, target: 100, dept: "Warehouse · 14 days left" },
  { title: "Hit 95% on-time shipping", progress: 92, target: 100, dept: "Logistics · 6 days left" },
];

const POLL_QUESTION = "What motivates you most at work?";
const POLL_OPTIONS = [
  { label: "Recognition from my manager", pct: 42 },
  { label: "Earning Bucks rewards", pct: 33 },
  { label: "Clear goals and targets", pct: 17 },
  { label: "Team camaraderie", pct: 8 },
];

type Scene = "reward" | "goals" | "store" | "poll";
const SCENES: { id: Scene; label: string }[] = [
  { id: "reward", label: "Reward" },
  { id: "goals", label: "Goals" },
  { id: "store", label: "Store" },
  { id: "poll", label: "Polls" },
];

function ProgramPreview() {
  const [scene, setScene] = useState<Scene>("reward");

  // Reward scene
  const [rewardStep, setRewardStep] = useState<0 | 1 | 2>(0);
  const [pickHighlight, setPickHighlight] = useState<string | null>(null);
  const [reasonHighlight, setReasonHighlight] = useState<string | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [sendHighlight, setSendHighlight] = useState(false);

  // Goals scene
  const [goalProgress, setGoalProgress] = useState(78);
  const [goalCompleteHighlight, setGoalCompleteHighlight] = useState(false);
  const [goalDistributed, setGoalDistributed] = useState(false);

  // Store scene
  const [storePickHighlight, setStorePickHighlight] = useState<string | null>(null);
  const [storeRedeemed, setStoreRedeemed] = useState(false);

  // Poll scene
  const [pollPick, setPollPick] = useState<string | null>(null);
  const [pollPickHighlight, setPollPickHighlight] = useState<string | null>(null);
  const [pollResults, setPollResults] = useState(false);

  // Refs for cursor targeting
  const containerRef = useRef<HTMLDivElement>(null);
  const employeeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reasonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sendRef = useRef<HTMLButtonElement>(null);
  const goalCompleteRef = useRef<HTMLButtonElement>(null);
  const productRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pollOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean; clicking: boolean }>(
    { x: 320, y: 360, visible: false, clicking: false }
  );
  const [caption, setCaption] = useState<{ text: string; benefit?: string } | null>(null);

  const moveCursorTo = (el: HTMLElement | null) => {
    if (!el || !containerRef.current) return;
    const c = containerRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setCursor((s) => ({
      ...s,
      x: r.left - c.left + r.width / 2 - 6,
      y: r.top - c.top + r.height / 2 - 4,
      visible: true,
    }));
  };

  const advanceTo = (next: Scene) => setScene(next);

  // Scene: REWARD
  useEffect(() => {
    if (scene !== "reward") return;
    // reset reward state
    setRewardStep(0);
    setPickHighlight(null);
    setReasonHighlight(null);
    setReason(REASONS[0]);
    setSendHighlight(false);
    setCaption(null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (!containerRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      setCursor({ x: c.width - 40, y: c.height - 30, visible: true, clicking: false });
    }, 200));
    timers.push(setTimeout(() => {
      moveCursorTo(employeeRefs.current["SK"]);
      setCaption({ text: "Pick an employee to reward" });
    }, 700));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setPickHighlight("SK");
    }, 1900));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false }));
      setRewardStep(1);
      setPickHighlight(null);
    }, 2150));
    // Move to reason chip
    timers.push(setTimeout(() => {
      moveCursorTo(reasonRefs.current[REASONS[1]]);
      setCaption({ text: "Tag the reason", benefit: "Reinforces what 'good' looks like" });
    }, 2400));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setReasonHighlight(REASONS[1]);
    }, 3400));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false }));
      setReason(REASONS[1]);
      setReasonHighlight(null);
    }, 3600));
    // Move to send
    timers.push(setTimeout(() => {
      moveCursorTo(sendRef.current);
      setCaption({ text: "One click to send", benefit: "30 seconds vs. a spreadsheet entry" });
    }, 3850));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setSendHighlight(true);
    }, 4750));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false, visible: false }));
      setSendHighlight(false);
      setRewardStep(2);
      setCaption({ text: "Sarah is notified instantly", benefit: "Builds a habit of daily recognition" });
    }, 4950));
    timers.push(setTimeout(() => advanceTo("goals"), 6800));
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  // Scene: GOALS
  useEffect(() => {
    if (scene !== "goals") return;
    setGoalProgress(78);
    setGoalCompleteHighlight(false);
    setGoalDistributed(false);
    setCursor((s) => ({ ...s, visible: false }));
    setCaption(null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (!containerRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      setCursor({ x: c.width - 50, y: c.height - 30, visible: true, clicking: false });
      setCaption({ text: "Set goals everyone can see", benefit: "Aligns the whole team around outcomes" });
    }, 250));
    // Animate progress filling 78 → 100
    [85, 92, 100].forEach((pct, i) =>
      timers.push(setTimeout(() => setGoalProgress(pct), 700 + i * 350))
    );
    // Cursor moves to "Distribute Bucks" button
    timers.push(setTimeout(() => {
      moveCursorTo(goalCompleteRef.current);
      setCaption({ text: "Goal hit — reward the whole team", benefit: "Group wins drive lasting motivation" });
    }, 2000));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setGoalCompleteHighlight(true);
    }, 3300));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false, visible: false }));
      setGoalCompleteHighlight(false);
      setGoalDistributed(true);
      setCaption({ text: "Bucks distributed automatically", benefit: "No spreadsheets, no payroll work" });
    }, 3500));
    timers.push(setTimeout(() => advanceTo("store"), 5400));
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  // Scene: STORE
  useEffect(() => {
    if (scene !== "store") return;
    setStorePickHighlight(null);
    setStoreRedeemed(false);
    setCursor((s) => ({ ...s, visible: false }));
    setCaption(null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (!containerRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      setCursor({ x: c.width - 50, y: c.height - 30, visible: true, clicking: false });
      setCaption({ text: "Employees spend Bucks on real rewards", benefit: "Bucks have real value — not just points" });
    }, 250));
    timers.push(setTimeout(() => {
      moveCursorTo(productRefs.current["Gaming Headset"]);
      setCaption({ text: "Tap any item to redeem" });
    }, 700));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setStorePickHighlight("Gaming Headset");
    }, 2000));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false, visible: false }));
      setStoreRedeemed(true);
      setCaption({ text: "We handle fulfillment & shipping", benefit: "Zero work for you, real reward for them" });
    }, 2200));
    timers.push(setTimeout(() => advanceTo("poll"), 4200));
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  // Scene: POLL
  useEffect(() => {
    if (scene !== "poll") return;
    setPollPick(null);
    setPollPickHighlight(null);
    setPollResults(false);
    setCursor((s) => ({ ...s, visible: false }));
    setCaption(null);

    const target = POLL_OPTIONS[0].label;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (!containerRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      setCursor({ x: c.width - 50, y: c.height - 30, visible: true, clicking: false });
      setCaption({ text: "Send anonymous pulse polls", benefit: "Honest feedback without awkward 1-on-1s" });
    }, 250));
    timers.push(setTimeout(() => {
      moveCursorTo(pollOptionRefs.current[target]);
      setCaption({ text: "Employees vote in seconds" });
    }, 700));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: true }));
      setPollPickHighlight(target);
    }, 1900));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, clicking: false }));
      setPollPick(target);
      setPollPickHighlight(null);
    }, 2100));
    timers.push(setTimeout(() => {
      setCursor((s) => ({ ...s, visible: false }));
      setPollResults(true);
      setCaption({ text: "See live results", benefit: "Spot turnover risks before they happen" });
    }, 2700));
    timers.push(setTimeout(() => advanceTo("reward"), 5400));
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  const headerLabels: Record<Scene, { title: string; pill: string; pillIcon: typeof Zap }> = {
    reward: { title: "Better Bucks Admin", pill: "Quick Reward", pillIcon: Zap },
    goals: { title: "Team Goals", pill: "Active Goal", pillIcon: Target },
    store: { title: "Rewards Store", pill: "Employee View", pillIcon: ShoppingBag },
    poll: { title: "Team Pulse", pill: "Anonymous", pillIcon: ClipboardList },
  };
  const HeaderIcon = headerLabels[scene].pillIcon;

  return (
    <div className="w-full flex flex-col gap-3" data-testid="program-preview-wrapper">
    <div
      ref={containerRef}
      className="relative rounded-2xl shadow-2xl border border-white/60 overflow-hidden bg-white w-full"
      style={{ minHeight: 420 }}
      data-testid="program-preview"
    >
      {/* App header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <div>
            <p className="text-white font-bold text-xs leading-tight" data-testid="text-preview-title">
              {headerLabels[scene].title}
            </p>
            <p className="text-white/50 text-xs">Acme Corp</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: `${BUCKS_COLOR}40`, color: "white" }}
        >
          <HeaderIcon className="h-3 w-3" />
          <span>{headerLabels[scene].pill}</span>
        </div>
      </div>

      {/* Scene tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
        {SCENES.map((s) => (
          <div
            key={s.id}
            className="flex-1 flex flex-col items-center gap-1"
            data-testid={`tab-indicator-${s.id}`}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wide transition-colors"
              style={{ color: scene === s.id ? NAVY : "#9ca3af" }}
            >
              {s.label}
            </span>
            <div
              className="h-0.5 w-full rounded-full transition-colors"
              style={{ background: scene === s.id ? BUCKS_COLOR : "#e5e7eb" }}
            />
          </div>
        ))}
      </div>

      <div className="p-4 min-h-[300px]">
        {/* ── REWARD SCENE ───────────────────────────────────────── */}
        {scene === "reward" && (
          <>
            {rewardStep === 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" style={{ color: NAVY }} />
                  <p className="font-bold text-xs" style={{ color: NAVY }}>
                    Select an employee to reward
                  </p>
                </div>
                {REWARD_EMPLOYEES.map((emp) => (
                  <button
                    key={emp.name}
                    ref={(el) => { employeeRefs.current[emp.initials] = el; }}
                    onClick={() => setRewardStep(1)}
                    className="flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left"
                    style={{
                      borderColor: pickHighlight === emp.initials ? BUCKS_COLOR : "#f3f4f6",
                      background: pickHighlight === emp.initials ? `${BUCKS_COLOR}10` : "#fff",
                      transform: pickHighlight === emp.initials ? "scale(0.98)" : "scale(1)",
                    }}
                    data-testid={`button-pick-${emp.initials}`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: BUCKS_COLOR }}
                    >
                      {emp.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: NAVY }}>{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.dept} · {emp.balance} Bucks</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}

            {rewardStep === 1 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: BUCKS_COLOR }}
                  >
                    SK
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: NAVY }}>Sarah K.</p>
                    <p className="text-xs text-gray-500">Logistics</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Reward amount</p>
                  <div
                    className="flex items-baseline gap-1 px-3 py-2 rounded-lg"
                    style={{ background: `${BUCKS_COLOR}15` }}
                  >
                    <span className="text-2xl font-black" style={{ color: BUCKS_COLOR }}>100</span>
                    <span className="text-xs font-bold" style={{ color: BUCKS_COLOR }}>Bucks</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Reason</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONS.map((r) => {
                      const active = reason === r || reasonHighlight === r;
                      return (
                        <button
                          key={r}
                          ref={(el) => { reasonRefs.current[r] = el; }}
                          onClick={() => setReason(r)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                          style={{
                            borderColor: active ? BUCKS_COLOR : "#e5e7eb",
                            background: active ? `${BUCKS_COLOR}15` : "#fff",
                            color: active ? BUCKS_COLOR : "#475569",
                            transform: reasonHighlight === r ? "scale(0.96)" : "scale(1)",
                          }}
                          data-testid={`button-reason-${r.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  ref={sendRef}
                  onClick={() => setRewardStep(2)}
                  className="mt-1 w-full py-2.5 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: BUCKS_COLOR,
                    transform: sendHighlight ? "scale(0.97)" : "scale(1)",
                    boxShadow: sendHighlight ? `0 0 0 4px ${BUCKS_COLOR}33` : "none",
                  }}
                  data-testid="button-send-reward"
                >
                  <Send className="h-4 w-4" />
                  Send Reward
                </button>
              </div>
            )}

            {rewardStep === 2 && (
              <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}20` }}>
                  <CheckCircle2 className="h-7 w-7" style={{ color: BUCKS_COLOR }} />
                </div>
                <div>
                  <p className="font-black text-base" style={{ color: NAVY }}>Sent!</p>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[220px]">
                    Sarah K. earned <span className="font-bold" style={{ color: BUCKS_COLOR }}>100 Bucks</span> for {reason.toLowerCase()}.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── GOALS SCENE ────────────────────────────────────────── */}
        {scene === "goals" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5" style={{ color: NAVY }} />
              <p className="font-bold text-xs" style={{ color: NAVY }}>Active team goals</p>
            </div>

            {GOALS.map((g, idx) => {
              const isLive = idx === 0;
              const pct = isLive ? goalProgress : g.progress;
              return (
                <div key={g.title} className="rounded-lg border border-gray-100 p-3" style={{ background: "#F8FAFC" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-xs" style={{ color: NAVY }}>{g.title}</p>
                      <p className="text-[10px] text-gray-500">{g.dept}</p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        background: pct >= 100 ? `${BUCKS_COLOR}20` : "#e5e7eb",
                        color: pct >= 100 ? BUCKS_COLOR : "#475569",
                      }}
                    >
                      {pct >= 100 ? "Complete" : `${pct}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: BUCKS_COLOR,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {!goalDistributed ? (
              <button
                ref={goalCompleteRef}
                onClick={() => setGoalDistributed(true)}
                disabled={goalProgress < 100}
                className="mt-1 w-full py-2.5 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{
                  background: BUCKS_COLOR,
                  transform: goalCompleteHighlight ? "scale(0.97)" : "scale(1)",
                  boxShadow: goalCompleteHighlight ? `0 0 0 4px ${BUCKS_COLOR}33` : "none",
                }}
                data-testid="button-distribute-goal"
              >
                <Coins className="h-4 w-4" />
                Distribute 50 Bucks to each
              </button>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: `${BUCKS_COLOR}15` }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: BUCKS_COLOR }} />
                <p className="text-xs font-semibold" style={{ color: BUCKS_COLOR }}>
                  12 employees received 50 Bucks each
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STORE SCENE ────────────────────────────────────────── */}
        {scene === "store" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5" style={{ color: NAVY }} />
                <p className="font-bold text-xs" style={{ color: NAVY }}>Spend your Bucks</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${BUCKS_COLOR}20`, color: BUCKS_COLOR }}>
                Balance: 1,240
              </span>
            </div>

            {!storeRedeemed ? (
              <div className="grid grid-cols-3 gap-2">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.name}
                    ref={(el) => { productRefs.current[p.name] = el; }}
                    onClick={() => setStoreRedeemed(true)}
                    className="rounded-lg border p-2 flex flex-col items-center gap-1 text-center transition-all"
                    style={{
                      borderColor: storePickHighlight === p.name ? BUCKS_COLOR : "#f3f4f6",
                      background: storePickHighlight === p.name ? `${BUCKS_COLOR}10` : "#fff",
                      transform: storePickHighlight === p.name ? "scale(0.97)" : "scale(1)",
                    }}
                    data-testid={`button-product-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <div className="text-2xl">{p.emoji}</div>
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: NAVY }}>{p.name}</p>
                    <p className="text-[10px] font-bold" style={{ color: BUCKS_COLOR }}>{p.price} B</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${BUCKS_COLOR}20` }}>
                  <CheckCircle2 className="h-7 w-7" style={{ color: BUCKS_COLOR }} />
                </div>
                <div>
                  <p className="font-black text-base" style={{ color: NAVY }}>Order placed!</p>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[240px]">
                    Gaming Headset · 350 Bucks · Ships in 3–5 days
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── POLL SCENE ─────────────────────────────────────────── */}
        {scene === "poll" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5" style={{ color: NAVY }} />
              <p className="font-bold text-xs" style={{ color: NAVY }}>Q3 Team Pulse Check</p>
            </div>
            <p className="text-xs font-semibold" style={{ color: NAVY }}>{POLL_QUESTION}</p>

            {!pollResults ? (
              <div className="flex flex-col gap-1.5">
                {POLL_OPTIONS.map((opt) => {
                  const active = pollPick === opt.label || pollPickHighlight === opt.label;
                  return (
                    <button
                      key={opt.label}
                      ref={(el) => { pollOptionRefs.current[opt.label] = el; }}
                      onClick={() => setPollPick(opt.label)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all"
                      style={{
                        borderColor: active ? BUCKS_COLOR : "#e5e7eb",
                        background: active ? `${BUCKS_COLOR}10` : "#fff",
                        color: NAVY,
                        fontWeight: active ? 600 : 400,
                        transform: pollPickHighlight === opt.label ? "scale(0.98)" : "scale(1)",
                      }}
                      data-testid={`button-poll-${opt.label.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{ borderColor: active ? BUCKS_COLOR : "#d1d5db" }}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: BUCKS_COLOR }} />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-wide font-bold text-gray-400">Live results · 47 responses</p>
                {POLL_OPTIONS.map((opt) => (
                  <div key={opt.label}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span style={{ color: NAVY, fontWeight: opt.label === pollPick ? 700 : 500 }}>{opt.label}</span>
                      <span className="font-bold" style={{ color: opt.label === pollPick ? BUCKS_COLOR : "#64748b" }}>{opt.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${opt.pct}%`,
                          background: opt.label === pollPick ? BUCKS_COLOR : "#cbd5e1",
                          transition: "width 0.7s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animated cursor overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-50"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${cursor.clicking ? 0.85 : 1})`,
          transition: "transform 1.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
          opacity: cursor.visible ? 1 : 0,
          willChange: "transform",
        }}
        data-testid="program-preview-cursor"
      >
        <div className="relative">
          <MousePointer2
            className="h-5 w-5"
            style={{
              color: NAVY,
              fill: "#fff",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
            }}
          />
          {cursor.clicking && (
            <span
              className="absolute -inset-2 rounded-full"
              style={{
                background: `${BUCKS_COLOR}40`,
                animation: "preview-click-pulse 0.4s ease-out",
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes preview-click-pulse {
          0%   { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>

    {/* Step caption — sits underneath the preview */}
    <div
      className="rounded-xl px-4 py-3 shadow-md"
      style={{
        background: NAVY,
        color: "white",
        opacity: caption ? 1 : 0,
        transform: caption ? "translateY(0)" : "translateY(-4px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        minHeight: 58,
      }}
      data-testid="program-preview-caption"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: BUCKS_COLOR }}
        />
        <span className="truncate">{caption?.text ?? "\u00A0"}</span>
      </div>
      {caption?.benefit && (
        <div
          className="text-xs font-medium mt-1 pl-4 leading-snug"
          style={{ color: "#a7c4f0" }}
          data-testid="program-preview-caption-benefit"
        >
          {caption.benefit}
        </div>
      )}
    </div>
    </div>
  );
}
export default function HowItWorksPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupNeeds, setSignupNeeds] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);

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
      const [userRes, demoRes] = await Promise.all([
        fetch("/api/user", { credentials: "include" }),
        fetch("/api/demo/status", { credentials: "include" }),
      ]);
      if (userRes.ok) queryClient.setQueryData(["/api/user"], await userRes.json());
      if (demoRes.ok) queryClient.setQueryData(["/api/demo/status"], await demoRes.json());
      setLocation("/admin/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDemoLoading(false);
    }
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupSubmitting(true);
    try {
      const res = await fetch("/api/info-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, phone: signupPhone, needs: signupNeeds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      toast({ title: "Request Sent!", description: data.message || "We'll be in touch shortly." });
      setSignupName("");
      setSignupEmail("");
      setSignupPhone("");
      setSignupNeeds("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSignupSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <PageSEO
        title="Better Bucks — Employee Recognition & Rewards Platform"
        description="Reward what's important — faster. Better Bucks helps managers recognize great work, reduce turnover, and replace spreadsheets with one simple incentive platform."
      />

      {/* ─── Top Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
            data-testid="button-home-logo"
          >
            <AppLogo size="sm" />
            <span className="font-bold text-base" style={{ color: NAVY }}>
              Better Bucks
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/blog")}
              data-testid="button-header-blog"
            >
              <BookOpen className="mr-1.5 h-4 w-4" />
              Blog
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-header-login"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              Log In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={startPublicDemo}
              disabled={demoLoading}
              className="border-2"
              data-testid="button-header-demo"
            >
              <Play className="mr-1.5 h-4 w-4" />
              {demoLoading ? "Loading..." : "Try Demo"}
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/signup")}
              data-testid="button-header-signup"
            >
              Sign Up
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>

          <div className="sm:hidden flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setLocation("/signup")}
              data-testid="button-header-signup-mobile"
            >
              Sign Up
            </Button>
            <div className="relative">
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
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { startPublicDemo(); setMobileMenuOpen(false); }}
                      data-testid="button-mobile-demo"
                    >
                      <Play className="h-4 w-4" />
                      Try Demo
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { setLocation("/blog"); setMobileMenuOpen(false); }}
                      data-testid="button-mobile-blog"
                    >
                      <BookOpen className="h-4 w-4" />
                      Blog
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { setLocation("/login"); setMobileMenuOpen(false); }}
                      data-testid="button-mobile-login"
                    >
                      <LogIn className="h-4 w-4" />
                      Log In
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Hero (split: text + signup left, program preview right) ──── */}
      <section className="relative overflow-hidden" style={{ background: "#F0F4F8" }} data-testid="section-hero">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 80% 30%, ${BUCKS_COLOR}18 0%, transparent 60%)` }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid gap-10 lg:gap-16 lg:grid-cols-2 items-center">
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 text-xs font-bold tracking-wide uppercase"
              style={{ background: `${BUCKS_COLOR}15`, color: BUCKS_COLOR }}
            >
              <Zap className="h-3 w-3" />
              Reward in seconds, not hours
            </div>
            <h1
              className="font-display font-black leading-tight"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: NAVY }}
              data-testid="text-hero-headline"
            >
              Reward what's Important —{" "}
              <span style={{ color: BUCKS_COLOR }}>Faster.</span>
            </h1>
            <p
              className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed"
              data-testid="text-hero-subheadline"
            >
              A simple platform that helps managers recognize performance, encourage good habits, and turn everyday wins into rewards your employees actually feel.
            </p>
            <div className="mt-8 flex flex-col items-center lg:items-start">
              <Button
                size="lg"
                onClick={() => setLocation("/signup")}
                className="text-base px-8 py-6 shadow-lg shadow-primary/25"
                data-testid="button-hero-signup"
              >
                Sign Up for Your Organization
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <ProgramPreview />
          </div>
        </div>
      </section>

      {/* ─── Benefits (3 cards) ───────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white border-t border-gray-100" data-testid="section-benefits">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="font-display font-black"
              style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: NAVY }}
              data-testid="text-benefits-heading"
            >
              Built for teams that need more than a spreadsheet.
            </h2>
            <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
              Everything you need to recognize great work, motivate your team, and keep your best people from walking out the door.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 flex flex-col"
                data-testid={`card-benefit-${title.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                  style={{ background: `${BUCKS_COLOR}15` }}
                >
                  <Icon className="h-6 w-6" style={{ color: BUCKS_COLOR }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
                  {title}
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Simplified ROI Calculator (replaces testimonials) ─── */}
      <section className="py-16 sm:py-20" style={{ background: "#F0F4F8" }} data-testid="section-calculator">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3"
              style={{ background: BUCKS_COLOR, color: "#fff" }}
            >
              See your ROI
            </span>
            <h2
              className="font-display font-black"
              style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", color: NAVY }}
              data-testid="text-calculator-heading"
            >
              How much could Better Bucks save you?
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Plug in your numbers. We'll show a conservative estimate of what structured incentives can save your business each year.
            </p>
          </div>
          <MiniCalculator />
        </div>
      </section>

      {/* ─── Bottom CTA + Sign-up ─────────────────────────────── */}
      <section className="py-16 sm:py-24" style={{ background: NAVY }} data-testid="section-cta">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid gap-10 lg:grid-cols-2 items-center">
          <div className="text-center lg:text-left">
            <h2
              className="font-display font-black text-white leading-tight"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)" }}
              data-testid="text-cta-headline"
            >
              Your team deserves better.
            </h2>
            <p className="mt-4 text-white/70 text-lg max-w-md mx-auto lg:mx-0">
              Launch a rewards program your employees will actually love — in minutes, not months.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 items-center justify-center lg:justify-start">
              <button
                onClick={() => setLocation("/signup")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-7 rounded-xl font-black text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: BUCKS_COLOR, color: "#fff" }}
                data-testid="button-cta-signup"
              >
                Build a Better Workplace Today
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleInfoSubmit}
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 space-y-4"
            data-testid="form-cta-signup"
          >
            <div>
              <h3 className="font-bold text-lg" style={{ color: NAVY }}>
                Talk to our team
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Tell us about your team and we'll reach out within one business day.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cta-name" className="text-xs font-semibold text-gray-600">Name</Label>
                <Input
                  id="cta-name"
                  required
                  placeholder="Jane Smith"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  data-testid="input-cta-name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cta-email" className="text-xs font-semibold text-gray-600">Work email</Label>
                <Input
                  id="cta-email"
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  data-testid="input-cta-email"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cta-phone" className="text-xs font-semibold text-gray-600">Phone</Label>
              <Input
                id="cta-phone"
                type="tel"
                required
                placeholder="(555) 123-4567"
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
                data-testid="input-cta-phone"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cta-needs" className="text-xs font-semibold text-gray-600">What are you trying to solve?</Label>
              <Textarea
                id="cta-needs"
                required
                rows={3}
                placeholder="e.g. We have ~120 warehouse employees and want to improve attendance and reduce turnover."
                value={signupNeeds}
                onChange={(e) => setSignupNeeds(e.target.value)}
                data-testid="input-cta-needs"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-base"
              disabled={signupSubmitting}
              data-testid="button-cta-submit"
            >
              <Send className="mr-2 h-4 w-4" />
              {signupSubmitting ? "Sending..." : "Request a Demo"}
            </Button>
          </form>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
