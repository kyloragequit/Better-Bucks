import { useState } from "react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, ExternalLink, Menu, X, LayoutDashboard, ShoppingCart, Store, Settings } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { PaymentPausedDialog } from "@/components/payment-paused-dialog";
import { useStoreUrl } from "@/hooks/use-store-url";

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const [location, setLocation] = useLocation();
  const { storeUrl } = useStoreUrl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location === path;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "link-dashboard" },
    { href: "/orders", label: "Orders", icon: ShoppingCart, testId: "link-orders" },
    { href: "/settings", label: "Settings", icon: Settings, testId: "link-settings" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-[999]">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-foreground cursor-pointer hover:opacity-80 transition-opacity">
            <AppLogo size="sm" linkTo="/dashboard" />
            <span className="hidden sm:inline">Better Bucks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${isActive(item.href) ? "text-primary font-bold" : "text-muted-foreground"}`}
                data-testid={item.testId}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary flex items-center gap-1"
              data-testid="link-promo-store-nav"
            >
              Store <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://www.instagram.com/better_bucks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-pink-500"
              data-testid="link-instagram-nav"
              title="@better_bucks on Instagram"
            >
              <SiInstagram className="h-4 w-4" />
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-sm text-muted-foreground">
              {user?.fullName}
            </span>
            <Button variant="ghost" size="icon" className="hidden md:inline-flex text-muted-foreground" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-5 w-5" />
            </Button>

            <div className="md:hidden relative">
              <Button
                variant="outline"
                size="sm"
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
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-link-promo-store"
                    >
                      <Store className="h-4 w-4" />
                      Store
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
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
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
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

      <main className="container max-w-5xl mx-auto px-4 py-8 animate-in">
        {children}
      </main>
      <PaymentPausedDialog />
    </div>
  );
}
