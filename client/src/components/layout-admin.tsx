import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { LogOut, Settings, ArrowLeft, Code2, Zap, Menu, LayoutDashboard, Users, ShoppingCart, ClipboardCheck, X, ShoppingBag, Eye, Target } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { AppLogo } from "@/components/app-logo";
import { PaymentPausedDialog } from "@/components/payment-paused-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const { data: demoStatus } = useQuery<{ inDemo: boolean }>({
    queryKey: ["/api/demo/status"],
  });
  const isImpersonating = devStatus?.impersonating === true;
  const isInDemo = demoStatus?.inDemo === true;

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
      toast({ title: "Demo Mode active", description: "Use the green bar to switch accounts." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/instant-transaction", label: "Instant Transaction", shortLabel: "Quick TX", icon: Zap, testId: "link-instant-transaction" },
    { href: "/admin/goals", label: "Goals", icon: Target },
    ...(user?.role === "prime_admin" ? [
      { href: "/admin/pending", label: "Pending Approvals", icon: ClipboardCheck },
      { href: "/admin/store", label: "Store", icon: ShoppingBag },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <ImpersonationBanner />
      <DemoBanner />
      <header className="sticky top-0 z-[999] w-full border-b border-white/10 bg-primary">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-white cursor-pointer hover:opacity-80 transition-opacity no-underline">
            <AppLogo size="sm" linkTo="/admin/dashboard" />
            <span className="hidden sm:inline">Better Bucks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <TooltipProvider delayDuration={200}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={`inline-flex items-center justify-center rounded-md p-2.5 transition-colors ${
                          isActive(item.href)
                            ? "bg-white/15 text-white"
                            : "text-white/65 hover:bg-white/10 hover:text-white"
                        }`}
                        data-testid={item.testId || `link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {user?.role === "admin" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/admin/account-settings"
                      className={`inline-flex items-center justify-center rounded-md p-2.5 transition-colors ${
                        isActive("/admin/account-settings")
                          ? "bg-white/15 text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                      data-testid="link-account-settings"
                    >
                      <Settings className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Account Settings</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://www.instagram.com/better_bucks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md p-2.5 transition-colors text-white/65 hover:bg-white/10 hover:text-pink-300"
                      data-testid="link-instagram-admin-nav"
                    >
                      <SiInstagram className="h-5 w-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">@better_bucks</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-sm text-white/60">
              Hello, {user?.fullName}
            </span>
            {user?.role === "prime_admin" && !isInDemo && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:inline-flex text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => startDemoMutation.mutate()}
                      disabled={startDemoMutation.isPending}
                      data-testid="button-start-demo"
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Start Demo Mode</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden md:inline-flex text-white/70 hover:text-white hover:bg-white/10" onClick={() => logout()} data-testid="button-logout">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Log Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="md:hidden relative">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-admin-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-lg shadow-lg border py-1 z-50">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive(item.href) ? "text-primary font-semibold bg-primary/5" : "text-gray-700 hover:bg-gray-100"
                          }`}
                          onClick={() => { setLocation(item.href); setMobileMenuOpen(false); }}
                          data-testid={`mobile-${item.testId || `link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                    {user?.role === "admin" ? (
                      <button
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive("/admin/account-settings") ? "text-primary font-semibold bg-primary/5" : "text-gray-700 hover:bg-gray-100"
                        }`}
                        onClick={() => { setLocation("/admin/account-settings"); setMobileMenuOpen(false); }}
                        data-testid="mobile-link-account-settings"
                      >
                        <Settings className="h-4 w-4" />
                        Account Settings
                      </button>
                    ) : (
                      <a
                        href="https://www.instagram.com/better_bucks"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="mobile-link-instagram-admin"
                      >
                        <SiInstagram className="h-4 w-4 text-pink-500" />
                        @better_bucks
                      </a>
                    )}
                    <div className="border-t my-1" />
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      data-testid="mobile-button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 animate-in">
        {children}
      </main>
      <SiteFooter />
      <PaymentPausedDialog />
    </div>
  );
}
