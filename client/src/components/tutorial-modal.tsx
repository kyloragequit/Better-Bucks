import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTutorial } from "@/hooks/use-tutorial";
import { useUser } from "@/hooks/use-auth";
import { AppLogo } from "@/components/app-logo";
import {
  Wallet, ShoppingBag, ShoppingCart, LayoutDashboard, Users, Zap,
  Settings, CheckCircle2, Package, Truck, Coins, Star, ChevronRight,
  ChevronLeft, X, TrendingUp, ClipboardCheck, Gamepad2, Tv, PersonStanding,
  ArrowRight, Gift, Heart,
} from "lucide-react";

const NAVY = "#162A4A";
const GREEN = "#4E9F3D";

const tutorialProducts = [
  { icon: Gamepad2, name: "Gaming Controller", price: 150, tag: "Popular", stars: 5 },
  { icon: Tv, name: 'Smart TV 55"', price: 450, tag: "Top Pick", stars: 4 },
  { icon: PersonStanding, name: "Action Figure", price: 75, tag: "New", stars: 5 },
];

function MiniShop({
  balance,
  onOrderComplete,
}: {
  balance: number;
  onOrderComplete: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [orderStep, setOrderStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleSelect = (i: number) => {
    setSelected(i);
    setOrderStep(1);
    setTimeout(() => setOrderStep(2), 1400);
    setTimeout(() => {
      setOrderStep(3);
      setCompleted(true);
      onOrderComplete();
    }, 2800);
  };

  const product = selected !== null ? tutorialProducts[selected] : null;
  const ProductIcon = product ? product.icon : Gamepad2;

  if (orderStep === 0) {
    return (
      <div className="space-y-3">
        <p className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pick something — give it a try!
        </p>
        <div className="grid grid-cols-3 gap-2">
          {tutorialProducts.map((p, i) => {
            const Icon = p.icon;
            const canAfford = balance >= p.price;
            return (
              <div
                key={p.name}
                className="rounded-xl border border-gray-100 p-3 flex flex-col items-center gap-2 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all duration-150 text-center"
                onClick={() => canAfford && handleSelect(i)}
                style={{ opacity: canAfford ? 1 : 0.5, cursor: canAfford ? "pointer" : "not-allowed" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${NAVY}12` }}>
                  <Icon className="h-5 w-5" style={{ color: NAVY }} />
                </div>
                <p className="text-xs font-bold leading-tight" style={{ color: NAVY }}>{p.name}</p>
                <span className="text-xs font-black" style={{ color: GREEN }}>{p.price} Bucks</span>
                <button
                  className="w-full py-1 rounded-lg text-xs font-semibold text-white"
                  style={{ background: canAfford ? GREEN : "#d1d5db" }}
                  disabled={!canAfford}
                >
                  Select
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (orderStep === 1) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${GREEN}33`, borderTopColor: GREEN }} />
        <p className="text-sm font-semibold text-gray-600">Processing order…</p>
      </div>
    );
  }

  if (orderStep === 2 || orderStep === 3) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" style={{ animation: "fadeUp 0.5s ease" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${GREEN}18` }}>
          <CheckCircle2 className="h-7 w-7" style={{ color: GREEN }} />
        </div>
        <p className="font-black text-lg" style={{ color: NAVY }}>Order Placed!</p>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Package className="h-3.5 w-3.5" />
          <span>{product?.name}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `${GREEN}18`, color: GREEN }}>
          <Truck className="h-3 w-3" />
          <span>Your manager will fulfill your request</span>
        </div>
        <p className="text-xs text-gray-400 max-w-xs">
          That's it! In the real app your Bucks are deducted and the order shows up in your Orders tab.
        </p>
      </div>
    );
  }

  return null;
}

type Slide = {
  id: string;
  title: string;
  subtitle?: string;
  body: React.ReactNode;
  requiresInteraction?: boolean;
};

function buildSlides(role: string, name: string): Slide[] {
  const firstName = name.split(" ")[0];

  const welcomeSlide: Slide = {
    id: "welcome",
    title: `Welcome, ${firstName}! 👋`,
    subtitle: role === "prime_admin"
      ? "You're the Prime Administrator"
      : role === "admin"
      ? "You're an Administrator"
      : "You're an Employee",
    body: (
      <div className="flex flex-col items-center gap-6">
        <AppLogo size="lg" />
        <p className="text-center text-gray-600 max-w-sm text-sm leading-relaxed">
          {role === "prime_admin"
            ? "You have full control over the Better Bucks platform — manage your team, curate the store, configure your organization, and track every Bucks transaction."
            : role === "admin"
            ? "You can manage employees, award Bucks for great work, approve orders, and keep your team motivated and recognized."
            : "Earn Bucks for great performance and redeem them in your company store for things you actually want. Let's take a quick tour!"}
        </p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {(role === "employee"
            ? [
                { icon: Wallet, label: "Earn Bucks", desc: "For performance" },
                { icon: ShoppingBag, label: "Shop", desc: "Spend your Bucks" },
                { icon: ShoppingCart, label: "Track Orders", desc: "See your items" },
              ]
            : role === "admin"
            ? [
                { icon: Users, label: "Manage Team", desc: "Add & view employees" },
                { icon: Coins, label: "Award Bucks", desc: "Recognize great work" },
                { icon: ClipboardCheck, label: "Fulfill Orders", desc: "Approve requests" },
              ]
            : [
                { icon: Users, label: "Team", desc: "Manage everyone" },
                { icon: ShoppingBag, label: "Store", desc: "Curate products" },
                { icon: Settings, label: "Settings", desc: "Full org control" },
              ]
          ).map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-gray-50 text-center">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}18` }}>
                <Icon className="h-4.5 w-4.5" style={{ color: GREEN }} />
              </div>
              <p className="text-xs font-bold" style={{ color: NAVY }}>{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  const dashboardSlide: Slide = {
    id: "dashboard",
    title: role === "employee" ? "Your Dashboard" : "Admin Dashboard",
    subtitle: role === "employee"
      ? "Your Bucks balance and recent activity — at a glance."
      : "Monitor Bucks activity, order volume, and team stats.",
    body: (
      <div className="space-y-3">
        <div className="rounded-xl border p-4" style={{ background: `${NAVY}08` }}>
          <p className="text-xs text-gray-500 mb-1">{role === "employee" ? "Your Balance" : "Bucks Awarded This Week"}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black" style={{ color: NAVY }}>{role === "employee" ? "850" : "2,340"}</span>
            <span className="text-lg text-gray-400 font-medium">Bucks</span>
          </div>
          {role !== "employee" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: GREEN }}>
              <TrendingUp className="h-3 w-3" />
              <span>+12% from last week</span>
            </div>
          )}
        </div>
        {role !== "employee" ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Pending Orders", value: "4", color: "#f59e0b" },
              { label: "Employees", value: "47", color: NAVY },
              { label: "Fulfilled Today", value: "8", color: GREEN },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border p-3 text-center bg-white">
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border p-3 bg-white">
            <p className="text-xs font-semibold text-gray-500 mb-2">Recent Transactions</p>
            {[
              { label: "Safety Compliance Award", amount: "+100", positive: true },
              { label: "Gaming Controller", amount: "-150", positive: false },
              { label: "Attendance Bonus", amount: "+50", positive: true },
            ].map(({ label, amount, positive }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs font-bold" style={{ color: positive ? GREEN : "#ef4444" }}>{amount}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 text-center">
          {role === "employee"
            ? "Your dashboard lives at the Dashboard tab — always start here!"
            : "Use filters to view by date range, department, or individual admin."}
        </p>
      </div>
    ),
  };

  const employeeSlides: Slide[] = [
    welcomeSlide,
    dashboardSlide,
    {
      id: "store",
      title: "The Employee Store",
      subtitle: "Browse items your admin has added. Spend your Bucks on what you actually want.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: NAVY }}>
              <span className="text-white font-bold text-sm flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" /> Store</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: GREEN, color: "white" }}>
                <Coins className="h-3 w-3" /> 850 Bucks
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50">
              {tutorialProducts.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div key={i} className="rounded-lg border bg-white p-2 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${NAVY}10` }}>
                      <Icon className="h-4 w-4" style={{ color: NAVY }} />
                    </div>
                    <p className="text-xs font-bold leading-tight" style={{ color: NAVY }}>{p.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} className="h-2 w-2" style={{ fill: si < p.stars ? "#f59e0b" : "none", color: si < p.stars ? "#f59e0b" : "#d1d5db" }} />
                      ))}
                    </div>
                    <span className="text-xs font-black" style={{ color: GREEN }}>{p.price} Bucks</span>
                    <div className="flex items-center gap-1 w-full">
                      <button className="flex-1 py-0.5 rounded text-xs font-semibold text-white" style={{ background: GREEN }}>Select</button>
                      <Heart className="h-3 w-3 text-gray-300 cursor-pointer" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Heart items to save them to your wishlist. Admins can see what you're wishing for!
          </p>
        </div>
      ),
    },
    {
      id: "try-store",
      title: "Try It Yourself!",
      subtitle: "Click Select on any item below. We'll walk you through the full order flow.",
      requiresInteraction: true,
      body: null,
    },
    {
      id: "orders",
      title: "Track Your Orders",
      subtitle: "Everything you've redeemed lives here. Your manager will update the status.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3" style={{ background: NAVY }}>
              <span className="text-white font-bold text-sm flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" /> My Orders</span>
            </div>
            <div className="divide-y bg-white">
              {[
                { name: "Gaming Controller", status: "Approved", color: GREEN, date: "Today" },
                { name: "Action Figure", status: "Pending", color: "#f59e0b", date: "Yesterday" },
                { name: "Gift Card $25", status: "Fulfilled", color: "#6b7280", date: "3 days ago" },
              ].map(({ name, status, color, date }) => (
                <div key={name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{name}</p>
                    <p className="text-xs text-gray-400">{date}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{status}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Orders move from Pending → Approved → Fulfilled as your manager processes them.
          </p>
        </div>
      ),
    },
    {
      id: "done",
      title: "You're All Set! 🎉",
      subtitle: "Start earning Bucks and spend them on what you love.",
      body: (
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${GREEN}18` }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: GREEN }} />
          </div>
          <div className="space-y-2 text-center max-w-xs">
            <p className="text-sm text-gray-600">Here's a quick cheat sheet:</p>
            {[
              { icon: LayoutDashboard, text: "Dashboard — Your Bucks balance & history" },
              { icon: ShoppingBag, text: "Store — Browse & redeem items" },
              { icon: ShoppingCart, text: "Orders — Track your redeemed items" },
              { icon: Settings, text: "Settings — Update your email & password" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-left">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NAVY}10` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
                </div>
                <p className="text-xs text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const adminSlides: Slide[] = [
    welcomeSlide,
    dashboardSlide,
    {
      id: "employees",
      title: "Manage Your Team",
      subtitle: "View, approve, and manage employees. Award Bucks directly from the employee list.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: NAVY }}>
              <span className="text-white font-bold text-sm flex items-center gap-1.5"><Users className="h-4 w-4" /> Employees</span>
              <button className="px-3 py-1 rounded text-xs font-semibold text-white" style={{ background: GREEN }}>+ Add Employee</button>
            </div>
            <div className="divide-y bg-white">
              {[
                { name: "Sarah Chen", code: "EMP-001", balance: 420, dept: "Warehouse" },
                { name: "Marcus Hill", code: "EMP-002", balance: 850, dept: "Logistics" },
                { name: "Priya Patel", code: "EMP-003", balance: 175, dept: "Shipping" },
              ].map(({ name, code, balance, dept }) => (
                <div key={name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{name}</p>
                    <p className="text-xs text-gray-400">{code} · {dept}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${GREEN}18`, color: GREEN }}>{balance} Bucks</span>
                    <button className="text-xs px-2 py-1 rounded border text-gray-600">Award</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Click Award to send Bucks instantly. Use the Instant Transaction tab for quick bulk awards.
          </p>
        </div>
      ),
    },
    {
      id: "orders",
      title: "Fulfill Employee Orders",
      subtitle: "When employees redeem items, their requests appear here for you to approve or reject.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3" style={{ background: NAVY }}>
              <span className="text-white font-bold text-sm flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Pending Orders</span>
            </div>
            <div className="divide-y bg-white">
              {[
                { employee: "Sarah Chen", item: "Gaming Controller", bucks: 150 },
                { employee: "Marcus Hill", item: 'Smart TV 55"', bucks: 450 },
              ].map(({ employee, item, bucks }) => (
                <div key={employee} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{item}</p>
                    <p className="text-xs text-gray-400">Requested by {employee} · {bucks} Bucks</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="text-xs px-2.5 py-1 rounded font-semibold text-white" style={{ background: GREEN }}>Approve</button>
                    <button className="text-xs px-2.5 py-1 rounded font-semibold border text-red-500 border-red-200">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Approved orders notify the employee. You can add fulfillment photos too.
          </p>
        </div>
      ),
    },
    {
      id: "instant-tx",
      title: "Instant Transaction",
      subtitle: "Award Bucks to employees in seconds — perfect for real-time recognition on the floor.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border p-4 bg-white space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Employee</p>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-gray-50">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Sarah Chen — EMP-001</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600">Amount</p>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  <span className="text-sm font-bold" style={{ color: GREEN }}>+ 100 Bucks</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600">Type</p>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  <span className="text-sm text-gray-500">Bonus Award</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Reason</p>
              <div className="border rounded-lg px-3 py-2 bg-gray-50">
                <span className="text-sm text-gray-400">Outstanding safety compliance this week</span>
              </div>
            </div>
            <button className="w-full py-2 rounded-lg text-sm font-bold text-white" style={{ background: GREEN }}>
              Award 100 Bucks
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Find this under the ⚡ Instant Transaction tab in the navigation.
          </p>
        </div>
      ),
    },
    {
      id: "done",
      title: "You're Ready to Lead! 🏆",
      subtitle: "Your team is counting on you. Here's a quick recap:",
      body: (
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${GREEN}18` }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: GREEN }} />
          </div>
          <div className="space-y-2 text-center max-w-xs w-full">
            {[
              { icon: LayoutDashboard, text: "Dashboard — Org-wide stats and charts" },
              { icon: Users, text: "Employees — Add, manage & award your team" },
              { icon: ShoppingCart, text: "Orders — Review and fulfill requests" },
              { icon: Zap, text: "Instant Transaction — Quick Bucks awards" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-left">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NAVY}10` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
                </div>
                <p className="text-xs text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const primeAdminExtraSlides: Slide[] = [
    {
      id: "store-creation",
      title: "Curate the Employee Store",
      subtitle: "You decide what employees can spend their Bucks on. Add, edit, or remove items anytime.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: NAVY }}>
              <span className="text-white font-bold text-sm flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" /> Employee Store</span>
              <button className="px-3 py-1 rounded text-xs font-semibold text-white" style={{ background: GREEN }}>+ Add Item</button>
            </div>
            <div className="p-4 bg-gray-50 space-y-3">
              <div className="rounded-lg border bg-white p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400">Item Name</p>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>Gaming Controller</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Price (Bucks)</p>
                    <p className="text-sm font-bold" style={{ color: GREEN }}>150 Bucks</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Product URL</p>
                  <p className="text-xs text-blue-500 truncate">amazon.com/gaming-controller...</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-1 rounded text-xs border text-gray-600">✏️ Edit</button>
                  <button className="flex-1 py-1 rounded text-xs border text-red-500 border-red-200">🗑 Delete</button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: GREEN }}>
            💡 Look for the "Need help?" button on the Store page for a detailed walkthrough!
          </p>
        </div>
      ),
    },
    {
      id: "settings",
      title: "Organization Settings",
      subtitle: "Configure your org code, billing plan, role labels, and more.",
      body: (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden bg-white">
            {[
              { label: "Org Name", value: "Acme Corp" },
              { label: "Org Code", value: "ACME1234 (share with employees to register)" },
              { label: "Plan", value: "Mid-Size · 300 employees max" },
              { label: "Role Labels", value: '"Bucks" → "Points" (customize anytime)' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <p className="text-xs font-semibold text-gray-500">{label}</p>
                <p className="text-xs text-right text-gray-700 max-w-[55%]">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">
            Settings are only visible to Prime Admins. Share the Org Code so your team can register.
          </p>
        </div>
      ),
    },
  ];

  if (role === "employee") return employeeSlides;

  const baseAdminSlides = adminSlides.slice(0, -1);
  if (role === "prime_admin") {
    return [
      ...baseAdminSlides,
      ...primeAdminExtraSlides,
      {
        id: "done",
        title: "You're the Prime Admin! 👑",
        subtitle: "Full control. Let's make your team's day.",
        body: (
          <div className="flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${GREEN}18` }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: GREEN }} />
            </div>
            <div className="space-y-2 text-center max-w-xs w-full">
              {[
                { icon: LayoutDashboard, text: "Dashboard — Full platform analytics" },
                { icon: Users, text: "Employees — Add, manage & award your team" },
                { icon: ShoppingCart, text: "Orders — Approve and fulfill requests" },
                { icon: Zap, text: "Instant Transaction — Quick awards" },
                { icon: ShoppingBag, text: "Store — Curate what employees can redeem" },
                { icon: Settings, text: "Settings — Org config, billing & labels" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NAVY}10` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
                  </div>
                  <p className="text-xs text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ];
  }

  return adminSlides;
}

export function TutorialModal() {
  const { data: user } = useUser();
  const { shouldShow, completeTutorial, skipTutorial } = useTutorial();
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [shopDone, setShopDone] = useState(false);
  const [shopBalance] = useState(850);

  if (!shouldShow || !user) return null;

  const slides = buildSlides(user.role, user.fullName || "there");
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;
  const isTrySlide = slide.id === "try-store";
  const canAdvance = !slide.requiresInteraction || shopDone;

  const handleNext = () => {
    if (isLast) {
      completeTutorial();
      if (user.role === "employee") setLocation("/dashboard");
      else if (user.role === "prime_admin") setLocation("/admin/dashboard");
      else setLocation("/admin/dashboard");
    } else {
      setCurrentSlide(s => s + 1);
    }
  };

  const handlePrev = () => { if (currentSlide > 0) setCurrentSlide(s => s - 1); };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(22,42,74,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ background: NAVY }}>
          <div className="flex items-center gap-2">
            <AppLogo size="sm" />
            <span className="text-white font-bold text-sm">Better Bucks</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: `${GREEN}40`, color: "white" }}>
              {user.role.replace("_", " ")}
            </span>
          </div>
          <button
            onClick={skipTutorial}
            className="text-white/50 hover:text-white transition-colors"
            data-testid="button-tutorial-skip"
            title="Skip tutorial"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-3 border-b bg-gray-50 shrink-0">
          {slides.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                background: i === currentSlide ? GREEN : i < currentSlide ? `${GREEN}60` : "#e5e7eb",
              }}
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-black font-display" style={{ color: NAVY }}>{slide.title}</h2>
            {slide.subtitle && <p className="text-sm text-gray-500 mt-1">{slide.subtitle}</p>}
          </div>

          {isTrySlide ? (
            <MiniShop balance={shopBalance} onOrderComplete={() => setShopDone(true)} />
          ) : (
            slide.body
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-0 transition-colors"
            data-testid="button-tutorial-prev"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <span className="text-xs text-gray-400">{currentSlide + 1} of {slides.length}</span>

          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-40"
            style={{ background: GREEN }}
            data-testid="button-tutorial-next"
          >
            {isLast ? "Let's Go!" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
            {isLast && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
