import { useState } from "react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { LogOut, Menu, X, LayoutDashboard, ShoppingCart, Store, User, Home, ClipboardList, HelpCircle } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { PaymentPausedDialog } from "@/components/payment-paused-dialog";
import { NeedHelpButton } from "@/components/need-help-button";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/components/demo-banner";

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: features } = useQuery<{ storeEnabled: boolean; manualOrdersEnabled: boolean; ordersEnabled: boolean }>({
    queryKey: ["/api/organizations/features"],
    enabled: !!user,
  });
  const { data: demoStatus } = useQuery<{ inDemo: boolean; isPublicDemo: boolean }>({
    queryKey: ["/api/demo/status"],
  });
  const isPublicDemo = demoStatus?.isPublicDemo === true;

  const isActive = (path: string) => location === path;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "link-dashboard" },
    ...(features?.storeEnabled !== false ? [{ href: "/store", label: "Store", icon: Store, testId: "link-store" }] : []),
    ...(features?.ordersEnabled !== false ? [{ href: "/orders", label: "Orders", icon: ShoppingCart, testId: "link-orders" }] : []),
    { href: "/surveys", label: "Surveys", icon: ClipboardList, testId: "link-surveys" },
    { href: "/settings", label: "Profile", icon: User, testId: "link-settings" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <DemoBanner />
      <header className="border-b border-white/10 bg-primary sticky top-0 z-[999]">
        <div className="container max-w-5xl mx-auto px-4 min-h-16 flex items-center justify-between gap-4 py-2">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-white cursor-pointer hover:opacity-80 transition-opacity">
            <AppLogo size="sm" linkTo="/dashboard" />
            <span className="hidden sm:inline">Better Bucks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
                data-testid={item.testId}
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://www.instagram.com/better_bucks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md p-2 transition-colors text-white/65 hover:bg-white/10 hover:text-pink-300"
              data-testid="link-instagram-nav"
              title="@better_bucks on Instagram"
            >
              <SiInstagram className="h-4 w-4" />
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-sm text-white/60">
              {user?.fullName}
            </span>
            <NeedHelpButton />
            {isPublicDemo ? (
              <Button variant="ghost" size="icon" className="hidden md:inline-flex text-white/70 hover:text-white hover:bg-white/10" onClick={() => { try { sessionStorage.removeItem("bb_demo_visitor"); } catch {} setLocation("/"); }} data-testid="button-home">
                <Home className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="hidden md:inline-flex text-white/70 hover:text-white hover:bg-white/10" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="h-5 w-5" />
              </Button>
            )}

            <div className="md:hidden relative">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-employee-mobile-menu"
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
                          data-testid={`mobile-${item.testId}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                    <a
                      href="https://www.instagram.com/better_bucks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-link-instagram"
                    >
                      <SiInstagram className="h-4 w-4 text-pink-500" />
                      @better_bucks
                    </a>
                    <div className="border-t my-1" />
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setTimeout(() => {
                          const btn = document.querySelector('[data-testid="button-need-help"]') as HTMLButtonElement;
                          btn?.click();
                        }, 100);
                      }}
                      data-testid="mobile-button-need-help"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Need Help?
                    </button>
                    {isPublicDemo ? (
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => { try { sessionStorage.removeItem("bb_demo_visitor"); } catch {} setLocation("/"); setMobileMenuOpen(false); }}
                        data-testid="mobile-button-home"
                      >
                        <Home className="h-4 w-4" />
                        Back to Home
                      </button>
                    ) : (
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => { logout(); setMobileMenuOpen(false); }}
                        data-testid="mobile-button-logout"
                      >
                        <LogOut className="h-4 w-4" />
                        Log Out
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 animate-in">
        {children}
      </main>
      <SiteFooter />
      <PaymentPausedDialog />
    </div>
  );
}
