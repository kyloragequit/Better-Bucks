import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { LogOut, Settings, ArrowLeft, Code2, Zap, Menu, LayoutDashboard, Users, ShoppingCart, X, Eye, Home, User, MessageCircle, Store as StoreIcon, Gift, CreditCard } from "lucide-react";
import { MobileBottomNav, type MobileNavItem } from "@/components/mobile-bottom-nav";
import { SiInstagram } from "react-icons/si";
import { AppLogo } from "@/components/app-logo";
import { PaymentPausedDialog } from "@/components/payment-paused-dialog";
import { NeedHelpButton } from "@/components/need-help-button";
import { AddToHomescreenButton } from "@/components/add-to-homescreen";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DemoBanner } from "@/components/demo-banner";
import { useToast } from "@/hooks/use-toast";

function ImpersonationBanner() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: impersonating } = useQuery<{ impersonating: boolean }>({
    queryKey: ["/api/developer/status"],
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/developer/return", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to return");
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/developer/dashboard";
    },
  });

  if (!impersonating?.impersonating) return null;

  return (
    <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <Code2 className="h-4 w-4 text-secondary" />
      <span>Developer Mode: Viewing as organization</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800 text-xs"
        onClick={() => returnMutation.mutate()}
        disabled={returnMutation.isPending}
        data-testid="button-return-developer"
      >
        <ArrowLeft className="mr-1 h-3 w-3" />
        Return to Developer
      </Button>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: devStatus } = useQuery<{ impersonating: boolean }>({
    queryKey: ["/api/developer/status"],
  });
  const { data: demoStatus } = useQuery<{ inDemo: boolean; isPublicDemo: boolean }>({
    queryKey: ["/api/demo/status"],
  });
  const isImpersonating = devStatus?.impersonating === true;
  const isInDemo = demoStatus?.inDemo === true;
  const isPublicDemo = demoStatus?.isPublicDemo === true;

  const { data: pendingCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/orders/pending-count"],
    refetchInterval: 30_000,
    enabled: user?.role === "admin" || user?.role === "prime_admin",
  });
  const pendingCount = pendingCountData?.count ?? 0;

  const startDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo/start", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to start demo" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demo/status"] });
      toast({ title: "Full Service View Mode active", description: "Use the green bar to switch accounts." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart, badge: pendingCount },
    { href: "/admin/store", label: "Store", icon: StoreIcon },
    { href: "/admin/instant-transaction", label: "Instant Transaction", shortLabel: "Quick TX", icon: Zap, testId: "link-instant-transaction" },
    { href: "/admin/reward-items", label: "Reward Items", icon: Gift },
    ...(user?.role === "prime_admin" ? [
      { href: "/admin/subscription", label: "Subscription", icon: CreditCard },
      { href: "/admin/settings", label: "Organization settings", icon: Settings },
    ] : []),
  ];

  const mobileNavItems = navItems.map(item =>
    item.href === "/admin/instant-transaction" ? { ...item, label: "NFC Tools" } : item
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <ImpersonationBanner />
      <DemoBanner />
      <header className="sticky top-0 z-[999] w-full border-b border-white/10 bg-primary pt-safe pl-safe pr-safe">
        <div className="container flex min-h-16 items-center justify-between gap-4 px-4 py-2">
          <Link href="/admin/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-white cursor-pointer hover:opacity-80 transition-opacity no-underline">
            <AppLogo size="sm" linkTo="/admin/dashboard" />
            <span className="hidden sm:inline">Better Bucks</span>
          </Link>

          <nav className="hidden sm:block">
            {(() => {
              const allItems = [
                ...navItems.filter(item => item.href !== "/admin/instant-transaction"),
                ...(user?.role === "admin" || user?.role === "prime_admin"
                  ? [{ href: "/admin/account-settings", label: "My Profile", icon: User }]
                  : []),
              ];
              const activeItem = allItems.find(item => isActive(item.href));
              return (
                <Select
                  value={activeItem?.href ?? ""}
                  onValueChange={(val) => setLocation(val)}
                >
                  <SelectTrigger
                    className="w-auto min-w-48 max-w-64 bg-white/10 border-white/20 text-white hover:bg-white/15 focus:ring-white/30 focus:ring-offset-0 [&>svg]:text-white/70"
                    data-testid="select-admin-nav"
                  >
                    <SelectValue>
                      {activeItem ? (
                        <span className="flex items-center gap-2">
                          <activeItem.icon className="h-4 w-4 shrink-0" />
                          {activeItem.label}
                          {activeItem.href === "/admin/orders" && pendingCount > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none" data-testid="badge-pending-orders-trigger">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-white/60">Navigate…</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-48">
                    {allItems.map((item) => {
                      const Icon = item.icon;
                      const itemBadge = (item as any).badge as number | undefined;
                      return (
                        <SelectItem
                          key={item.href}
                          value={item.href}
                          data-testid={(item as any).testId || `nav-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {item.label}
                            {(itemBadge ?? 0) > 0 && (
                              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none" data-testid="badge-pending-orders-dropdown">
                                {itemBadge! > 99 ? "99+" : itemBadge}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              );
            })()}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-sm text-white/60">
              Hello, {user?.fullName}
            </span>
            <NeedHelpButton />
            {user?.role === "prime_admin" && !isInDemo && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden sm:inline-flex text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => startDemoMutation.mutate()}
                      disabled={startDemoMutation.isPending}
                      aria-label="Start full service view mode"
                      data-testid="button-start-demo"
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Full Service View Mode</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isPublicDemo ? (
                    <Button variant="ghost" size="icon" aria-label="Home" className="hidden sm:inline-flex text-white/70 hover:text-white hover:bg-white/10" onClick={() => { try { sessionStorage.removeItem("bb_demo_visitor"); } catch {} setLocation("/"); }} data-testid="button-home">
                      <Home className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" aria-label="Log out" className="hidden sm:inline-flex text-white/70 hover:text-white hover:bg-white/10" onClick={() => logout()} data-testid="button-logout">
                      <LogOut className="h-5 w-5" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">{isPublicDemo ? "Back to Home" : "Log Out"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="sm:hidden">
              <AddToHomescreenButton />
            </span>

            <div className="sm:hidden relative">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                data-testid="button-admin-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border z-50 flex flex-col" style={{ maxHeight: "min(80dvh, 560px)" }}>
                    {/* Scrollable nav list */}
                    <div className="overflow-y-auto flex-1 py-1">
                      {mobileNavItems.map((item) => {
                        const Icon = item.icon;
                        const itemBadge = (item as any).badge as number | undefined;
                        return (
                          <button type="button"
                            key={item.href}
                            className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm transition-colors ${
                              isActive(item.href) ? "text-primary font-semibold bg-primary/5" : "text-gray-700 hover:bg-gray-100"
                            }`}
                            onClick={() => { setLocation(item.href); setMobileMenuOpen(false); }}
                            data-testid={`mobile-${(item as any).testId || `link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {(itemBadge ?? 0) > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none" data-testid="badge-pending-orders-hamburger">
                                {itemBadge! > 99 ? "99+" : itemBadge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {(user?.role === "admin" || user?.role === "prime_admin") ? (
                        <button type="button"
                          className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm transition-colors ${
                            isActive("/admin/account-settings") ? "text-primary font-semibold bg-primary/5" : "text-gray-700 hover:bg-gray-100"
                          }`}
                          onClick={() => { setLocation("/admin/account-settings"); setMobileMenuOpen(false); }}
                          data-testid="mobile-link-account-settings"
                        >
                          <User className="h-4 w-4 shrink-0" />
                          My Profile
                        </button>
                      ) : (
                        <a
                          href="https://www.instagram.com/better_bucks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid="mobile-link-instagram-admin"
                        >
                          <SiInstagram className="h-4 w-4 text-pink-500 shrink-0" />
                          @better_bucks
                        </a>
                      )}
                      <button type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setTimeout(() => {
                            const btn = document.querySelector('[data-testid="button-need-help"]') as HTMLButtonElement;
                            btn?.click();
                          }, 100);
                        }}
                        data-testid="mobile-button-need-help"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        Need Help?
                      </button>
                    </div>
                    {/* Pinned footer: always visible */}
                    <div className="border-t shrink-0">
                      {isPublicDemo ? (
                        <button type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => { try { sessionStorage.removeItem("bb_demo_visitor"); } catch {} setLocation("/"); setMobileMenuOpen(false); }}
                          data-testid="mobile-button-home"
                        >
                          <Home className="h-4 w-4 shrink-0" />
                          Back to Home
                        </button>
                      ) : (
                        <button type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-red-600 hover:bg-red-50 font-medium"
                          onClick={() => { logout(); setMobileMenuOpen(false); }}
                          data-testid="mobile-button-logout"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          Log Out
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 pb-[calc(var(--bb-bottom-nav-h)+env(safe-area-inset-bottom)+1rem)] sm:pb-8 pl-safe pr-safe animate-in">
        {children}
      </main>
      <SiteFooter />
      <PaymentPausedDialog />
      <MobileBottomNav
        items={[
          { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "link-dashboard" },
          { href: "/admin/employees", label: "Employees", icon: Users, testId: "link-employees" },
          { href: "/admin/orders", label: "Orders", icon: ShoppingCart, testId: "link-orders", badge: pendingCount },
          {
            href: user?.role === "prime_admin" ? "/admin/settings" : "/admin/account-settings",
            label: "Org settings",
            icon: Settings,
            testId: "link-settings",
          },
        ] as MobileNavItem[]}
      />
    </div>
  );
}
